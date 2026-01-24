import mongoose from 'mongoose';

const doctorSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    license_number: {
      type: String,
      required: true,
      unique: true,
    },
    specialization: {
      type: String,
      enum: ['CARDIOLOGY', 'NEUROLOGY', 'ONCOLOGY', 'PEDIATRICS', 'ORTHOPEDICS', 'DERMATOLOGY', 'PSYCHIATRY', 'GENERAL'],
      required: true,
    },
    qualifications: {
      type: String,
      required: true,
    },
    years_of_experience: {
      type: Number,
      required: true,
    },
    application_status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
    },
    rejection_reason: String,
    approved_at: Date,
    rejected_at: Date,
    status_change_request: {
      type: {
        type: String,
        enum: ['ACTIVATE', 'DEACTIVATE'],
      },
      reason: String,
      requested_at: Date,
      status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED'],
        default: 'PENDING',
      }
    }
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export default mongoose.model('Doctor', doctorSchema);
