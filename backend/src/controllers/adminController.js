import {
  getPendingApplications,
  approveApplication,
  rejectApplication
} from '../services/doctorService.js';
import {
  getDashboardStats,
  getAlertStats,
  getAppointmentStats,
  getRecentAlerts,
  getRecentLogs,
  getPaginatedLogs,
  getAllLogsForDownload,
  formatLogsForCSV,
  getDoctorApplications,
  approveDoctorApplication,
  rejectDoctorApplication,
  getPaginatedDoctors,
  getPaginatedPatients,
  getAllDoctorsForDownload,
  formatDoctorsForCSV,
  getPaginatedAppointments,
  getPaginatedAlerts,
  registerDoctorAsAdmin,
  changeDoctorStatus,
  changePatientStatus,
  getAllPatientsForDownload,
  formatPatientsForCSV,
} from '../services/adminService.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { logSuccess, logFailure } from '../utils/logger.js';
import PDFDocument from 'pdfkit';

export const getPendingApplicationsController = async (req, res, next) => {
  try {
    const applications = await getPendingApplications();
    res.json(successResponse('Retrieved pending applications.', applications));
  } catch (error) {
    next(error);
  }
};

export const approveApplicationController = async (req, res, next) => {
  try {
    const { doctorId } = req.body;

    if (!doctorId) {
      return res.status(400).json(errorResponse('Doctor ID is required'));
    }

    await approveDoctorApplication(doctorId);
    res.json(successResponse('Doctor application approved successfully. Email sent to doctor.'));
    await logSuccess({
      req,
      adminId: req?.user?._id,
      action: 'APPROVE_DOCTOR',
      entityType: 'DOCTOR',
      entityId: doctorId,
      description: `Doctor application approved: ${doctorId}`,
    });
  } catch (error) {
    await logFailure({
      req,
      adminId: req?.user?._id,
      action: 'APPROVE_DOCTOR',
      entityType: 'DOCTOR',
      entityId: req?.body?.doctorId,
      description: 'Doctor approval failed',
      error,
    });
    next(error);
  }
};

export const rejectApplicationController = async (req, res, next) => {
  try {
    const { doctorId, reason } = req.body;

    if (!doctorId || !reason) {
      return res.status(400).json(errorResponse('Doctor ID and reason are required'));
    }

    await rejectDoctorApplication(doctorId, reason);
    res.json(successResponse('Doctor application rejected. Email sent to doctor.'));
    await logSuccess({
      req,
      adminId: req?.user?._id,
      action: 'REJECT_DOCTOR',
      entityType: 'DOCTOR',
      entityId: doctorId,
      description: `Doctor application rejected: ${doctorId}. Reason: ${reason}`,
    });
  } catch (error) {
    await logFailure({
      req,
      adminId: req?.user?._id,
      action: 'REJECT_DOCTOR',
      entityType: 'DOCTOR',
      entityId: req?.body?.doctorId,
      description: 'Doctor rejection failed',
      error,
    });
    next(error);
  }
};

export const processApplicationController = async (req, res, next) => {
  try {
    const { doctorId, approved, reason } = req.body;

    if (!doctorId) {
      return res.status(400).json(errorResponse('Doctor ID is required'));
    }

    if (approved) {
      await approveDoctorApplication(doctorId);
      res.json(successResponse('Doctor application approved successfully.'));
      await logSuccess({
        req,
        adminId: req?.user?._id,
        action: 'APPROVE_DOCTOR',
        entityType: 'DOCTOR',
        entityId: doctorId,
        description: `Doctor application approved via process: ${doctorId}`,
      });
    } else {
      if (!reason) {
        return res.status(400).json(errorResponse('Reason is required for rejection'));
      }
      await rejectDoctorApplication(doctorId, reason);
      res.json(successResponse('Doctor application rejected.'));
      await logSuccess({
        req,
        adminId: req?.user?._id,
        action: 'REJECT_DOCTOR',
        entityType: 'DOCTOR',
        entityId: doctorId,
        description: `Doctor application rejected via process: ${doctorId}. Reason: ${reason}`,
      });
    }
  } catch (error) {
    await logFailure({
      req,
      adminId: req?.user?._id,
      action: approved ? 'APPROVE_DOCTOR' : 'REJECT_DOCTOR',
      entityType: 'DOCTOR',
      entityId: req?.body?.doctorId,
      description: 'Doctor application process failed',
      error,
    });
    next(error);
  }
};

/**
 * Get dashboard statistics
 */
