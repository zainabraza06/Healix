import Appointment from '../models/Appointment.js';
import Prescription from '../models/Prescription.js';
import Payment from '../models/Payment.js';
import EmergencyCancellationRequest from '../models/EmergencyCancellationRequest.js';
import DoctorEmergencyRescheduleRequest from '../models/DoctorEmergencyRescheduleRequest.js';
import Doctor from '../models/Doctor.js';
import Patient from '../models/Patient.js';

// Import helper functions
import { getIO } from '../config/socket.js';
import { sendEmail, sendEmailAsync } from '../config/email.js';

// Constants
const WORKING_HOURS = {
  start: 9, // 9 AM
  end: 17, // 5 PM
  breakStart: 13, // 1 PM
  breakEnd: 14 // 2 PM
};

const SLOT_DURATION_MINUTES = 30;
const APPOINTMENT_FEE = 1000;
const CANCELLATION_DEDUCTION = 250;
const MIN_BOOKING_DAYS_ADVANCE = 3;
const MAX_BOOKING_DAYS_ADVANCE = 30;
const MIN_PATIENT_CANCEL_HOURS = 24;
const MIN_DOCTOR_CANCEL_HOURS = 24;
const EMERGENCY_REVIEW_WINDOW_HOURS = 12;

/**
 * Calculate end time for a slot
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

  // Check if it's a weekend (Saturday = 6, Sunday = 0)
  const dayOfWeek = queryDate.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return [];
  }

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

const parseTimeToDate = (dateValue, timeStr) => {
  if (!timeStr) return new Date(dateValue);
  const [hours, minutes] = timeStr.split(':').map(Number);
  const dt = new Date(dateValue);
  dt.setHours(hours || 0, minutes || 0, 0, 0);
  return dt;
};

const getAppointmentEndDateTime = (appointment) => {
  const endTime = appointment.slot_end_time || calculateEndTime(appointment.slot_start_time);
  return parseTimeToDate(appointment.appointment_date, endTime);
};

const getTodayDateRange = () => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return { startOfToday, endOfToday };
};

const getCurrentTimeString = () => {
  const now = new Date();
  return now.toTimeString().slice(0, 5);
};

const generateChallanNumber = () => `CH-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;

const markPastConfirmedAppointments = async () => {
  const { startOfToday, endOfToday } = getTodayDateRange();
  const currentTime = getCurrentTimeString();

  await Appointment.updateMany(
    {
      status: 'CONFIRMED',
      payment_status: 'PAID',
      $or: [
        { appointment_date: { $lt: startOfToday } },
        {
          appointment_date: { $gte: startOfToday, $lte: endOfToday },
          slot_end_time: { $lte: currentTime },
        },
      ],
    },
    { $set: { status: 'PAST' } }
  );
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

  // Check if it's a weekend
  const dayOfWeek = appointmentDateObj.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    const err = new Error('Appointments cannot be booked on weekends (Saturday/Sunday)');
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

  // Allow confirming both REQUESTED and RESCHEDULE_REQUESTED appointments
  if (appointment.status !== 'REQUESTED' && appointment.status !== 'RESCHEDULE_REQUESTED') {
    const err = new Error('Only requested or reschedule-requested appointments can be confirmed');
    err.statusCode = 400;
    throw err;
  }

  // For online appointments, meeting link is required
  if (appointment.appointment_type === 'ONLINE' && !meetingLink) {
    const err = new Error('Meeting link is required for online appointments');
    err.statusCode = 400;
    throw err;
  }

  // Update appointment
  appointment.status = 'CONFIRMED';
  if (meetingLink) {
    appointment.meeting_link = meetingLink;
  }

  // Check if this is a rescheduled appointment (has challan_number and PAID status)
  const isRescheduledWithPayment = appointment.challan_number && appointment.payment_status === 'PAID';

  if (isRescheduledWithPayment) {
    // Rescheduled appointment with existing payment - auto-confirm
    // Payment already exists and is PAID, so no new payment needed
    // Clear reschedule rejection flags if any
    appointment.reschedule_rejected = false;
    appointment.reschedule_rejection_reason = undefined;
    appointment.patient_responded_to_doctor_reschedule = false;
    appointment.reschedule_requested_by = undefined;
    await appointment.save();

    // Notify patient of confirmation
    try {
      const io = getIO();
      io.to(`patient:${appointment.patient_id._id}`).emit('appointment:confirmed', {
        appointmentId: appointment._id,
        doctorName: appointment.doctor_id.user_id?.full_name,
        newDate: appointment.appointment_date,
      });
    } catch (err) {
      console.error('Socket emit failed:', err);
    }

    // Send confirmation email
    try {
      if (appointment.patient_id.user_id?.email) {
        const content = `
          <p>Your rescheduled appointment has been confirmed!</p>
          <div class="info">
            <strong>Doctor:</strong> Dr. ${appointment.doctor_id.user_id?.full_name}<br/>
            <strong>Date:</strong> ${new Date(appointment.appointment_date).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}<br/>
            <strong>Time:</strong> ${appointment.slot_start_time} - ${appointment.slot_end_time}<br/>
            <strong>Type:</strong> ${appointment.appointment_type === 'ONLINE' ? 'Online Consultation' : 'In-Person'}<br/>
            ${appointment.appointment_type === 'ONLINE' ? `<strong>Meeting Link:</strong> ${appointment.meeting_link}<br/>` : ''}
            <strong>Payment:</strong> Already Paid (Rs. 1000) - No new payment needed
          </div>
        `;
        // Use async email (non-blocking)
        sendEmailAsync(appointment.patient_id.user_id?.email, 'Appointment Confirmed - Rescheduled Slot', content);
      }
    } catch (err) {
      console.error('Failed to send email:', err);
    }

    return appointment;
  }

  // For new appointments (no challan_number), create payment record
  const challanNumber = generateChallanNumber();
  appointment.challan_number = challanNumber;
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

  // Send confirmation email to patient (non-blocking)
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
      // Use async email (non-blocking)
      sendEmailAsync(patientEmail, 'Appointment Confirmed - Payment Required', content);
    }
  } catch (emailErr) {
    console.error('Failed to queue confirmation email:', emailErr);
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
 * Auto-cancel CONFIRMED appointments with PENDING payment when 1 day or less until appointment
 */
