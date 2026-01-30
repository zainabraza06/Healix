import mongoose from 'mongoose';

const emergencyCancellationRequestSchema = new mongoose.Schema(
    {
        appointment_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Appointment',
            required: true,
        },
        patient_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Patient',
            required: true,
        },
        reason: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ['PENDING', 'APPROVED', 'REJECTED'],
            default: 'PENDING',
        },
        // Admin review fields
        admin_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin',
        },
        admin_notes: {
            type: String,
        },
        reviewed_at: {
            type: Date,
        },
        // Track if the window has expired (12 hours before appointment)
        expires_at: {
            type: Date,
            required: true,
        },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

// Index for efficient queries
emergencyCancellationRequestSchema.index({ status: 1, expires_at: 1 });
emergencyCancellationRequestSchema.index({ appointment_id: 1 });
emergencyCancellationRequestSchema.index({ patient_id: 1 });

export default mongoose.model('EmergencyCancellationRequest', emergencyCancellationRequestSchema);
