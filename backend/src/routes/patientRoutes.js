import express from 'express';
import {
    getPatientDashboardController,
    getVitalsHistoryController,
    getPatientProfileController,
    updatePatientProfileController
} from '../controllers/patientController.js';
import {
    getMedicalRecordsController,
    addMedicalRecordEntryController
} from '../controllers/medicalRecordController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// All patient routes require PATIENT role
router.use(authenticate);
router.use(authorize('PATIENT'));

// Dashboard and Vitals
router.get('/dashboard', getPatientDashboardController);
router.get('/vitals/history', getVitalsHistoryController);

// Profile
router.get('/profile', getPatientProfileController);
router.put('/profile', updatePatientProfileController);

// Medical Records
router.get('/medical-records', getMedicalRecordsController);
router.post('/medical-records/:type', addMedicalRecordEntryController);

export default router;
