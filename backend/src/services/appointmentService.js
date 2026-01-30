import Appointment from '../models/Appointment.js';
import Payment from '../models/Payment.js';
import EmergencyCancellationRequest from '../models/EmergencyCancellationRequest.js';
import Patient from '../models/Patient.js';
import Doctor from '../models/Doctor.js';
import { sendEmail } from '../config/email.js';
import { getIO } from '../config/socket.js';

// Constants
const APPOINTMENT_FEE = 1000;
const CANCELLATION_DEDUCTION = 250;
const SLOT_DURATION_MINUTES = 30;
const WORKING_HOURS = {
    start: 9, // 9 AM
    end: 17,  // 5 PM
    breakStart: 13, // 1 PM
    breakEnd: 14,   // 2 PM
};
const MIN_BOOKING_DAYS_ADVANCE = 3;
const MAX_BOOKING_DAYS_ADVANCE = 30; // Approx. 1 month
const MIN_PATIENT_CANCEL_DAYS = 3;
const MIN_DOCTOR_CANCEL_DAYS = 1;
const EMERGENCY_REVIEW_WINDOW_HOURS = 12;

/**
 * Generate a unique challan number
 */
const generateChallanNumber = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `HLX-${timestamp}-${random}`;
};

/**
 * Calculate end time from start time
 */
const calculateEndTime = (startTime) => {
    const [hours, minutes] = startTime.split(':').map(Number);
    let endMinutes = minutes + SLOT_DURATION_MINUTES;
    let endHours = hours;

    if (endMinutes >= 60) {
        endMinutes -= 60;
        endHours += 1;
    }

    return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
};

/**
 * Get all available 30-minute slots for a given date and doctor
 */
