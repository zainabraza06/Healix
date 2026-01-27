import express from 'express';
import { getDoctorDashboardController, requestStatusChangeController, getDoctorPatientsController, getDoctorAlertsController, resolveAlertController } from '../controllers/doctorController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// All doctor routes require DOCTOR role
router.use(authenticate);
router.use(authorize('DOCTOR'));

// Dashboard statistics endpoint
router.get('/dashboard', getDoctorDashboardController);
router.post('/request-status-change', requestStatusChangeController);
router.get('/patients', getDoctorPatientsController);
router.get('/alerts', getDoctorAlertsController);
router.post('/alerts/:alertId/resolve', resolveAlertController);

export default router;
