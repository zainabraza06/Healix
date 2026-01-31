/**
 * Approve reschedule-requested appointment (Doctor accepts patient-proposed reschedule)
 */
export const approveRescheduleRequestedAppointmentController = async (req, res, next) => {
    try {
        const { id } = req.params;

        const doctor = await Doctor.findOne({ user_id: req.user._id });
        if (!doctor) {
            return res.status(404).json(errorResponse('Doctor profile not found'));
        }

        const appointment = await approveRescheduleRequestedAppointment(id, doctor._id);

        await logSuccess({
            req,
            userId: req.user._id,
            action: 'APPROVE_RESCHEDULE',
            entityType: 'APPOINTMENT',
            entityId: id,
            description: 'Doctor approved patient-proposed reschedule',
        });

        res.json(successResponse('Reschedule approved', appointment));
    } catch (error) {
        next(error);
    }
};
import {
    getAvailableSlots,
    requestAppointment,
    confirmAppointment,
    processPayment,
    cancelAppointmentByPatient,
    cancelAppointmentByDoctor,
    cancelRescheduleRequestedByPatient,
    rejectRescheduledAppointment,
    handleRescheduleRejectionResponse,
    requestEmergencyCancellation,
    reviewEmergencyCancellation,
    completeAppointment,
    markNoShow,
    getPatientAppointments,
    getDoctorAppointments,
    getPastDoctorAppointments,
    getPastPatientAppointments,
    getDoctorDailySchedule,
    getDoctorNextDaySchedule,
    getPendingEmergencyCancellations,
    getAppointmentById,
    cleanupExpiredRequests,
    requestRescheduleByDoctor,
    rescheduleAppointmentByPatient,
    approveRescheduleRequestedAppointment,
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
            description: `Appointment requested with doctor ${doctorId} `,
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
            description: `Appointment cancelled.Refund: Rs.${result.refundAmount} `,
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
 * Request reschedule (Doctor)
 */
export const requestRescheduleController = async (req, res, next) => {
    try {
        const appointmentId = req.params.id;
        const doctorId = req.user.role === 'DOCTOR' ? req.user.doctor_id : null;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json(errorResponse('Reschedule reason is required'));
        }

        const doctor = await Doctor.findOne({ user_id: req.user._id });
        if (!doctor) {
            return res.status(404).json(errorResponse('Doctor profile not found'));
        }

        const appointment = await requestRescheduleByDoctor(appointmentId, doctor._id, reason);

        await logSuccess({
            req,
            userId: req.user._id,
            action: 'REQUEST_RESCHEDULE',
            entityType: 'APPOINTMENT',
            entityId: appointmentId,
            description: 'Doctor requested reschedule',
        });

        res.json(successResponse('Reschedule requested successfully', appointment));
    } catch (error) {
        next(error);
    }
};

/**
 * Reschedule appointment (Patient)
 */
export const rescheduleAppointmentByPatientController = async (req, res, next) => {
    try {
        const appointmentId = req.params.id;
        const { date, time, reason } = req.body;

        if (!date || !time) {
            return res.status(400).json(errorResponse('Date and time are required'));
        }

        const patient = await Patient.findOne({ user_id: req.user._id });
        if (!patient) {
            return res.status(404).json(errorResponse('Patient profile not found'));
        }

        const appointment = await rescheduleAppointmentByPatient(
            appointmentId,
            patient._id,
            date,
            time,
            reason
        );

        await logSuccess({
            req,
            userId: req.user._id,
            action: 'RESCHEDULE_APPOINTMENT',
            entityType: 'APPOINTMENT',
            entityId: appointmentId,
            description: 'Patient rescheduled appointment',
        });

        res.json(successResponse('Appointment rescheduled successfully', appointment));
    } catch (error) {
        next(error);
    }
};

/**
 * Cancel RESCHEDULE_REQUESTED appointment (Patient chooses not to reschedule)
 */
