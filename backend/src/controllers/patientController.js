import { getAllPatients, getPatientById, togglePatientStatus, getPatientDashboardData, getVitalsHistory, processVitalsCSV, getPatientAlerts } from '../services/patientService.js';
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
 * Get all alerts for a patient (paginated, with optional status)
 */
export const getPatientAlertsController = async (req, res, next) => {
  try {
    const { page = 0, size = 10, status } = req.query;
    const data = await getPatientAlerts(req.user._id, parseInt(page), parseInt(size), status);
    res.json(successResponse('Patient alerts retrieved successfully.', data));
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
    
    // Log consultation notification
    await logSuccess({
      req,
      userId: req.user._id,
      action: 'CONSULT_DOCTOR',
      entityType: 'ALERT',
      entityId: latestAlert._id,
      description: `Patient requested consultation with doctor for critical alert`,
    });
  } catch (error) {
    await logFailure({
      req,
      userId: req.user._id,
      action: 'CONSULT_DOCTOR',
      entityType: 'ALERT',
      description: 'Failed to request doctor consultation',
      error,
    });
    next(error);
  }
};

export const uploadVitalsCSVController = async (req, res, next) => {
  try {
    if (!req.file) {
      const error = new Error('No file uploaded');
      error.statusCode = 400;
      throw error;
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const result = await processVitalsCSV(req.user._id, csvContent);
    
    // Log vitals upload
    await logSuccess({
      req,
      userId: req.user._id,
      action: 'UPLOAD_VITALS',
      entityType: 'PATIENT',
      description: `Patient uploaded vitals CSV - ${result.recordsProcessed || 0} records${result.criticalAlert ? ' (CRITICAL)' : ''}`,
    });
    
    res.json(successResponse('Vitals uploaded successfully. ' + (result.criticalAlert ? 'Critical vitals detected!' : ''), result));
  } catch (error) {
    await logFailure({
      req,
      userId: req.user._id,
      action: 'UPLOAD_VITALS',
      entityType: 'PATIENT',
      description: 'Vitals upload failed',
      error,
    });
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
    const User = (await import('../models/User.js')).default;
    
    // Get all approved doctors
    const doctors = await Doctor.find({ application_status: 'APPROVED' })
      .populate('user_id', 'full_name email is_active')
      .select('specialization qualifications license_number')
      .lean();
    
    // Filter out doctors with inactive user accounts
    const activeDoctors = doctors.filter(doc => 
      doc.user_id && doc.user_id.is_active === true
    );
    
    const formattedDoctors = activeDoctors.map(doc => ({
      id: doc._id.toString(),
      user_id: doc.user_id?._id?.toString(),
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
/**
 * Create patient-initiated alert and send to selected doctor
 */
export const createPatientAlertController = async (req, res, next) => {
  try {
    const { doctorId, alertType, severity, title, message } = req.body;

    // Validate required fields
    if (!doctorId || !alertType || !severity || !title || !message) {
      const error = new Error('Missing required fields: doctorId, alertType, severity, title, message');
      error.statusCode = 400;
      throw error;
    }

    if (!['CRITICAL', 'WARNING', 'INFO'].includes(alertType)) {
      const error = new Error('Invalid alert type. Must be CRITICAL, WARNING, or INFO');
      error.statusCode = 400;
      throw error;
    }

    const Patient = (await import('../models/Patient.js')).default;
    const Doctor = (await import('../models/Doctor.js')).default;
    const AlertModel = (await import('../models/Alert.js')).default;

    // Get patient and doctor records
    const patient = await Patient.findOne({ user_id: req.user._id }).populate('user_id');
    if (!patient) throw new Error('Patient record not found');
    
    // Check if patient is active
    if (!patient.user_id?.is_active) {
      const error = new Error('Your account is inactive. Please contact support.');
      error.statusCode = 403;
      throw error;
    }

    const doctor = await Doctor.findById(doctorId).populate('user_id');
    if (!doctor) throw new Error('Doctor not found');
    
    // Check if doctor is active and approved
    if (doctor.application_status !== 'APPROVED') {
      const error = new Error('Selected doctor is not approved.');
      error.statusCode = 400;
      throw error;
    }
    
    if (!doctor.user_id?.is_active) {
      const error = new Error('Selected doctor is currently unavailable.');
      error.statusCode = 400;
      throw error;
    }

    // Create the alert
    const alert = await AlertModel.create({
      patient_id: patient._id,
      doctor_id: doctorId,
      alert_type: alertType,
      severity,
      title,
      message,
      status: 'ACTIVE',
    });

    // Emit real-time notification to doctor
    const { getIO } = await import('../config/socket.js');
    const io = getIO();
    io.to(`doctor:${doctorId}`).emit('patientAlert', {
      alertId: alert._id,
      patientId: patient._id,
      doctorId,
      alert: {
        id: alert._id,
        type: alert.alert_type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        timestamp: alert.created_at,
      },
      patient: {
        id: patient._id,
        name: patient.user_id?.full_name,
        email: patient.user_id?.email,
      },
    });

    // Log alert creation
    await logSuccess({
      req,
      userId: req.user._id,
      action: 'CREATE_ALERT',
      entityType: 'ALERT',
      entityId: alert._id,
      description: `Patient created ${alertType} alert for doctor consultation`,
    });

    res.json(successResponse('Alert created and sent to doctor.', {
      alert: {
        id: alert._id,
        type: alert.alert_type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
      },
    }));
  } catch (error) {
    await logFailure({
      req,
      userId: req.user._id,
      action: 'CREATE_ALERT',
      entityType: 'ALERT',
      description: 'Failed to create patient alert',
      error,
    });
    next(error);
  }
};