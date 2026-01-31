import express from 'express';
import {
    getPatientDashboardController,
    getVitalsHistoryController,
    downloadVitalsCSVTemplateController,
    uploadVitalsCSVController,
    notifyDoctorForCriticalVitalsController,
    getPatientProfileController,
    updatePatientProfileController,
    getAvailableDoctorsController,
    createPatientAlertController,
    getPatientAlertsController
} from '../controllers/patientController.js';
import {
    getMedicalRecordsController,
    addMedicalRecordEntryController
} from '../controllers/medicalRecordController.js';
import {
    getAvailableSlotsController,
    requestAppointmentController,
    getPatientAppointmentsController,
    getPastPatientAppointmentsController,
    cancelPatientAppointmentController,
    cancelRescheduleRequestedController,
    handleRescheduleRejectionResponseController,
    respondToDocCancelledRescheduleController,
    requestEmergencyCancellationController,
    processPaymentController,
    getAppointmentDetailsController,
    createCheckoutSessionController,
    verifyPaymentController,
    rescheduleAppointmentByPatientController,
} from '../controllers/appointmentController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

// All patient routes require PATIENT role
router.use(authenticate);
router.use(authorize('PATIENT'));

// Dashboard and Vitals
router.get('/dashboard', getPatientDashboardController);
router.get('/doctors', getAvailableDoctorsController);
router.get('/vitals/history', getVitalsHistoryController);
router.get('/vitals/csv-template', downloadVitalsCSVTemplateController);
router.post('/vitals/upload-csv', upload.single('file'), uploadVitalsCSVController);
router.post('/vitals/consultation-notify', notifyDoctorForCriticalVitalsController);

// Alerts
router.get('/alerts', getPatientAlertsController);
router.post('/alert/create', createPatientAlertController);

// Medical Records
router.get('/medical-records', getMedicalRecordsController);
router.post('/medical-records/:type', addMedicalRecordEntryController);

// Appointments
router.get('/appointments', getPatientAppointmentsController);
router.get('/appointments/past', getPastPatientAppointmentsController);
router.get('/appointments/slots', getAvailableSlotsController);
router.get('/appointments/verify-payment', verifyPaymentController);
router.post('/appointments/book', requestAppointmentController);
router.post('/appointments/:id/cancel', cancelPatientAppointmentController);
router.post('/appointments/:id/cancel-reschedule-requested', cancelRescheduleRequestedController);
router.post('/appointments/:id/reschedule-rejection-response', handleRescheduleRejectionResponseController);
router.post('/appointments/:id/doctor-cancelled-reschedule-response', respondToDocCancelledRescheduleController);
router.post('/appointments/:id/emergency-cancel', requestEmergencyCancellationController);
router.post('/appointments/:id/checkout', createCheckoutSessionController);
router.post('/appointments/:id/pay', processPaymentController);
router.post('/appointments/:id/reschedule', rescheduleAppointmentByPatientController);
router.get('/appointments/:id', getAppointmentDetailsController);

export default router;

