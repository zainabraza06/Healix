import User from '../models/User.js';
import Patient from '../models/Patient.js';

export const getUserById = async (userId) => {
  const user = await User.findById(userId);
  if (user) {
    user.password_hash = undefined;
  }
  return user;
};

export const getUserByEmail = async (email) => {
  const user = await User.findOne({ email });
  if (user) {
    user.password_hash = undefined;
  }
  return user;
};

export const updateUser = async (userId, updates) => {
  // Remove fields that shouldn't be updated directly
  const allowedUpdates = { ...updates };
  delete allowedUpdates.user_id;
  delete allowedUpdates.email;
  delete allowedUpdates.role;
  delete allowedUpdates.password_hash;

  const user = await User.findByIdAndUpdate(
    userId,
    allowedUpdates,
    { new: true }
  );
  if (user) {
    user.password_hash = undefined;
  }
  return user;
};

export const deleteUser = async (userId) => {
  await User.findByIdAndDelete(userId);
  return true;
};

export const getAllPatients = async () => {
  const patients = await Patient.find().populate('user_id');
  return patients.map(patient => {
    if (patient.user_id) {
      patient.user_id.password_hash = undefined;
    }
    return patient;
  });
};

export const toggleUserStatus = async (userId, isActive) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { is_active: isActive },
    { new: true }
  );
  if (user) {
    user.password_hash = undefined;
  }
  return user;
};