export const getDashboardStatsController = async (req, res, next) => {
  try {
    const stats = await getDashboardStats();
    res.json(successResponse('Dashboard statistics retrieved successfully.', stats));
  } catch (error) {
    next(error);
  }
};

/**
 * Get alert statistics
 */
export const getAlertStatsController = async (req, res, next) => {
  try {
    const stats = await getAlertStats();
    res.json(successResponse('Alert statistics retrieved successfully.', stats));
  } catch (error) {
    next(error);
  }
};

/**
 * Get appointment statistics
 */
export const getAppointmentStatsController = async (req, res, next) => {
  try {
    const stats = await getAppointmentStats();
    res.json(successResponse('Appointment statistics retrieved successfully.', stats));
  } catch (error) {
    next(error);
  }
};

/**
 * Get recent alerts
 */
export const getRecentAlertsController = async (req, res, next) => {
  try {
    const limit = req.query.limit || 10;
    const alerts = await getRecentAlerts(parseInt(limit));
    res.json(successResponse('Recent alerts retrieved successfully.', alerts));
  } catch (error) {
    next(error);
  }
};

/**
 * Get recent logs
 */
export const getRecentLogsController = async (req, res, next) => {
  try {
    const limit = req.query.limit || 10;
    const logs = await getRecentLogs(parseInt(limit));
    res.json(successResponse('Recent logs retrieved successfully.', logs));
  } catch (error) {
    next(error);
  }
};

/**
 * Get paginated logs (for logs page)
 */
export const getLogsController = async (req, res, next) => {
  try {
    const { page = 0, size = 20 } = req.query;
    const data = await getPaginatedLogs(parseInt(page), parseInt(size));
    res.json(successResponse('Logs retrieved successfully.', data));
  } catch (error) {
    res.status(400).json(errorResponse(error.message));
  }
};

/**
 * Download logs (CSV or JSON)
 */
