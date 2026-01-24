import express from 'express';
import {
  registerPatientController,
  registerDoctorController,
  registerAdminController,
  loginController,
  logoutController,
  refreshTokenController,
  verifyEmailController,
  forgotPasswordController,
  resetPasswordController,
  validateTokenController,
  getCurrentUserController,
  changePasswordController
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validator.js';
import {
  registerPatientValidation,
  registerDoctorValidation,
  loginValidation,
  passwordResetRequestValidation,
  passwordResetConfirmValidation,
  changePasswordValidation
} from '../validators/authValidators.js';

const router = express.Router();

// Public routes
router.post('/register-patient', registerPatientValidation, validate, registerPatientController);
router.post('/register-doctor', registerDoctorValidation, validate, registerDoctorController);
router.post('/register-admin', registerPatientValidation, validate, registerAdminController);
router.post('/login', loginValidation, validate, loginController);
router.post('/logout', logoutController);
router.post('/refresh-token', refreshTokenController);
router.get('/verify-email', verifyEmailController);
router.post('/forgot-password', passwordResetRequestValidation, validate, forgotPasswordController);
router.post('/reset-password', passwordResetConfirmValidation, validate, resetPasswordController);

// Protected routes
router.get('/validate-token', authenticate, validateTokenController);
router.get('/me', authenticate, getCurrentUserController);
router.post('/change-password', authenticate, changePasswordValidation, validate, changePasswordController);

export default router;
