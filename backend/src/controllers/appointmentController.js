import {
    getAvailableSlots,
    requestAppointment,
    confirmAppointment,
    processPayment,
    cancelAppointmentByPatient,
    cancelAppointmentByDoctor,
    requestEmergencyCancellation,
    reviewEmergencyCancellation,
    completeAppointment,
    markNoShow,
    getPatientAppointments,
    getDoctorAppointments,
    getDoctorDailySchedule,
    getDoctorNextDaySchedule,
    getPendingEmergencyCancellations,
    getAppointmentById,
    cleanupExpiredRequests,
    rescheduleAppointment,
} from '../services/appointmentService.js';
import Patient from '../models/Patient.js';
import Doctor from '../models/Doctor.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { logSuccess, logFailure } from '../utils/logger.js';

// ============================================
// PATIENT CONTROLLERS
// ============================================

/**
 * Get available appointment slots for a doctor on a specific date
 */
export const getAvailableSlotsController = async (req, res, next) => {
    try {
        const { doctorId, date } = req.query;

        if (!doctorId || !date) {
            return res.status(400).json(errorResponse('doctorId and date are required'));
        }

        const slots = await getAvailableSlots(doctorId, date);
        res.json(successResponse('Available slots retrieved', slots));
    } catch (error) {
        next(error);
    }
};

/**
 * Request a new appointment (Patient)
 */
export const requestAppointmentController = async (req, res, next) => {
    try {
        const { doctorId, appointmentDate, slotStartTime, appointmentType, reason } = req.body;

        if (!doctorId || !appointmentDate || !slotStartTime || !reason) {
            return res.status(400).json(errorResponse('Missing required fields'));
        }

        // Get patient record
        const patient = await Patient.findOne({ user_id: req.user._id });
        if (!patient) {
            return res.status(404).json(errorResponse('Patient profile not found'));
        }

        const appointment = await requestAppointment(
            patient._id,
            doctorId,
            appointmentDate,
            slotStartTime,
            appointmentType || 'OFFLINE',
            reason
        );

        await logSuccess({
            req,
            userId: req.user._id,
            action: 'REQUEST_APPOINTMENT',
            entityType: 'APPOINTMENT',
            entityId: appointment._id,
            description: `Appointment requested with doctor ${doctorId}`,
        });

        res.status(201).json(successResponse('Appointment requested successfully', appointment));
    } catch (error) {
        await logFailure({
            req,
            userId: req.user._id,
            action: 'REQUEST_APPOINTMENT',
            entityType: 'APPOINTMENT',
            description: 'Appointment request failed',
            error,
        });
        next(error);
    }
};

/**
 * Get patient's appointments with pagination
 */
export const getPatientAppointmentsController = async (req, res, next) => {
    try {
        const { status, page = 0, size = 10 } = req.query;
        const patient = await Patient.findOne({ user_id: req.user._id });
        if (!patient) {
            return res.status(404).json(errorResponse('Patient profile not found'));
        }

        const result = await getPatientAppointments(patient._id, status, parseInt(page), parseInt(size));

        // Lazy cleanup in background
        cleanupExpiredRequests().catch(err => console.error('Background cleanup failed:', err));

        res.json(successResponse('Appointments retrieved', result));
    } catch (error) {
        next(error);
    }
};

/**
 * Cancel appointment (Patient)
 */
export const cancelPatientAppointmentController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json(errorResponse('Cancellation reason is required'));
        }

        const patient = await Patient.findOne({ user_id: req.user._id });
        if (!patient) {
            return res.status(404).json(errorResponse('Patient profile not found'));
        }

        const result = await cancelAppointmentByPatient(id, patient._id, reason);

        await logSuccess({
            req,
            userId: req.user._id,
            action: 'CANCEL_APPOINTMENT',
            entityType: 'APPOINTMENT',
            entityId: id,
            description: `Appointment cancelled. Refund: Rs. ${result.refundAmount}`,
        });

        res.json(successResponse('Appointment cancelled', {
            appointment: result.appointment,
            refundAmount: result.refundAmount,
        }));
    } catch (error) {
        if (error.needsEmergencyCancellation) {
            return res.status(400).json({
                success: false,
                message: error.message,
                needsEmergencyCancellation: true,
            });
        }
        await logFailure({
            req,
            userId: req.user._id,
            action: 'CANCEL_APPOINTMENT',
            entityType: 'APPOINTMENT',
            entityId: req.params.id,
            description: 'Appointment cancellation failed',
            error,
        });
        next(error);
    }
};

/**
 * Request emergency cancellation (Patient)
 */
export const requestEmergencyCancellationController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json(errorResponse('Reason is required'));
        }

        const patient = await Patient.findOne({ user_id: req.user._id });
        if (!patient) {
            return res.status(404).json(errorResponse('Patient profile not found'));
        }

        const request = await requestEmergencyCancellation(id, patient._id, reason);

        await logSuccess({
            req,
            userId: req.user._id,
            action: 'REQUEST_EMERGENCY_CANCELLATION',
            entityType: 'APPOINTMENT',
            entityId: id,
            description: 'Emergency cancellation requested',
        });

        res.json(successResponse('Emergency cancellation request submitted', request));
    } catch (error) {
        next(error);
    }
};

