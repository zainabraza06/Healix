import mongoose from 'mongoose';

const medicalRecordSchema = new mongoose.Schema(
    {
        patient_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Patient',
            required: true,
            unique: true,
        },
        immunizations: [
            {
                name: { type: String, required: true },
                date: { type: Date, required: true },
                notes: String,
            },
        ],
        allergies: [
            {
                name: { type: String, required: true },
                severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' },
                notes: String,
            },
        ],
        operations: [
            {
                name: { type: String, required: true },
                date: { type: Date, required: true },
                hospital: String,
                surgeon: String,
                notes: String,
            },
        ],
        labResults: [
            {
                testName: { type: String, required: true },
                date: { type: Date, required: true },
                result: String,
                unit: String,
                notes: String,
            },
        ],
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export default mongoose.model('MedicalRecord', medicalRecordSchema);