export const downloadLogsController = async (req, res, next) => {
  try {
    const { format = 'csv' } = req.query;
    const data = await getAllLogsForDownload();

    const fmt = String(format).toLowerCase();

    if (fmt === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="system_logs.json"');
      return res.status(200).send(JSON.stringify(data));
    }

    if (fmt === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="system_logs.pdf"');

      const doc = new PDFDocument({ margin: 36, layout: 'landscape' });
      doc.pipe(res);

      doc.fontSize(20).text('System Activity Logs', { align: 'center' });
      doc.moveDown(0.2);
      doc.fontSize(10).fillColor('#666').text(`Professional Healthcare Platform | Generated: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.moveDown(1.5);

      // Table configuration for Landscape
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const columns = [
        { key: 'timestamp', label: 'Date/Time', width: pageWidth * 0.16 },
        { key: 'level', label: 'Lvl', width: pageWidth * 0.06 },
        { key: 'status', label: 'Status', width: pageWidth * 0.08 },
        { key: 'action', label: 'Action', width: pageWidth * 0.15 },
        { key: 'userEmail', label: 'Personnel Email', width: pageWidth * 0.20 },
        { key: 'description', label: 'Activity Description', width: pageWidth * 0.35 },
      ];

      const startX = doc.page.margins.left;
      const padding = 4;
      const headerRow = columns.reduce((acc, c) => ({ ...acc, [c.key]: c.label }), {});

      const measureRowHeight = (row, isHeader = false) => {
        const heights = columns.map((col) => {
          const text = row[col.key] ? String(row[col.key]) : '';
          const fontSize = isHeader ? 10 : 9;
          doc.fontSize(fontSize);
          const height = doc.heightOfString(text, {
            width: col.width - padding * 2,
            align: 'left',
          });
          return height + padding * 2;
        });
        return Math.max(isHeader ? 20 : 16, ...heights);
      };

      const drawRow = (row, isHeader = false) => {
        const height = measureRowHeight(row, isHeader);
        const bottom = doc.page.height - doc.page.margins.bottom;

        if (!isHeader && doc.y + height > bottom) {
          doc.addPage();
          doc.y = doc.page.margins.top;
          drawRow(headerRow, true);
          return drawRow(row, false);
        }

        let x = startX;
        const y = doc.y;

        columns.forEach((col) => {
          const text = row[col.key] ? String(row[col.key]) : '';
          const cellX = x;
          const cellY = y;

          // Draw cell background for header
          if (isHeader) {
            doc.save().rect(cellX, cellY, col.width, height).fill('#f2f4f7').restore();
          }

          // Draw cell border
          doc.rect(cellX, cellY, col.width, height).lineWidth(0.5).stroke('#d0d0d0');

          // Draw text with clipping to prevent overflow
          doc.save();
          doc.rect(cellX + padding, cellY + padding, col.width - padding * 2, height - padding * 2).clip();
          doc
            .fontSize(isHeader ? 10 : 9)
            .fillColor(isHeader ? '#000' : '#111')
            .text(text, cellX + padding, cellY + padding, {
              width: col.width - padding * 2,
              align: 'left',
              lineBreak: true,
            });
          doc.restore();
          x += col.width;
        });
        doc.y = y + height;
      };

      drawRow(headerRow, true);
      doc.moveDown(0.1);

      data.forEach((l) => {
        drawRow({
          timestamp: l.timestamp ? new Date(l.timestamp).toISOString() : '',
          level: l.level || '',
          status: l.status || '',
          action: l.action || '',
          userEmail: l.userEmail || l.adminEmail || '',
          description: l.description || (l.additionalInfo ? l.additionalInfo.slice(0, 160) : ''),
        });
      });

      doc.end();
      return;
    }

    // CSV formatting via service
    const csv = await formatLogsForCSV();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="system_logs.csv"');
    return res.status(200).send(csv);
  } catch (error) {
    res.status(400).json(errorResponse(error.message));
  }
};

/**
 * Download doctors data (CSV or JSON or PDF)
 */
/**
 * Download doctors data (CSV or JSON or PDF)
 */
export const downloadDoctorsController = async (req, res, next) => {
  try {
    const { format = 'csv' } = req.query;
    const data = await getAllDoctorsForDownload();
    const fmt = String(format).toLowerCase();

    if (fmt === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="medical_personnel.json"');
      return res.status(200).send(JSON.stringify(data, null, 2));
    }

    if (fmt === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="medical_personnel.pdf"');

      const doc = new PDFDocument({ margin: 36, layout: 'landscape' });
      doc.pipe(res);

      doc.fontSize(20).text('Medical Personnel Directory', { align: 'center' });
      doc.moveDown(0.2);
      doc.fontSize(10).fillColor('#666').text(`Professional Healthcare Platform | Generated: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.moveDown(1.5);

      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const columns = [
        { key: 'fullName', label: 'Doctor Name', width: pageWidth * 0.15 },
        { key: 'email', label: 'Email Address', width: pageWidth * 0.18 },
        { key: 'specialization', label: 'Specialization', width: pageWidth * 0.12 },
        { key: 'licenseNumber', label: 'License #', width: pageWidth * 0.12 },
        { key: 'experience', label: 'Exp (Yrs)', width: pageWidth * 0.08 },
        { key: 'status', label: 'App Status', width: pageWidth * 0.12 },
        { key: 'isActive', label: 'Security', width: pageWidth * 0.10 },
        { key: 'registeredAt', label: 'Registered', width: pageWidth * 0.13 },
      ];

      const startX = doc.page.margins.left;
      const padding = 4;
      const headerRow = columns.reduce((acc, c) => ({ ...acc, [c.key]: c.label }), {});

      const measureRowHeight = (row, isHeader = false) => {
        const heights = columns.map((col) => {
          const text = row[col.key] ? String(row[col.key]) : '';
          doc.fontSize(isHeader ? 10 : 9);
          return doc.heightOfString(text, { width: col.width - padding * 2 }) + padding * 2;
        });
        return Math.max(isHeader ? 22 : 18, ...heights);
      };

      const drawRow = (row, isHeader = false) => {
        const height = measureRowHeight(row, isHeader);
        if (doc.y + height > doc.page.height - doc.page.margins.bottom) {
          doc.addPage();
          doc.y = doc.page.margins.top;
          drawRow(headerRow, true);
        }

        let currX = startX;
        const currY = doc.y;

        columns.forEach((col) => {
          const text = row[col.key] ? String(row[col.key]) : '';

          if (isHeader) {
            doc.save().rect(currX, currY, col.width, height).fill('#f8fafc').restore();
          }
          doc.rect(currX, currY, col.width, height).lineWidth(0.5).stroke('#e2e8f0');

          doc.save();
          doc.rect(currX + padding, currY + padding, col.width - padding * 2, height - padding * 2).clip();
          doc.fontSize(isHeader ? 10 : 9)
            .fillColor(isHeader ? '#0f172a' : '#334155')
            .text(text, currX + padding, currY + padding, {
              width: col.width - padding * 2,
              align: 'left',
              lineBreak: true
            });
          doc.restore();
          currX += col.width;
        });
        doc.y = currY + height;
      };

      drawRow(headerRow, true);
      data.forEach(item => {
        drawRow({
          ...item,
          registeredAt: item.registeredAt ? new Date(item.registeredAt).toLocaleDateString() : 'N/A'
        });
      });

      doc.end();
      return;
    }

    // CSV formatting via service
    const csvContent = await formatDoctorsForCSV();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="medical_personnel.csv"');
    return res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};

/**
 * Download patients data (CSV or JSON or PDF)
 */
export const downloadPatientsController = async (req, res, next) => {
  try {
    const { format = 'csv' } = req.query;
    const data = await getAllPatientsForDownload();
    const fmt = String(format).toLowerCase();

    if (fmt === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="patient_registry.json"');
      return res.status(200).send(JSON.stringify(data, null, 2));
    }

    if (fmt === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="patient_registry.pdf"');

      const doc = new PDFDocument({ margin: 36, layout: 'landscape' });
      doc.pipe(res);

      doc.fontSize(20).text('Patient Registry Directory', { align: 'center' });
      doc.moveDown(0.2);
      doc.fontSize(10).fillColor('#666').text(`Professional Healthcare Platform | Generated: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.moveDown(1.5);

      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const columns = [
        { key: 'fullName', label: 'Patient Name', width: pageWidth * 0.15 },
        { key: 'email', label: 'Email Address', width: pageWidth * 0.18 },
        { key: 'phone', label: 'Phone', width: pageWidth * 0.12 },
        { key: 'bloodType', label: 'Blood', width: pageWidth * 0.08 },
        { key: 'gender', label: 'Gender', width: pageWidth * 0.08 },
        { key: 'dob', label: 'Birth Date', width: pageWidth * 0.12 },
        { key: 'isActive', label: 'Status', width: pageWidth * 0.10 },
        { key: 'registeredAt', label: 'Registered', width: pageWidth * 0.17 },
      ];

      const startX = doc.page.margins.left;
      const padding = 4;
      const headerRow = columns.reduce((acc, c) => ({ ...acc, [c.key]: c.label }), {});

      const measureRowHeight = (row, isHeader = false) => {
        const heights = columns.map((col) => {
          const text = row[col.key] ? String(row[col.key]) : '';
          doc.fontSize(isHeader ? 10 : 9);
          return doc.heightOfString(text, { width: col.width - padding * 2 }) + padding * 2;
        });
        return Math.max(isHeader ? 22 : 18, ...heights);
      };

      const drawRow = (row, isHeader = false) => {
        const height = measureRowHeight(row, isHeader);
        if (doc.y + height > doc.page.height - doc.page.margins.bottom) {
          doc.addPage();
          doc.y = doc.page.margins.top;
          drawRow(headerRow, true);
        }

        let currX = startX;
        const currY = doc.y;

        columns.forEach((col) => {
          const text = row[col.key] ? String(row[col.key]) : '';

          if (isHeader) {
            doc.save().rect(currX, currY, col.width, height).fill('#f8fafc').restore();
          }
          doc.rect(currX, currY, col.width, height).lineWidth(0.5).stroke('#e2e8f0');

          doc.save();
          doc.rect(currX + padding, currY + padding, col.width - padding * 2, height - padding * 2).clip();
          doc.fontSize(isHeader ? 10 : 9)
            .fillColor(isHeader ? '#0f172a' : '#334155')
            .text(text, currX + padding, currY + padding, {
              width: col.width - padding * 2,
              align: 'left',
              lineBreak: true
            });
          doc.restore();
          currX += col.width;
        });
        doc.y = currY + height;
      };

      drawRow(headerRow, true);
      data.forEach(item => {
        drawRow({
          ...item,
          registeredAt: item.registeredAt ? new Date(item.registeredAt).toLocaleDateString() : 'N/A'
        });
      });

      doc.end();
      return;
    }

    // CSV formatting via service
    const csvContent = await formatPatientsForCSV();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="patient_registry.csv"');
    return res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin-direct doctor registration (skips approval flow)
 */
export const registerDoctorAsAdminController = async (req, res, next) => {
  try {
    const result = await registerDoctorAsAdmin(req.body);
    res.status(201).json(successResponse('Doctor registered and activated successfully.', result));
    await logSuccess({
      req,
      adminId: req?.user?._id,
      action: 'ADMIN_REGISTER_DOCTOR',
      entityType: 'DOCTOR',
      entityId: result?.doctor?._id,
      description: `Admin created doctor account: ${result?.user?.email}`,
    });
  } catch (error) {
    await logFailure({
      req,
      adminId: req?.user?._id,
      action: 'ADMIN_REGISTER_DOCTOR',
      entityType: 'DOCTOR',
      description: 'Admin doctor registration failed',
      error,
    });
    next(error);
  }
};

/**
 * Get doctor applications
 */
export const getDoctorApplicationsController = async (req, res, next) => {
  try {
    const { status = 'PENDING', page = 0, size = 10 } = req.query;
    const data = await getDoctorApplications(status, parseInt(page), parseInt(size));
    res.json(successResponse('Doctor applications retrieved successfully.', data));
  } catch (error) {
    next(error);
  }
};

/**
 * Get paginated patients
 */
export const getPaginatedPatientsController = async (req, res, next) => {
  try {
    const { page = 0, size = 10, search = '' } = req.query;
    const data = await getPaginatedPatients(parseInt(page), parseInt(size), search);
    res.json(successResponse('Paginated patients retrieved successfully.', data));
  } catch (error) {
    next(error);
  }
};

/**
 * Get paginated doctors
 */
export const getPaginatedDoctorsController = async (req, res, next) => {
  try {
    const { page = 0, size = 10, search = '', requestStatus } = req.query;
    const data = await getPaginatedDoctors(parseInt(page), parseInt(size), search, requestStatus);
    res.json(successResponse('Paginated doctors retrieved successfully.', data));
  } catch (error) {
    next(error);
  }
};

/**
 * Get paginated appointments
 */
export const getPaginatedAppointmentsController = async (req, res, next) => {
  try {
    const { page = 0, size = 10 } = req.query;
    const data = await getPaginatedAppointments(parseInt(page), parseInt(size));
    res.json(successResponse('Paginated appointments retrieved successfully.', data));
  } catch (error) {
    next(error);
  }
};

/**
 * Get paginated alerts
 */
export const getPaginatedAlertsController = async (req, res, next) => {
  try {
    const { page = 0, size = 10 } = req.query;
    const data = await getPaginatedAlerts(parseInt(page), parseInt(size));
    res.json(successResponse('Paginated alerts retrieved successfully.', data));
  } catch (error) {
    next(error);
  }
};
/**
 * Manage doctor status (Activate/Deactivate) with email notification
 */
export const manageDoctorStatusController = async (req, res, next) => {
  try {
    const { doctorId, status, reason } = req.body;

    if (!doctorId || !status || !reason) {
      return res.status(400).json(errorResponse('Doctor ID, status, and reason are required'));
    }

    await changeDoctorStatus(doctorId, status, reason);
    res.json(successResponse(`Doctor ${status.toLowerCase()}d successfully. Email sent.`));

    await logSuccess({
      req,
      adminId: req?.user?._id,
      action: `DOCTOR_${status}`,
      entityType: 'DOCTOR',
      entityId: doctorId,
      description: `Doctor status changed to ${status}. Reason: ${reason}`,
    });
  } catch (error) {
    await logFailure({
      req,
      adminId: req?.user?._id,
      action: `DOCTOR_${status}`,
      entityType: 'DOCTOR',
      entityId: req?.body?.doctorId,
      description: `Doctor status change failed`,
      error,
    });
    next(error);
  }
};

/**
 * Manage patient status (Activate/Deactivate) with email notification
 */
export const managePatientStatusController = async (req, res, next) => {
  const { patientId, status, reason } = req.body;
  try {
    if (!patientId || !status || !reason) {
      return res.status(400).json(errorResponse('Patient ID, status, and reason are required'));
    }

    await changePatientStatus(patientId, status, reason);
    res.json(successResponse(`Patient ${status.toLowerCase()}d successfully. Email sent.`));

    await logSuccess({
      req,
      adminId: req?.user?._id,
      action: `PATIENT_${status}`,
      entityType: 'PATIENT',
      entityId: patientId,
      description: `Patient status changed to ${status}. Reason: ${reason}`,
    });
  } catch (error) {
    await logFailure({
      req,
      adminId: req?.user?._id,
      action: `PATIENT_${status}`,
      entityType: 'PATIENT',
      entityId: req?.body?.patientId,
      description: `Patient status change failed`,
      error,
    });
    next(error);
  }
};