/**
 * Create Stripe Checkout Session for payment (Patient)
 */
export const createCheckoutSessionController = async (req, res, next) => {
    try {
        const { id } = req.params;

        const patient = await Patient.findOne({ user_id: req.user._id });
        if (!patient) {
            return res.status(404).json(errorResponse('Patient profile not found'));
        }

        // Import stripe service dynamically
        const { createCheckoutSession } = await import('../services/stripeService.js');
        const session = await createCheckoutSession(id, patient._id);

        await logSuccess({
            req,
            userId: req.user._id,
            action: 'CREATE_CHECKOUT_SESSION',
            entityType: 'APPOINTMENT',
            entityId: id,
            description: `Stripe checkout session created`,
        });

        res.json(successResponse('Checkout session created', session));
    } catch (error) {
        next(error);
    }
};

/**
 * Verify payment after Stripe redirect (Patient)
 */
export const verifyPaymentController = async (req, res, next) => {
    try {
        const { sessionId } = req.query;

        if (!sessionId) {
            return res.status(400).json(errorResponse('Session ID is required'));
        }

        const { verifyPayment } = await import('../services/stripeService.js');
        const result = await verifyPayment(sessionId);

        if (result.success) {
            await logSuccess({
                req,
                userId: req.user._id,
                action: 'VERIFY_PAYMENT',
                entityType: 'APPOINTMENT',
                description: `Payment verified successfully`,
            });
        }

        res.json(successResponse('Payment verification complete', result));
    } catch (error) {
        next(error);
    }
};

/**
 * Process payment (Patient) - Fallback for mock mode
 */
export const processPaymentController = async (req, res, next) => {
    try {
        const { id } = req.params;

        const patient = await Patient.findOne({ user_id: req.user._id });
        if (!patient) {
            return res.status(404).json(errorResponse('Patient profile not found'));
        }

        const appointment = await processPayment(id, patient._id);

        await logSuccess({
            req,
            userId: req.user._id,
            action: 'PROCESS_PAYMENT',
            entityType: 'APPOINTMENT',
            entityId: id,
            description: `Payment processed for appointment`,
        });

        res.json(successResponse('Payment processed successfully', appointment));
    } catch (error) {
        next(error);
    }
};

/**
 * Get appointment details
 */
export const getAppointmentDetailsController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const appointment = await getAppointmentById(id);

        if (!appointment) {
            return res.status(404).json(errorResponse('Appointment not found'));
        }

        res.json(successResponse('Appointment details retrieved', appointment));
    } catch (error) {
        next(error);
    }
};

// ============================================
// DOCTOR CONTROLLERS
// ============================================

/**
 * Get doctor's appointments with pagination
 */
export const getDoctorAppointmentsController = async (req, res, next) => {
    try {
        const { status, date, page = 0, size = 10 } = req.query;
        const doctor = await Doctor.findOne({ user_id: req.user._id });
        if (!doctor) {
            return res.status(404).json(errorResponse('Doctor profile not found'));
        }

        const result = await getDoctorAppointments(doctor._id, status, date, parseInt(page), parseInt(size));

        // Lazy cleanup in background
        cleanupExpiredRequests().catch(err => console.error('Background cleanup failed:', err));

        res.json(successResponse('Appointments retrieved', result));
    } catch (error) {
        next(error);
    }
};

/**
 * Get appointment requests (REQUESTED status) with pagination
 */
export const getAppointmentRequestsController = async (req, res, next) => {
    try {
        const { page = 0, size = 10 } = req.query;
        const doctor = await Doctor.findOne({ user_id: req.user._id });
        if (!doctor) {
            return res.status(404).json(errorResponse('Doctor profile not found'));
        }

        const result = await getDoctorAppointments(doctor._id, 'REQUESTED', null, parseInt(page), parseInt(size));
        res.json(successResponse('Appointment requests retrieved', result));
    } catch (error) {
        next(error);
    }
};

/**
 * Get today's schedule
 */
export const getDoctorDailyScheduleController = async (req, res, next) => {
    try {
        const { date } = req.query;
        const doctor = await Doctor.findOne({ user_id: req.user._id });
        if (!doctor) {
            return res.status(404).json(errorResponse('Doctor profile not found'));
        }

        const schedule = await getDoctorDailySchedule(doctor._id, date);
        res.json(successResponse('Daily schedule retrieved', schedule));
    } catch (error) {
        next(error);
    }
};

/**
 * Get next day schedule
 */
export const getDoctorNextDayScheduleController = async (req, res, next) => {
    try {
        const doctor = await Doctor.findOne({ user_id: req.user._id });
        if (!doctor) {
            return res.status(404).json(errorResponse('Doctor profile not found'));
        }

        const schedule = await getDoctorNextDaySchedule(doctor._id);
        res.json(successResponse('Next day schedule retrieved', schedule));
    } catch (error) {
        next(error);
    }
};

