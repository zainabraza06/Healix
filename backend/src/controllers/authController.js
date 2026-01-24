import {
  registerPatient,
  registerDoctor,
  registerAdmin,
  login,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
  changePassword
} from '../services/authService.js';
import { verifyRefreshToken, generateToken, generateRefreshToken } from '../config/jwt.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { logSuccess, logFailure } from '../utils/logger.js';

export const registerPatientController = async (req, res, next) => {
  try {
    const user = await registerPatient(req.body);
    await logSuccess({
      req,
      userId: user?._id,
      action: 'REGISTER_PATIENT',
      entityType: 'PATIENT',
      entityId: user?._id,
      description: `Patient registered: ${user?.email}`,
    });
    res.status(201).json(successResponse('Registration successful. Please check your email to verify your account.', user));
  } catch (error) {
    await logFailure({
      req,
      action: 'REGISTER_PATIENT',
      entityType: 'PATIENT',
      description: 'Patient registration failed',
      error,
    });
    next(error);
  }
};

export const registerDoctorController = async (req, res, next) => {
  try {
    const user = await registerDoctor(req.body);
    await logSuccess({
      req,
      userId: user?._id,
      action: 'REGISTER_DOCTOR',
      entityType: 'DOCTOR',
      entityId: user?._id,
      description: `Doctor application submitted: ${user?.email}`,
    });
    res.status(201).json(successResponse(
      'Doctor registration successful. Your application is under review and will be approved or rejected by an admin.',
      user
    ));
  } catch (error) {
    await logFailure({
      req,
      action: 'REGISTER_DOCTOR',
      entityType: 'DOCTOR',
      description: 'Doctor registration failed',
      error,
    });
    next(error);
  }
};

export const registerAdminController = async (req, res, next) => {
  try {
    const user = await registerAdmin(req.body);
    await logSuccess({
      req,
      userId: user?._id,
      action: 'REGISTER_ADMIN',
      entityType: 'ADMIN',
      entityId: user?._id,
      description: `Admin registered: ${user?.email}`,
    });
    res.status(201).json(successResponse(
      'Admin registered successfully. This is the only admin account allowed.',
      user
    ));
  } catch (error) {
    await logFailure({
      req,
      action: 'REGISTER_ADMIN',
      entityType: 'ADMIN',
      description: 'Admin registration failed',
      error,
    });
    next(error);
  }
};

export const loginController = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await login(email, password);
    
    // Set JWT token in secure HTTP-only cookie
    res.cookie('accessToken', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    // Set refresh token in secure HTTP-only cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });
    
    res.json(successResponse('Login successful', {
      token: result.token,
      refreshToken: result.refreshToken,
      user: result.user
    }));
    await logSuccess({
      req,
      userId: result?.user?.id,
      action: 'LOGIN',
      entityType: 'USER',
      entityId: result?.user?.id,
      description: `Login success: ${result?.user?.email}`,
    });
  } catch (error) {
    await logFailure({
      req,
      action: 'LOGIN',
      entityType: 'USER',
      description: `Login failed for ${req?.body?.email}`,
      error,
    });
    res.status(401).json(errorResponse(error.message || 'Invalid credentials'));
  }
};

export const logoutController = async (req, res) => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.json(successResponse('Logged out successfully'));
  await logSuccess({
    req,
    userId: req?.user?._id,
    action: 'LOGOUT',
    entityType: 'USER',
    entityId: req?.user?._id,
    description: 'User logged out',
  });
};

export const refreshTokenController = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(400).json(errorResponse('Refresh token is required'));
    }

    const decoded = verifyRefreshToken(refreshToken);

    if (!decoded) {
      return res.status(401).json(errorResponse('Invalid refresh token'));
    }

    const newToken = generateToken({
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    });

    res.cookie('accessToken', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json(successResponse('Token refreshed', { message: 'New token set in cookie' }));
    await logSuccess({
      req,
      userId: req?.user?._id,
      action: 'REFRESH_TOKEN',
      entityType: 'USER',
      entityId: req?.user?._id,
      description: 'Access token refreshed',
    });
  } catch (error) {
    await logFailure({
      req,
      action: 'REFRESH_TOKEN',
      entityType: 'USER',
      description: 'Refresh token failed',
      error,
    });
    res.status(401).json(errorResponse('Failed to refresh token'));
  }
};

export const validateTokenController = async (req, res) => {
  res.json(successResponse('Token is valid', true));
};

export const getCurrentUserController = async (req, res) => {
  const user = req.user;
  
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
  
  res.json(successResponse('User profile', formattedUser));
};

export const verifyEmailController = async (req, res, next) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json(errorResponse('Verification token is required'));
    }

    await verifyEmail(token);
    res.json(successResponse('Email verified successfully! Your application will be reviewed by an admin.'));
    logSuccess({
      req,
      action: 'VERIFY_EMAIL',
      entityType: 'USER',
      description: 'Email verification success',
    }).catch((err) => console.error('verifyEmail logSuccess failed:', err?.message || err));
  } catch (error) {
    logFailure({
      req,
      action: 'VERIFY_EMAIL',
      entityType: 'USER',
      description: 'Email verification failed',
      error,
    }).catch((err) => console.error('verifyEmail logFailure failed:', err?.message || err));
    res.status(400).json(errorResponse(error.message));
  }
};

export const forgotPasswordController = async (req, res, next) => {
  try {
    const { email } = req.body;
    await requestPasswordReset(email);
    res.json(successResponse('Password reset instructions have been sent to your email.'));
    await logSuccess({
      req,
      action: 'REQUEST_PASSWORD_RESET',
      entityType: 'USER',
      description: `Requested password reset for ${email}`,
    });
  } catch (error) {
    // Always return success to not reveal if email exists
    res.json(successResponse('Password reset instructions have been sent to your email.'));
    await logFailure({
      req,
      action: 'REQUEST_PASSWORD_RESET',
      entityType: 'USER',
      description: `Password reset request failed for ${req?.body?.email}`,
      error,
    });
  }
};

export const resetPasswordController = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    await resetPassword(token, newPassword);
    res.json(successResponse('Password has been reset successfully. You can now login with your new password.'));
    await logSuccess({
      req,
      action: 'RESET_PASSWORD',
      entityType: 'USER',
      description: 'Password reset success',
    });
  } catch (error) {
    await logFailure({
      req,
      action: 'RESET_PASSWORD',
      entityType: 'USER',
      description: 'Password reset failed',
      error,
    });
    res.status(400).json(errorResponse(error.message));
  }
};

export const changePasswordController = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    await changePassword(req.user._id, currentPassword, newPassword);
    res.json(successResponse('Password changed successfully'));
    await logSuccess({
      req,
      userId: req?.user?._id,
      action: 'CHANGE_PASSWORD',
      entityType: 'USER',
      entityId: req?.user?._id,
      description: 'Password changed',
    });
  } catch (error) {
    await logFailure({
      req,
      userId: req?.user?._id,
      action: 'CHANGE_PASSWORD',
      entityType: 'USER',
      entityId: req?.user?._id,
      description: 'Password change failed',
      error,
    });
    res.status(400).json(errorResponse(error.message));
  }
};
