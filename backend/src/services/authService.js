import { generateToken, generateRefreshToken } from '../config/jwt.js';
import { hashPassword, comparePassword, generateUserId } from '../utils/helpers.js';
import { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail } from '../config/email.js';
import { v4 as uuidv4 } from 'uuid';
import User from '../models/User.js';
import Patient from '../models/Patient.js';
import Doctor from '../models/Doctor.js';
import VerificationToken from '../models/VerificationToken.js';
import PasswordResetToken from '../models/PasswordResetToken.js';

const normalizeBloodType = (value) => {
  if (!value) return undefined;
  const upper = value.toUpperCase();
  const map = {
    A_POSITIVE: 'A+',
    A_NEGATIVE: 'A-',
    B_POSITIVE: 'B+',
    B_NEGATIVE: 'B-',
    AB_POSITIVE: 'AB+',
    AB_NEGATIVE: 'AB-',
    O_POSITIVE: 'O+',
    O_NEGATIVE: 'O-',
  };
  return map[upper] || upper;
};

const createVerificationToken = async (userId) => {
  await VerificationToken.deleteMany({ user_id: userId });
  const token = uuidv4();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // 24-hour expiry
  const verification = new VerificationToken({
    token,
    user_id: userId,
    expires_at: expiresAt,
  });
  await verification.save();
  return token;
};

export const registerPatient = async (userData) => {
  const {
    firstName,
    lastName,
    email,
    password,
    dateOfBirth,
    address,
    phoneNumber,
    gender,
    bloodType,
    emergencyContactName,
    emergencyContactPhone,
    emergencyContactEmail,
    emergencyContactRelationship
  } = userData;

  // Check if email already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    // Block reuse if email belongs to another role
    if (existingUser.role !== 'PATIENT') {
      const err = new Error('Email already registered');
      err.statusCode = 409;
      throw err;
    }

    // If the patient exists but is not verified, reset profile and resend verification
    if (!existingUser.is_verified) {
      const passwordHash = await hashPassword(password);

      existingUser.full_name = `${firstName} ${lastName}`;
      existingUser.password_hash = passwordHash;
      existingUser.phone = phoneNumber;
      existingUser.date_of_birth = dateOfBirth ? new Date(dateOfBirth) : undefined;
      existingUser.gender = gender?.toUpperCase();
      existingUser.blood_type = normalizeBloodType(bloodType);
      existingUser.address = address;
      existingUser.is_active = true;
      existingUser.is_verified = false;
      await existingUser.save();

      await Patient.findOneAndUpdate(
        { user_id: existingUser._id },
        {},
        { upsert: true }
      );

      try {
        const token = await createVerificationToken(existingUser._id);
        await sendVerificationEmail(email, token);
      } catch (err) {
        console.error('Failed to resend verification email:', err?.message || err);
      }

      existingUser.password_hash = undefined;
      return existingUser;
    }

    const err = new Error('Email already registered');
    err.statusCode = 409;
    throw err;
  }

  // Hash password
  const passwordHash = await hashPassword(password);
  const userId = generateUserId('PATIENT');

  // Create user
  const user = new User({
    user_id: userId,
    full_name: `${firstName} ${lastName}`,
    email,
    role: 'PATIENT',
    password_hash: passwordHash,
    phone: phoneNumber,
    date_of_birth: dateOfBirth ? new Date(dateOfBirth) : undefined,
    gender: gender?.toUpperCase(),
    blood_type: normalizeBloodType(bloodType),
    address,
    is_active: true,
    is_verified: false,
    emergency_contact_name: emergencyContactName,
    emergency_contact_phone: emergencyContactPhone,
    emergency_contact_email: emergencyContactEmail,
    emergency_contact_relationship: emergencyContactRelationship,
  });
  await user.save();

  // Create patient record with reference to user ObjectId
  const patient = new Patient({ user_id: user._id });
  await patient.save();

  // Create verification token and send verification email (non-blocking)
  try {
    const token = await createVerificationToken(user._id);
    await sendVerificationEmail(email, token);
  } catch (err) {
    console.error('Failed to send verification email:', err?.message || err);
  }

  // Remove password hash before returning
  user.password_hash = undefined;
  return user;
};

