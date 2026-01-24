import express from 'express';
import {
    downloadPatientMedicalRecordController
} from '../controllers/medicalRecordController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Require authentication for ALL record download attempts
router.use(authenticate);

/**
 * Shared Secure Download Endpoint
 * Access controlled within the controller based on role and relationships
 */
router.get('/:patientId/download', downloadPatientMedicalRecordController);

export default router;
