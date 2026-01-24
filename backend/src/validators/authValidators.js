import { body } from 'express-validator';

export const registerPatientValidation = [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and number'),
  body('dateOfBirth').optional().isISO8601().withMessage('Valid date required'),
  body('phoneNumber').optional().isMobilePhone().withMessage('Valid phone number required'),
  body('gender')
    .optional()
    .customSanitizer((v) => v?.toUpperCase?.())
    .isIn(['MALE', 'FEMALE', 'OTHER'])
    .withMessage('Invalid gender'),
  body('bloodType')
    .optional()
    .customSanitizer((v) => v?.toUpperCase?.())
    .isIn([
      'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN',
      'A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE',
      'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE'
    ])
    .withMessage('Invalid blood type')
];

export const registerDoctorValidation = [
  ...registerPatientValidation,
  body('licenseNumber').trim().notEmpty().withMessage('License number is required'),
  body('specialization')
    .customSanitizer((v) => v?.toUpperCase?.().trim())
    .isIn([
      'CARDIOLOGY', 'NEUROLOGY', 'ONCOLOGY', 'PEDIATRICS',
      'ORTHOPEDICS', 'DERMATOLOGY', 'PSYCHIATRY', 'GENERAL',
      'GENERAL PRACTICE', 'PSYCHOLOGY'
    ])
    .withMessage('Invalid specialization')
];

export const loginValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
];

export const passwordResetRequestValidation = [
  body('email').isEmail().withMessage('Valid email is required')
];

export const passwordResetConfirmValidation = [
  body('token').notEmpty().withMessage('Token is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and number')
];

export const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and number')
];