export const getAvailableSlots = async (doctorId, date) => {
    const queryDate = new Date(date);
    queryDate.setHours(0, 0, 0, 0);

    const endOfDay = new Date(queryDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all booked appointments for this doctor on this date
    const bookedAppointments = await Appointment.find({
        doctor_id: doctorId,
        appointment_date: { $gte: queryDate, $lte: endOfDay },
        status: { $in: ['REQUESTED', 'CONFIRMED'] }
    }).select('slot_start_time');

    const bookedSlots = new Set(bookedAppointments.map(a => a.slot_start_time));

    // Generate all possible slots
    const allSlots = [];
    for (let hour = WORKING_HOURS.start; hour < WORKING_HOURS.end; hour++) {
        // Skip break time
        if (hour >= WORKING_HOURS.breakStart && hour < WORKING_HOURS.breakEnd) {
            continue;
        }

        for (let minutes = 0; minutes < 60; minutes += SLOT_DURATION_MINUTES) {
            // Don't add slots that end after working hours or during break
            const slotEndHour = minutes + SLOT_DURATION_MINUTES >= 60 ? hour + 1 : hour;
            if (slotEndHour > WORKING_HOURS.end) continue;
            if (slotEndHour === WORKING_HOURS.breakStart && minutes + SLOT_DURATION_MINUTES > 0) {
                // This slot would end during break
                if (hour === WORKING_HOURS.breakStart - 1 && minutes === 30) continue;
            }

            const timeStr = `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            allSlots.push(timeStr);
        }
    }

    // Filter out booked slots
    const availableSlots = allSlots.filter(slot => !bookedSlots.has(slot));

    return availableSlots.map(slot => ({
        time: slot,
        endTime: calculateEndTime(slot),
        available: true
    }));
};

/**
 * Request a new appointment (Patient action)
 */
export const requestAppointment = async (patientId, doctorId, appointmentDate, slotStartTime, appointmentType, reason) => {
    // Validate doctor exists and is approved/active
    const doctor = await Doctor.findById(doctorId).populate('user_id');
    if (!doctor) {
        const err = new Error('Doctor not found');
        err.statusCode = 404;
        throw err;
    }

    if (doctor.application_status !== 'APPROVED') {
        const err = new Error('Doctor is not available for appointments');
        err.statusCode = 400;
        throw err;
    }

    // Validate patient exists
    const patient = await Patient.findById(patientId).populate('user_id');
    if (!patient) {
        const err = new Error('Patient not found');
        err.statusCode = 404;
        throw err;
    }

    // Validate appointment is at least 3 days in advance
    const appointmentDateObj = new Date(appointmentDate);
    appointmentDateObj.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const daysDiff = Math.ceil((appointmentDateObj - today) / (1000 * 60 * 60 * 24));

    if (daysDiff < MIN_BOOKING_DAYS_ADVANCE) {
        const err = new Error(`Appointments must be booked at least ${MIN_BOOKING_DAYS_ADVANCE} days in advance`);
        err.statusCode = 400;
        throw err;
    }

    if (daysDiff > MAX_BOOKING_DAYS_ADVANCE) {
        const err = new Error(`Appointments cannot be booked more than ${MAX_BOOKING_DAYS_ADVANCE} days in advance`);
        err.statusCode = 400;
        throw err;
    }

    // Check if slot is available
    const availableSlots = await getAvailableSlots(doctorId, appointmentDate);
    const isSlotAvailable = availableSlots.some(s => s.time === slotStartTime);

    if (!isSlotAvailable) {
        const err = new Error('Selected time slot is not available');
        err.statusCode = 400;
        throw err;
    }

    // Create the appointment
    const appointment = await Appointment.create({
        patient_id: patientId,
        doctor_id: doctorId,
        appointment_date: appointmentDateObj,
        slot_start_time: slotStartTime,
        slot_end_time: calculateEndTime(slotStartTime),
        appointment_type: appointmentType,
        status: 'REQUESTED',
        reason,
        payment_status: 'PENDING',
        payment_amount: APPOINTMENT_FEE,
    });

    // Notify doctor via socket
    try {
        const io = getIO();
        io.to(`doctor:${doctorId}`).emit('appointment:requested', {
            appointmentId: appointment._id,
            patientName: patient.user_id?.full_name,
            date: appointmentDate,
            time: slotStartTime,
            type: appointmentType,
            reason,
        });
    } catch (err) {
        console.error('Socket emit failed:', err);
    }

    // Send email to doctor
    try {
        if (doctor.user_id?.email) {
            const content = `
        <p>You have a new appointment request from <strong>${patient.user_id?.full_name}</strong>.</p>
        <div class="warning">
          <strong>Date:</strong> ${appointmentDateObj.toDateString()}<br/>
          <strong>Time:</strong> ${slotStartTime} - ${calculateEndTime(slotStartTime)}<br/>
          <strong>Type:</strong> ${appointmentType}<br/>
          <strong>Reason:</strong> ${reason}
        </div>
        <p>Please log in to confirm or cancel this appointment.</p>
      `;
            await sendEmail(doctor.user_id.email, 'New Appointment Request', content);
        }
    } catch (emailErr) {
        console.error('Failed to send appointment request email:', emailErr);
    }

    return appointment;
};

/**
 * Confirm an appointment (Doctor action)
 */
export const confirmAppointment = async (appointmentId, doctorId, meetingLink = null) => {
    const appointment = await Appointment.findById(appointmentId)
        .populate({ path: 'patient_id', populate: { path: 'user_id' } })
        .populate({ path: 'doctor_id', populate: { path: 'user_id' } });

    if (!appointment) {
        const err = new Error('Appointment not found');
        err.statusCode = 404;
        throw err;
    }

    // Verify this appointment belongs to this doctor
    if (appointment.doctor_id._id.toString() !== doctorId.toString()) {
        const err = new Error('Unauthorized to confirm this appointment');
        err.statusCode = 403;
        throw err;
    }

    if (appointment.status !== 'REQUESTED') {
        const err = new Error('Only requested appointments can be confirmed');
        err.statusCode = 400;
        throw err;
    }

    // For online appointments, meeting link is required
    if (appointment.appointment_type === 'ONLINE' && !meetingLink) {
        const err = new Error('Meeting link is required for online appointments');
        err.statusCode = 400;
        throw err;
    }

    // Generate challan number
    const challanNumber = generateChallanNumber();

    // Update appointment
    appointment.status = 'CONFIRMED';
    appointment.challan_number = challanNumber;
    if (meetingLink) {
        appointment.meeting_link = meetingLink;
    }
    await appointment.save();

    // Create payment record
    await Payment.create({
        appointment_id: appointment._id,
        patient_id: appointment.patient_id._id,
        amount: APPOINTMENT_FEE,
        type: 'PAYMENT',
        status: 'PENDING',
        challan_number: challanNumber,
    });

    // Notify patient via socket
    try {
        const io = getIO();
        const patientUserId = appointment.patient_id.user_id?._id;
        if (patientUserId) {
            io.to(`user:${patientUserId}`).emit('appointment:confirmed', {
                appointmentId: appointment._id,
                challanNumber,
                amount: APPOINTMENT_FEE,
                meetingLink: appointment.meeting_link,
            });
        }
    } catch (err) {
        console.error('Socket emit failed:', err);
    }

    // Send confirmation email to patient
    try {
        const patientEmail = appointment.patient_id.user_id?.email;
        if (patientEmail) {
            const content = `
        <p>Your appointment has been <strong style="color: green;">CONFIRMED</strong>!</p>
        <div class="success">
          <strong>Doctor:</strong> Dr. ${appointment.doctor_id.user_id?.full_name}<br/>
          <strong>Date:</strong> ${appointment.appointment_date.toDateString()}<br/>
          <strong>Time:</strong> ${appointment.slot_start_time} - ${appointment.slot_end_time}<br/>
          <strong>Type:</strong> ${appointment.appointment_type}
          ${meetingLink ? `<br/><strong>Meeting Link:</strong> ${meetingLink}` : ''}
        </div>
        <div class="warning">
          <strong>Payment Required</strong><br/>
          Amount: <strong>Rs. ${APPOINTMENT_FEE}</strong><br/>
          Challan Number: <strong>${challanNumber}</strong><br/>
          Please complete payment to confirm your appointment.
        </div>
      `;
            await sendEmail(patientEmail, 'Appointment Confirmed - Payment Required', content);
        }
    } catch (emailErr) {
        console.error('Failed to send confirmation email:', emailErr);
    }

    // AUTO-CANCEL CONFLICTING REQUESTS
    try {
        const conflictingRequests = await Appointment.find({
            _id: { $ne: appointment._id },
            doctor_id: appointment.doctor_id._id,
            appointment_date: appointment.appointment_date,
            slot_start_time: appointment.slot_start_time,
            status: 'REQUESTED'
        }).populate({ path: 'patient_id', populate: { path: 'user_id' } });

        for (const req of conflictingRequests) {
            req.status = 'CANCELLED';
            req.cancelled_by = 'SYSTEM';
            req.cancellation_reason = 'Slot already occupied by another patient';
            await req.save();

            // Send notification email for conflict
            try {
                const patientEmail = req.patient_id.user_id?.email;
                if (patientEmail) {
                    const content = `
                        <p>We regret to inform you that your appointment request with <strong>Dr. ${appointment.doctor_id.user_id?.full_name}</strong> has been <strong style="color: red;">CANCELLED</strong>.</p>
                        <div class="warning">
                            <strong>Reason:</strong> This time slot has been occupied by another patient who requested it earlier or concurrently.
                        </div>
                        <p>Please try booking another available slot or contact the medical center for assistance.</p>
                    `;
                    await sendEmail(patientEmail, 'Appointment Slot Occupied - Request Cancelled', content);
                }
            } catch (err) {
                console.error('Failed to send conflict rejection email:', err);
            }
        }
    } catch (err) {
        console.error('Failed to process conflicting requests:', err);
    }

    return appointment;
};

/**
 * Cleanup expired "REQUESTED" appointments (not accepted within 24 hours)
 */
export const cleanupExpiredRequests = async () => {
    try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const expiredRequests = await Appointment.find({
            status: 'REQUESTED',
            created_at: { $lt: twentyFourHoursAgo }
        }).populate({ path: 'patient_id', populate: { path: 'user_id' } })
            .populate({ path: 'doctor_id', populate: { path: 'user_id' } });

        console.log(`Found ${expiredRequests.length} expired appointment requests`);

        for (const req of expiredRequests) {
            req.status = 'CANCELLED';
            req.cancelled_by = 'SYSTEM';
            req.cancellation_reason = 'Doctor did not respond within 24 hours';
            await req.save();

            // Send expiry email
            try {
                const patientEmail = req.patient_id.user_id?.email;
                if (patientEmail) {
                    const content = `
                        <p>Your appointment request with <strong>Dr. ${req.doctor_id.user_id?.full_name}</strong> has been <strong style="color: red;">CANCELLED</strong>.</p>
                        <div class="warning">
                            <strong>Reason:</strong> The doctor did not respond to your request within the 24-hour window.
                        </div>
                        <p>We apologize for the inconvenience. Please try requesting another slot or choosing a different doctor.</p>
                    `;
                    await sendEmail(patientEmail, 'Appointment Request Expired', content);
                }
            } catch (err) {
                console.error('Failed to send expiry email:', err);
            }
        }

        return expiredRequests.length;
    } catch (err) {
        console.error('Cleanup expired requests failed:', err);
        throw err;
    }
};

/**
 * Process payment for an appointment (MOCK/DEMO MODE for CV projects)
 * Simulates instant payment confirmation - no real payment gateway
 */
export const processPayment = async (appointmentId, patientId) => {
    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
        const err = new Error('Appointment not found');
        err.statusCode = 404;
        throw err;
    }

    if (appointment.status !== 'CONFIRMED') {
        const err = new Error('Appointment must be confirmed before payment');
        err.statusCode = 400;
        throw err;
    }

    if (appointment.payment_status === 'PAID') {
        const err = new Error('Payment already completed');
        err.statusCode = 400;
        throw err;
    }

    // Update appointment payment status
    appointment.payment_status = 'PAID';
    appointment.paid_at = new Date();
    await appointment.save();

    // Update payment record
    await Payment.findOneAndUpdate(
        { appointment_id: appointmentId, type: 'PAYMENT' },
        { status: 'COMPLETED', transaction_date: new Date() }
    );

    return appointment;
};

/**
 * Cancel appointment by patient
 */
export const cancelAppointmentByPatient = async (appointmentId, patientId, reason) => {
    const appointment = await Appointment.findById(appointmentId)
        .populate({ path: 'patient_id', populate: { path: 'user_id' } })
        .populate({ path: 'doctor_id', populate: { path: 'user_id' } });

    if (!appointment) {
        const err = new Error('Appointment not found');
        err.statusCode = 404;
        throw err;
    }

    if (appointment.patient_id._id.toString() !== patientId.toString()) {
        const err = new Error('Unauthorized to cancel this appointment');
        err.statusCode = 403;
        throw err;
    }

    // Requested appointments can always be cancelled
    if (appointment.status === 'REQUESTED') {
        appointment.status = 'CANCELLED';
        appointment.cancelled_by = 'PATIENT';
        appointment.cancellation_reason = reason;
        appointment.cancelled_at = new Date();
        await appointment.save();
        return { appointment, refundAmount: 0, canCancel: true };
    }

    if (appointment.status !== 'CONFIRMED') {
        const err = new Error('Only requested or confirmed appointments can be cancelled');
        err.statusCode = 400;
        throw err;
    }

    // Check if more than 3 days remaining
    const now = new Date();
    const appointmentDateTime = new Date(appointment.appointment_date);
    const daysDiff = Math.ceil((appointmentDateTime - now) / (1000 * 60 * 60 * 24));

    if (daysDiff < MIN_PATIENT_CANCEL_DAYS) {
        const err = new Error(`Cannot cancel appointment with less than ${MIN_PATIENT_CANCEL_DAYS} days remaining. Please request emergency cancellation.`);
        err.statusCode = 400;
        err.needsEmergencyCancellation = true;
        throw err;
    }

    // Calculate refund
    let refundAmount = 0;
    if (appointment.payment_status === 'PAID') {
        refundAmount = APPOINTMENT_FEE - CANCELLATION_DEDUCTION;
        appointment.refund_amount = refundAmount;
        appointment.payment_status = 'PARTIAL_REFUND';

        // Create refund record
        await Payment.create({
            appointment_id: appointment._id,
            patient_id: patientId,
            amount: refundAmount,
            type: 'REFUND',
            status: 'COMPLETED',
            challan_number: `REF-${appointment.challan_number}`,
            refund_reason: reason,
            refund_initiated_by: 'PATIENT',
        });
    }

    appointment.status = 'CANCELLED';
    appointment.cancelled_by = 'PATIENT';
    appointment.cancellation_reason = reason;
    appointment.cancelled_at = new Date();
    await appointment.save();

    // Notify doctor
    try {
        const io = getIO();
        io.to(`doctor:${appointment.doctor_id._id}`).emit('appointment:cancelled', {
            appointmentId: appointment._id,
            patientName: appointment.patient_id.user_id?.full_name,
            cancelledBy: 'PATIENT',
            reason,
        });
    } catch (err) {
        console.error('Socket emit failed:', err);
    }

    // Send cancellation email
    try {
        if (appointment.doctor_id.user_id?.email) {
            const content = `
        <p>An appointment has been cancelled by the patient.</p>
        <div class="warning">
          <strong>Patient:</strong> ${appointment.patient_id.user_id?.full_name}<br/>
          <strong>Date:</strong> ${appointment.appointment_date.toDateString()}<br/>
          <strong>Time:</strong> ${appointment.slot_start_time}<br/>
          <strong>Reason:</strong> ${reason}
        </div>
      `;
            await sendEmail(appointment.doctor_id.user_id.email, 'Appointment Cancelled', content);
        }
    } catch (emailErr) {
        console.error('Failed to send cancellation email:', emailErr);
    }

    return { appointment, refundAmount, canCancel: true };
};

/**
 * Cancel appointment by doctor
 */
export const cancelAppointmentByDoctor = async (appointmentId, doctorId, reason) => {
    const appointment = await Appointment.findById(appointmentId)
        .populate({ path: 'patient_id', populate: { path: 'user_id' } })
        .populate({ path: 'doctor_id', populate: { path: 'user_id' } });

    if (!appointment) {
        const err = new Error('Appointment not found');
        err.statusCode = 404;
        throw err;
    }

    if (appointment.doctor_id._id.toString() !== doctorId.toString()) {
        const err = new Error('Unauthorized to cancel this appointment');
        err.statusCode = 403;
        throw err;
    }

    if (!['REQUESTED', 'CONFIRMED'].includes(appointment.status)) {
        const err = new Error('Only requested or confirmed appointments can be cancelled');
        err.statusCode = 400;
        throw err;
    }

    // Check if more than 1 day remaining for confirmed appointments
    if (appointment.status === 'CONFIRMED') {
        const now = new Date();
        const appointmentDateTime = new Date(appointment.appointment_date);
        const daysDiff = Math.ceil((appointmentDateTime - now) / (1000 * 60 * 60 * 24));

        if (daysDiff < MIN_DOCTOR_CANCEL_DAYS) {
            const err = new Error(`Cannot cancel appointment with less than ${MIN_DOCTOR_CANCEL_DAYS} day remaining`);
            err.statusCode = 400;
            throw err;
        }
    }

    // Full refund for doctor cancellation
    let refundAmount = 0;
    if (appointment.payment_status === 'PAID') {
        refundAmount = APPOINTMENT_FEE;
        appointment.refund_amount = refundAmount;
        appointment.payment_status = 'REFUNDED';

        await Payment.create({
            appointment_id: appointment._id,
            patient_id: appointment.patient_id._id,
            amount: refundAmount,
            type: 'REFUND',
            status: 'COMPLETED',
            challan_number: `REF-${appointment.challan_number}`,
            refund_reason: `Doctor cancelled: ${reason}`,
            refund_initiated_by: 'DOCTOR',
        });
    }

    appointment.status = 'CANCELLED';
    appointment.cancelled_by = 'DOCTOR';
    appointment.cancellation_reason = reason;
    appointment.cancelled_at = new Date();
    await appointment.save();

    // Notify patient
    try {
        const io = getIO();
        const patientUserId = appointment.patient_id.user_id?._id;
        if (patientUserId) {
            io.to(`user:${patientUserId}`).emit('appointment:cancelled', {
                appointmentId: appointment._id,
                doctorName: appointment.doctor_id.user_id?.full_name,
                cancelledBy: 'DOCTOR',
                reason,
                refundAmount,
            });
        }
    } catch (err) {
        console.error('Socket emit failed:', err);
    }

    // Send cancellation email to patient
    try {
        if (appointment.patient_id.user_id?.email) {
            const content = `
        <p>Your appointment has been cancelled by the doctor.</p>
        <div class="warning">
          <strong>Doctor:</strong> Dr. ${appointment.doctor_id.user_id?.full_name}<br/>
          <strong>Date:</strong> ${appointment.appointment_date.toDateString()}<br/>
          <strong>Reason:</strong> ${reason}
        </div>
        ${refundAmount > 0 ? `
          <div class="success">
            <strong>Full Refund:</strong> Rs. ${refundAmount} will be credited to your account.
          </div>
        ` : ''}
      `;
            await sendEmail(appointment.patient_id.user_id.email, 'Appointment Cancelled by Doctor', content);
        }
    } catch (emailErr) {
        console.error('Failed to send cancellation email:', emailErr);
    }

    return { appointment, refundAmount };
};

/**
 * Reschedule an appointment (Doctor)
 */
export const rescheduleAppointment = async (appointmentId, doctorId, newDateTime) => {
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
        const err = new Error('Appointment not found');
        err.statusCode = 404;
        throw err;
    }

    if (appointment.doctor_id.toString() !== doctorId.toString()) {
        const err = new Error('Unauthorized');
        err.statusCode = 403;
        throw err;
    }

    // Parse new date and time
    const [datePart, timePart] = newDateTime.split('T');
    const newDate = new Date(datePart);
    newDate.setHours(0, 0, 0, 0);

    // Check availability
    const availableSlots = await getAvailableSlots(doctorId, datePart);
    const isAvailable = availableSlots.some(s => s.time === timePart);

    if (!isAvailable) {
        const err = new Error('Selected slot is no longer available');
        err.statusCode = 400;
        throw err;
    }

    // Update appointment
    appointment.appointment_date = newDate;
    appointment.slot_start_time = timePart;
    appointment.slot_end_time = calculateEndTime(timePart);

    await appointment.save();

    // Send notification/email
    try {
        const patient = await Patient.findById(appointment.patient_id).populate('user_id');
        if (patient && patient.user_id) {
            await sendEmail(patient.user_id.email, 'Appointment Rescheduled', `Your appointment has been rescheduled to ${datePart} at ${timePart}.`);
        }
    } catch (err) {
        console.error('Failed to send reschedule email:', err);
    }

    return appointment;
};

/**
 * Request emergency cancellation (for appointments within 3 days)
 */
export const requestEmergencyCancellation = async (appointmentId, patientId, reason) => {
    const appointment = await Appointment.findById(appointmentId)
        .populate({ path: 'patient_id', populate: { path: 'user_id' } });

    if (!appointment) {
        const err = new Error('Appointment not found');
        err.statusCode = 404;
        throw err;
    }

    if (appointment.patient_id._id.toString() !== patientId.toString()) {
        const err = new Error('Unauthorized');
        err.statusCode = 403;
        throw err;
    }

    if (appointment.status !== 'CONFIRMED') {
        const err = new Error('Only confirmed appointments can request emergency cancellation');
        err.statusCode = 400;
        throw err;
    }

    // Check if there's already a pending request
    const existingRequest = await EmergencyCancellationRequest.findOne({
        appointment_id: appointmentId,
        status: 'PENDING'
    });

    if (existingRequest) {
        const err = new Error('An emergency cancellation request is already pending');
        err.statusCode = 400;
        throw err;
    }

    // Check if appointment is at least 12 hours away
    const appointmentDateTime = new Date(appointment.appointment_date);
    const [hours, minutes] = appointment.slot_start_time.split(':').map(Number);
    appointmentDateTime.setHours(hours, minutes, 0, 0);

    const now = new Date();
    const hoursUntilAppointment = (appointmentDateTime - now) / (1000 * 60 * 60);

    if (hoursUntilAppointment < EMERGENCY_REVIEW_WINDOW_HOURS) {
        const err = new Error(`Emergency cancellation requests must be submitted at least ${EMERGENCY_REVIEW_WINDOW_HOURS} hours before the appointment`);
        err.statusCode = 400;
        throw err;
    }

    // Calculate expiry (12 hours before appointment)
    const expiresAt = new Date(appointmentDateTime);
    expiresAt.setHours(expiresAt.getHours() - EMERGENCY_REVIEW_WINDOW_HOURS);

    const request = await EmergencyCancellationRequest.create({
        appointment_id: appointmentId,
        patient_id: patientId,
        reason,
        status: 'PENDING',
        expires_at: expiresAt,
    });

    return request;
};

/**
 * Review emergency cancellation request (Admin action)
 */
export const reviewEmergencyCancellation = async (requestId, adminId, approved, notes = '') => {
    const request = await EmergencyCancellationRequest.findById(requestId)
        .populate({
            path: 'appointment_id', populate: [
                { path: 'patient_id', populate: { path: 'user_id' } },
                { path: 'doctor_id', populate: { path: 'user_id' } }
            ]
        });

    if (!request) {
        const err = new Error('Request not found');
        err.statusCode = 404;
        throw err;
    }

    if (request.status !== 'PENDING') {
        const err = new Error('Request has already been reviewed');
        err.statusCode = 400;
        throw err;
    }

    const appointment = request.appointment_id;

    request.status = approved ? 'APPROVED' : 'REJECTED';
    request.admin_id = adminId;
    request.admin_notes = notes;
    request.reviewed_at = new Date();
    await request.save();

    if (approved) {
        // Full refund for emergency cancellation
        let refundAmount = 0;
        if (appointment.payment_status === 'PAID') {
            refundAmount = APPOINTMENT_FEE;
            appointment.refund_amount = refundAmount;
            appointment.payment_status = 'REFUNDED';

            await Payment.create({
                appointment_id: appointment._id,
                patient_id: appointment.patient_id._id,
                amount: refundAmount,
                type: 'REFUND',
                status: 'COMPLETED',
                challan_number: `EMREF-${appointment.challan_number}`,
                refund_reason: `Emergency cancellation approved: ${request.reason}`,
                refund_initiated_by: 'ADMIN',
            });
        }

        appointment.status = 'CANCELLED';
        appointment.cancelled_by = 'ADMIN';
        appointment.cancellation_reason = `Emergency cancellation: ${request.reason}`;
        appointment.cancelled_at = new Date();
        await appointment.save();

        // Notify patient
        try {
            const patientEmail = appointment.patient_id.user_id?.email;
            if (patientEmail) {
                const content = `
          <p>Your emergency cancellation request has been <strong style="color: green;">APPROVED</strong>.</p>
          <div class="success">
            <strong>Appointment:</strong> ${appointment.appointment_date.toDateString()} at ${appointment.slot_start_time}<br/>
            <strong>Full Refund:</strong> Rs. ${refundAmount} will be credited to your account.
          </div>
        `;
                await sendEmail(patientEmail, 'Emergency Cancellation Approved', content);
            }
        } catch (emailErr) {
            console.error('Failed to send approval email:', emailErr);
        }

        // Notify doctor
        try {
            const doctorEmail = appointment.doctor_id.user_id?.email;
            if (doctorEmail) {
                const content = `
          <p>An appointment has been cancelled due to patient emergency.</p>
          <div class="warning">
            <strong>Patient:</strong> ${appointment.patient_id.user_id?.full_name}<br/>
            <strong>Date:</strong> ${appointment.appointment_date.toDateString()}<br/>
            <strong>Time:</strong> ${appointment.slot_start_time}
          </div>
        `;
                await sendEmail(doctorEmail, 'Appointment Cancelled - Emergency', content);
            }
        } catch (emailErr) {
            console.error('Failed to send doctor notification:', emailErr);
        }

        return { request, refundAmount };
    } else {
        // Rejected - notify patient
        try {
            const patientEmail = appointment.patient_id.user_id?.email;
            if (patientEmail) {
                const content = `
          <p>Your emergency cancellation request has been <strong style="color: red;">REJECTED</strong>.</p>
          <div class="warning">
            <strong>Appointment:</strong> ${appointment.appointment_date.toDateString()} at ${appointment.slot_start_time}<br/>
            <strong>Admin Notes:</strong> ${notes || 'No additional notes'}
          </div>
          <p>Please attend your appointment or contact support for assistance.</p>
        `;
                await sendEmail(patientEmail, 'Emergency Cancellation Request Rejected', content);
            }
        } catch (emailErr) {
            console.error('Failed to send rejection email:', emailErr);
        }

        return { request, refundAmount: 0 };
    }
};

/**
 * Complete appointment (Doctor action)
 */
export const completeAppointment = async (appointmentId, doctorId, prescription, instructions) => {
    const appointment = await Appointment.findById(appointmentId)
        .populate({ path: 'patient_id', populate: { path: 'user_id' } })
        .populate({ path: 'doctor_id', populate: { path: 'user_id' } });

    if (!appointment) {
        const err = new Error('Appointment not found');
        err.statusCode = 404;
        throw err;
    }

    if (appointment.doctor_id._id.toString() !== doctorId.toString()) {
        const err = new Error('Unauthorized');
        err.statusCode = 403;
        throw err;
    }

    if (appointment.status !== 'CONFIRMED') {
        const err = new Error('Only confirmed appointments can be completed');
        err.statusCode = 400;
        throw err;
    }

    appointment.status = 'COMPLETED';
    appointment.prescription = prescription;
    appointment.instructions = instructions;
    appointment.completed_at = new Date();
    appointment.patient_attended = true;
    appointment.chat_enabled = true;
    await appointment.save();

    // Notify patient
    try {
        const io = getIO();
        const patientUserId = appointment.patient_id.user_id?._id;
        if (patientUserId) {
            io.to(`user:${patientUserId}`).emit('appointment:completed', {
                appointmentId: appointment._id,
                prescription,
                instructions,
                chatEnabled: true,
            });
        }
    } catch (err) {
        console.error('Socket emit failed:', err);
    }

    // Send completion email
    try {
        const patientEmail = appointment.patient_id.user_id?.email;
        if (patientEmail) {
            const content = `
        <p>Your appointment has been completed. Here are the details:</p>
        <div class="success">
          <strong>Doctor:</strong> Dr. ${appointment.doctor_id.user_id?.full_name}<br/>
          <strong>Date:</strong> ${appointment.appointment_date.toDateString()}
        </div>
        <h3>Prescription</h3>
        <p>${prescription || 'No prescription provided'}</p>
        <h3>Instructions</h3>
        <p>${instructions || 'No special instructions'}</p>
        <p>You can now chat with the doctor for any follow-up questions.</p>
      `;
            await sendEmail(patientEmail, 'Appointment Completed - Prescription Details', content);
        }
    } catch (emailErr) {
        console.error('Failed to send completion email:', emailErr);
    }

    return appointment;
};

/**
 * Mark patient as no-show (Doctor action)
 */
export const markNoShow = async (appointmentId, doctorId) => {
    const appointment = await Appointment.findById(appointmentId)
        .populate({ path: 'patient_id', populate: { path: 'user_id' } })
        .populate({ path: 'doctor_id', populate: { path: 'user_id' } });

    if (!appointment) {
        const err = new Error('Appointment not found');
        err.statusCode = 404;
        throw err;
    }

    if (appointment.doctor_id._id.toString() !== doctorId.toString()) {
        const err = new Error('Unauthorized');
        err.statusCode = 403;
        throw err;
    }

    if (appointment.status !== 'CONFIRMED') {
        const err = new Error('Only confirmed appointments can be marked as no-show');
        err.statusCode = 400;
        throw err;
    }

    appointment.status = 'NO_SHOW';
    appointment.patient_attended = false;
    await appointment.save();

    // Send no-show email to patient
    try {
        const patientEmail = appointment.patient_id.user_id?.email;
        if (patientEmail) {
            const content = `
        <div class="warning">
          <strong>Missed Appointment Notice</strong>
        </div>
        <p>You have been marked as a no-show for your appointment:</p>
        <ul>
          <li><strong>Doctor:</strong> Dr. ${appointment.doctor_id.user_id?.full_name}</li>
          <li><strong>Date:</strong> ${appointment.appointment_date.toDateString()}</li>
          <li><strong>Time:</strong> ${appointment.slot_start_time}</li>
        </ul>
        <p>Please contact us if this was in error or to reschedule.</p>
      `;
            await sendEmail(patientEmail, 'Missed Appointment - No Show', content);
        }
    } catch (emailErr) {
        console.error('Failed to send no-show email:', emailErr);
    }

    return appointment;
};

/**
 * Get patient's appointments with pagination
 */
export const getPatientAppointments = async (patientId, status = null, page = 0, size = 10) => {
    const query = { patient_id: patientId };
    if (status) {
        if (typeof status === 'string' && status.includes(',')) {
            query.status = { $in: status.split(',') };
        } else if (Array.isArray(status)) {
            query.status = { $in: status };
        } else {
            query.status = status;
        }
    }

    const skip = page * size;
    const totalElements = await Appointment.countDocuments(query);
    const appointments = await Appointment.find(query)
        .populate({ path: 'doctor_id', populate: { path: 'user_id', select: 'full_name email' } })
        .sort({ appointment_date: -1, slot_start_time: -1 })
        .skip(skip)
        .limit(size)
        .lean();

    return {
        content: appointments.map(apt => ({
            id: apt._id,
            doctorId: apt.doctor_id?._id,
            doctorName: apt.doctor_id?.user_id?.full_name || 'Unknown Doctor',
            doctorEmail: apt.doctor_id?.user_id?.email,
            specialization: apt.doctor_id?.specialization,
            appointmentDate: apt.appointment_date,
            slotStartTime: apt.slot_start_time,
            slotEndTime: apt.slot_end_time,
            appointmentType: apt.appointment_type,
            status: apt.status,
            reason: apt.reason,
            meetingLink: apt.meeting_link,
            location: apt.location,
            paymentStatus: apt.payment_status,
            paymentAmount: apt.payment_amount,
            refundAmount: apt.refund_amount,
            challanNumber: apt.challan_number,
            prescription: apt.prescription,
            instructions: apt.instructions,
            completedAt: apt.completed_at,
            cancelledBy: apt.cancelled_by,
            cancellationReason: apt.cancellation_reason,
            chatEnabled: apt.chat_enabled,
            createdAt: apt.created_at,
        })),
        pageNumber: page,
        pageSize: size,
        totalElements,
        totalPages: Math.ceil(totalElements / size)
    };
};

/**
 * Get doctor's appointments with pagination
 */
export const getDoctorAppointments = async (doctorId, status = null, date = null, page = 0, size = 10) => {
    const query = { doctor_id: doctorId };
    if (status) {
        if (typeof status === 'string' && status.includes(',')) {
            query.status = { $in: status.split(',') };
        } else if (Array.isArray(status)) {
            query.status = { $in: status };
        } else {
            query.status = status;
        }
    }
    if (date) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        query.appointment_date = { $gte: startOfDay, $lte: endOfDay };
    }

    const skip = page * size;
    const totalElements = await Appointment.countDocuments(query);
    const appointments = await Appointment.find(query)
        .populate({ path: 'patient_id', populate: { path: 'user_id', select: 'full_name email' } })
        .sort({ appointment_date: 1, slot_start_time: 1 })
        .skip(skip)
        .limit(size)
        .lean();

    return {
        content: appointments.map(apt => ({
            id: apt._id,
            patientId: apt.patient_id?._id,
            patientName: apt.patient_id?.user_id?.full_name || 'Unknown Patient',
            patientEmail: apt.patient_id?.user_id?.email,
            appointmentDate: apt.appointment_date,
            slotStartTime: apt.slot_start_time,
            slotEndTime: apt.slot_end_time,
            appointmentType: apt.appointment_type,
            status: apt.status,
            reason: apt.reason,
            meetingLink: apt.meeting_link,
            paymentStatus: apt.payment_status,
            prescription: apt.prescription,
            instructions: apt.instructions,
            cancelledBy: apt.cancelled_by,
            cancellationReason: apt.cancellation_reason,
            createdAt: apt.created_at,
        })),
        pageNumber: page,
        pageSize: size,
        totalElements,
        totalPages: Math.ceil(totalElements / size)
    };
};

/**
 * Get doctor's daily schedule
 */
export const getDoctorDailySchedule = async (doctorId, date = null) => {
    const targetDate = date ? new Date(date) : new Date();
    return getDoctorAppointments(doctorId, 'CONFIRMED', targetDate);
};

/**
 * Get doctor's next day schedule
 */
export const getDoctorNextDaySchedule = async (doctorId) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return getDoctorAppointments(doctorId, 'CONFIRMED', tomorrow);
};

/**
 * Get pending emergency cancellation requests
 */
export const getPendingEmergencyCancellations = async () => {
    const requests = await EmergencyCancellationRequest.find({ status: 'PENDING' })
        .populate({
            path: 'appointment_id',
            populate: [
                { path: 'patient_id', populate: { path: 'user_id', select: 'full_name email' } },
                { path: 'doctor_id', populate: { path: 'user_id', select: 'full_name' } }
            ]
        })
        .sort({ created_at: 1 })
        .lean();

    return requests.map(req => ({
        id: req._id,
        appointmentId: req.appointment_id?._id,
        patientName: req.appointment_id?.patient_id?.user_id?.full_name,
        patientEmail: req.appointment_id?.patient_id?.user_id?.email,
        doctorName: req.appointment_id?.doctor_id?.user_id?.full_name,
        appointmentDate: req.appointment_id?.appointment_date,
        appointmentTime: req.appointment_id?.slot_start_time,
        reason: req.reason,
        status: req.status,
        expiresAt: req.expires_at,
        createdAt: req.created_at,
    }));
};

/**
 * Get appointment by ID with full details
 */
export const getAppointmentById = async (appointmentId) => {
    const appointment = await Appointment.findById(appointmentId)
        .populate({ path: 'patient_id', populate: { path: 'user_id', select: 'full_name email' } })
        .populate({ path: 'doctor_id', populate: { path: 'user_id', select: 'full_name email' } })
        .lean();

    if (!appointment) {
        return null;
    }

    return {
        id: appointment._id,
        patientId: appointment.patient_id?._id,
        patientName: appointment.patient_id?.user_id?.full_name,
        patientEmail: appointment.patient_id?.user_id?.email,
        doctorId: appointment.doctor_id?._id,
        doctorName: appointment.doctor_id?.user_id?.full_name,
        doctorEmail: appointment.doctor_id?.user_id?.email,
        specialization: appointment.doctor_id?.specialization,
        appointmentDate: appointment.appointment_date,
        slotStartTime: appointment.slot_start_time,
        slotEndTime: appointment.slot_end_time,
        appointmentType: appointment.appointment_type,
        status: appointment.status,
        reason: appointment.reason,
        meetingLink: appointment.meeting_link,
        location: appointment.location,
        paymentStatus: appointment.payment_status,
        paymentAmount: appointment.payment_amount,
        refundAmount: appointment.refund_amount,
        challanNumber: appointment.challan_number,
        prescription: appointment.prescription,
        instructions: appointment.instructions,
        completedAt: appointment.completed_at,
        cancelledBy: appointment.cancelled_by,
        cancellationReason: appointment.cancellation_reason,
        chatEnabled: appointment.chat_enabled,
        createdAt: appointment.created_at,
    };
};
