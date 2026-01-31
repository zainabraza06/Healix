import cron from 'node-cron';
import { cleanupExpiredRequests, cancelUnpaidConfirmedAppointments } from './appointmentService.js';
import Appointment from '../models/Appointment.js';
import { sendEmail } from '../config/email.js';

/**
 * Schedule auto-cancellation of expired appointment requests (every hour)
 * Cancels REQUESTED appointments that have been pending for more than 24 hours
 */
export const scheduleAutoCancel = () => {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    try {
      console.log('[CRON] Running auto-cancel for expired appointment requests...');
      const cancelled = await cleanupExpiredRequests();
      console.log(`[CRON] Auto-cancelled ${cancelled} expired appointment requests`);
    } catch (err) {
      console.error('[CRON] Auto-cancel failed:', err.message);
    }
  });
};

/**
 * Schedule auto-cancellation of unpaid confirmed appointments (every 6 hours)
 * Cancels CONFIRMED appointments with PENDING payment 1 day or less before appointment
 */
export const scheduleAutoCancelUnpaid = () => {
  // Run every 6 hours (at 00:00, 06:00, 12:00, 18:00)
  cron.schedule('0 0,6,12,18 * * *', async () => {
    try {
      console.log('[CRON] Running auto-cancel for unpaid confirmed appointments...');
      const cancelled = await cancelUnpaidConfirmedAppointments();
      console.log(`[CRON] Auto-cancelled ${cancelled} unpaid appointment(s)`);
    } catch (err) {
      console.error('[CRON] Unpaid appointment auto-cancel failed:', err.message);
    }
  });
};

/**
 * Schedule appointment reminders (every day at 9 AM)
 * Sends email reminders to patients for appointments scheduled for tomorrow
 */
export const scheduleAppointmentReminders = () => {
  // Run daily at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    try {
      console.log('[CRON] Running appointment reminders...');
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);
      
      // Find all CONFIRMED appointments scheduled for tomorrow
      const appointmentsToRemind = await Appointment.find({
        status: 'CONFIRMED',
        appointment_date: {
          $gte: new Date(today.getTime() + 24 * 60 * 60 * 1000).setHours(0, 0, 0, 0),
          $lte: tomorrow
        },
        reminder_sent: { $ne: true }
      })
        .populate({ path: 'patient_id', populate: { path: 'user_id', select: 'email full_name' } })
        .populate({ path: 'doctor_id', populate: { path: 'user_id', select: 'full_name' } });

      console.log(`[CRON] Found ${appointmentsToRemind.length} appointments for reminder`);

      for (const appointment of appointmentsToRemind) {
        try {
          const patientEmail = appointment.patient_id?.user_id?.email;
          const patientName = appointment.patient_id?.user_id?.full_name;
          const doctorName = appointment.doctor_id?.user_id?.full_name;
          const appointmentDate = appointment.appointment_date.toDateString();
          const appointmentTime = appointment.slot_start_time;

          if (patientEmail) {
            const reminderContent = `
              <h2>Appointment Reminder</h2>
              <p>Hi ${patientName},</p>
              <p>This is a reminder that you have an appointment scheduled for <strong>tomorrow</strong>.</p>
              <div style="background-color: #f0f9ff; padding: 15px; border-left: 4px solid #06b6d4; margin: 20px 0; border-radius: 5px;">
                <p><strong>Doctor:</strong> Dr. ${doctorName}</p>
                <p><strong>Date:</strong> ${appointmentDate}</p>
                <p><strong>Time:</strong> ${appointmentTime}</p>
                <p><strong>Type:</strong> ${appointment.appointment_type === 'ONLINE' ? 'Online Consultation' : 'In-Person Visit'}</p>
                ${appointment.appointment_type === 'ONLINE' && appointment.meeting_link ? `<p><strong>Meeting Link:</strong> <a href="${appointment.meeting_link}">${appointment.meeting_link}</a></p>` : ''}
              </div>
              <p>Please arrive on time. If you need to reschedule or cancel, please do so at least 24 hours before the appointment.</p>
              <p>Best regards,<br/>Healthcare Management System</p>
            `;

            await sendEmail(patientEmail, 'Appointment Reminder - Tomorrow', reminderContent);

            // Mark reminder as sent
            appointment.reminder_sent = true;
            appointment.reminder_sent_at = new Date();
            await appointment.save();

            console.log(`[CRON] Reminder sent to ${patientEmail}`);
          }
        } catch (emailErr) {
          console.error(`[CRON] Failed to send reminder for appointment ${appointment._id}:`, emailErr.message);
        }
      }

      console.log(`[CRON] Appointment reminders completed`);
    } catch (err) {
      console.error('[CRON] Appointment reminders failed:', err.message);
    }
  });
};

/**
 * Initialize all scheduled jobs
 */
export const initializeScheduler = () => {
  console.log('[SCHEDULER] Initializing cron jobs...');
  
  // Auto-cancel expired requests (every hour)
  scheduleAutoCancel();
  console.log('[SCHEDULER] Auto-cancel job scheduled (every hour)');
  
  // Auto-cancel unpaid confirmed appointments (every 6 hours)
  scheduleAutoCancelUnpaid();
  console.log('[SCHEDULER] Unpaid appointment auto-cancel scheduled (every 6 hours)');
  
  // Send appointment reminders (daily at 9 AM)
  scheduleAppointmentReminders();
  console.log('[SCHEDULER] Appointment reminder job scheduled (daily at 9 AM)');
  
  console.log('[SCHEDULER] All cron jobs initialized successfully');
};