export const cancelRescheduleRequestedController = async (req, res, next) => {
    try {
        const appointmentId = req.params.id;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json(errorResponse('Cancellation reason is required'));
        }

        const patient = await Patient.findOne({ user_id: req.user._id });
        if (!patient) {
            return res.status(404).json(errorResponse('Patient profile not found'));
        }

        const result = await cancelRescheduleRequestedByPatient(appointmentId, patient._id, reason);

        await logSuccess({
            req,
            userId: req.user._id,
            action: 'CANCEL_RESCHEDULE_REQUESTED',
            entityType: 'APPOINTMENT',
            entityId: appointmentId,
            description: `Appointment cancelled after reschedule request. Refund: Rs.${result.refundAmount}`,
        });

        res.json(successResponse('Appointment cancelled', {
            appointment: result.appointment,
            refundAmount: result.refundAmount,
        }));
    } catch (error) {
        await logFailure({
            req,
            userId: req.user._id,
            action: 'CANCEL_RESCHEDULE_REQUESTED',
            entityType: 'APPOINTMENT',
            description: 'Failed to cancel reschedule-requested appointment',
            error,
        });
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
            description: `Appointment cancelled by doctor.Refund: Rs.${result.refundAmount} `,
        });

        res.json(successResponse('Appointment cancelled', result));
    } catch (error) {
        next(error);
    }
};

/**
        next(error);
    }
};

/**
 * Reject rescheduled appointment (Doctor)
 */
export const rejectRescheduledAppointmentController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json(errorResponse('Rejection reason is required'));
        }

        const doctor = await Doctor.findOne({ user_id: req.user._id });
        if (!doctor) {
            return res.status(404).json(errorResponse('Doctor profile not found'));
        }

        const appointment = await rejectRescheduledAppointment(id, doctor._id, reason);

        await logSuccess({
            req,
            userId: req.user._id,
            action: 'REJECT_RESCHEDULE',
            entityType: 'APPOINTMENT',
            entityId: id,
            description: 'Doctor rejected appointment reschedule request',
        });

        res.json(successResponse('Reschedule request rejected', appointment));
    } catch (error) {
        await logFailure({
            req,
            userId: req.user._id,
            action: 'REJECT_RESCHEDULE',
            entityType: 'APPOINTMENT',
            description: 'Failed to reject reschedule',
            error,
        });
        next(error);
    }
};

/**
 * Handle patient response to rejected reschedule (keep original or cancel)
 */
export const handleRescheduleRejectionResponseController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { action, reason } = req.body;

        if (!action || !['keep_original', 'cancel'].includes(action)) {
            return res.status(400).json(errorResponse('Valid action is required: keep_original or cancel'));
        }

        const patient = await Patient.findOne({ user_id: req.user._id });
        if (!patient) {
            return res.status(404).json(errorResponse('Patient profile not found'));
        }

        const result = await handleRescheduleRejectionResponse(id, patient._id, action, reason);

        await logSuccess({
            req,
            userId: req.user._id,
            action: action === 'keep_original' ? 'KEEP_ORIGINAL_APPOINTMENT' : 'CANCEL_AFTER_REJECTION',
            entityType: 'APPOINTMENT',
            entityId: id,
            description: result.message,
        });

        res.json(successResponse(result.message, {
            appointment: result.appointment,
            refundAmount: result.refundAmount || 0,
        }));
    } catch (error) {
        await logFailure({
            req,
            userId: req.user._id,
            action: 'HANDLE_RESCHEDULE_REJECTION',
            entityType: 'APPOINTMENT',
            description: 'Failed to handle reschedule rejection response',
            error,
        });
        next(error);
    }
};

/**
 * Respond to doctor's cancellation of reschedule request
 */
export const respondToDocCancelledRescheduleController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { choice, reason } = req.body;

        if (!choice || !['keep', 'cancel'].includes(choice)) {
            return res.status(400).json(errorResponse('Valid choice is required: keep or cancel'));
        }

        const patient = await Patient.findOne({ user_id: req.user._id });
        if (!patient) {
            return res.status(404).json(errorResponse('Patient profile not found'));
        }

        const { respondToDocCancelledReschedule } = await import('../services/appointmentService.js');
        const result = await respondToDocCancelledReschedule(id, patient._id, choice, reason);

        await logSuccess({
            req,
            userId: req.user._id,
            action: choice === 'keep' ? 'KEEP_ORIGINAL_AFTER_DOC_CANCEL' : 'CANCEL_AFTER_DOC_CANCEL',
            entityType: 'APPOINTMENT',
            entityId: id,
            description: `Patient chose to ${choice === 'keep' ? 'keep original slot' : 'cancel appointment'} after doctor cancelled reschedule request`,
        });

        res.json(successResponse(`Appointment ${result.action} successfully`, {
            appointment: result.appointment,
            action: result.action,
            refundAmount: result.refundAmount || 0,
        }));
    } catch (error) {
        await logFailure({
            req,
            userId: req.user._id,
            action: 'RESPOND_TO_DOC_CANCELLED_RESCHEDULE',
            entityType: 'APPOINTMENT',
            description: 'Failed to respond to doctor cancelled reschedule',
            error,
        });
        next(error);
    }
};

