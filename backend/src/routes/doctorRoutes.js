import express from 'express';
import { getDoctorDashboardController, requestStatusChangeController } from '../controllers/doctorController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// All doctor routes require DOCTOR role
router.use(authenticate);
router.use(authorize('DOCTOR'));

// Dashboard statistics endpoint
router.get('/dashboard', getDoctorDashboardController);
router.post('/request-status-change', requestStatusChangeController);

export default router;
