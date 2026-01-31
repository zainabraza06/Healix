import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema(
  {
    patient_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    doctor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    // Slot timing
    appointment_date: {
      type: Date,
      required: true,
    },
    slot_start_time: {
      type: String, // Format: "09:00", "09:30", etc.
      required: true,
    },
    slot_end_time: {
      type: String, // Calculated: start + 30 min
      required: true,
    },
    // Type and status
    appointment_type: {
      type: String,
      enum: ['ONLINE', 'OFFLINE'],
      default: 'OFFLINE',
      required: true,
    },
    status: {
      type: String,
      enum: ['REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULE_REQUESTED'],
      default: 'REQUESTED',
    },
    // Appointment details
    reason: {
      type: String,
      required: true,
    },
    notes: String,
    // For online appointments
    meeting_link: {
      type: String,
    },
    // For offline appointments
    location: {
      type: String,
      default: 'Healix Medical Center, Main Branch',
    },
    // Payment fields
    payment_status: {
      type: String,
      enum: ['PENDING', 'PAID', 'REFUNDED', 'PARTIAL_REFUND'],
      default: 'PENDING',
    },
    payment_amount: {
      type: Number,
      default: 1000,
    },
    refund_amount: {
      type: Number,
      default: 0,
    },
    challan_number: {
      type: String,
    },
    // Stripe payment fields
    stripe_session_id: {
      type: String,
    },
    stripe_payment_id: {
      type: String,
    },
    paid_at: {
      type: Date,
    },
    // Completion fields (filled by doctor)
    prescription_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Prescription',
    },
    completed_at: {
      type: Date,
    },
    patient_attended: {
      type: Boolean,
      default: true,
    },
    // Cancellation fields
    cancelled_by: {
      type: String,
      enum: ['PATIENT', 'DOCTOR', 'ADMIN', 'SYSTEM'],
    },
    cancellation_reason: {
      type: String,
    },
    cancelled_at: {
      type: Date,
    },
    reschedule_reason: {
      type: String,
    },
    // Track who requested the reschedule
    reschedule_requested_by: {
      type: String,
      enum: ['PATIENT', 'DOCTOR'],
    },
    // Reschedule rejection fields
    reschedule_rejected: {
      type: Boolean,
      default: false,
    },
    reschedule_rejection_reason: {
      type: String,
    },
    // Doctor cancelled reschedule request - patient needs to choose
    doctor_cancelled_reschedule_request: {
      type: Boolean,
      default: false,
    },
    doctor_cancellation_reason: {
      type: String,
    },
    doctor_cancelled_at: {
      type: Date,
    },
    // Chat eligibility - set to true after completion
    chat_enabled: {
      type: Boolean,
      default: false,
    },
    // Reminder fields
    reminder_sent: {
      type: Boolean,
      default: false,
    },
    reminder_sent_at: {
      type: Date,
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

// Index for efficient queries
appointmentSchema.index({ doctor_id: 1, appointment_date: 1, status: 1 });
appointmentSchema.index({ patient_id: 1, status: 1 });
appointmentSchema.index({ status: 1, appointment_date: 1 });

export default mongoose.model('Appointment', appointmentSchema);
