import { getDoctorDashboard, requestDoctorStatusChange, getDoctorPatients, getDoctorAlerts, resolveAlert, getPatientVitalsForDoctor } from '../services/doctorService.js';
import { getPatientMedicalSummaryForDoctor } from '../services/medicalRecordService.js';
import { getIO } from '../config/socket.js';
import Doctor from '../models/Doctor.js';
import { successResponse, errorResponse } from '../utils/response.js';

/**
 * Get current doctor's dashboard data
 */
export const getDoctorDashboardController = async (req, res, next) => {
    try {
        const userId = req.user._id;

        // Find the doctor associated with this user
        const doctor = await Doctor.findOne({ user_id: userId });

        if (!doctor) {
            return res.status(404).json(errorResponse('Doctor profile not found for this user'));
        }

        const dashboardData = await getDoctorDashboard(doctor._id);
        res.json(successResponse('Doctor dashboard data retrieved successfully', dashboardData));
    } catch (error) {
        next(error);
    }
};

/**
 * Request status change (Activate/Deactivate)
 */
export const requestStatusChangeController = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const { type, reason } = req.body;

        if (!type || !reason) {
            return res.status(400).json(errorResponse('Request type and reason are required'));
        }

        const doctor = await Doctor.findOne({ user_id: userId });
        if (!doctor) {
            return res.status(404).json(errorResponse('Doctor profile not found'));
        }

        await requestDoctorStatusChange(doctor._id, type, reason);
        res.json(successResponse('Status change request submitted successfully'));
    } catch (error) {
        next(error);
    }
};

/**
 * Get all patients this doctor can chat with (patients with alerts or confirmed appointments)
 */
export const getDoctorPatientsController = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const doctor = await Doctor.findOne({ user_id: userId });

        if (!doctor) {
            return res.status(404).json(errorResponse('Doctor profile not found'));
        }

        const patients = await getDoctorPatients(doctor._id);
        res.json(successResponse('Patients retrieved successfully', patients));
    } catch (error) {
        next(error);
    }
};

/**
 * Get all alerts assigned to this doctor
 */
export const getDoctorAlertsController = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const page = parseInt(req.query.page) || 0;
        const size = parseInt(req.query.size) || 10;
        const status = req.query.status; // ACTIVE or RESOLVED

        const doctor = await Doctor.findOne({ user_id: userId });
        if (!doctor) {
            return res.status(404).json(errorResponse('Doctor profile not found'));
        }

        const alerts = await getDoctorAlerts(doctor._id, page, size, status);
        res.json(successResponse('Alerts retrieved successfully', alerts));
    } catch (error) {
        next(error);
    }
};

/**
 * Resolve an alert with prescription and instructions
 */
export const resolveAlertController = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const { alertId } = req.params;
        const { instructions, prescription } = req.body;

        if (!instructions) {
            return res.status(400).json(errorResponse('Instructions are required'));
        }

        const doctor = await Doctor.findOne({ user_id: userId }).populate('user_id', 'full_name email');
        if (!doctor) {
            return res.status(404).json(errorResponse('Doctor profile not found'));
        }

        const resolvedAlert = await resolveAlert(alertId, doctor._id, instructions, prescription);
        try {
            const io = getIO();
            // Extract patient's user_id safely - it's nested in the populated structure
            const patientUserId = resolvedAlert?.patient_id?.user_id?._id;
            console.log('Alert resolved - emitting to patient room:', {
                patientUserId,
                alertId,
                patient_id: resolvedAlert?.patient_id,
            });
            
            if (patientUserId) {
                io.to(`user:${patientUserId}`).emit('alert:resolved', {
                    alertId,
                    instructions: resolvedAlert.instructions,
                    prescription: resolvedAlert.prescription,
                    resolved_at: resolvedAlert.resolved_at,
                    doctor_name: doctor.user_id?.full_name || 'Doctor'
                });
                console.log(`alert:resolved emitted to user:${patientUserId}`);
            } else {
                console.warn('Could not extract patient userId from resolved alert');
            }
        } catch (emitErr) {
            console.error('Failed to emit alert:resolved socket event', emitErr);
        }
        res.json(successResponse('Alert resolved successfully', resolvedAlert));
    } catch (error) {
        next(error);
    }
};

/**
 * Get patient medical summary for doctor
 */
export const getPatientMedicalSummaryController = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const { patientId } = req.params;

        const doctor = await Doctor.findOne({ user_id: userId });
        if (!doctor) {
            return res.status(404).json(errorResponse('Doctor profile not found'));
        }

        const summary = await getPatientMedicalSummaryForDoctor(patientId, doctor._id);
        res.json(successResponse('Patient medical summary retrieved successfully', summary));
    } catch (error) {
        next(error);
    }
};

/**
 * Get patient vitals for doctor
 */
export const getPatientVitalsController = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const { patientId } = req.params;

        const doctor = await Doctor.findOne({ user_id: userId });
        if (!doctor) {
            return res.status(404).json(errorResponse('Doctor profile not found'));
        }

        const vitals = await getPatientVitalsForDoctor(patientId, doctor._id);
        res.json(successResponse('Patient vitals retrieved successfully', vitals));
    } catch (error) {
        next(error);
    }
};