export const cancelUnpaidConfirmedAppointments = async () => {
  try {
    const now = new Date();
    
    // Find all CONFIRMED appointments with PENDING payment
    const unpaidAppointments = await Appointment.find({
      status: 'CONFIRMED',
      payment_status: 'PENDING',
    })
      .populate({ path: 'patient_id', populate: { path: 'user_id' } })
      .populate({ path: 'doctor_id', populate: { path: 'user_id' } });

    let cancelledCount = 0;

    for (const apt of unpaidAppointments) {
      // Calculate hours remaining until appointment
      const appointmentDateTime = new Date(apt.appointment_date);
      const [hours, minutes] = apt.slot_start_time.split(':').map(Number);
      appointmentDateTime.setHours(hours, minutes, 0, 0);
      
      const hoursRemaining = (appointmentDateTime - now) / (1000 * 60 * 60);

      // Cancel if less than 24 hours remaining
      if (hoursRemaining < 24) {
        apt.status = 'CANCELLED';
        apt.cancelled_by = 'SYSTEM';
        apt.cancellation_reason = 'Payment not completed - less than 24 hours remaining';
        apt.cancelled_at = new Date();
        await apt.save();
        cancelledCount++;

        try {
          const patientEmail = apt.patient_id?.user_id?.email;
          const patientName = apt.patient_id?.user_id?.full_name;
          const doctorName = apt.doctor_id?.user_id?.full_name;
          
          if (patientEmail) {
            const content = `
              <p>Your appointment with <strong>Dr. ${doctorName}</strong> has been <strong style="color: red;">CANCELLED</strong>.</p>
              <div class="warning">
                <strong>Appointment Details:</strong><br/>
                Date: ${apt.appointment_date?.toDateString?.()}<br/>
                Time: ${apt.slot_start_time}
              </div>
              <div class="info">
                <strong>Reason for Cancellation:</strong> Payment was not completed.
              </div>
              <p>Your appointment was scheduled for less than 24 hours from now, and payment must be completed at least 24 hours in advance.</p>
              <p>Please book a new appointment if you still need to see the doctor.</p>
              <p>For more information, please contact support.</p>
            `;
            await sendEmail(patientEmail, 'Appointment Cancelled - Payment Not Completed', content);
            
            console.log(`[SCHEDULER] Cancelled unpaid appointment ${apt._id} for patient ${patientName} (${hoursRemaining.toFixed(2)} hours remaining)`);
          }
        } catch (err) {
          console.error(`[SCHEDULER] Failed to send cancellation email for appointment ${apt._id}:`, err);
        }
      }
    }
    
    console.log(`[SCHEDULER] Total unpaid appointments cancelled: ${cancelledCount}`);
    return cancelledCount;
  } catch (err) {
    console.error('[SCHEDULER] cancelUnpaidConfirmedAppointments failed:', err);
    throw err;
  }
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
 * Reject rescheduled appointment (Doctor rejects patient's reschedule request)
 * Patient can then either keep original slot or cancel with partial refund
 */
export const rejectRescheduledAppointment = async (appointmentId, doctorId, reason) => {
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

  if (appointment.status !== 'RESCHEDULE_REQUESTED' || appointment.reschedule_requested_by !== 'PATIENT') {
    const err = new Error('Only patient reschedule requests can be rejected');
    err.statusCode = 400;
    throw err;
  }

  // Store original appointment date/time to revert if needed
  const originalDate = appointment.appointment_date;
  const originalTime = appointment.slot_start_time;

  // Set a flag that this was rejected - patient will get options
  appointment.reschedule_rejected = true;
  appointment.reschedule_rejection_reason = reason;
  await appointment.save();

  // Notify patient
  try {
    const io = getIO();
    const patientUserId = appointment.patient_id.user_id?._id;
    if (patientUserId) {
      io.to(`user:${patientUserId}`).emit('reschedule:rejected', {
        appointmentId: appointment._id,
        doctorName: appointment.doctor_id.user_id?.full_name,
        reason,
      });
    }
  } catch (err) {
    console.error('Socket emit failed:', err);
  }

  // Send notification email to patient
  try {
    if (appointment.patient_id.user_id?.email) {
      const content = `
        <p>Your appointment reschedule request has been <strong style="color: orange;">DECLINED</strong> by Dr. ${appointment.doctor_id.user_id?.full_name}.</p>
        <div class="warning">
          <strong>Reason:</strong> ${reason}
        </div>
        <p><strong>Your options:</strong></p>
        <ul>
          <li><strong>Keep Original Slot:</strong> Your appointment remains on the original date/time (${new Date(originalDate).toDateString()} at ${originalTime})</li>
          <li><strong>Cancel:</strong> Cancel the appointment and receive Rs. 750 refund (Rs. 250 cancellation fee deducted from Rs. 1000)</li>
        </ul>
        <p>Please log in to your dashboard to choose an option.</p>
      `;
      await sendEmail(appointment.patient_id.user_id.email, 'Appointment Reschedule Declined', content);
    }
  } catch (err) {
    console.error('Failed to send email:', err);
  }

  return appointment;
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
 * Handle patient's response to rejected reschedule (keep original or cancel)
 */
export const handleRescheduleRejectionResponse = async (appointmentId, patientId, action, reason = '') => {
  const appointment = await Appointment.findById(appointmentId)
    .populate({ path: 'patient_id', populate: { path: 'user_id' } })
    .populate({ path: 'doctor_id', populate: { path: 'user_id' } });

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

  if (!appointment.reschedule_rejected) {
    const err = new Error('This appointment does not have a rejected reschedule');
    err.statusCode = 400;
    throw err;
  }

  if (action === 'keep_original') {
    // Revert to original appointment details - they're already stored in the document
    // Just mark as confirmed again and clear the rejection flag
    appointment.reschedule_rejected = false;
    appointment.reschedule_rejection_reason = null;
    appointment.status = 'CONFIRMED';
    appointment.payment_status = 'PAID';
    await appointment.save();

    // Notify doctor
    try {
      if (appointment.doctor_id.user_id?.email) {
        const content = `
          <p>Patient <strong>${appointment.patient_id.user_id?.full_name}</strong> has chosen to keep their original appointment slot.</p>
          <div class="success">
            <strong>Date:</strong> ${appointment.appointment_date.toDateString()}<br/>
            <strong>Time:</strong> ${appointment.slot_start_time}
          </div>
        `;
        await sendEmail(appointment.doctor_id.user_id.email, 'Patient Kept Original Appointment', content);
      }
    } catch (err) {
      console.error('Failed to send email:', err);
    }

    return { appointment, message: 'Original appointment confirmed' };
  }

  if (action === 'cancel') {
    // Cancel with partial refund (Rs. 250 deduction)
    let refundAmount = 0;
    if (appointment.payment_status === 'PAID') {
      refundAmount = APPOINTMENT_FEE - CANCELLATION_DEDUCTION; // 1000 - 250 = 750
      appointment.refund_amount = refundAmount;
      appointment.payment_status = 'PARTIAL_REFUND';

      await Payment.create({
        appointment_id: appointment._id,
        patient_id: patientId,
        amount: refundAmount,
        type: 'REFUND',
        status: 'COMPLETED',
        challan_number: `REF-${appointment.challan_number}`,
        refund_reason: `Patient cancelled after reschedule rejection: ${reason}`,
        refund_initiated_by: 'PATIENT',
      });
    }

    appointment.status = 'CANCELLED';
    appointment.cancelled_by = 'PATIENT';
    appointment.cancellation_reason = reason || 'Cancelled after reschedule rejection';
    appointment.cancelled_at = new Date();
    appointment.reschedule_rejected = false;
    await appointment.save();

    // Notify doctor
    try {
      if (appointment.doctor_id.user_id?.email) {
        const content = `
          <p>Patient <strong>${appointment.patient_id.user_id?.full_name}</strong> has cancelled their appointment after reschedule rejection.</p>
          <div class="info">
            <strong>Refund:</strong> Rs. ${refundAmount} (Rs. 250 cancellation fee deducted)
          </div>
        `;
        await sendEmail(appointment.doctor_id.user_id.email, 'Patient Cancelled Appointment', content);
      }
    } catch (err) {
      console.error('Failed to send email:', err);
    }

    return { appointment, refundAmount, message: 'Appointment cancelled with partial refund' };
  }

  const err = new Error('Invalid action. Must be "keep_original" or "cancel"');
  err.statusCode = 400;
  throw err;
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

  // Patient can cancel REQUESTED appointments (withdraw request) - no payment involved
  if (appointment.status === 'REQUESTED') {
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

    try {
      if (appointment.doctor_id.user_id?.email) {
        const content = `
          <p>Patient <strong>${appointment.patient_id.user_id?.full_name}</strong> has withdrawn their appointment request.</p>
          <div class="info">
            <strong>Reason:</strong> ${reason}
          </div>
        `;
        await sendEmail(appointment.doctor_id.user_id?.email, 'Appointment Request Withdrawn', content);
      }
    } catch (err) {
      console.error('Failed to send email:', err);
    }

    return { appointment, refundAmount: 0 };
  }

  if (appointment.status !== 'CONFIRMED') {
    const err = new Error('Only requested or confirmed appointments can be cancelled');
    err.statusCode = 400;
    throw err;
  }

  // Check if more than 24 hours remaining
  const now = new Date();
  const appointmentDateTime = parseTimeToDate(appointment.appointment_date, appointment.slot_start_time);
  const hoursDiff = (appointmentDateTime - now) / (1000 * 60 * 60);

  // Logic 6: Patient CANNOT cancel if less than 24 hours remaining, NO emergency cancellation option
  if (hoursDiff < MIN_PATIENT_CANCEL_HOURS) {
    const err = new Error(`Cannot cancel appointment with less than ${MIN_PATIENT_CANCEL_HOURS} hours remaining.`);
    err.statusCode = 400;
    throw err;
  }

  // Calculate refund
  // Logic 6: Deduct 250 from charges, refund 750 (total fee is 1000)
  let refundAmount = 0;
  if (appointment.payment_status === 'PAID') {
    refundAmount = APPOINTMENT_FEE - CANCELLATION_DEDUCTION; // 1000 - 250 = 750
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

  // Send refund confirmation email to patient (if paid)
  if (appointment.payment_status === 'PARTIAL_REFUND' && refundAmount > 0) {
    try {
      if (appointment.patient_id.user_id?.email) {
        const content = `
          <p>Your appointment has been <strong style="color: red;">CANCELLED</strong> successfully.</p>
          <div class="success">
            <strong>Doctor:</strong> Dr. ${appointment.doctor_id.user_id?.full_name}<br/>
            <strong>Date:</strong> ${appointment.appointment_date.toDateString()}<br/>
            <strong>Time:</strong> ${appointment.slot_start_time} - ${appointment.slot_end_time}
          </div>
          <div class="info">
            <h3 style="color: green;">Refund Details</h3>
            <strong>Original Payment:</strong> Rs. 1,000<br/>
            <strong>Refund Amount:</strong> Rs. ${refundAmount.toLocaleString()}<br/>
            <strong>Deduction:</strong> Rs. 250 (Cancellation fee)<br/>
            <strong>Challan Number:</strong> ${appointment.challan_number}<br/>
            <strong>Refund Status:</strong> Processed
          </div>
          <p>The refund will be credited to your original payment method within 5-7 business days.</p>
          <p>If you have any questions, please contact support.</p>
        `;
        await sendEmail(appointment.patient_id.user_id?.email, 'Appointment Cancelled - Refund Processed', content);
      }
    } catch (err) {
      console.error('Failed to send patient refund email:', err);
    }
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

  if (!['REQUESTED', 'CONFIRMED', 'RESCHEDULE_REQUESTED'].includes(appointment.status)) {
    const err = new Error('Only requested, confirmed, or reschedule-requested appointments can be cancelled');
    err.statusCode = 400;
    throw err;
  }

  // Logic for RESCHEDULE_REQUESTED: Patient gets option to keep original slot or cancel with deduction
  if (appointment.status === 'RESCHEDULE_REQUESTED') {
    // Store the cancellation request but DON'T change status yet
    // Set a flag that patient needs to choose
    appointment.doctor_cancelled_reschedule_request = true;
    appointment.doctor_cancellation_reason = reason;
    appointment.doctor_cancelled_at = new Date();
    await appointment.save();

    try {
      const io = getIO();
      const patientUserId = appointment.patient_id.user_id?._id;
      const patientId = appointment.patient_id._id;
      
      if (patientUserId) {
        io.to(`user:${patientUserId}`).emit('reschedule:doctor_cancelled', {
          appointmentId: appointment._id,
          doctorName: appointment.doctor_id.user_id?.full_name,
          reason,
          requiresPatientChoice: true,
        });
      }
      
      if (patientId) {
        io.to(`patient:${patientId}`).emit('reschedule:doctor_cancelled', {
          appointmentId: appointment._id,
          doctorName: appointment.doctor_id.user_id?.full_name,
          reason,
          requiresPatientChoice: true,
        });
      }
    } catch (err) {
      console.error('Socket emit failed:', err);
    }

    // Send email to patient with options
    sendEmailAsync(
      appointment.patient_id.user_id?.email,
      'Doctor Cancelled Reschedule Request - Action Required',
      `
        <p>Dr. ${appointment.doctor_id.user_id?.full_name} has cancelled the reschedule request for your appointment.</p>
        <div class="warning">
          <strong>Reason:</strong> ${reason}
        </div>
        <div class="info">
          <h3>You have two options:</h3>
          <strong>Option 1: Keep Original Slot</strong>
          <p>Return to your original appointment date and time without any changes.</p>
          <strong>Original Appointment:</strong> ${appointment.appointment_date.toDateString()} at ${appointment.slot_start_time}<br/>
          
          <strong>Option 2: Cancel Completely</strong>
          <p>Cancel the appointment entirely. If you paid, a refund will be issued with a deduction fee.</p>
          <strong>Refund Amount:</strong> Rs. 750 (after Rs. 250 deduction)<br/>
        </div>
        <p>Please respond through the app to confirm your choice.</p>
      `
    );

    return { appointment, requiresPatientChoice: true };
  }

  // Check if less than 24 hours remaining for CONFIRMED appointments
  if (appointment.status === 'CONFIRMED') {
    // Doctor CANNOT cancel CONFIRMED+PAID appointments - only reschedule
    if (appointment.payment_status === 'PAID') {
      const err = new Error('Cannot cancel paid confirmed appointments. Please use the Reschedule option instead.');
      err.statusCode = 400;
      err.canOnlyReschedule = true;
      throw err;
    }

    const now = new Date();
    const appointmentDateTime = parseTimeToDate(appointment.appointment_date, appointment.slot_start_time);
    const hoursDiff = (appointmentDateTime - now) / (1000 * 60 * 60);

    if (hoursDiff < MIN_DOCTOR_CANCEL_HOURS) {
      // Logic 4: Doctor CANNOT cancel if less than 24 hours. Must request emergency via admin.
      const err = new Error(`Cannot cancel appointment with less than ${MIN_DOCTOR_CANCEL_HOURS} hours remaining. Please request emergency reschedule via admin.`);
      err.statusCode = 400;
      err.canRequestEmergencyReschedule = true;
      throw err;
    }
  }

  // Logic 1: REQUESTED appointment cancellation = PERMANENT CANCEL
  if (appointment.status === 'REQUESTED') {
    appointment.status = 'CANCELLED';
    appointment.cancelled_by = 'DOCTOR';
    appointment.cancellation_reason = reason;
    appointment.cancelled_at = new Date();
    await appointment.save();

    // Notify patient via socket - try multiple event channels
    try {
      const io = getIO();
      const patientUserId = appointment.patient_id.user_id?._id;
      const patientId = appointment.patient_id._id;
      
      if (patientUserId) {
        io.to(`user:${patientUserId}`).emit('appointment:cancelled', {
          appointmentId: appointment._id,
          doctorName: appointment.doctor_id.user_id?.full_name,
          cancelledBy: 'DOCTOR',
          reason,
          refundAmount: 0,
        });
      }
      
      // Also emit to patient-scoped room
      if (patientId) {
        io.to(`patient:${patientId}`).emit('appointment:cancelled', {
          appointmentId: appointment._id,
          doctorName: appointment.doctor_id.user_id?.full_name,
          cancelledBy: 'DOCTOR',
          reason,
          refundAmount: 0,
        });
      }
      
      console.log(`[SOCKET] Appointment cancellation notification sent to patient ${patientUserId}`);
    } catch (err) {
      console.error('Socket emit failed:', err);
    }

    // Send email asynchronously
    sendEmailAsync(
      appointment.patient_id.user_id?.email,
      'Appointment Request Cancelled by Doctor',
      `
        <p>Your appointment request has been cancelled by the doctor.</p>
        <div class="warning">
          <strong>Doctor:</strong> Dr. ${appointment.doctor_id.user_id?.full_name}<br/>
          <strong>Date:</strong> ${appointment.appointment_date.toDateString()}<br/>
          <strong>Reason:</strong> ${reason}
        </div>
        <p>No refund is applicable for cancelled requests.</p>
      `
    );

    return { appointment, refundAmount: 0, requiresRescheduleSelection: false };
  }

  // CONFIRMED + UNPAID appointment cancellation
  if (appointment.status === 'CONFIRMED' && appointment.payment_status !== 'PAID') {
    // Logic 2: CONFIRMED + UNPAID = Permanently cancel
    appointment.status = 'CANCELLED';
    appointment.cancelled_by = 'DOCTOR';
    appointment.cancellation_reason = reason;
    appointment.cancelled_at = new Date();
    await appointment.save();

    // Notify patient via socket - try multiple event channels
    try {
      const io = getIO();
      const patientUserId = appointment.patient_id.user_id?._id;
      const patientId = appointment.patient_id._id;
      
      if (patientUserId) {
        io.to(`user:${patientUserId}`).emit('appointment:cancelled', {
          appointmentId: appointment._id,
          doctorName: appointment.doctor_id.user_id?.full_name,
          cancelledBy: 'DOCTOR',
          reason,
          refundAmount: 0,
        });
      }
      
      // Also emit to patient-scoped room
      if (patientId) {
        io.to(`patient:${patientId}`).emit('appointment:cancelled', {
          appointmentId: appointment._id,
          doctorName: appointment.doctor_id.user_id?.full_name,
          cancelledBy: 'DOCTOR',
          reason,
          refundAmount: 0,
        });
      }
      
      console.log(`[SOCKET] Appointment cancellation notification sent to patient ${patientUserId}`);
    } catch (err) {
      console.error('Socket emit failed:', err);
    }

    // Send email asynchronously
    sendEmailAsync(
      appointment.patient_id.user_id?.email,
      'Appointment Cancelled by Doctor',
      `
        <p>Your appointment has been cancelled by the doctor.</p>
        <div class="warning">
          <strong>Doctor:</strong> Dr. ${appointment.doctor_id.user_id?.full_name}<br/>
          <strong>Date:</strong> ${appointment.appointment_date.toDateString()}<br/>
          <strong>Reason:</strong> ${reason}
        </div>
        <p>No refund is applicable as payment was pending.</p>
      `
    );

    return { appointment, refundAmount: 0, requiresRescheduleSelection: false };
  }
};

/**
 * Patient responds to doctor's cancellation of reschedule request
 * Patient can either: keep original slot (CONFIRMED) or cancel with deduction (CANCELLED + PARTIAL_REFUND)
 */
export const respondToDocCancelledReschedule = async (appointmentId, patientId, choice, reason) => {
  const appointment = await Appointment.findById(appointmentId)
    .populate({ path: 'patient_id', populate: { path: 'user_id' } })
    .populate({ path: 'doctor_id', populate: { path: 'user_id' } });

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

  if (appointment.status !== 'RESCHEDULE_REQUESTED' || !appointment.doctor_cancelled_reschedule_request) {
    const err = new Error('This appointment is not waiting for your response');
    err.statusCode = 400;
    throw err;
  }

  // Choice 1: Keep original slot - restore CONFIRMED status
  if (choice === 'keep') {
    appointment.status = 'CONFIRMED';
    appointment.doctor_cancelled_reschedule_request = false;
    await appointment.save();

    try {
      const io = getIO();
      const patientUserId = appointment.patient_id.user_id?._id;
      const patientId = appointment.patient_id._id;
      
      if (patientUserId) {
        io.to(`user:${patientUserId}`).emit('appointment:confirmed', {
          appointmentId: appointment._id,
          message: 'Appointment confirmed for original slot',
        });
      }
      
      if (patientId) {
        io.to(`patient:${patientId}`).emit('appointment:confirmed', {
          appointmentId: appointment._id,
          message: 'Appointment confirmed for original slot',
        });
      }
    } catch (err) {
      console.error('Socket emit failed:', err);
    }

    sendEmailAsync(
      appointment.patient_id.user_id?.email,
      'Appointment Confirmed - Original Slot',
      `
        <p>Your appointment has been confirmed for the original slot.</p>
        <div class="success">
          <strong>Doctor:</strong> Dr. ${appointment.doctor_id.user_id?.full_name}<br/>
          <strong>Date:</strong> ${appointment.appointment_date.toDateString()}<br/>
          <strong>Time:</strong> ${appointment.slot_start_time} - ${appointment.slot_end_time}
        </div>
        <p>No changes have been made to your appointment.</p>
      `
    );

    return { appointment, action: 'kept' };
  }

  // Choice 2: Cancel completely - apply deduction if paid
  if (choice === 'cancel') {
    let refundAmount = 0;
    if (appointment.payment_status === 'PAID') {
      refundAmount = APPOINTMENT_FEE - CANCELLATION_DEDUCTION; // 1000 - 250 = 750
      appointment.refund_amount = refundAmount;
      appointment.payment_status = 'PARTIAL_REFUND';

      await Payment.create({
        appointment_id: appointment._id,
        patient_id: patientId,
        amount: refundAmount,
        type: 'REFUND',
        status: 'COMPLETED',
        challan_number: `REF-${appointment.challan_number}`,
        refund_reason: `Patient chose to cancel after doctor cancelled reschedule request: ${reason}`,
        refund_initiated_by: 'PATIENT',
      });
    }

    appointment.status = 'CANCELLED';
    appointment.cancelled_by = 'PATIENT';
    appointment.cancellation_reason = reason;
    appointment.cancelled_at = new Date();
    appointment.doctor_cancelled_reschedule_request = false;
    await appointment.save();

    try {
      const io = getIO();
      const patientUserId = appointment.patient_id.user_id?._id;
      const patientId = appointment.patient_id._id;
      
      if (patientUserId) {
        io.to(`user:${patientUserId}`).emit('appointment:cancelled', {
          appointmentId: appointment._id,
          refundAmount,
          reason,
        });
      }
      
      if (patientId) {
        io.to(`patient:${patientId}`).emit('appointment:cancelled', {
          appointmentId: appointment._id,
          refundAmount,
          reason,
        });
      }
    } catch (err) {
      console.error('Socket emit failed:', err);
    }

    sendEmailAsync(
      appointment.patient_id.user_id?.email,
      'Appointment Cancelled - Refund Processed',
      `
        <p>Your appointment has been <strong style="color: red;">CANCELLED</strong>.</p>
        <div class="warning">
          <strong>Doctor:</strong> Dr. ${appointment.doctor_id.user_id?.full_name}<br/>
          <strong>Date:</strong> ${appointment.appointment_date.toDateString()}<br/>
          <strong>Reason:</strong> ${reason}
        </div>
        <div class="info">
          <h3 style="color: green;">Refund Details</h3>
          <strong>Original Payment:</strong> Rs. 1,000<br/>
          <strong>Refund Amount:</strong> Rs. ${refundAmount.toLocaleString()}<br/>
          <strong>Deduction:</strong> Rs. 250 (Cancellation fee)<br/>
          <strong>Challan Number:</strong> ${appointment.challan_number}<br/>
          <strong>Refund Status:</strong> Processed
        </div>
        <p>The refund will be credited to your original payment method within 5-7 business days.</p>
      `
    );

    // Notify doctor
    try {
      if (appointment.doctor_id.user_id?.email) {
        const content = `
          <p>Patient <strong>${appointment.patient_id.user_id?.full_name}</strong> cancelled their appointment after your reschedule cancellation.</p>
          <div class="info">
            <strong>Reason:</strong> ${reason}
          </div>
        `;
        await sendEmail(appointment.doctor_id.user_id?.email, 'Patient Cancelled Appointment', content);
      }
    } catch (err) {
      console.error('Failed to send email to doctor:', err);
    }

    return { appointment, action: 'cancelled', refundAmount };
  }

  const err = new Error('Invalid choice. Must be "keep" or "cancel"');
  err.statusCode = 400;
  throw err;
};

/**
 * Cancel RESCHEDULE_REQUESTED appointment (Patient) - with full refund
 */
export const cancelRescheduleRequestedByPatient = async (appointmentId, patientId, reason) => {
  const appointment = await Appointment.findById(appointmentId)
    .populate({ path: 'patient_id', populate: { path: 'user_id' } })
    .populate({ path: 'doctor_id', populate: { path: 'user_id' } });

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

  if (appointment.status !== 'RESCHEDULE_REQUESTED') {
    const err = new Error('Only reschedule-requested appointments can be cancelled from this option');
    err.statusCode = 400;
    throw err;
  }

  // Full refund since doctor initiated the reschedule request
  let refundAmount = 0;
  if (appointment.payment_status === 'PAID') {
    refundAmount = APPOINTMENT_FEE;
    appointment.refund_amount = refundAmount;
    appointment.payment_status = 'REFUNDED';

    await Payment.create({
      appointment_id: appointment._id,
      patient_id: patientId,
      amount: refundAmount,
      type: 'REFUND',
      status: 'COMPLETED',
      challan_number: `REF-${appointment.challan_number}`,
      refund_reason: `Patient cancelled after doctor reschedule request: ${reason}`,
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

  try {
    if (appointment.doctor_id.user_id?.email) {
      const content = `
        <p>Patient <strong>${appointment.patient_id.user_id?.full_name}</strong> has cancelled their appointment and declined to reschedule.</p>
        <div class="info">
          <strong>Reason:</strong> ${reason}
        </div>
        <p>Full refund of Rs. ${refundAmount} has been issued to the patient.</p>
      `;
      await sendEmail(appointment.doctor_id.user_id?.email, 'Appointment Cancelled by Patient', content);
    }
  } catch (err) {
    console.error('Failed to send email:', err);
  }

  // Send refund confirmation email to patient
  try {
    if (appointment.patient_id.user_id?.email) {
      const content = `
        <p>Your appointment has been <strong style="color: red;">CANCELLED</strong> successfully.</p>
        <div class="success">
          <strong>Doctor:</strong> Dr. ${appointment.doctor_id.user_id?.full_name}<br/>
          <strong>Original Date:</strong> ${appointment.appointment_date.toDateString()}<br/>
          <strong>Original Time:</strong> ${appointment.slot_start_time} - ${appointment.slot_end_time}
        </div>
        <div class="info">
          <h3 style="color: green;">Refund Details</h3>
          <strong>Original Payment:</strong> Rs. 1,000<br/>
          <strong>Refund Amount:</strong> Rs. ${refundAmount.toLocaleString()}<br/>
          <strong>Deduction:</strong> Rs. 0 (No cancellation fee - Doctor initiated)<br/>
          <strong>Challan Number:</strong> ${appointment.challan_number}<br/>
          <strong>Refund Status:</strong> Processed
        </div>
        <p>The refund will be credited to your original payment method within 5-7 business days.</p>
        <p>If you have any questions, please contact support.</p>
      `;
      await sendEmail(appointment.patient_id.user_id?.email, 'Appointment Cancelled - Refund Processed', content);
    }
  } catch (err) {
    console.error('Failed to send patient refund email:', err);
  }

  return { appointment, refundAmount };
};

/**
 * Request reschedule (Doctor) - Sets status to RESCHEDULE_REQUESTED
 */
export const requestRescheduleByDoctor = async (appointmentId, doctorId, reason) => {
  const appointment = await Appointment.findById(appointmentId)
    .populate({ path: 'doctor_id', populate: { path: 'user_id' } })
    .populate({ path: 'patient_id', populate: { path: 'user_id' } });

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

  // Allow doctor reschedule for CONFIRMED or any RESCHEDULE_REQUESTED
  if (appointment.status !== 'CONFIRMED' && appointment.status !== 'RESCHEDULE_REQUESTED') {
    const err = new Error('Only confirmed or reschedule-requested appointments can be rescheduled by doctor.');
    err.statusCode = 400;
    throw err;
  }

  // Update appointment
  const oldDate = appointment.appointment_date.toDateString();
  const oldTime = appointment.slot_start_time;

  appointment.status = 'RESCHEDULE_REQUESTED';
  appointment.reschedule_reason = reason;
  appointment.reschedule_requested_by = 'DOCTOR';
  // Reset patient response flag since doctor is requesting a new reschedule
  appointment.patient_responded_to_doctor_reschedule = false;
  await appointment.save();

  // Send notification/email
  try {
    if (appointment.patient_id.user_id?.email) {
      const emailContent = `
        <p>Your appointment with <strong>Dr. ${appointment.doctor_id.user_id?.full_name}</strong> needs to be rescheduled.</p>
        <div class="warning">
          <strong>Previous Schedule:</strong> ${oldDate} at ${oldTime}<br/>
          <strong>Reason:</strong> ${reason || 'Not provided'}
        </div>
        <p>Please log in to your dashboard to select a new time or cancel for a full refund.</p>
      `;
      await sendEmail(appointment.patient_id.user_id.email, 'Action Required: Appointment Reschedule Request', emailContent);
    }
  } catch (err) {
    console.error('Failed to send reschedule email:', err);
  }

  return appointment;
};

/**
 * Reschedule by Patient (Select new time)
 */
export const rescheduleAppointmentByPatient = async (appointmentId, patientId, newDateStr, newTime, reason) => {
  const appointment = await Appointment.findById(appointmentId)
    .populate({ path: 'doctor_id', populate: { path: 'user_id' } })
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

  // Can reschedule from CONFIRMED (paid or unpaid) or RESCHEDULE_REQUESTED (paid)
  if (!['CONFIRMED', 'RESCHEDULE_REQUESTED'].includes(appointment.status)) {
    const err = new Error('Only confirmed or reschedule-requested appointments can be rescheduled');
    err.statusCode = 400;
    throw err;
  }

  // Parse new date first to compare with current appointment
  const newDate = new Date(newDateStr);
  newDate.setHours(0, 0, 0, 0);
  
  const currentDate = new Date(appointment.appointment_date);
  currentDate.setHours(0, 0, 0, 0);

  // Check if trying to reschedule to the same date and time
  if (currentDate.getTime() === newDate.getTime() && appointment.slot_start_time === newTime) {
    const err = new Error('Cannot reschedule to the same date and time. Please select a different slot.');
    err.statusCode = 400;
    throw err;
  }

  // Check availability
  const availableSlots = await getAvailableSlots(appointment.doctor_id._id, newDateStr);
  const isAvailable = availableSlots.some(s => s.time === newTime && s.available);

  if (!isAvailable) {
    const err = new Error('Selected slot is not available');
    err.statusCode = 400;
    throw err;
  }

  // Logic 8: If CONFIRMED + UNPAID → becomes new REQUESTED
  // Check 24h constraint ONLY for PAID confirmed appointments
  if (appointment.status === 'CONFIRMED' && appointment.payment_status === 'PAID') {
    const now = new Date();
    const appointmentDateTime = parseTimeToDate(appointment.appointment_date, appointment.slot_start_time);
    const hoursDiff = (appointmentDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursDiff < 24) {
      const err = new Error('Cannot reschedule with less than 24 hours remaining. Please contact support.');
      err.statusCode = 400;
      throw err;
    }
  }

  // Validate reschedule date is within booking window
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysDiff = Math.ceil((newDate - today) / (1000 * 60 * 60 * 24));

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

  // Check if it's a weekend
  const dayOfWeek = newDate.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    const err = new Error('Appointments cannot be rescheduled to weekends (Saturday/Sunday)');
    err.statusCode = 400;
    throw err;
  }

  // Update appointment
  appointment.appointment_date = newDate;
  appointment.slot_start_time = newTime;
  appointment.slot_end_time = calculateEndTime(newTime);

  // Status Logic for Patient Rescheduling:
  // PAID confirmed appointments become RESCHEDULE_REQUESTED for doctor approval.
  // UNPAID confirmed appointments are treated as new REQUESTED.
  // If already RESCHEDULE_REQUESTED by doctor, keep it as doctor-initiated (patient is responding)
  if (appointment.status === 'CONFIRMED' && appointment.payment_status !== 'PAID') {
    appointment.status = 'REQUESTED';
    appointment.reschedule_requested_by = undefined;
  } else if (appointment.status === 'RESCHEDULE_REQUESTED' && appointment.reschedule_requested_by === 'DOCTOR') {
    // Patient is responding to doctor's reschedule request - keep it as doctor initiated
    // Status remains RESCHEDULE_REQUESTED with reschedule_requested_by = 'DOCTOR'
    // Set flag to indicate patient has proposed a new date/time
    appointment.patient_responded_to_doctor_reschedule = true;
  } else {
    appointment.status = 'RESCHEDULE_REQUESTED';
    appointment.reschedule_requested_by = 'PATIENT';
  }

  // Append reason if provided
  if (reason) {
    appointment.reschedule_reason = (appointment.reschedule_reason ? appointment.reschedule_reason + ' | ' : '') + `Patient: ${reason}`;
  }

  await appointment.save();

  // Notify doctor
  try {
    const emailContent = `
      <p>Patient <strong>${appointment.patient_id.user_id?.full_name}</strong> has requested to reschedule their appointment.</p>
      <div class="info">
        <strong>New Date:</strong> ${newDateStr}<br/>
        <strong>New Time:</strong> ${newTime}<br/>
        <strong>Reason:</strong> ${reason || 'Not provided'}<br/>
        <strong>Payment Status:</strong> ${appointment.payment_status === 'PAID' ? 'PAID' : 'PENDING'}
      </div>
      <p>Please review and approve this reschedule request in your dashboard.</p>
    `;
    await sendEmail(appointment.doctor_id.user_id?.email, 'Patient Reschedule Request', emailContent);
  } catch (err) {
    console.error('Failed to send email:', err);
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

  // Emergency requests must be submitted at least 12 hours before appointment
  // FIXED: Changed from < to > for correct logic
  if (hoursUntilAppointment <= EMERGENCY_REVIEW_WINDOW_HOURS) {
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
export const completeAppointment = async (appointmentId, doctorId, medications, instructions) => {
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

  if (appointment.status !== 'CONFIRMED' && appointment.status !== 'PAST') {
    const err = new Error('Only confirmed or past appointments can be completed');
    err.statusCode = 400;
    throw err;
  }

  const now = new Date();
  const appointmentEnd = getAppointmentEndDateTime(appointment);

  if (appointmentEnd > now) {
    const err = new Error('Cannot complete appointment before it ends');
    err.statusCode = 400;
    throw err;
  }

  if (!instructions || !instructions.trim()) {
    const err = new Error('Follow-up instructions are required');
    err.statusCode = 400;
    throw err;
  }

  // Create prescription record
  const prescriptionRecord = await Prescription.create({
    patient_id: appointment.patient_id._id,
    doctor_id: appointment.doctor_id._id,
    appointment_id: appointment._id,
    medications: Array.isArray(medications) ? medications : [],
    notes: instructions, // Using instructions as notes
  });

  appointment.status = 'COMPLETED';
  appointment.prescription_id = prescriptionRecord._id;
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
        prescription: prescriptionRecord,
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
      const medsHtml = (prescriptionRecord?.medications || [])
        .map(
          (med) => `
            <li>
              <strong>${med.name}</strong> - ${med.dosage}, ${med.frequency} for ${med.duration}
              ${med.instructions ? `<br/><em>${med.instructions}</em>` : ''}
            </li>
          `
        )
        .join('');

      const content = `
        <p>Your appointment has been completed. Here are the details:</p>
        <div class="success">
          <strong>Doctor:</strong> Dr. ${appointment.doctor_id.user_id?.full_name}<br/>
          <strong>Date:</strong> ${appointment.appointment_date.toDateString()}
        </div>
        <h3>Prescription</h3>
        ${medsHtml ? `<ul>${medsHtml}</ul>` : '<p>No prescription provided</p>'}
        <h3>Instructions</h3>
        <p>${prescriptionRecord?.notes || instructions || 'No special instructions'}</p>
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

  if (appointment.status !== 'CONFIRMED' && appointment.status !== 'PAST') {
    const err = new Error('Only confirmed or past appointments can be marked as no-show');
    err.statusCode = 400;
    throw err;
  }

  const now = new Date();
  const appointmentEnd = getAppointmentEndDateTime(appointment);
  if (appointmentEnd > now) {
    const err = new Error('Cannot mark appointment as no-show before it ends');
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
  await markPastConfirmedAppointments();
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

  if (status === 'CONFIRMED') {
    // Past confirmed (paid) appointments are moved to PAST by markPastConfirmedAppointments.
    // Keep confirmed filter simple to avoid timezone/time comparison issues.
  }

  const skip = page * size;
  const totalElements = await Appointment.countDocuments(query);
  const appointments = await Appointment.find(query)
    .populate({ path: 'doctor_id', populate: { path: 'user_id', select: 'full_name email' } })
    .populate('prescription_id')
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
      prescription: apt.prescription_id,
      instructions: apt.prescription_id?.notes,
      completedAt: apt.completed_at,
      cancelledBy: apt.cancelled_by,
      cancellationReason: apt.cancellation_reason,
      rescheduleReason: apt.reschedule_reason,
      rescheduleRequestedBy: apt.reschedule_requested_by,
      rescheduleRejected: apt.reschedule_rejected,
      rescheduleRejectionReason: apt.reschedule_rejection_reason,
      patientRespondedToDoctorReschedule: apt.patient_responded_to_doctor_reschedule,
      doctorCancelledRescheduleRequest: apt.doctor_cancelled_reschedule_request,
      doctorCancellationReason: apt.doctor_cancellation_reason,
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
  await markPastConfirmedAppointments();
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

  if (status === 'CONFIRMED' && !date) {
    // Past confirmed (paid) appointments are moved to PAST by markPastConfirmedAppointments.
    // Keep confirmed filter simple to avoid timezone/time comparison issues.
  }

  const skip = page * size;
  const totalElements = await Appointment.countDocuments(query);
  const appointments = await Appointment.find(query)
    .populate({ path: 'patient_id', populate: { path: 'user_id', select: 'full_name email' } })
    .populate('prescription_id')
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
      prescription: apt.prescription_id,
      instructions: apt.prescription_id?.notes,
      cancelledBy: apt.cancelled_by,
      cancellationReason: apt.cancellation_reason,
      rescheduleReason: apt.reschedule_reason,
      rescheduleRequestedBy: apt.reschedule_requested_by,
      rescheduleRejected: apt.reschedule_rejected,
      rescheduleRejectionReason: apt.reschedule_rejection_reason,
      patientRespondedToDoctorReschedule: apt.patient_responded_to_doctor_reschedule,
      createdAt: apt.created_at,
    })),
    pageNumber: page,
    pageSize: size,
    totalElements,
    totalPages: Math.ceil(totalElements / size)
  };
};

/**
 * Get past appointments for doctor (appointments that have already occurred)
 */
export const getPastDoctorAppointments = async (doctorId, page = 0, size = 10) => {
  await markPastConfirmedAppointments();

  const query = {
    doctor_id: doctorId,
    status: 'PAST',
  };

  const skip = page * size;
  const totalElements = await Appointment.countDocuments(query);
  const appointments = await Appointment.find(query)
    .populate({ path: 'patient_id', populate: { path: 'user_id', select: 'full_name email' } })
    .populate('prescription_id')
    .sort({ appointment_date: -1, slot_start_time: -1 })
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
      prescription: apt.prescription_id,
      instructions: apt.prescription_id?.notes,
      completedAt: apt.completed_at,
      patientAttended: apt.patient_attended,
      cancelledBy: apt.cancelled_by,
      cancellationReason: apt.cancellation_reason,
      rescheduleReason: apt.reschedule_reason,
      rescheduleRequestedBy: apt.reschedule_requested_by,
      createdAt: apt.created_at,
    })),
    pageNumber: page,
    pageSize: size,
    totalElements,
    totalPages: Math.ceil(totalElements / size)
  };
};

/**
 * Get past appointments for patient
 */
export const getPastPatientAppointments = async (patientId, page = 0, size = 10) => {
  await markPastConfirmedAppointments();

  const query = {
    patient_id: patientId,
    status: 'PAST',
  };

  const skip = page * size;
  const totalElements = await Appointment.countDocuments(query);
  const appointments = await Appointment.find(query)
    .populate({ path: 'doctor_id', populate: { path: 'user_id', select: 'full_name email' } })
    .populate('prescription_id')
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
      appointmentDate: apt.appointment_date,
      slotStartTime: apt.slot_start_time,
      slotEndTime: apt.slot_end_time,
      appointmentType: apt.appointment_type,
      status: apt.status,
      reason: apt.reason,
      meetingLink: apt.meeting_link,
      paymentStatus: apt.payment_status,
      prescription: apt.prescription_id,
      instructions: apt.prescription_id?.notes,
      completedAt: apt.completed_at,
      patientAttended: apt.patient_attended,
      cancelledBy: apt.cancelled_by,
      cancellationReason: apt.cancellation_reason,
      rescheduleReason: apt.reschedule_reason,
      rescheduleRequestedBy: apt.reschedule_requested_by,
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
    .populate('prescription_id')
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
    prescription: appointment.prescription_id,
    instructions: appointment.prescription_id?.notes,
    completedAt: appointment.completed_at,
    cancelledBy: appointment.cancelled_by,
    cancellationReason: appointment.cancellation_reason,
    chatEnabled: appointment.chat_enabled,
    createdAt: appointment.created_at,
  };
};

/**
 * Request Emergency Reschedule (Doctor)
 */
export const requestDoctorEmergencyReschedule = async (appointmentId, doctorId, reason) => {
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

  // Check if there is already a pending request
  const existing = await DoctorEmergencyRescheduleRequest.findOne({
    appointment_id: appointmentId,
    status: 'PENDING'
  });

  if (existing) {
    const err = new Error('An emergency reschedule request is already pending for this appointment');
    err.statusCode = 400;
    throw err;
  }

  // Create request
  const request = await DoctorEmergencyRescheduleRequest.create({
    appointment_id: appointmentId,
    doctor_id: doctorId,
    reason,
    status: 'PENDING'
  });

  return request;
};

/**
 * Approve Emergency Reschedule (Admin)
 */
export const approveDoctorEmergencyReschedule = async (requestId, adminId) => {
  const request = await DoctorEmergencyRescheduleRequest.findById(requestId)
    .populate('appointment_id');

  if (!request) {
    const err = new Error('Request not found');
    err.statusCode = 404;
    throw err;
  }

  if (request.status !== 'PENDING') {
    const err = new Error('Request is already processed');
    err.statusCode = 400;
    throw err;
  }

  request.status = 'APPROVED';
  request.admin_id = adminId;
  request.admin_notes = 'Approved by Admin';
  request.reviewed_at = new Date();
  await request.save();

  // Now perform the helper logic: Set appointment to RESCHEDULE_REQUESTED
  const appointment = await Appointment.findById(request.appointment_id._id);
  const reason = `Emergency Reschedule: ${request.reason}`;

  // We reuse the logic essentially, but we force it
  appointment.status = 'RESCHEDULE_REQUESTED';
  appointment.reschedule_reason = reason;
  await appointment.save();

  // Notify Patient via Email
  try {
    const patient = await Patient.findById(appointment.patient_id).populate('user_id');
    if (patient && patient.user_id?.email) {
      const emailContent = `
        <p>An <strong>Emergency Reschedule</strong> has been requested by Dr. for your appointment.</p>
        <div class="warning">
          <strong>Reason:</strong> ${reason}
        </div>
        <p>The Admin has approved this request due to emergency.</p>
        <p>Please log in to your dashboard to <strong>Reschedule</strong> (payment carries over) or <strong>Cancel</strong> (full refund).</p>
      `;
      await sendEmail(patient.user_id.email, 'Emergency Reschedule Approved', emailContent);
    }
  } catch (err) {
    console.error('Failed to send email:', err);
  }

  return request;
};

/**
 * Get all Doctor Emergency Requests (Admin)
 */
export const getDoctorEmergencyRequests = async (status = 'PENDING') => {
  return await DoctorEmergencyRescheduleRequest.find({ status })
    .populate({ path: 'doctor_id', populate: { path: 'user_id' } })
    .populate({ path: 'appointment_id', populate: { path: 'patient_id', populate: { path: 'user_id' } } })
    .sort({ created_at: -1 });
};

/**
 * Approve a patient-proposed reschedule (doctor accepts new date/time)
 */
export const approveRescheduleRequestedAppointment = async (appointmentId, doctorId) => {
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
  if (appointment.status !== 'RESCHEDULE_REQUESTED' || appointment.reschedule_requested_by !== 'PATIENT') {
    const err = new Error('Only patient-proposed reschedules can be approved');
    err.statusCode = 400;
    throw err;
  }
  appointment.status = 'CONFIRMED';
  appointment.reschedule_requested_by = undefined;
  await appointment.save();
  
  // Notify patient
  try {
    const patient = await Patient.findById(appointment.patient_id).populate('user_id');
    if (patient && patient.user_id?.email) {
      const emailContent = `
        <p>Your reschedule request has been approved by the doctor.</p>
        <div class="success">
          <strong>New Date:</strong> ${appointment.appointment_date.toDateString()}<br/>
          <strong>New Time:</strong> ${appointment.slot_start_time}<br/>
          <strong>Status:</strong> Confirmed
        </div>
      `;
      await sendEmail(patient.user_id.email, 'Reschedule Approved', emailContent);
    }
  } catch (err) {
    console.error('Failed to send approval email:', err);
  }
  
  return appointment;
};