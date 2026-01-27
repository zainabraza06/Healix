import MedicalRecord from '../models/MedicalRecord.js';
import Patient from '../models/Patient.js';
import Appointment from '../models/Appointment.js';
import Alert from '../models/Alert.js';
import Prescription from '../models/Prescription.js';

/**
 * Get full medical records for a patient
 */
export const getPatientMedicalRecords = async (userId) => {
    try {
        const patient = await Patient.findOne({ user_id: userId }).lean();
        if (!patient) throw new Error('Patient record not found');

        let records = await MedicalRecord.findOne({ patient_id: patient._id }).lean();

        // If no record exists yet, return empty structure
        if (!records) {
            records = {
                patient_id: patient._id,
                immunizations: [],
                allergies: [],
                operations: [],
                labResults: [],
            };
        }

        // Fetch history: Completed Appointments with Prescriptions & Alerts with full details
        const [completedAppointments, alerts] = await Promise.all([
            Appointment.find({ patient_id: patient._id, status: 'COMPLETED' })
                .populate({ path: 'doctor_id', populate: { path: 'user_id', select: 'full_name' } })
                .populate('prescription_id')
                .sort({ appointment_date: -1 })
                .lean(),
            Alert.find({ patient_id: patient._id })
                .populate('prescription_id')
                .sort({ created_at: -1 })
                .lean()
        ]);

        return {
            ...records,
            history: {
                completedAppointments: completedAppointments.map(a => ({
                    id: a._id,
                    date: a.appointment_date,
                    doctorName: a.doctor_id?.user_id?.full_name || 'Doctor',
                    notes: a.notes,
                    type: a.appointment_type,
                    prescription: a.prescription_id || null
                })),
                alerts: alerts.map(a => ({
                    id: a._id,
                    title: a.title,
                    message: a.message,
                    severity: a.severity,
                    date: a.created_at,
                    status: a.status,
                    instructions: a.instructions || null,
                    prescription: a.prescription_id || null
                }))
            }
        };
    } catch (error) {
        throw new Error(`Failed to fetch medical records: ${error.message}`);
    }
};

/**
 * Add a record entry (immunization, allergy, etc.)
 */
export const addMedicalRecordEntry = async (userId, type, entryData) => {
    try {
        const patient = await Patient.findOne({ user_id: userId });
        if (!patient) throw new Error('Patient record not found');

        const update = {};
        update[type] = entryData;

        const record = await MedicalRecord.findOneAndUpdate(
            { patient_id: patient._id },
            { $push: update },
            { upsert: true, new: true }
        );

        return record;
    } catch (error) {
        throw new Error(`Failed to add medical record entry: ${error.message}`);
    }
};

/**
 * Generate PDF for Medical Records (Professional High-Fidelity Version)
 */
