import mongoose from 'mongoose';

const doctorEmergencyRescheduleRequestSchema = new mongoose.Schema(
    {
        appointment_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Appointment',
            required: true,
        },
        doctor_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Doctor',
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
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

// Index for efficient queries
doctorEmergencyRescheduleRequestSchema.index({ status: 1 });
doctorEmergencyRescheduleRequestSchema.index({ appointment_id: 1 });
doctorEmergencyRescheduleRequestSchema.index({ doctor_id: 1 });

export default mongoose.model('DoctorEmergencyRescheduleRequest', doctorEmergencyRescheduleRequestSchema);
