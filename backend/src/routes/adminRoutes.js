import express from 'express';
import {
  getPendingApplicationsController,
  approveApplicationController,
  rejectApplicationController,
  processApplicationController,
  getDashboardStatsController,
  getAlertStatsController,
  getAppointmentStatsController,
  getRecentAlertsController,
  getRecentLogsController,
  getLogsController,
  downloadLogsController,
  registerDoctorAsAdminController,
  getDoctorApplicationsController,
  getPaginatedPatientsController,
  getPaginatedDoctorsController,
  downloadDoctorsController,
  getPaginatedAppointmentsController,
  getPaginatedAlertsController,
  manageDoctorStatusController,
  managePatientStatusController,
  downloadPatientsController,
  downloadAlertsController,
  downloadAppointmentsController,
} from '../controllers/adminController.js';
import {
  getMedicalRecordsController,
  addMedicalRecordEntryController,
  downloadPatientMedicalRecordController
} from '../controllers/medicalRecordController.js';
import {
  getAllPatientsController,
  getPatientByIdController,
  disablePatientController,
  enablePatientController,
} from '../controllers/patientController.js';
import {
  getPendingEmergencyCancellationsController,
  reviewEmergencyCancellationController,
  getDoctorEmergencyRequestsController,
  approveDoctorEmergencyRescheduleController,
} from '../controllers/appointmentController.js';
import { getAllDoctorsController, getDoctorByIdController } from '../services/doctorService.js';
import { registerAdminController } from '../controllers/authController.js';
import { validate } from '../middleware/validator.js';
import { registerPatientValidation } from '../validators/authValidators.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Public: allow creating the single admin account without auth
router.post('/register', registerPatientValidation, validate, registerAdminController);

// All other admin routes require ADMIN role
router.use(authenticate);
router.use(authorize('ADMIN'));

// Dashboard statistics endpoints
router.get('/dashboard/stats', getDashboardStatsController);
router.get('/dashboard/alerts', getRecentAlertsController);
router.get('/dashboard/logs', getRecentLogsController);
router.get('/dashboard/alert-stats', getAlertStatsController);
router.get('/dashboard/appointment-stats', getAppointmentStatsController);

// Paginated data endpoints
router.get('/patients', getPaginatedPatientsController);
router.get('/patients/download', downloadPatientsController);
router.get('/patients/:patientId', getPatientByIdController);
router.get('/doctors', getPaginatedDoctorsController);
router.get('/doctors/download', downloadDoctorsController);
router.get('/appointments', getPaginatedAppointmentsController);
router.get('/appointments/download', downloadAppointmentsController);
router.get('/alerts', getPaginatedAlertsController);
router.get('/alerts/export', downloadAlertsController);
router.get('/logs', getLogsController);
router.get('/logs/download', downloadLogsController);

// Admin direct doctor registration
router.post('/doctors/register', registerDoctorAsAdminController);

// Applications endpoints
router.get('/applications/pending', getPendingApplicationsController);
router.get('/applications', getDoctorApplicationsController);
router.post('/applications/approve', approveApplicationController);
router.post('/applications/reject', rejectApplicationController);
router.post('/applications/decision', processApplicationController);

// Patient management endpoints (disable/enable status)
router.get('/patients/:patientId', getPatientByIdController);
router.post('/patients/:patientId/disable', disablePatientController);
router.post('/patients/:patientId/enable', enablePatientController);
router.post('/patients/manage-status', managePatientStatusController);

// Doctor management endpoints
router.post('/doctors/manage-status', manageDoctorStatusController);
router.get('/doctors/:doctorId', getDoctorByIdController);

// Emergency cancellation requests
router.get('/emergency-cancellations', getPendingEmergencyCancellationsController);
router.post('/emergency-cancellations/:id/review', reviewEmergencyCancellationController);

// Doctor Emergency Reschedule Requests
router.get('/emergency-reschedules', getDoctorEmergencyRequestsController);
router.post('/emergency-reschedules/:requestId/approve', approveDoctorEmergencyRescheduleController);

export default router;