export const generateMedicalRecordsPDF = async (patientId, res) => {
    try {
        const patient = await Patient.findById(patientId).populate('user_id').lean();
        if (!patient) throw new Error('Patient not found');

        const records = await getPatientMedicalRecords(patient.user_id._id);
        const PDFDocument = (await import('pdfkit')).default;

        const doc = new PDFDocument({
            margin: 40,
            size: 'A4',
            bufferPages: false
        });

        doc.pipe(res);

        // -- Page Setup --
        const MARGIN = 40;
        const WIDTH = doc.page.width;
        const CONTENT_WIDTH = WIDTH - (MARGIN * 2);

        // -- Colors --
        const COLORS = {
            teal: '#0d9488',
            emerald: '#10b981',
            slate800: '#1e293b',
            slate600: '#475569',
            slate400: '#94a3b8',
            border: '#cbd5e1',
            bg: '#f8fafc',
            headerBg: '#ecfdf5'
        };

        // Helper: Draw Header Branding
        const drawBranding = () => {
            // App Name (Centered)
            doc.fillColor(COLORS.teal).fontSize(24).font('Helvetica-Bold').text('HEALIX', 0, 30, { align: 'center' });
            doc.fillColor(COLORS.slate400).fontSize(9).font('Helvetica').text('PROFESSIONAL HEALTHCARE PLATFORM', 0, 56, { align: 'center' });

            // Report Title (Centered)
            doc.moveDown(0.5);
            doc.fillColor(COLORS.slate800).fontSize(20).font('Helvetica-Bold').text('MEDICAL RECORD', 0, 75, { align: 'center' });
            doc.fillColor(COLORS.slate400).fontSize(9).font('Helvetica').text(`Generated: ${new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' })}`, 0, 95, { align: 'center' });

            // Horizontal line
            doc.moveTo(MARGIN, 110).lineTo(WIDTH - MARGIN, 110).stroke(COLORS.border);
            doc.y = 120;
        };

        // Helper: Draw Section Title
        const drawSectionTitle = (title) => {
            doc.moveDown(1);
            doc.rect(MARGIN, doc.y, CONTENT_WIDTH, 25).fill(COLORS.headerBg).stroke(COLORS.border);
            doc.fillColor(COLORS.teal).fontSize(13).font('Helvetica-Bold').text(title.toUpperCase(), MARGIN + 10, doc.y + 7);
            doc.moveDown(2.5);
        };

        // Helper: Draw Table Row (for data display)
        const drawTableRow = (label, value, labelWidth = 150) => {
            const currentY = doc.y;
            doc.fillColor(COLORS.slate600).fontSize(10).font('Helvetica-Bold').text(label, MARGIN, currentY, { width: labelWidth, align: 'left' });
            doc.fillColor(COLORS.slate800).fontSize(10).font('Helvetica').text(value || 'N/A', MARGIN + labelWidth + 10, currentY, { width: CONTENT_WIDTH - labelWidth - 10, align: 'left', lineGap: 3 });
            doc.moveDown(0.8);
        };

        // -- First Page Content --
        drawBranding();

        // 1. Patient Profile Card (Table Style)
        drawSectionTitle('Patient Information');
        
        const birthDate = patient.user_id?.date_of_birth ? new Date(patient.user_id.date_of_birth).toLocaleDateString() : 'N/A';
        drawTableRow('Full Name:', patient.user_id?.full_name?.toUpperCase() || 'ANONYMOUS');
        drawTableRow('Patient ID:', patient._id.toString());
        drawTableRow('Email:', patient.user_id?.email || 'N/A');
        drawTableRow('Phone:', patient.user_id?.phone || 'N/A');
        drawTableRow('Date of Birth:', birthDate);
        drawTableRow('Gender:', patient.user_id?.gender || 'N/A');
        drawTableRow('Blood Type:', patient.user_id?.blood_type || 'N/A');
        drawTableRow('Emergency Contact:', patient.user_id?.emergency_contact || 'N/A');

        // 2. Clinical History Summaries
        drawSectionTitle('Clinical History & Immunizations');

        if (records.immunizations.length === 0) {
            doc.fillColor(COLORS.slate400).fontSize(10).text('No recorded immunizations.', MARGIN + 10);
            doc.moveDown(0.5);
        } else {
            // Table headers
            doc.rect(MARGIN, doc.y, CONTENT_WIDTH, 20).fill(COLORS.headerBg).stroke(COLORS.border);
            doc.fillColor(COLORS.slate800).fontSize(9).font('Helvetica-Bold');
            doc.text('Vaccine Name', MARGIN + 8, doc.y + 6, { width: 200 });
            doc.text('Date', MARGIN + 220, doc.y + 6, { width: 80 });
            doc.text('Notes', MARGIN + 310, doc.y + 6, { width: CONTENT_WIDTH - 318 });
            doc.moveDown(2.2);

            // Table rows
            records.immunizations.forEach((item) => {
                const rowHeight = 25;
                doc.rect(MARGIN, doc.y, CONTENT_WIDTH, rowHeight).stroke(COLORS.border);
                doc.fillColor(COLORS.slate800).fontSize(9).font('Helvetica');
                doc.text(item.name, MARGIN + 8, doc.y + 5, { width: 200, height: rowHeight - 10 });
                doc.text(new Date(item.date).toLocaleDateString(), MARGIN + 220, doc.y - (rowHeight - 10) + 5, { width: 80, height: rowHeight - 10 });
                doc.text(item.notes || '-', MARGIN + 310, doc.y - (rowHeight - 10) + 5, { width: CONTENT_WIDTH - 318, height: rowHeight - 10 });
                doc.moveDown(2.2);
            });
        }

        drawSectionTitle('Active Allergies');
        if (records.allergies.length === 0) {
            doc.fillColor(COLORS.slate400).fontSize(10).text('No recorded allergies.', MARGIN + 10);
            doc.moveDown(0.5);
        } else {
            // Table headers
            doc.rect(MARGIN, doc.y, CONTENT_WIDTH, 20).fill(COLORS.headerBg).stroke(COLORS.border);
            doc.fillColor(COLORS.slate800).fontSize(9).font('Helvetica-Bold');
            doc.text('Allergen', MARGIN + 8, doc.y + 6, { width: 250 });
            doc.text('Severity', MARGIN + 270, doc.y + 6, { width: 100 });
            doc.text('Reaction', MARGIN + 380, doc.y + 6, { width: CONTENT_WIDTH - 388 });
            doc.moveDown(2.2);

            // Table rows
            records.allergies.forEach((item) => {
                const rowHeight = 25;
                const severityColor = item.severity === 'HIGH' ? '#ef4444' : (item.severity === 'MEDIUM' ? '#f59e0b' : COLORS.teal);
                doc.rect(MARGIN, doc.y, CONTENT_WIDTH, rowHeight).stroke(COLORS.border);
                doc.fillColor(COLORS.slate800).fontSize(9).font('Helvetica');
                doc.text(item.name, MARGIN + 8, doc.y + 5, { width: 250, height: rowHeight - 10 });
                doc.fillColor(severityColor).fontSize(8).font('Helvetica-Bold');
                doc.text(item.severity, MARGIN + 270, doc.y - (rowHeight - 10) + 5, { width: 100, height: rowHeight - 10 });
                doc.fillColor(COLORS.slate800).fontSize(9).font('Helvetica');
                doc.text(item.reaction || '-', MARGIN + 380, doc.y - (rowHeight - 10) + 5, { width: CONTENT_WIDTH - 388, height: rowHeight - 10 });
                doc.moveDown(2.2);
            });
        }

        drawSectionTitle('Major Operations & Surgeries');
        if (records.operations.length === 0) {
            doc.fillColor(COLORS.slate400).fontSize(10).text('No recorded major operations.', MARGIN + 10);
            doc.moveDown(0.5);
        } else {
            // Table headers
            doc.rect(MARGIN, doc.y, CONTENT_WIDTH, 20).fill(COLORS.headerBg).stroke(COLORS.border);
            doc.fillColor(COLORS.slate800).fontSize(9).font('Helvetica-Bold');
            doc.text('Operation Name', MARGIN + 8, doc.y + 6, { width: 200 });
            doc.text('Date', MARGIN + 220, doc.y + 6, { width: 80 });
            doc.text('Hospital', MARGIN + 310, doc.y + 6, { width: CONTENT_WIDTH - 318 });
            doc.moveDown(2.2);

            // Table rows
            records.operations.forEach((item) => {
                const rowHeight = 25;
                doc.rect(MARGIN, doc.y, CONTENT_WIDTH, rowHeight).stroke(COLORS.border);
                doc.fillColor(COLORS.slate800).fontSize(9).font('Helvetica');
                doc.text(item.name, MARGIN + 8, doc.y + 5, { width: 200, height: rowHeight - 10 });
                doc.text(new Date(item.date).toLocaleDateString(), MARGIN + 220, doc.y - (rowHeight - 10) + 5, { width: 80, height: rowHeight - 10 });
                doc.text(item.hospital || '-', MARGIN + 310, doc.y - (rowHeight - 10) + 5, { width: CONTENT_WIDTH - 318, height: rowHeight - 10 });
                doc.moveDown(2.2);
            });
        }

        // 3. Lab Results & Records (Second Page)
        doc.addPage();
        drawBranding();

        drawSectionTitle('Laboratory Results');
        if (records.labResults.length === 0) {
            doc.fillColor(COLORS.slate400).fontSize(10).text('No recorded lab results.', MARGIN + 10);
            doc.moveDown(0.5);
        } else {
            // Table headers
            doc.rect(MARGIN, doc.y, CONTENT_WIDTH, 20).fill(COLORS.headerBg).stroke(COLORS.border);
            doc.fillColor(COLORS.slate800).fontSize(9).font('Helvetica-Bold');
            doc.text('Test Name', MARGIN + 8, doc.y + 6, { width: 200 });
            doc.text('Result', MARGIN + 220, doc.y + 6, { width: 100 });
            doc.text('Unit', MARGIN + 330, doc.y + 6, { width: 70 });
            doc.text('Date', MARGIN + 410, doc.y + 6, { width: CONTENT_WIDTH - 418 });
            doc.moveDown(2.2);

            // Table rows
            records.labResults.forEach((item) => {
                const rowHeight = 25;
                doc.rect(MARGIN, doc.y, CONTENT_WIDTH, rowHeight).stroke(COLORS.border);
                doc.fillColor(COLORS.slate800).fontSize(9).font('Helvetica');
                doc.text(item.testName, MARGIN + 8, doc.y + 5, { width: 200, height: rowHeight - 10 });
                doc.text(item.result, MARGIN + 220, doc.y - (rowHeight - 10) + 5, { width: 100, height: rowHeight - 10 });
                doc.text(item.unit || '-', MARGIN + 330, doc.y - (rowHeight - 10) + 5, { width: 70, height: rowHeight - 10 });
                doc.text(new Date(item.date).toLocaleDateString(), MARGIN + 410, doc.y - (rowHeight - 10) + 5, { width: CONTENT_WIDTH - 418, height: rowHeight - 10 });
                doc.moveDown(2.2);
            });
        }

        drawSectionTitle('Recent Alerts & Notifications');
        if (records.history.alerts.length === 0) {
            doc.fillColor(COLORS.slate400).fontSize(10).text('No alerts in record.', MARGIN + 10);
            doc.moveDown(0.5);
        } else {
            // Table headers
            doc.rect(MARGIN, doc.y, CONTENT_WIDTH, 20).fill(COLORS.headerBg).stroke(COLORS.border);
            doc.fillColor(COLORS.slate800).fontSize(9).font('Helvetica-Bold');
            doc.text('Severity', MARGIN + 8, doc.y + 6, { width: 80 });
            doc.text('Message', MARGIN + 100, doc.y + 6, { width: 180 });
            doc.text('Status', MARGIN + 290, doc.y + 6, { width: 80 });
            doc.text('Date', MARGIN + 380, doc.y + 6, { width: CONTENT_WIDTH - 388 });
            doc.moveDown(2.2);

            // Table rows (Show recent 5 alerts)
            records.history.alerts.slice(0, 5).forEach((item) => {
                const rowHeight = 35;
                const severityColor = item.severity === 'CRITICAL' ? '#ef4444' : (item.severity === 'HIGH' ? '#f59e0b' : COLORS.teal);
                doc.rect(MARGIN, doc.y, CONTENT_WIDTH, rowHeight).stroke(COLORS.border);
                doc.fillColor(severityColor).fontSize(8).font('Helvetica-Bold');
                doc.text(item.severity, MARGIN + 8, doc.y + 8, { width: 80, height: rowHeight - 10 });
                doc.fillColor(COLORS.slate800).fontSize(8).font('Helvetica');
                doc.text(item.message, MARGIN + 100, doc.y + 8, { width: 180, height: rowHeight - 10 });
                doc.fillColor(COLORS.slate600).fontSize(8).font('Helvetica-Bold');
                doc.text(item.status, MARGIN + 290, doc.y + 8, { width: 80, height: rowHeight - 10 });
                doc.fillColor(COLORS.slate600).fontSize(8).font('Helvetica');
                doc.text(new Date(item.date).toLocaleDateString(), MARGIN + 380, doc.y + 8, { width: CONTENT_WIDTH - 388, height: rowHeight - 10 });
                
                // Show resolved alert details if available
                if (item.status === 'RESOLVED' && (item.instructions || item.prescription)) {
                    doc.moveDown(3.5);
                    if (item.instructions) {
                        doc.fillColor(COLORS.slate600).fontSize(8).font('Helvetica-Bold');
                        doc.text('Instructions:', MARGIN + 20, doc.y, { width: 150 });
                        doc.fillColor(COLORS.slate700).fontSize(8).font('Helvetica');
                        doc.text(item.instructions, MARGIN + 20, doc.y + 12, { width: CONTENT_WIDTH - 40 });
                    }
                    if (item.prescription && item.prescription.medications && item.prescription.medications.length > 0) {
                        doc.moveDown(0.8);
                        doc.fillColor(COLORS.slate600).fontSize(8).font('Helvetica-Bold');
                        doc.text('Prescriptions:', MARGIN + 20, doc.y, { width: 150 });
                        doc.fillColor(COLORS.slate700).fontSize(8).font('Helvetica');
                        item.prescription.medications.forEach((med, idx) => {
                            const medText = `${idx + 1}. ${med.name} - ${med.dosage}, ${med.frequency} for ${med.duration}`;
                            doc.text(medText, MARGIN + 30, doc.y + 12 + (idx * 14), { width: CONTENT_WIDTH - 50 });
                        });
                    }
                }
                doc.moveDown(3.5);
            });
        }

        drawSectionTitle('Completed Appointments & Prescriptions');
        if (records.history.completedAppointments.length === 0) {
            doc.fillColor(COLORS.slate400).fontSize(10).text('No completed appointments.', MARGIN + 10);
            doc.moveDown(0.5);
        } else {
            records.history.completedAppointments.forEach((apt) => {
                doc.fillColor(COLORS.slate800).fontSize(10).font('Helvetica-Bold');
                doc.text(`Dr. ${apt.doctorName} - ${apt.type}`, MARGIN, doc.y);
                doc.fillColor(COLORS.slate600).fontSize(9).font('Helvetica');
                doc.text(new Date(apt.date).toLocaleDateString(), MARGIN, doc.y + 15);
                
                if (apt.notes) {
                    doc.moveDown(0.5);
                    doc.fillColor(COLORS.slate600).fontSize(9).font('Helvetica-Bold');
                    doc.text('Notes:', MARGIN, doc.y);
                    doc.fillColor(COLORS.slate700).fontSize(9).font('Helvetica');
                    doc.text(apt.notes, MARGIN + 10, doc.y + 12, { width: CONTENT_WIDTH - 20 });
                }

                if (apt.prescription && apt.prescription.medications && apt.prescription.medications.length > 0) {
                    doc.moveDown(0.8);
                    doc.fillColor(COLORS.slate600).fontSize(9).font('Helvetica-Bold');
                    doc.text('Prescriptions:', MARGIN, doc.y);
                    doc.fillColor(COLORS.slate700).fontSize(9).font('Helvetica');
                    apt.prescription.medications.forEach((med, idx) => {
                        const medText = `${idx + 1}. ${med.name} - ${med.dosage}, ${med.frequency} for ${med.duration}`;
                        doc.text(medText, MARGIN + 10, doc.y + 12 + (idx * 14), { width: CONTENT_WIDTH - 20 });
                    });
                }

                doc.moveDown(1.5);
                doc.moveTo(MARGIN, doc.y).lineTo(WIDTH - MARGIN, doc.y).stroke(COLORS.border);
                doc.moveDown(0.8);
            });
        }

        // 4. Verification & Footer
        doc.moveDown(2);
        doc.moveTo(MARGIN, doc.y).lineTo(WIDTH - MARGIN, doc.y).stroke(COLORS.border);
        
        doc.moveDown(1);
        doc.fillColor(COLORS.slate400).fontSize(8).font('Helvetica').text(
            'This document is confidential and intended only for authorized medical personnel. HEALIX Systems.',
            0, doc.y, { align: 'center' }
        );

        doc.end();
    } catch (error) {
        if (!res.headersSent) {
            res.status(400).json({ success: false, message: `PDF Generation failed: ${error.message}` });
        }
        console.error(error);
    }
};
