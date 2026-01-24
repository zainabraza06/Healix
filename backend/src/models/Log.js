import mongoose from 'mongoose';

const logSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    admin_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    level: {
      type: String,
      enum: ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'],
      default: 'INFO',
      index: true,
    },
    action: {
      type: String,
      required: true,
    },
    entity_type: {
      type: String,
      enum: ['PATIENT', 'DOCTOR', 'ADMIN', 'APPOINTMENT', 'ALERT', 'USER', 'SYSTEM'],
      required: true,
    },
    entity_id: mongoose.Schema.Types.ObjectId,
    description: String,
    ip_address: String,
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILURE'],
      default: 'SUCCESS',
    },
    error_details: String,
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export default mongoose.model('Log', logSchema);