/**
 * Complete appointment (Doctor)
 */
export const completeAppointmentController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { medications, instructions } = req.body;

        const doctor = await Doctor.findOne({ user_id: req.user._id });
        if (!doctor) {
            return res.status(404).json(errorResponse('Doctor profile not found'));
        }

        const appointment = await completeAppointment(id, doctor._id, medications, instructions);

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

/**
 * Get past appointments for doctor
 */
export const getPastDoctorAppointmentsController = async (req, res, next) => {
    try {
        const { page = 0, size = 10 } = req.query;
        const doctor = await Doctor.findOne({ user_id: req.user._id });
        if (!doctor) {
            return res.status(404).json(errorResponse('Doctor profile not found'));
        }

        const result = await getPastDoctorAppointments(doctor._id, parseInt(page), parseInt(size));
        res.json(successResponse('Past appointments retrieved', result));
    } catch (error) {
        next(error);
    }
};

/**
 * Get past appointments for patient
 */
export const getPastPatientAppointmentsController = async (req, res, next) => {
    try {
        const { page = 0, size = 10 } = req.query;
        const patient = await Patient.findOne({ user_id: req.user._id });
        if (!patient) {
            return res.status(404).json(errorResponse('Patient profile not found'));
        }

        const result = await getPastPatientAppointments(patient._id, parseInt(page), parseInt(size));
        res.json(successResponse('Past appointments retrieved', result));
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
            description: `Emergency cancellation ${approved ? 'approved' : 'rejected'}.Refund: Rs.${result.refundAmount} `,
        });

        res.json(successResponse(
            `Emergency cancellation ${approved ? 'approved' : 'rejected'} `,
            result
        ));
    } catch (error) {
        next(error);
    }
};

/**
 * Request emergency reschedule (Doctor)
 */
export const requestDoctorEmergencyRescheduleController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const doctorId = req.user.profileId;

        // Dynamically import to avoid circular dependency
        const { requestDoctorEmergencyReschedule } = await import('../services/appointmentService.js');

        const request = await requestDoctorEmergencyReschedule(id, doctorId, reason);
        res.status(201).json(successResponse('Emergency reschedule request submitted', request));

        logSuccess(req, 'Doctor Emergency Reschedule Requested', { appointmentId: id });
    } catch (error) {
        logFailure(req, 'Doctor Emergency Reschedule Request Failed', { error: error.message });
        next(error);
    }
};

/**
 * Approve emergency reschedule (Admin)
 */
export const approveDoctorEmergencyRescheduleController = async (req, res, next) => {
    try {
        const { requestId } = req.params;
        const adminId = req.user.profileId;

        const { approveDoctorEmergencyReschedule } = await import('../services/appointmentService.js');

        const result = await approveDoctorEmergencyReschedule(requestId, adminId);
        res.json(successResponse('Emergency reschedule approved', result));

        logSuccess(req, 'Doctor Emergency Reschedule Approved', { requestId });
    } catch (error) {
        logFailure(req, 'Doctor Emergency Reschedule Approval Failed', { error: error.message });
        next(error);
    }
};

/**
 * Get doctor emergency requests (Admin)
 */
export const getDoctorEmergencyRequestsController = async (req, res, next) => {
    try {
        const { status } = req.query;
        const { getDoctorEmergencyRequests } = await import('../services/appointmentService.js');

        const requests = await getDoctorEmergencyRequests(status);
        res.json(successResponse('Emergency requests retrieved', requests));
    } catch (error) {
        next(error);
    }
};
