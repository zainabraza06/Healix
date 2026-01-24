import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export const hashPassword = async (password) => {
  return await bcrypt.hash(password, SALT_ROUNDS);
};

export const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

export const generateUserId = (role) => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  const prefix = role.substring(0, 1).toUpperCase();
  return `${prefix}${timestamp}${random}`.toUpperCase();
};

export default { hashPassword, comparePassword, generateUserId };
