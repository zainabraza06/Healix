import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
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
        amount: {
            type: Number,
            required: true,
        },
        type: {
            type: String,
            enum: ['PAYMENT', 'REFUND'],
            required: true,
        },
        status: {
            type: String,
            enum: ['PENDING', 'COMPLETED', 'FAILED'],
            default: 'PENDING',
        },
        challan_number: {
            type: String,
            required: true,
        },
        transaction_date: {
            type: Date,
            default: Date.now,
        },
        refund_reason: {
            type: String,
        },
        // For tracking who initiated refund
        refund_initiated_by: {
            type: String,
            enum: ['PATIENT', 'DOCTOR', 'ADMIN', 'SYSTEM'],
        },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

// Index for efficient queries
paymentSchema.index({ appointment_id: 1 });
paymentSchema.index({ patient_id: 1, type: 1 });
paymentSchema.index({ challan_number: 1 });

export default mongoose.model('Payment', paymentSchema);