export const registerDoctor = async (userData) => {
  const {
    firstName,
    lastName,
    email,
    password,
    dateOfBirth,
    address,
    phoneNumber,
    gender,
    bloodType,
    licenseNumber,
    specialization,
    qualifications,
    yearsOfExperience,
    emergencyContactName,
    emergencyContactPhone,
    emergencyContactEmail,
    emergencyContactRelationship
  } = userData;

  // Check if email already exists
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    // If the email belongs to a non-doctor account, block re-registration
    if (existingUser.role !== 'DOCTOR') {
      const err = new Error('Email already registered');
      err.statusCode = 409;
      throw err;
    }

    // Try to find the doctor profile linked to this user
    let existingDoctorProfile = await Doctor.findOne({ user_id: existingUser._id });

    // If no doctor profile exists for this doctor user, treat as new application path
    if (!existingDoctorProfile) {
      // Ensure license number is unique
      const licenseConflict = await Doctor.findOne({ license_number: licenseNumber });
      if (licenseConflict) {
        const err = new Error('License number already registered');
        err.statusCode = 409;
        throw err;
      }

      const passwordHash = await hashPassword(password);
      await User.findByIdAndUpdate(existingUser._id, {
        full_name: `${firstName} ${lastName}`,
        phone: phoneNumber,
        password_hash: passwordHash,
        is_active: false,
        is_verified: false,
      });

      const doctor = new Doctor({
        user_id: existingUser._id,
        license_number: licenseNumber,
        specialization,
        qualifications,
        years_of_experience: yearsOfExperience,
        application_status: 'PENDING',
      });
      await doctor.save();

      const user = await User.findById(existingUser._id).lean();
      if (user) user.password_hash = undefined;
      return user;
    }

    // Handle based on current application status
    if (existingDoctorProfile.application_status === 'PENDING') {
      const err = new Error('Your application is already pending. You will be notified shortly.');
      err.statusCode = 409;
      throw err;
    }

    if (existingDoctorProfile.application_status === 'APPROVED') {
      const err = new Error('Email already registered');
      err.statusCode = 409;
      throw err;
    }

    // If REJECTED, renew the application with updated details
    if (existingDoctorProfile.application_status === 'REJECTED') {
      // Check license uniqueness: allow if same doctor, block if another doctor owns it
      const licenseOwner = await Doctor.findOne({ license_number: licenseNumber });
      if (licenseOwner && licenseOwner._id.toString() !== existingDoctorProfile._id.toString()) {
        const err = new Error('License number already registered');
        err.statusCode = 409;
        throw err;
      }

      const passwordHash = await hashPassword(password);

      // Update user info and reset access flags
      await User.findByIdAndUpdate(existingUser._id, {
        full_name: `${firstName} ${lastName}`,
        phone: phoneNumber,
        password_hash: passwordHash,
        is_active: false,
        is_verified: false,
      });

      // Update doctor profile and set status back to PENDING
      await Doctor.findByIdAndUpdate(existingDoctorProfile._id, {
        license_number: licenseNumber,
        specialization,
        qualifications,
        years_of_experience: yearsOfExperience,
        application_status: 'PENDING',
        rejection_reason: undefined,
        rejected_at: undefined,
        approved_at: undefined,
      });

      const user = await User.findById(existingUser._id).lean();
      if (user) user.password_hash = undefined;
      return user;
    }
  }

  // New doctor application path (no existing user)
  // Check if license number already exists
  const existingDoctor = await Doctor.findOne({ license_number: licenseNumber });
  if (existingDoctor) {
    const err = new Error('License number already registered');
    err.statusCode = 409;
    throw err;
  }

  // Hash password
  const passwordHash = await hashPassword(password);
  const userId = generateUserId('DOCTOR');

  // Create user
  const user = new User({
    user_id: userId,
    full_name: `${firstName} ${lastName}`,
    email,
    role: 'DOCTOR',
    password_hash: passwordHash,
    phone: phoneNumber,
    is_active: false, // Doctors need admin approval
    is_verified: false,
    emergency_contact_name: emergencyContactName,
    emergency_contact_phone: emergencyContactPhone,
    emergency_contact_email: emergencyContactEmail,
    emergency_contact_relationship: emergencyContactRelationship,
  });
  await user.save();

  // Create doctor record with reference to user ObjectId
  const doctor = new Doctor({
    user_id: user._id,
    license_number: licenseNumber,
    specialization,
    qualifications,
    years_of_experience: yearsOfExperience,
    application_status: 'PENDING'
  });
  await doctor.save();

  user.password_hash = undefined;
  return user;
};

