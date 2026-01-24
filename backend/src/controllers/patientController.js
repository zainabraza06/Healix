import { getAllPatients, getPatientById, togglePatientStatus, getPatientDashboardData, getVitalsHistory, processVitalsCSV } from '../services/patientService.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { logSuccess, logFailure } from '../utils/logger.js';

/**
 * Get all patients
 */
export const getAllPatientsController = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const size = parseInt(req.query.size) || 10;
    const search = req.query.search || '';

    const patients = await getAllPatients(page, size, search);
    res.json(successResponse('Patients retrieved successfully.', patients));
  } catch (error) {
    next(error);
  }
};

/**
 * Get patient by ID
 */
export const getPatientByIdController = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const patient = await getPatientById(patientId);
    res.json(successResponse('Patient retrieved successfully.', patient));
  } catch (error) {
    next(error);
  }
};

/**
 * Disable patient
 */
export const disablePatientController = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    await togglePatientStatus(patientId, false);
    res.json(successResponse('Patient disabled successfully.'));
    await logSuccess({
      req,
      adminId: req?.user?._id,
      action: 'DISABLE_PATIENT',
      entityType: 'PATIENT',
      entityId: patientId,
      description: `Patient disabled: ${patientId}`,
    });
  } catch (error) {
    await logFailure({
      req,
      adminId: req?.user?._id,
      action: 'DISABLE_PATIENT',
      entityType: 'PATIENT',
      entityId: req?.params?.patientId,
      description: 'Disable patient failed',
      error,
    });
    next(error);
  }
};

/**
 * Enable patient
 */
export const enablePatientController = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    await togglePatientStatus(patientId, true);
    res.json(successResponse('Patient enabled successfully.'));
    await logSuccess({
      req,
      adminId: req?.user?._id,
      action: 'ENABLE_PATIENT',
      entityType: 'PATIENT',
      entityId: patientId,
      description: `Patient enabled: ${patientId}`,
    });
  } catch (error) {
    await logFailure({
      req,
      adminId: req?.user?._id,
      action: 'ENABLE_PATIENT',
      entityType: 'PATIENT',
      entityId: req?.params?.patientId,
      description: 'Enable patient failed',
      error,
    });
    next(error);
  }
};

/**
 * Get patient dashboard data
 */
export const getPatientDashboardController = async (req, res, next) => {
  try {
    const data = await getPatientDashboardData(req.user._id);
    res.json(successResponse('Dashboard data retrieved.', data));
  } catch (error) {
    next(error);
  }
};

/**
 * Get vital signs history
 */
export const getVitalsHistoryController = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const data = await getVitalsHistory(req.user._id, days);
    res.json(successResponse('Vitals history retrieved.', data));
  } catch (error) {
    next(error);
  }
};

/**
 * Download CSV template for vitals upload
 */
export const downloadVitalsCSVTemplateController = async (req, res, next) => {
  try {
    const csvTemplate = [
      'date,time,bloodPressureSystolic,bloodPressureDiastolic,heartRate,temperature,oxygenSaturation,respiratoryRate,notes',
      '2026-01-24,09:30,120,80,72,98.6,98,16,Morning reading',
      '2026-01-24,14:00,118,78,70,98.4,99,14,Afternoon reading'
    ].join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="vitals_template.csv"');
    res.status(200).send(csvTemplate);
  } catch (error) {
    next(error);
  }
};

/**
 * Notify selected doctor about critical vitals and email patient's emergency contact
 */
export const notifyDoctorForCriticalVitalsController = async (req, res, next) => {
  try {
    const { doctorId } = req.body;
    if (!doctorId) {
      const e = new Error('doctorId is required');
      e.statusCode = 400;
      throw e;
    }

    const patient = await (await import('../models/Patient.js')).default.findOne({ user_id: req.user._id }).populate('user_id').lean();
    if (!patient) throw new Error('Patient record not found');

    const Doctor = (await import('../models/Doctor.js')).default;
    const doctor = await Doctor.findById(doctorId).populate('user_id').lean();
    if (!doctor) throw new Error('Doctor not found');

    const AlertModel = (await import('../models/Alert.js')).default;
    let latestAlert = await AlertModel.findOne({ patient_id: patient._id, alert_type: 'CRITICAL', status: 'ACTIVE' })
      .sort({ created_at: -1 });

    if (!latestAlert) {
      const e = new Error('No active critical alert to notify');
      e.statusCode = 404;
      throw e;
    }

    // Attach selected doctor to the active alert for consultation chat access
    if (!latestAlert.doctor_id) {
      latestAlert.doctor_id = doctorId;
      await latestAlert.save();
    }

    // Emit real-time event to doctor's room
    const { getIO } = await import('../config/socket.js');
    const io = getIO();
    io.to(`doctor:${doctorId}`).emit('criticalVitals', {
      patientId: patient._id,
      doctorId,
      alert: {
        id: latestAlert._id,
        title: latestAlert.title,
        message: latestAlert.message,
        created_at: latestAlert.created_at
      },
      patient: {
        name: patient.user_id?.full_name,
        email: patient.user_id?.email
      }
    });

    // Email emergency contact
    const { sendEmail } = await import('../config/email.js');
    if (patient.user_id?.emergency_contact_email) {
      const content = `
        <p>Critical vitals were detected for <strong>${patient.user_id?.full_name}</strong>.</p>
        <div class="warning">
          ${latestAlert.message.replace(/\n/g, '<br/>')}
        </div>
        <p>Please ensure they contact their doctor as soon as possible.</p>
      `;
      await sendEmail(patient.user_id.emergency_contact_email, 'Urgent: Critical Vitals Detected', content);
    }

    res.json({ success: true, message: 'Doctor notified and emergency contact email sent.' });
  } catch (error) {
    next(error);
  }
};
/**
 * Upload vitals CSV file and process critical alerts
 */
export const uploadVitalsCSVController = async (req, res, next) => {
  try {
    if (!req.file) {
      const error = new Error('No file uploaded');
      error.statusCode = 400;
      throw error;
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const result = await processVitalsCSV(req.user._id, csvContent);
    
    res.json(successResponse('Vitals uploaded successfully. ' + (result.criticalAlert ? 'Critical vitals detected!' : ''), result));
  } catch (error) {
    next(error);
  }
};

/**
 * Get patient profile
 */
export const getPatientProfileController = async (req, res, next) => {
  try {
    const patient = await getPatientById(req.user._id);
    res.json(successResponse('Profile retrieved.', patient));
  } catch (error) {
    next(error);
  }
};

/**
 * Update patient profile
 */
export const updatePatientProfileController = async (req, res, next) => {
  try {
    res.json(successResponse('Profile update triggered (STUB).'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get available doctors for consultation
 */
export const getAvailableDoctorsController = async (req, res, next) => {
  try {
    const Doctor = (await import('../models/Doctor.js')).default;
    
    const doctors = await Doctor.find({ approval_status: 'APPROVED' })
      .populate('user_id', 'full_name email')
      .select('specialization qualifications license_number')
      .lean();
    
    const formattedDoctors = doctors.map(doc => ({
      id: doc._id.toString(),
      name: doc.user_id?.full_name || 'Unknown',
      email: doc.user_id?.email || '',
      specialization: doc.specialization || 'General',
      qualifications: doc.qualifications || '',
      licenseNumber: doc.license_number || ''
    }));

    res.json(successResponse('Available doctors retrieved.', formattedDoctors));
  } catch (error) {
    next(error);
  }
};
