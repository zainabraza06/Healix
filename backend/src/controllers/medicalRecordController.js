import { getPatientMedicalRecords, addMedicalRecordEntry, generateMedicalRecordsPDF } from '../services/medicalRecordService.js';
import { successResponse, errorResponse } from '../utils/response.js';
import Appointment from '../models/Appointment.js';
import Alert from '../models/Alert.js';
import Doctor from '../models/Doctor.js';
import Patient from '../models/Patient.js';

/**
 * Get patient medical records
 */
export const getMedicalRecordsController = async (req, res, next) => {
    try {
        const data = await getPatientMedicalRecords(req.user._id);
        res.json(successResponse('Medical records retrieved.', data));
    } catch (error) {
        next(error);
    }
};

/**
 * Add an entry to medical records
 */
export const addMedicalRecordEntryController = async (req, res, next) => {
    try {
        const { type } = req.params;
        const data = await addMedicalRecordEntry(req.user._id, type, req.body);
        res.json(successResponse(`${type} added successfully.`, data));
    } catch (error) {
        next(error);
    }
};

/**
 * Download patient medical records as PDF (Permission strictly enforced)
 */
export const downloadPatientMedicalRecordController = async (req, res, next) => {
    try {
        const { patientId } = req.params;
        const currentUser = req.user;

        let hasAccess = false;

        // 1. Admin: Unlimited Access
        if (currentUser.role === 'ADMIN') {
            hasAccess = true;
        }
        // 2. Patient: Access ONLY their own record
        else if (currentUser.role === 'PATIENT') {
            const patient = await Patient.findById(patientId);
            if (patient && patient.user_id.toString() === currentUser._id.toString()) {
                hasAccess = true;
            }
        }
        // 3. Doctor: Access if appointment OR alert exists
        else if (currentUser.role === 'DOCTOR') {
            const doctor = await Doctor.findOne({ user_id: currentUser._id });
            if (doctor) {
                // Check for existing appointment (Scheduled or Completed)
                const appointment = await Appointment.findOne({
                    patient_id: patientId,
                    doctor_id: doctor._id,
                    status: { $in: ['CONFIRMED', 'COMPLETED'] }
                });
                if (appointment) {
                    hasAccess = true;
                }
                // Also check for existing alert with this doctor
                else {
                    const alert = await Alert.findOne({
                        patient_id: patientId,
                        doctor_id: doctor._id
                    });
                    if (alert) {
                        hasAccess = true;
                    }
                }
            }
        }

        if (!hasAccess) {
            return res.status(403).json(errorResponse('Unprivileged access attempt. You do not have permission to download this medical record.'));
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="medical_record_${patientId}.pdf"`);
        await generateMedicalRecordsPDF(patientId, res);
    } catch (error) {
        next(error);
    }
};
