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

export default router;
