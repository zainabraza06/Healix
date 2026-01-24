import mongoose from 'mongoose';

const verificationTokenSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    expires_at: {
      type: Date,
      required: true,
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

// Auto-delete expired tokens
verificationTokenSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('VerificationToken', verificationTokenSchema);