export const registerAdmin = async (userData) => {
  // Check if admin already exists
  const adminCount = await User.countDocuments({ role: 'ADMIN' });
  if (adminCount > 0) {
    throw new Error('Admin account already exists. Only one admin is allowed.');
  }

  const {
    firstName,
    lastName,
    email,
    password,
    dateOfBirth,
    phoneNumber,
    gender,
    bloodType,
    address,
    emergencyContactName,
    emergencyContactPhone,
    emergencyContactEmail,
    emergencyContactRelationship
  } = userData;

  // Check if email already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new Error('Email already registered');
  }

  // Hash password
  const passwordHash = await hashPassword(password);
  const userId = generateUserId('ADMIN');

  // Create user with all fields
  const user = new User({
    user_id: userId,
    full_name: `${firstName} ${lastName}`,
    email,
    role: 'ADMIN',
    password_hash: passwordHash,
    phone: phoneNumber,
    date_of_birth: dateOfBirth ? new Date(dateOfBirth) : undefined,
    gender: gender?.toUpperCase(),
    blood_type: normalizeBloodType(bloodType),
    address,
    is_active: true,
    is_verified: true,
    emergency_contact_name: emergencyContactName,
    emergency_contact_phone: emergencyContactPhone,
    emergency_contact_email: emergencyContactEmail,
    emergency_contact_relationship: emergencyContactRelationship,
  });
  await user.save();

  user.password_hash = undefined;
  return user;
};

export const login = async (email, password) => {
  // Get user
  const user = await User.findOne({ email });
  if (!user) {
    throw new Error('Invalid credentials');
  }

  // Block login until email is verified
  if (!user.is_verified) {
    const err = new Error('Please verify your email before logging in.');
    err.statusCode = 403;
    throw err;
  }

  // Verify password
  const isValidPassword = await comparePassword(password, user.password_hash);
  console.log("isValidPassowrd", isValidPassword);
  if (!isValidPassword) {
    throw new Error('Invalid credentials');
  }

  // Check if user is active
  if (!user.is_active) {
    throw new Error('Account is not active. Please contact administrator.');
  }

  // Generate tokens using MongoDB ObjectId
  const token = generateToken({ userId: user._id, email: user.email, role: user.role });
  const refreshToken = generateRefreshToken({ userId: user._id, email: user.email });

  // Split full_name to firstName and lastName
  const [firstName = '', lastName = ''] = (user.full_name || '').split(' ', 2);

  // Format user object for frontend
  const formattedUser = {
    id: user._id.toString(),
    email: user.email,
    firstName,
    lastName,
    role: user.role,
    enabled: user.is_active,
  };

  return {
    token,
    refreshToken,
    user: formattedUser
  };
};

export const verifyEmail = async (token) => {
  // Find token
  const verificationToken = await VerificationToken.findOne({ token });
  if (!verificationToken) {
    throw new Error('Invalid or expired verification token');
  }

  // Check if expired
  if (new Date(verificationToken.expires_at) < new Date()) {
    throw new Error('Verification token has expired');
  }

  // Update user by ObjectId
  const user = await User.findByIdAndUpdate(
    verificationToken.user_id,
    { is_verified: true },
    { new: true }
  );

  // Delete token
  await VerificationToken.findOneAndDelete({ token });

  // Send welcome/confirmation email after successful verification
  if (user) {
    try {
      const [firstName = ''] = (user.full_name || '').split(' ', 1);
      await sendWelcomeEmail(user.email, firstName, user.role);
    } catch (err) {
      console.error('Failed to send post-verification welcome email:', err?.message || err);
    }
  }

  return true;
};

export const requestPasswordReset = async (email) => {
  // Find user
  const user = await User.findOne({ email });
  if (!user) {
    // Don't reveal if email exists
    return true;
  }

  // Create reset token
  const resetToken = uuidv4();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour

  const token = new PasswordResetToken({
    token: resetToken,
    user_id: user._id,
    expires_at: expiresAt
  });
  await token.save();

  // Send reset email
  try {
    await sendPasswordResetEmail(email, resetToken);
  } catch (emailError) {
    console.error('Failed to send password reset email:', emailError);
  }

  return true;
};

export const resetPassword = async (token, newPassword) => {
  // Find token
  const resetToken = await PasswordResetToken.findOne({ token });
  if (!resetToken) {
    throw new Error('Invalid or expired reset token');
  }

  // Check if expired
  if (new Date(resetToken.expires_at) < new Date()) {
    throw new Error('Reset token has expired');
  }

  // Hash new password
  const passwordHash = await hashPassword(newPassword);

  // Update password by ObjectId
  await User.findByIdAndUpdate(
    resetToken.user_id,
    { password_hash: passwordHash }
  );

  // Delete token
  await PasswordResetToken.findOneAndDelete({ token });

  return true;
};

export const changePassword = async (userId, currentPassword, newPassword) => {
  // Get user by ObjectId
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Verify current password
  const isValid = await comparePassword(currentPassword, user.password_hash);
  if (!isValid) {
    throw new Error('Current password is incorrect');
  }

  // Hash new password
  const passwordHash = await hashPassword(newPassword);

  // Update password by ObjectId
  await User.findByIdAndUpdate(
    userId,
    { password_hash: passwordHash }
  );

  return true;
};
