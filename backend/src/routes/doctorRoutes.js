import express from 'express';
import { getDoctorDashboardController, requestStatusChangeController, getDoctorPatientsController, getDoctorAlertsController, resolveAlertController } from '../controllers/doctorController.js';
import {
    getDoctorAppointmentsController,
    getAppointmentRequestsController,
    getDoctorDailyScheduleController,
    getDoctorNextDayScheduleController,
    confirmAppointmentController,
    cancelDoctorAppointmentController,
    requestRescheduleController,
    rejectRescheduledAppointmentController,
    completeAppointmentController,
    markNoShowController,
    requestDoctorEmergencyRescheduleController,
} from '../controllers/appointmentController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// All doctor routes require DOCTOR role
router.use(authenticate);
router.use(authorize('DOCTOR'));

// Dashboard and profile
router.get('/dashboard', getDoctorDashboardController);
router.post('/request-status-change', requestStatusChangeController);
router.get('/patients', getDoctorPatientsController);

// Alerts
router.get('/alerts', getDoctorAlertsController);
router.post('/alerts/:alertId/resolve', resolveAlertController);

// Appointments
router.get('/appointments', getDoctorAppointmentsController);
router.get('/appointments/requests', getAppointmentRequestsController);
router.get('/appointments/today', getDoctorDailyScheduleController);
router.get('/appointments/tomorrow', getDoctorNextDayScheduleController);
router.post('/appointments/:id/confirm', confirmAppointmentController);
router.post('/appointments/:id/cancel', cancelDoctorAppointmentController);
router.post('/appointments/:id/request-reschedule', requestRescheduleController);
router.post('/appointments/:id/reject-reschedule', rejectRescheduledAppointmentController);
router.post('/appointments/:id/complete', completeAppointmentController);
router.post('/appointments/:id/no-show', markNoShowController);
router.post('/appointments/:id/request-emergency-reschedule', requestDoctorEmergencyRescheduleController);

export default router;