/**
 * Confirm appointment (Doctor)
 */
export const confirmAppointmentController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { meetingLink } = req.body;

        const doctor = await Doctor.findOne({ user_id: req.user._id });
        if (!doctor) {
            return res.status(404).json(errorResponse('Doctor profile not found'));
        }

        const appointment = await confirmAppointment(id, doctor._id, meetingLink);

        await logSuccess({
            req,
            userId: req.user._id,
            action: 'CONFIRM_APPOINTMENT',
            entityType: 'APPOINTMENT',
            entityId: id,
            description: 'Appointment confirmed',
        });

        res.json(successResponse('Appointment confirmed', appointment));
    } catch (error) {
        next(error);
    }
};

/**
 * Cancel appointment (Doctor)
 */
export const cancelDoctorAppointmentController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json(errorResponse('Cancellation reason is required'));
        }

        const doctor = await Doctor.findOne({ user_id: req.user._id });
        if (!doctor) {
            return res.status(404).json(errorResponse('Doctor profile not found'));
        }

        const result = await cancelAppointmentByDoctor(id, doctor._id, reason);

        await logSuccess({
            req,
            userId: req.user._id,
            action: 'CANCEL_APPOINTMENT',
            entityType: 'APPOINTMENT',
            entityId: id,
            description: `Appointment cancelled by doctor. Refund: Rs. ${result.refundAmount}`,
        });

        res.json(successResponse('Appointment cancelled', result));
    } catch (error) {
        next(error);
    }
};

/**
 * Reschedule appointment (Doctor)
 */
export const rescheduleAppointmentController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { dateTime } = req.body;

        const doctor = await Doctor.findOne({ user_id: req.user._id });
        if (!doctor) {
            return res.status(404).json(errorResponse('Doctor profile not found'));
        }

        const appointment = await rescheduleAppointment(id, doctor._id, dateTime);

        await logSuccess({
            req,
            userId: req.user._id,
            action: 'RESCHEDULE_APPOINTMENT',
            entityType: 'APPOINTMENT',
            entityId: id,
            description: 'Appointment rescheduled by doctor',
        });

        res.json(successResponse('Appointment rescheduled', appointment));
    } catch (error) {
        next(error);
    }
};

/**
 * Complete appointment (Doctor)
 */
export const completeAppointmentController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { prescription, instructions } = req.body;

        const doctor = await Doctor.findOne({ user_id: req.user._id });
        if (!doctor) {
            return res.status(404).json(errorResponse('Doctor profile not found'));
        }

        const appointment = await completeAppointment(id, doctor._id, prescription, instructions);

        await logSuccess({
            req,
            userId: req.user._id,
            action: 'COMPLETE_APPOINTMENT',
            entityType: 'APPOINTMENT',
            entityId: id,
            description: 'Appointment completed with prescription',
        });

        res.json(successResponse('Appointment completed', appointment));
    } catch (error) {
        next(error);
    }
};

/**
 * Mark no-show (Doctor)
 */
export const markNoShowController = async (req, res, next) => {
    try {
        const { id } = req.params;

        const doctor = await Doctor.findOne({ user_id: req.user._id });
        if (!doctor) {
            return res.status(404).json(errorResponse('Doctor profile not found'));
        }

        const appointment = await markNoShow(id, doctor._id);

        await logSuccess({
            req,
            userId: req.user._id,
            action: 'MARK_NO_SHOW',
            entityType: 'APPOINTMENT',
            entityId: id,
            description: 'Patient marked as no-show',
        });

        res.json(successResponse('Patient marked as no-show', appointment));
    } catch (error) {
        next(error);
    }
};

// ============================================
// ADMIN CONTROLLERS
// ============================================

/**
 * Get pending emergency cancellation requests
 */
export const getPendingEmergencyCancellationsController = async (req, res, next) => {
    try {
        const requests = await getPendingEmergencyCancellations();
        res.json(successResponse('Emergency cancellation requests retrieved', requests));
    } catch (error) {
        next(error);
    }
};

/**
 * Review emergency cancellation request (Admin)
 */
export const reviewEmergencyCancellationController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { approved, notes } = req.body;

        if (typeof approved !== 'boolean') {
            return res.status(400).json(errorResponse('approved field is required'));
        }

        const result = await reviewEmergencyCancellation(id, req.user._id, approved, notes);

        await logSuccess({
            req,
            adminId: req.user._id,
            action: approved ? 'APPROVE_EMERGENCY_CANCELLATION' : 'REJECT_EMERGENCY_CANCELLATION',
            entityType: 'EMERGENCY_CANCELLATION_REQUEST',
            entityId: id,
            description: `Emergency cancellation ${approved ? 'approved' : 'rejected'}. Refund: Rs. ${result.refundAmount}`,
        });

        res.json(successResponse(
            `Emergency cancellation ${approved ? 'approved' : 'rejected'}`,
            result
        ));
    } catch (error) {
        next(error);
    }
};
