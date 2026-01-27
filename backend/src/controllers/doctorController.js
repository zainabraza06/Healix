import { getDoctorDashboard, requestDoctorStatusChange, getDoctorPatients } from '../services/doctorService.js';
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
