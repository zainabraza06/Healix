import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    doctor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    patient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    sender_role: { type: String, enum: ['DOCTOR', 'PATIENT'], required: true },
    text: { type: String, required: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

messageSchema.index({ doctor_id: 1, patient_id: 1, created_at: 1 });

export default mongoose.model('Message', messageSchema);
