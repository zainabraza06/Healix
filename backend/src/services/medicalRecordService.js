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
                .populate({ path: 'doctor_id', populate: { path: 'user_id', select: 'full_name' } })
                .populate({ path: 'resolved_by', select: 'full_name' })
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
                    prescription_id: a.prescription_id || null, // The related prescription model
                    prescription: a.prescription || null,      // The prescription string
                    instructions: a.instructions || null       // The instructions string
                })),
                alerts: alerts.map(a => ({
                    id: a._id,
                    title: a.title,
                    message: a.message,
                    severity: a.severity,
                    date: a.created_at,
                    status: a.status,
                    instructions: a.instructions || null,      // The instructions string
                    prescription_id: a.prescription_id || null, // The related prescription model
                    prescription: a.prescription || null,       // The prescription string
                    doctorName: a.doctor_id?.user_id?.full_name || 'Doctor',
                    resolvedAt: a.resolved_at || null,
                    resolvedBy: a.resolved_by || null,
                    resolvedByName: a.resolved_by?.full_name || null,
                    expiresAt: a.expires_at || null
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

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="medical-record-${patientId}.pdf"`);
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

        // Helper to check if we need a new page
        const checkPageBreak = (requiredHeight = 100) => {
            if (doc.y + requiredHeight > doc.page.height - MARGIN) {
                doc.addPage();
                drawBranding();
                return true;
            }
            return false;
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
            checkPageBreak(40);
            doc.moveDown(1);
            const sectionY = doc.y;
            doc.rect(MARGIN, sectionY, CONTENT_WIDTH, 25).fill(COLORS.headerBg).stroke(COLORS.border);
            doc.fillColor(COLORS.teal).fontSize(13).font('Helvetica-Bold').text(title.toUpperCase(), MARGIN + 10, sectionY + 7);
            doc.y = sectionY + 35;
        };

        // Helper: Draw Table Row (for data display)
        const drawTableRow = (label, value, labelWidth = 150) => {
            checkPageBreak(30);
            const currentY = doc.y;
            doc.fillColor(COLORS.slate600).fontSize(10).font('Helvetica-Bold').text(label, MARGIN, currentY, { width: labelWidth, align: 'left' });
            doc.fillColor(COLORS.slate800).fontSize(10).font('Helvetica').text(value || 'N/A', MARGIN + labelWidth + 10, currentY, { width: CONTENT_WIDTH - labelWidth - 10, align: 'left', lineGap: 3 });
            doc.y = currentY + 15;
        };

        // Helper: Draw Table with dynamic rows
        const drawTable = (headers, rows, columnWidths, rowRenderer) => {
            checkPageBreak(60);
            const headerY = doc.y;

            // Draw header
            doc.rect(MARGIN, headerY, CONTENT_WIDTH, 25).fill(COLORS.headerBg).stroke(COLORS.border);
            let xPos = MARGIN + 8;
            headers.forEach((header, index) => {
                doc.fillColor(COLORS.slate800).fontSize(10).font('Helvetica-Bold');
                doc.text(header, xPos, headerY + 8, { width: columnWidths[index] });
                xPos += columnWidths[index] + 10;
            });

            doc.y = headerY + 35;

            // Draw rows
            rows.forEach((row, index) => {
                checkPageBreak(35);
                const rowY = doc.y;
                rowRenderer(row, rowY);
                doc.y = rowY + 35;
            });

            doc.moveDown(0.5);
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
            checkPageBreak(30);
            doc.fillColor(COLORS.slate400).fontSize(10).text('No recorded immunizations.', MARGIN + 10);
            doc.y += 15;
        } else {
            drawTable(
                ['Vaccine Name', 'Date', 'Notes'],
                records.immunizations,
                [200, 80, CONTENT_WIDTH - 318],
                (item, rowY) => {
                    doc.rect(MARGIN, rowY, CONTENT_WIDTH, 30).stroke(COLORS.border);
                    doc.fillColor(COLORS.slate800).fontSize(10).font('Helvetica');
                    doc.text(item.name, MARGIN + 8, rowY + 10, { width: 200 });
                    doc.text(new Date(item.date).toLocaleDateString(), MARGIN + 220, rowY + 10, { width: 80 });
                    doc.text(item.notes || '-', MARGIN + 310, rowY + 10, { width: CONTENT_WIDTH - 318 });
                }
            );
        }

        drawSectionTitle('Active Allergies');
        if (records.allergies.length === 0) {
            checkPageBreak(30);
            doc.fillColor(COLORS.slate400).fontSize(10).text('No recorded allergies.', MARGIN + 10);
            doc.y += 15;
        } else {
            drawTable(
                ['Allergen', 'Severity', 'Reaction'],
                records.allergies,
                [250, 100, CONTENT_WIDTH - 388],
                (item, rowY) => {
                    doc.rect(MARGIN, rowY, CONTENT_WIDTH, 30).stroke(COLORS.border);
                    const severityColor = item.severity === 'HIGH' ? '#ef4444' : (item.severity === 'MEDIUM' ? '#f59e0b' : COLORS.teal);
                    doc.fillColor(COLORS.slate800).fontSize(10).font('Helvetica');
                    doc.text(item.name, MARGIN + 8, rowY + 10, { width: 250 });
                    doc.fillColor(severityColor).fontSize(9).font('Helvetica-Bold');
                    doc.text(item.severity, MARGIN + 270, rowY + 10, { width: 100 });
                    doc.fillColor(COLORS.slate800).fontSize(10).font('Helvetica');
                    doc.text(item.reaction || '-', MARGIN + 380, rowY + 10, { width: CONTENT_WIDTH - 388 });
                }
            );
        }

        drawSectionTitle('Major Operations & Surgeries');
        if (records.operations.length === 0) {
            checkPageBreak(30);
            doc.fillColor(COLORS.slate400).fontSize(10).text('No recorded major operations.', MARGIN + 10);
            doc.y += 15;
        } else {
            drawTable(
                ['Operation Name', 'Date', 'Hospital'],
                records.operations,
                [200, 80, CONTENT_WIDTH - 318],
                (item, rowY) => {
                    doc.rect(MARGIN, rowY, CONTENT_WIDTH, 30).stroke(COLORS.border);
                    doc.fillColor(COLORS.slate800).fontSize(10).font('Helvetica');
                    doc.text(item.name, MARGIN + 8, rowY + 10, { width: 200 });
                    doc.text(new Date(item.date).toLocaleDateString(), MARGIN + 220, rowY + 10, { width: 80 });
                    doc.text(item.hospital || '-', MARGIN + 310, rowY + 10, { width: CONTENT_WIDTH - 318 });
                }
            );
        }

        // Start new page for remaining content
        doc.addPage();
        drawBranding();

        // 3. Lab Results
        drawSectionTitle('Laboratory Results');
        if (records.labResults.length === 0) {
            checkPageBreak(30);
            doc.fillColor(COLORS.slate400).fontSize(10).text('No recorded lab results.', MARGIN + 10);
            doc.y += 15;
        } else {
            drawTable(
                ['Test Name', 'Result', 'Unit', 'Date'],
                records.labResults,
                [200, 100, 70, CONTENT_WIDTH - 418],
                (item, rowY) => {
                    doc.rect(MARGIN, rowY, CONTENT_WIDTH, 30).stroke(COLORS.border);
                    doc.fillColor(COLORS.slate800).fontSize(10).font('Helvetica');
                    doc.text(item.testName, MARGIN + 8, rowY + 10, { width: 200 });
                    doc.text(item.result, MARGIN + 220, rowY + 10, { width: 100 });
                    doc.text(item.unit || '-', MARGIN + 330, rowY + 10, { width: 70 });
                    doc.text(new Date(item.date).toLocaleDateString(), MARGIN + 410, rowY + 10, { width: CONTENT_WIDTH - 418 });
                }
            );
        }

        // 4. Alerts with proper color themes and subheadings
        drawSectionTitle('Recent Alerts & Notifications');
        if (records.history.alerts.length === 0) {
            checkPageBreak(30);
            doc.fillColor(COLORS.slate400).fontSize(10).text('No alerts in record.', MARGIN + 10);
            doc.y += 15;
        } else {
            records.history.alerts.forEach((alert, index) => {
                // Calculate required height for this alert
                doc.font('Helvetica').fontSize(9);
                const messageHeight = alert.message ? doc.heightOfString(alert.message, { width: CONTENT_WIDTH - 50 }) + 15 : 0;
                const instructionsHeight = alert.instructions ? doc.heightOfString(alert.instructions, { width: CONTENT_WIDTH - 50 }) + 25 : 0;
                const prescriptionStrHeight = alert.prescription ? doc.heightOfString(alert.prescription, { width: CONTENT_WIDTH - 50 }) + 25 : 0;

                // Calculate meds height (from model)
                let medsHeight = 0;
                if (alert.prescription_id?.medications?.length > 0) {
                    medsHeight = 25; // For the "Prescribed Medications:" heading
                    alert.prescription_id.medications.forEach(med => {
                        const medText = `• ${med.name} - ${med.dosage}, ${med.frequency} for ${med.duration}`;
                        medsHeight += doc.heightOfString(medText, { width: CONTENT_WIDTH - 60 }) + 5;
                    });
                }

                const totalHeight = 40 + messageHeight + instructionsHeight + prescriptionStrHeight + medsHeight + 20;

                checkPageBreak(totalHeight + 20);

                const alertY = doc.y;
                const severityColor = getSeverityColor(alert.severity);

                // Alert container with subtle border
                doc.rect(MARGIN, alertY, CONTENT_WIDTH, totalHeight)
                    .fillAndStroke('#ffffff', COLORS.border);

                // Alert header with severity indicator
                doc.rect(MARGIN, alertY, 5, 25).fill(severityColor);
                doc.rect(MARGIN + 5, alertY, CONTENT_WIDTH - 5, 25).fill(severityColor + '15');

                // Alert title and severity
                doc.fillColor(severityColor).fontSize(11).font('Helvetica-Bold');
                doc.text(alert.severity, MARGIN + 15, alertY + 8, { width: 80 });

                doc.fillColor(COLORS.slate800).fontSize(11).font('Helvetica-Bold');
                const title = alert.title || 'Medical Alert';
                doc.text(title, MARGIN + 100, alertY + 8, { width: 200 });

                // Status and date
                const statusColor = alert.status === 'RESOLVED' ? COLORS.emerald :
                    (alert.status === 'ACTIVE' ? '#f59e0b' : COLORS.slate600);

                doc.fillColor(statusColor).fontSize(9).font('Helvetica-Bold');
                doc.text(alert.status, MARGIN + 310, alertY + 8, { width: 80 });

                doc.fillColor(COLORS.slate600).fontSize(9).font('Helvetica');
                doc.text(new Date(alert.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                }), MARGIN + 400, alertY + 8, { width: 150 });

                let contentY = alertY + 35;

                // Doctor information
                if (alert.doctorName) {
                    doc.fillColor(COLORS.slate700).fontSize(9).font('Helvetica');
                    doc.text(`Issued by: Dr. ${alert.doctorName}`, MARGIN + 15, contentY, { width: CONTENT_WIDTH - 30 });
                    contentY += 15;
                }

                // Alert message (with proper subheading)
                if (alert.message) {
                    doc.fillColor(COLORS.slate600).fontSize(9).font('Helvetica-Bold');
                    doc.text('Alert Details:', MARGIN + 15, contentY);
                    contentY += 12;

                    doc.fillColor(COLORS.slate800).fontSize(9).font('Helvetica');
                    doc.text(alert.message, MARGIN + 25, contentY, {
                        width: CONTENT_WIDTH - 50,
                        lineGap: 3
                    });
                    contentY += messageHeight;
                }

                // Instructions (with proper subheading)
                if (alert.instructions) {
                    doc.fillColor(COLORS.slate600).fontSize(9).font('Helvetica-Bold');
                    doc.text('Medical Instructions:', MARGIN + 15, contentY);
                    contentY += 12;

                    doc.fillColor(COLORS.slate800).fontSize(9).font('Helvetica');
                    doc.text(alert.instructions, MARGIN + 25, contentY, {
                        width: CONTENT_WIDTH - 50,
                        lineGap: 3
                    });
                    contentY += instructionsHeight - 12;
                }

                // Prescription String (if provided as text)
                if (alert.prescription) {
                    doc.fillColor(COLORS.slate600).fontSize(9).font('Helvetica-Bold');
                    doc.text('Prescription:', MARGIN + 15, contentY);
                    contentY += 12;

                    doc.fillColor(COLORS.slate800).fontSize(9).font('Helvetica');
                    doc.text(alert.prescription, MARGIN + 25, contentY, {
                        width: CONTENT_WIDTH - 50,
                        lineGap: 3
                    });
                    contentY += prescriptionStrHeight - 12;
                }

                // Prescribed Medications (from model)
                if (alert.prescription_id?.medications?.length > 0) {
                    doc.fillColor(COLORS.slate600).fontSize(9).font('Helvetica-Bold');
                    doc.text('Prescribed Medications:', MARGIN + 15, contentY);
                    contentY += 15;

                    doc.fillColor(COLORS.slate800).fontSize(9).font('Helvetica');
                    alert.prescription_id.medications.forEach((med, idx) => {
                        const medText = `• ${med.name} - ${med.dosage}, ${med.frequency} for ${med.duration}`;
                        const medHeight = doc.heightOfString(medText, { width: CONTENT_WIDTH - 60 }) + 3;
                        doc.text(medText, MARGIN + 25, contentY, {
                            width: CONTENT_WIDTH - 60,
                            lineGap: 2
                        });
                        contentY += medHeight;
                    });
                }

                // Resolution information (with proper styling)
                if (alert.status === 'RESOLVED' && (alert.resolvedByName || alert.resolvedAt)) {
                    contentY += 10;
                    doc.fillColor(COLORS.emerald).fontSize(8).font('Helvetica-Bold');
                    doc.text('RESOLUTION DETAILS', MARGIN + 15, contentY);
                    contentY += 10;

                    doc.fillColor(COLORS.slate700).fontSize(9).font('Helvetica');

                    if (alert.resolvedByName) {
                        doc.text(`Resolved by: ${alert.resolvedByName}`, MARGIN + 25, contentY, { width: CONTENT_WIDTH - 50 });
                        contentY += 12;
                    }

                    if (alert.resolvedAt) {
                        const resolvedDate = new Date(alert.resolvedAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                        });
                        doc.text(`Resolved on: ${resolvedDate}`, MARGIN + 25, contentY, { width: CONTENT_WIDTH - 50 });
                        contentY += 12;
                    }
                }

                // Expiry information (if applicable)
                if (alert.expiresAt && alert.status === 'ACTIVE') {
                    const expiryDate = new Date(alert.expiresAt);
                    const today = new Date();
                    const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

                    if (daysUntilExpiry >= 0) {
                        contentY += 10;
                        const expiryColor = daysUntilExpiry <= 3 ? '#ef4444' :
                            (daysUntilExpiry <= 7 ? '#f59e0b' : COLORS.slate600);

                        doc.fillColor(expiryColor).fontSize(8).font('Helvetica-Bold');
                        doc.text('EXPIRY NOTICE', MARGIN + 15, contentY);
                        contentY += 10;

                        doc.fillColor(COLORS.slate700).fontSize(9).font('Helvetica');
                        doc.text(`Expires: ${expiryDate.toLocaleDateString()} (in ${daysUntilExpiry} days)`,
                            MARGIN + 25, contentY, { width: CONTENT_WIDTH - 50 });
                    }
                }

                doc.y = contentY + 15;

                // Separator line (except for last alert)
                if (index < records.history.alerts.length - 1) {
                    doc.moveTo(MARGIN, doc.y).lineTo(WIDTH - MARGIN, doc.y).stroke(COLORS.border);
                    doc.y += 10;
                }
            });
        }

        // 5. Completed Appointments with proper styling
        drawSectionTitle('Completed Appointments & Prescriptions');
        if (records.history.completedAppointments.length === 0) {
            checkPageBreak(30);
            doc.fillColor(COLORS.slate400).fontSize(10).text('No completed appointments.', MARGIN + 10);
            doc.y += 15;
        } else {
            records.history.completedAppointments.forEach((apt, index) => {
                // Calculate required height
                const notesHeight = apt.notes ? doc.heightOfString(apt.notes, { width: CONTENT_WIDTH - 50 }) + 30 : 0;
                const instructionsHeight = apt.instructions ? doc.heightOfString(apt.instructions, { width: CONTENT_WIDTH - 50 }) + 30 : 0;
                const prescriptionStrHeight = apt.prescription ? doc.heightOfString(apt.prescription, { width: CONTENT_WIDTH - 50 }) + 30 : 0;

                // Calculate meds height (from model)
                let medsHeight = 0;
                if (apt.prescription_id?.medications?.length > 0) {
                    medsHeight = 25; // For the "Prescriptions:" heading
                    apt.prescription_id.medications.forEach(med => {
                        const medText = `• ${med.name} - ${med.dosage}, ${med.frequency} for ${med.duration}`;
                        medsHeight += doc.heightOfString(medText, { width: CONTENT_WIDTH - 60 }) + 5;
                    });
                }

                const totalHeight = 40 + notesHeight + instructionsHeight + prescriptionStrHeight + medsHeight;

                checkPageBreak(totalHeight + 20);

                const aptY = doc.y;

                // Appointment container
                doc.rect(MARGIN, aptY, CONTENT_WIDTH, totalHeight)
                    .fillAndStroke('#ffffff', COLORS.border);

                // Appointment header with colored accent
                doc.rect(MARGIN, aptY, CONTENT_WIDTH, 25).fill(COLORS.teal + '15');
                doc.rect(MARGIN, aptY, 5, 25).fill(COLORS.teal);

                // Appointment header text
                doc.fillColor(COLORS.teal).fontSize(11).font('Helvetica-Bold');
                doc.text(apt.type.toUpperCase(), MARGIN + 15, aptY + 8, { width: 150 });

                doc.fillColor(COLORS.slate800).fontSize(11).font('Helvetica-Bold');
                doc.text(`Dr. ${apt.doctorName}`, MARGIN + 170, aptY + 8, { width: 200 });

                doc.fillColor(COLORS.slate600).fontSize(9).font('Helvetica');
                doc.text(new Date(apt.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                }), MARGIN + 380, aptY + 8, { width: 150 });

                let contentY = aptY + 35;

                // Notes (with proper subheading)
                if (apt.notes) {
                    doc.fillColor(COLORS.slate600).fontSize(9).font('Helvetica-Bold');
                    doc.text('Clinical Notes:', MARGIN + 15, contentY);
                    contentY += 12;

                    doc.fillColor(COLORS.slate800).fontSize(9).font('Helvetica');
                    doc.text(apt.notes, MARGIN + 25, contentY, {
                        width: CONTENT_WIDTH - 50,
                        lineGap: 3
                    });
                    contentY += notesHeight - 12;
                }

                // Instructions string
                if (apt.instructions) {
                    doc.fillColor(COLORS.slate600).fontSize(9).font('Helvetica-Bold');
                    doc.text('Medical Instructions:', MARGIN + 15, contentY);
                    contentY += 12;

                    doc.fillColor(COLORS.slate800).fontSize(9).font('Helvetica');
                    doc.text(apt.instructions, MARGIN + 25, contentY, {
                        width: CONTENT_WIDTH - 50,
                        lineGap: 3
                    });
                    contentY += instructionsHeight - 12;
                }

                // Prescription string
                if (apt.prescription) {
                    doc.fillColor(COLORS.slate600).fontSize(9).font('Helvetica-Bold');
                    doc.text('Prescription:', MARGIN + 15, contentY);
                    contentY += 12;

                    doc.fillColor(COLORS.slate800).fontSize(9).font('Helvetica');
                    doc.text(apt.prescription, MARGIN + 25, contentY, {
                        width: CONTENT_WIDTH - 50,
                        lineGap: 3
                    });
                    contentY += prescriptionStrHeight - 12;
                }

                // Prescribed medications from model
                if (apt.prescription_id?.medications?.length > 0) {
                    doc.fillColor(COLORS.slate600).fontSize(9).font('Helvetica-Bold');
                    doc.text('Prescribed Medications:', MARGIN + 15, contentY);
                    contentY += 15;

                    doc.fillColor(COLORS.slate800).fontSize(9).font('Helvetica');
                    apt.prescription_id.medications.forEach((med, idx) => {
                        const medText = `• ${med.name} - ${med.dosage}, ${med.frequency} for ${med.duration}`;
                        const medHeight = doc.heightOfString(medText, { width: CONTENT_WIDTH - 60 }) + 3;
                        doc.text(medText, MARGIN + 25, contentY, {
                            width: CONTENT_WIDTH - 60,
                            lineGap: 2
                        });
                        contentY += medHeight;
                    });
                }

                doc.y = contentY + 15;

                // Separator line (except for last appointment)
                if (index < records.history.completedAppointments.length - 1) {
                    doc.moveTo(MARGIN, doc.y).lineTo(WIDTH - MARGIN, doc.y).stroke(COLORS.border);
                    doc.y += 10;
                }
            });
        }

        // Helper function for severity colors
        function getSeverityColor(severity) {
            switch (severity?.toUpperCase()) {
                case 'CRITICAL': return '#ef4444';
                case 'HIGH': return '#f59e0b';
                case 'MEDIUM': return '#3b82f6';
                case 'LOW': return '#10b981';
                default: return COLORS.slate600;
            }
        }

        // 6. Footer
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