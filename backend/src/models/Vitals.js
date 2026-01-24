import mongoose from 'mongoose';

const vitalsSchema = new mongoose.Schema(
    {
        patient_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Patient',
            required: true,
        },
        heartRate: {
            type: Number,
            required: true,
        },
        systolicBP: {
            type: Number,
            required: true,
        },
        diastolicBP: {
            type: Number,
            required: true,
        },
        oxygenLevel: {
            type: Number,
            required: true,
        },
        temperature: {
            type: Number,
            required: true,
        },
        respiratoryRate: {
            type: Number,
            required: true,
        },
        notes: {
            type: String,
            trim: true,
        },
        recorded_at: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

// Index for fast historical retrieval
vitalsSchema.index({ patient_id: 1, recorded_at: -1 });

export default mongoose.model('Vitals', vitalsSchema);
