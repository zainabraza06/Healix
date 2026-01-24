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
    appointment_date: {
      type: Date,
      required: true,
    },
    appointment_time: {
      type: String,
      required: true,
    },
    appointment_type: {
      type: String,
      enum: ['ONLINE', 'OFFLINE'],
      default: 'OFFLINE',
      required: true,
    },
    status: {
      type: String,
      enum: ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
      default: 'SCHEDULED',
    },
    reason: String,
    notes: String,
    meeting_link: {
      type: String,
      required: function() {
        return this.appointment_type === 'ONLINE';
      }
    },
    location: {
      type: String,
      required: function() {
        return this.appointment_type === 'OFFLINE';
      }
    },
    cancelled_by: {
      type: String,
      enum: ['PATIENT', 'DOCTOR', 'ADMIN'],
    },
    cancellation_reason: String,
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export default mongoose.model('Appointment', appointmentSchema);
