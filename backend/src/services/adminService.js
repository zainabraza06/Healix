// Get all appointments for download (CSV/JSON/PDF)
export const getAllAppointmentsForDownload = async (status, payment_status) => {
  try {
    const query = {};
    if (status) query.status = status;
    if (payment_status) query.payment_status = payment_status;
    const appointments = await Appointment.find(query)
      .populate({
        path: 'patient_id',
        populate: { path: 'user_id', select: 'full_name name email' },
      })
      .populate({
        path: 'doctor_id',
        populate: { path: 'user_id', select: 'full_name name email' },
      })
      .sort({ appointment_date: -1, slot_start_time: -1 })
      .lean();
    return appointments.map(a => ({
      id: a._id?.toString?.(),
      appointment_date: a.appointment_date,
      slot_start_time: a.slot_start_time,
      slot_end_time: a.slot_end_time,
      patient_name: a.patient_id?.user_id?.full_name || a.patient_id?.user_id?.name || 'N/A',
      doctor_name: a.doctor_id?.user_id?.full_name || a.doctor_id?.user_id?.name || 'N/A',
      status: a.status,
      payment_status: a.payment_status,
      prescription: a.prescription || '',
      instructions: a.instructions || '',
    }));
  } catch (error) {
    throw new Error(`Failed to fetch appointments for download: ${error.message}`);
  }
};

// Format appointments for CSV download
export const formatAppointmentsForCSV = async (data) => {
  const headers = ['id', 'appointment_date', 'slot_start_time', 'slot_end_time', 'patient_name', 'doctor_name', 'status', 'payment_status', 'prescription', 'instructions'];
  const rows = (data || []).map((a) => [
    a.id,
    a.appointment_date ? new Date(a.appointment_date).toISOString() : '',
    a.slot_start_time,
    a.slot_end_time,
    a.patient_name,
    a.doctor_name,
    a.status,
    a.payment_status,
    a.prescription,
    a.instructions,
  ]);
  const csv = [headers.join(','), ...rows.map((r) => r.map((v) => {
    const s = v == null ? '' : String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }).join(','))].join('\n');
  return csv;
};
import Patient from '../models/Patient.js';
import Doctor from '../models/Doctor.js';
import Admin from '../models/Admin.js';
import Appointment from '../models/Appointment.js';
import Alert from '../models/Alert.js';
import Log from '../models/Log.js';
import User from '../models/User.js';
import { sendEmail } from '../config/email.js';
import { hashPassword, generateUserId } from '../utils/helpers.js';

/**
 * Get dashboard statistics for admin
 */
export const getDashboardStats = async () => {
  try {
    const [
      totalPatients,
      totalDoctors,
      totalAdmins,
      totalAppointments,
      activeAlerts,
      totalLogs,
      pendingDoctorApplications,
      completedAppointments,
      upcomingAppointments,
    ] = await Promise.all([
      Patient.countDocuments(),
      Doctor.countDocuments({ application_status: 'APPROVED' }),
      Admin.countDocuments(),
      Appointment.countDocuments(),
      Alert.countDocuments({ status: 'ACTIVE' }),
      Log.countDocuments(),
      Doctor.countDocuments({ application_status: 'PENDING' }),
      Appointment.countDocuments({ status: 'COMPLETED' }),
      Appointment.countDocuments({ status: 'SCHEDULED' }),
    ]);

    return {
      totalPatients,
      totalDoctors,
      totalAdmins,
      totalAppointments,
      activeAlerts,
      totalLogs,
      pendingApprovals: pendingDoctorApplications,
      completedAppointments,
      upcomingAppointments,
    };
  } catch (error) {
    throw new Error(`Failed to fetch dashboard stats: ${error.message}`);
  }
};

/**
 * Get alert statistics
 */
export const getAlertStats = async () => {
  try {
    const alertStats = await Alert.aggregate([
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 },
        },
      },
    ]);

    const activeAlertsByType = await Alert.aggregate([
      {
        $match: { status: 'ACTIVE' },
      },
      {
        $group: {
          _id: '$alert_type',
          count: { $sum: 1 },
        },
      },
    ]);

    return {
      bySeverity: alertStats,
      activeByType: activeAlertsByType,
    };
  } catch (error) {
    throw new Error(`Failed to fetch alert stats: ${error.message}`);
  }
};

/**
 * Get appointment statistics
 */
export const getAppointmentStats = async () => {
  try {
    const appointmentStats = await Appointment.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    return appointmentStats;
  } catch (error) {
    throw new Error(`Failed to fetch appointment stats: ${error.message}`);
  }
};

/**
 * Get recent alerts
 */
export const getRecentAlerts = async (limit = 10) => {
  try {
    const rawAlerts = await Alert.find()
      .sort({ created_at: -1 })
      .limit(limit)
      .populate({
        path: 'patient_id',
        populate: { path: 'user_id', select: 'full_name name email' },
      })
      .populate({
        path: 'doctor_id',
        populate: { path: 'user_id', select: 'full_name name email' },
      })
      .lean();

    // Normalize names for frontend display
    const alerts = rawAlerts.map((alert) => {
      const doctorName =
        alert?.doctor_id?.user_id?.full_name ||
        alert?.doctor_id?.user_id?.name ||
        alert?.doctor_name ||
        null;
      const patientName =
        alert?.patient_id?.user_id?.full_name ||
        alert?.patient_id?.user_id?.name ||
        null;

      return {
        ...alert,
        doctor_name: doctorName,
        patient_name: patientName,
        doctor_id: alert?.doctor_id?._id || alert?.doctor_id,
        patient_id: alert?.patient_id?._id || alert?.patient_id,
      };
    });

    return alerts;
  } catch (error) {
    throw new Error(`Failed to fetch recent alerts: ${error.message}`);
  }
};

/**
 * Get recent logs
 */
export const getRecentLogs = async (limit = 10) => {
  try {
    const logs = await Log.find()
      .sort({ created_at: -1 })
      .limit(limit)
      .populate('user_id', 'name email')
      .populate('admin_id', 'name')
      .lean();

    return logs;
  } catch (error) {
    throw new Error(`Failed to fetch recent logs: ${error.message}`);
  }
};

/**
 * Get paginated system logs with frontend-compatible shape
 */
export const getPaginatedLogs = async (page = 0, size = 20) => {
  try {
    const [items, totalElements] = await Promise.all([
      Log.find()
        .sort({ created_at: -1 })
        .skip(page * size)
        .limit(size)
        .populate('user_id', 'email full_name')
        .populate('admin_id', 'email full_name')
        .lean(),
      Log.countDocuments(),
    ]);

    const content = items.map((l) => ({
      id: l._id?.toString?.(),
      action: l.action,
      description: l.description,
      timestamp: l.created_at,
      userId: l.user_id?._id?.toString?.(),
      userEmail: l.user_id?.email,
      adminId: l.admin_id?._id?.toString?.(),
      adminEmail: l.admin_id?.email,
      ipAddress: l.ip_address,
      level: l.level,
      status: l.status,
      additionalInfo: l.error_details ? JSON.stringify({ error: l.error_details }) : undefined,
      entityType: l.entity_type,
      entityId: l.entity_id?.toString?.(),
    }));

    const totalPages = Math.ceil(totalElements / size) || 1;

    return {
      content,
      pageNumber: page,
      pageSize: size,
      totalElements,
      totalPages,
      hasNext: page < totalPages - 1,
      hasPrevious: page > 0,
    };
  } catch (error) {
    throw new Error(`Failed to fetch paginated logs: ${error.message}`);
  }
};

/**
 * Get all logs for download (CSV/JSON)
 */
export const getAllLogsForDownload = async () => {
  try {
    const logs = await Log.find()
      .sort({ created_at: -1 })
      .populate('user_id', 'email full_name')
      .populate('admin_id', 'email full_name')
      .lean();

    return logs.map((l) => ({
      id: l._id?.toString?.(),
      action: l.action,
      description: l.description,
      timestamp: l.created_at,
      userId: l.user_id?._id?.toString?.(),
      userEmail: l.user_id?.email,
      adminId: l.admin_id?._id?.toString?.(),
      adminEmail: l.admin_id?.email,
      ipAddress: l.ip_address,
      level: l.level,
      status: l.status,
      additionalInfo: l.error_details ? JSON.stringify({ error: l.error_details }) : undefined,
      entityType: l.entity_type,
      entityId: l.entity_id?.toString?.(),
    }));
  } catch (error) {
    throw new Error(`Failed to build logs download: ${error.message}`);
  }
};

/**
 * Format logs for CSV download
 */
export const formatLogsForCSV = async () => {
  const data = await getAllLogsForDownload();
  const headers = [
    'id', 'timestamp', 'level', 'status', 'action', 'description', 'entityType', 'entityId', 'ipAddress', 'userId', 'userEmail', 'adminId', 'adminEmail'
  ];
  const rows = data.map((l) => [
    l.id,
    l.timestamp?.toISOString?.() || l.timestamp,
    l.level,
    l.status,
    l.action,
    (l.description || '').replace(/\n/g, ' '),
    l.entityType,
    l.entityId,
    l.ipAddress,
    l.userId,
    l.userEmail,
    l.adminId,
    l.adminEmail,
  ]);
  const csv = [headers.join(','), ...rows.map((r) => r.map((v) => {
    const s = v == null ? '' : String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }).join(','))].join('\n');
  return csv;
};

/**
 * Get all doctors for download
 */
export const getAllDoctorsForDownload = async () => {
  try {
    const doctors = await Doctor.find()
      .populate('user_id', 'full_name email phone is_active is_verified')
      .lean();

    return doctors.map(d => ({
      id: d._id?.toString?.(),
      fullName: d.user_id?.full_name || '',
      email: d.user_id?.email || '',
      phone: d.user_id?.phone || '',
      licenseNumber: d.license_number || '',
      specialization: d.specialization || '',
      experience: d.years_of_experience || 0,
      status: d.application_status || 'UNKNOWN',
      isActive: d.user_id?.is_active ? 'Yes' : 'No',
      isVerified: d.user_id?.is_verified ? 'Yes' : 'No',
      registeredAt: d.created_at,
    }));
  } catch (error) {
    throw new Error(`Failed to fetch doctors for download: ${error.message}`);
  }
};

/**
 * Format doctors for CSV download
 */
export const formatDoctorsForCSV = async () => {
  const data = await getAllDoctorsForDownload();
  const headers = ['id', 'fullName', 'email', 'phone', 'specialization', 'licenseNumber', 'experience', 'status', 'isActive', 'isVerified', 'registeredAt'];
  const rows = data.map((d) => [
    d.id,
    d.fullName,
    d.email,
    d.phone,
    d.specialization,
    d.licenseNumber,
    d.experience,
    d.status,
    d.isActive,
    d.isVerified,
    d.registeredAt ? new Date(d.registeredAt).toISOString() : '',
  ]);
  const csv = [headers.join(','), ...rows.map((r) => r.map((v) => {
    const s = v == null ? '' : String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }).join(','))].join('\n');
  return csv;
};

/**
 * Get all patients for download
 */
export const getAllPatientsForDownload = async () => {
  try {
    const patients = await Patient.find()
      .populate('user_id', 'full_name email phone is_active is_verified blood_type address gender date_of_birth')
      .lean();

    return patients.map(p => ({
      id: p._id?.toString?.(),
      fullName: p.user_id?.full_name || 'Anonymous',
      email: p.user_id?.email || '',
      phone: p.user_id?.phone || '',
      bloodType: p.user_id?.blood_type || 'N/A',
      gender: p.user_id?.gender || 'N/A',
      dob: p.user_id?.date_of_birth ? new Date(p.user_id.date_of_birth).toLocaleDateString() : 'N/A',
      address: p.user_id?.address || 'N/A',
      isActive: p.user_id?.is_active ? 'Yes' : 'No',
      registeredAt: p.created_at,
    }));
  } catch (error) {
    throw new Error(`Failed to fetch patients for download: ${error.message}`);
  }
};

/**
 * Format patients for CSV download
 */
export const formatPatientsForCSV = async () => {
  const data = await getAllPatientsForDownload();
  const headers = ['id', 'fullName', 'email', 'phone', 'bloodType', 'gender', 'dob', 'address', 'isActive', 'registeredAt'];
  const rows = data.map((p) => [
    p.id,
    p.fullName,
    p.email,
    p.phone,
    p.bloodType,
    p.gender,
    p.dob,
    p.address,
    p.isActive,
    p.registeredAt ? new Date(p.registeredAt).toISOString() : '',
  ]);
  const csv = [headers.join(','), ...rows.map((r) => r.map((v) => {
    const s = v == null ? '' : String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }).join(','))].join('\n');
  return csv;
};

// Format patients for CSV using provided data (filtered)
export const formatPatientsForCSVWithData = (data) => {
  const headers = ['id', 'fullName', 'email', 'phone', 'bloodType', 'gender', 'dob', 'address', 'isActive', 'registeredAt'];
  const rows = (data || []).map((p) => [
    p.id,
    p.fullName,
    p.email,
    p.phone,
    p.bloodType,
    p.gender,
    p.dob,
    p.address,
    p.isActive,
    p.registeredAt ? new Date(p.registeredAt).toISOString() : '',
  ]);
  const csv = [headers.join(','), ...rows.map((r) => r.map((v) => {
    const s = v == null ? '' : String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }).join(','))].join('\n');
  return csv;
};

/**
 * Admin-direct doctor registration (skips application workflow)
 */
export const registerDoctorAsAdmin = async (data) => {
  const {
    firstName,
    lastName,
    email,
    password,
    phoneNumber,
    licenseNumber,
    specialization,
    qualifications,
    yearsOfExperience,
    emergencyContactName,
    emergencyContactPhone,
    emergencyContactEmail,
    emergencyContactRelationship,
  } = data;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    const err = new Error('Email already registered');
    err.statusCode = 409;
    throw err;
  }

  const existingDoctor = await Doctor.findOne({ license_number: licenseNumber });
  if (existingDoctor) {
    const err = new Error('License number already registered');
    err.statusCode = 409;
    throw err;
  }

  const passwordHash = await hashPassword(password);
  const userId = generateUserId('DOCTOR');

  const user = new User({
    user_id: userId,
    full_name: `${firstName} ${lastName}`.trim(),
    email,
    role: 'DOCTOR',
    password_hash: passwordHash,
    phone: phoneNumber,
    is_active: true,
    is_verified: true,
    emergency_contact_name: emergencyContactName,
    emergency_contact_phone: emergencyContactPhone,
    emergency_contact_email: emergencyContactEmail,
    emergency_contact_relationship: emergencyContactRelationship,
  });
  await user.save();

  const doctor = new Doctor({
    user_id: user._id,
    license_number: licenseNumber,
    specialization: (specialization || 'GENERAL').toUpperCase(),
    qualifications: qualifications || 'Not provided',
    years_of_experience: yearsOfExperience,
    application_status: 'APPROVED',
    approved_at: new Date(),
  });
  await doctor.save();

  // Send credentials email (best-effort)
  try {
    const content = `
      <p>Hello Dr. ${firstName || ''} ${lastName || ''},</p>
      <p>Your Healix account has been created by an administrator. You can log in immediately using the credentials below:</p>
      <div class="success">
        <strong>Email:</strong> ${email}<br/>
        <strong>Temporary Password:</strong> ${password}
      </div>
      <p>Please sign in and change your password from your profile settings.</p>
    `;
    await sendEmail(email, 'Your Doctor Account is Ready', content, `${process.env.FRONTEND_URL}/login`, 'Log In');
  } catch (emailErr) {
    console.error('Failed to send doctor credentials email', emailErr);
  }

  const safeUser = user.toObject();
  safeUser.password_hash = undefined;

  return { user: safeUser, doctor };
};

/**
 * Get paginated patients
 */
export const getPaginatedPatients = async (page = 0, size = 10, search = '', isActiveFilter) => {
  try {
    const query = search
      ? {
        $or: [
          // We'll filter in memory or use aggregation for complex nested search
          // For now, let's just fetch and filter as currently implemented but with correct field names
        ],
      }
      : {};

    const patients = await Patient.find()
      .populate('user_id', 'full_name email phone gender date_of_birth blood_type address is_active emergency_contact_name emergency_contact_phone emergency_contact_email emergency_contact_relationship')
      .sort({ created_at: -1 })
      .lean();

    // Correctly filter by full_name and email
    let filteredPatients = search
      ? patients.filter(p =>
        p.user_id?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        p.user_id?.email?.toLowerCase().includes(search.toLowerCase())
      )
      : patients;

    // Optional filter by active/deactivated
    if (typeof isActiveFilter !== 'undefined' && isActiveFilter !== null && isActiveFilter !== '') {
      const activeBool = String(isActiveFilter).toLowerCase() === 'true' || String(isActiveFilter).toLowerCase() === 'active';
      filteredPatients = filteredPatients.filter(p => (p.user_id?.is_active ?? false) === activeBool);
    }

    const totalElements = filteredPatients.length;
    const totalPages = Math.ceil(totalElements / size);

    return {
      content: filteredPatients.slice(page * size, (page + 1) * size),
      pageNumber: page,
      pageSize: size,
      totalElements,
      totalPages,
      hasNext: page < totalPages - 1,
      hasPrevious: page > 0,
    };
  } catch (error) {
    throw new Error(`Failed to fetch paginated patients: ${error.message}`);
  }
};

/**
 * Get paginated doctors
 */
export const getPaginatedDoctors = async (page = 0, size = 10, search = '', requestStatus = '') => {
  try {
    const query = {};

    if (search) {
      query.$or = [
        { 'user_id.name': { $regex: search, $options: 'i' } },
        { 'user_id.email': { $regex: search, $options: 'i' } },
      ];
    }

    if (requestStatus) {
      if (requestStatus === 'ANY_REQUEST') {
        query['status_change_request.status'] = 'PENDING';
      } else if (requestStatus === 'ACTIVATE_REQUEST') {
        query['status_change_request.status'] = 'PENDING';
        query['status_change_request.type'] = 'ACTIVATE';
      } else if (requestStatus === 'DEACTIVATE_REQUEST') {
        query['status_change_request.status'] = 'PENDING';
        query['status_change_request.type'] = 'DEACTIVATE';
      }
    }

    const doctors = await Doctor.find(query)
      .populate('user_id', 'full_name email phone gender date_of_birth is_active emergency_contact_name emergency_contact_phone emergency_contact_email emergency_contact_relationship')
      .sort({ created_at: -1 })
      .skip(page * size)
      .limit(size)
      .lean();

    const totalElements = await Doctor.countDocuments(query);
    const totalPages = Math.ceil(totalElements / size);

    return {
      content: doctors,
      pageNumber: page,
      pageSize: size,
      totalElements,
      totalPages,
      hasNext: page < totalPages - 1,
      hasPrevious: page > 0,
    };
  } catch (error) {
    throw new Error(`Failed to fetch paginated doctors: ${error.message}`);
  }
};

/**
 * Get all doctors for download (CSV/JSON/PDF)
 */
/**
 * Get paginated appointments
 */
export const getPaginatedAppointments = async (page = 0, size = 10, status, payment_status) => {
  try {
    const query = {};
    if (status) query.status = status;
    if (payment_status) query.payment_status = payment_status;

    const appointments = await Appointment.find(query)
      .populate({
        path: 'patient_id',
        populate: { path: 'user_id', select: 'full_name name email' },
      })
      .populate({
        path: 'doctor_id',
        populate: { path: 'user_id', select: 'full_name name email' },
      })
      .sort({ appointment_date: -1, appointment_time: -1 })
      .skip(page * size)
      .limit(size)
      .lean();

    const totalElements = await Appointment.countDocuments(query);
    const totalPages = Math.ceil(totalElements / size);

    return {
      content: appointments,
      pageNumber: page,
      pageSize: size,
      totalElements,
      totalPages,
      hasNext: page < totalPages - 1,
      hasPrevious: page > 0,
    };
  } catch (error) {
    throw new Error(`Failed to fetch paginated appointments: ${error.message}`);
  }
};

/**
 * Get paginated alerts
 */
export const getPaginatedAlerts = async (page = 0, size = 10, status) => {
  try {
    const query = status ? { status } : {};

    const rawAlerts = await Alert.find(query)
      .populate({
        path: 'patient_id',
        populate: { path: 'user_id', select: 'full_name name email' },
      })
      .populate({
        path: 'doctor_id',
        populate: { path: 'user_id', select: 'full_name name email' },
      })
      .sort({ created_at: -1 })
      .skip(page * size)
      .limit(size)
      .lean();

    // Normalize doctor and patient names for frontend display
    const alerts = rawAlerts.map((alert) => {
      const doctorName =
        alert?.doctor_id?.user_id?.full_name ||
        alert?.doctor_id?.user_id?.name ||
        alert?.doctor_name ||
        null;
      const patientName =
        alert?.patient_id?.user_id?.full_name ||
        alert?.patient_id?.user_id?.name ||
        null;
      return {
        ...alert,
        doctor_name: doctorName,
        patient_name: patientName,
      };
    });

    const totalElements = await Alert.countDocuments(query);
    const totalPages = Math.ceil(totalElements / size);

    return {
      content: alerts,
      pageNumber: page,
      pageSize: size,
      totalElements,
      totalPages,
      hasNext: page < totalPages - 1,
      hasPrevious: page > 0,
    };
  } catch (error) {
    throw new Error(`Failed to fetch paginated alerts: ${error.message}`);
  }
};

/**
 * Get doctor applications
 */
export const getDoctorApplications = async (status = 'PENDING', page = 0, size = 10) => {
  try {
    const query = { application_status: status };
    const applications = await Doctor.find(query)
      .populate('user_id', 'full_name email phone')
      .sort({ created_at: -1 })
      .skip(page * size)
      .limit(size)
      .lean();

    const totalElements = await Doctor.countDocuments(query);
    const totalPages = Math.ceil(totalElements / size);

    return {
      content: applications,
      pageNumber: page,
      pageSize: size,
      totalElements,
      totalPages,
      hasNext: page < totalPages - 1,
      hasPrevious: page > 0,
    };
  } catch (error) {
    throw new Error(`Failed to fetch doctor applications: ${error.message}`);
  }
};

/**
 * Get system activity for date range
 */
export const getSystemActivity = async (startDate, endDate) => {
  try {
    const logs = await Log.find({
      created_at: {
        $gte: startDate,
        $lte: endDate,
      },
    })
      .sort({ created_at: -1 })
      .lean();

    return logs;
  } catch (error) {
    throw new Error(`Failed to fetch system activity: ${error.message}`);
  }
};

/**
 * Approve doctor application
 */
export const approveDoctorApplication = async (doctorId, password, doctorEmail) => {
  try {
    const doctor = await Doctor.findByIdAndUpdate(
      doctorId,
      {
        application_status: 'APPROVED',
        approved_at: new Date(),
      },
      { new: true }
    ).populate('user_id');

    if (!doctor) {
      throw new Error('Doctor not found');
    }

    // Update the User record: set password, activate, and verify
    const { hashPassword } = await import('../utils/helpers.js');
    const hashedPassword = await hashPassword(password);

    await User.findByIdAndUpdate(doctor.user_id._id, {
      password_hash: hashedPassword,
      is_active: true,
      is_verified: true
    });

    // Send approval email (password is sent as plain text in the email)
    const emailSubject = 'Your Doctor Application Has Been Approved';
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">Application Approved!</h2>
        <p>Dear ${doctor.user_id.full_name},</p>
        <p>We are pleased to inform you that your doctor application has been <strong>approved</strong>.</p>
        
        <div style="background-color: #f0f9ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Your Login Credentials:</h3>
          <p><strong>Email:</strong> ${doctor.user_id.email}</p>
          <p><strong>Temporary Password:</strong> <code style="background-color: #e0e7ff; padding: 5px 10px; border-radius: 4px; font-family: monospace;">${password}</code></p>
        </div>
        
        <p style="color: #ef4444; font-weight: bold;">⚠️ Important: Please change your password immediately after your first login for security reasons.</p>
        
        <p>You can now log in to the Remote Healthcare Management System and start managing your appointments and patient consultations.</p>
        
        <p>If you have any issues or questions, please contact our support team.</p>
        
        <p>Best regards,<br/>Remote Healthcare Management System</p>
      </div>
    `;

    await sendEmail(doctorEmail, emailSubject, emailHtml);

    return doctor;
  } catch (error) {
    throw new Error(`Failed to approve doctor application: ${error.message}`);
  }
};

/**
 * Reject doctor application
 */
export const rejectDoctorApplication = async (doctorId, reason, doctorEmail) => {
  try {
    const doctor = await Doctor.findByIdAndUpdate(
      doctorId,
      {
        application_status: 'REJECTED',
        rejection_reason: reason,
        rejected_at: new Date(),
      },
      { new: true }
    ).populate('user_id');

    if (!doctor) {
      throw new Error('Doctor not found');
    }

    // Send rejection email
    const emailSubject = 'Update on Your Doctor Application';
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ef4444;">Application Decision</h2>
        <p>Dear ${doctor.user_id.full_name},</p>
        <p>Thank you for applying to be a doctor on our Remote Healthcare Management System.</p>
        
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Status: Application Rejected</strong></p>
        </div>
        
        <h3>Reason for Rejection:</h3>
        <p style="background-color: #f3f4f6; padding: 15px; border-radius: 4px; border-left: 4px solid #9ca3af;">
          ${reason}
        </p>
        
        <p>If you believe this decision was made in error, or if you would like to reapply after addressing the concerns mentioned above, please contact our support team.</p>
        
        <p>We appreciate your interest in our platform and wish you the best in your medical career.</p>
        
        <p>Best regards,<br/>Remote Healthcare Management System</p>
      </div>
    `;

    await sendEmail(doctorEmail, emailSubject, emailHtml);

    return doctor;
  } catch (error) {
    throw new Error(`Failed to reject doctor application: ${error.message}`);
  }
};

/**
 * Change doctor status (Activate/Deactivate)
 */
export const changeDoctorStatus = async (doctorId, status, reason) => {
  try {
    const doctor = await Doctor.findById(doctorId).populate('user_id');
    if (!doctor) throw new Error('Doctor not found');

    const user = await User.findById(doctor.user_id._id);
    if (!user) throw new Error('User not found');

    const isActive = status === 'ACTIVATE';

    // Update User status
    user.is_active = isActive;
    await user.save();

    // Update Doctor request status if exists
    if (doctor.status_change_request && doctor.status_change_request.status === 'PENDING') {
      const requestType = doctor.status_change_request.type;
      // If the action matches the request (e.g. requested DEACTIVATE and we are DEACTIVATING), approve it
      if ((isActive && requestType === 'ACTIVATE') || (!isActive && requestType === 'DEACTIVATE')) {
        doctor.status_change_request.status = 'APPROVED';
      } else {
        doctor.status_change_request.status = 'REJECTED';
      }
    }

    await doctor.save();

    // Send Status Change Email
    const actionText = isActive ? 'activated' : 'deactivated';
    const emailSubject = `Your Account Has Been ${isActive ? 'Activated' : 'Deactivated'}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${isActive ? '#10b981' : '#ef4444'};">Account ${isActive ? 'Activated' : 'Deactivated'}</h2>
        <p>Dear ${user.full_name},</p>
        <p>Your doctor account has been <strong>${actionText}</strong> by an administrator.</p>
        
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 4px; border-left: 4px solid #6b7280; margin: 20px 0;">
          <p style="margin: 0;"><strong>Reason:</strong></p>
          <p style="margin-top: 5px;">${reason}</p>
        </div>
        
        ${isActive
        ? '<p>You can now log in and access all features of the Remote Healthcare Management System.</p>'
        : '<p>You will no longer be able to access your account dashboard until it is reactivated.</p>'
      }
        
        <p>If you have questions regarding this action, please contact support.</p>
        
        <p>Best regards,<br/>Remote Healthcare Management System</p>
      </div>
    `;

    await sendEmail(user.email, emailSubject, emailHtml);
    return doctor;
  } catch (error) {
    throw new Error(`Failed to change doctor status: ${error.message}`);
  }
};

/**
 * Change patient status (Activate/Deactivate)
 */
export const changePatientStatus = async (patientId, status, reason) => {
  try {
    const patient = await Patient.findById(patientId).populate('user_id');
    if (!patient) throw new Error('Patient not found');

    const user = await User.findById(patient.user_id._id);
    if (!user) throw new Error('User not found');

    const isActive = status === 'ACTIVATE';
    user.is_active = isActive;
    await user.save();

    // Send Status Change Email
    const actionText = isActive ? 'activated' : 'deactivated';
    const emailSubject = `Your Account Has Been ${isActive ? 'Activated' : 'Deactivated'}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${isActive ? '#10b981' : '#ef4444'};">Account ${isActive ? 'Activated' : 'Deactivated'}</h2>
        <p>Dear ${user.full_name},</p>
        <p>Your patient account has been <strong>${actionText}</strong> by an administrator.</p>
        
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 4px; border-left: 4px solid #6b7280; margin: 20px 0;">
          <p style="margin: 0;"><strong>Reason:</strong></p>
          <p style="margin-top: 5px;">${reason}</p>
        </div>
        
        ${isActive
        ? '<p>You can now log in and access all features of the Remote Healthcare Management System.</p>'
        : '<p>You will no longer be able to access your account dashboard until it is reactivated.</p>'
      }
        
        <p>If you have questions regarding this action, please contact support.</p>
        
        <p>Best regards,<br/>Remote Healthcare Management System</p>
      </div>
    `;

    await sendEmail(user.email, emailSubject, emailHtml);
    return patient;
  } catch (error) {
    throw new Error(`Failed to change patient status: ${error.message}`);
  }
};

/**
 * Get all alerts for download
 */
export const getAllAlertsForDownload = async () => {
  try {
    const alerts = await Alert.find()
      .populate({
        path: 'patient_id',
        populate: { path: 'user_id', select: 'full_name name email' },
      })
      .populate({
        path: 'doctor_id',
        populate: { path: 'user_id', select: 'full_name name email' },
      })
      .sort({ created_at: -1 })
      .lean();

    return alerts.map(a => ({
      id: a._id?.toString?.(),
      title: a.title || '',
      message: a.message || '',
      severity: a.severity || 'UNKNOWN',
      status: a.status || 'UNKNOWN',
      patientName: a.patient_id?.user_id?.full_name || a.patient_id?.user_id?.name || 'N/A',
      doctorName: a.doctor_id?.user_id?.full_name || a.doctor_id?.user_id?.name || 'N/A',
      createdAt: a.created_at,
      resolvedAt: a.resolved_at || 'N/A',
    }));
  } catch (error) {
    throw new Error(`Failed to fetch alerts for download: ${error.message}`);
  }
};

/**
 * Format alerts for CSV download
 */
export const formatAlertsForCSV = async () => {
  const data = await getAllAlertsForDownload();
  const headers = ['id', 'title', 'severity', 'status', 'patientName', 'doctorName', 'createdAt', 'resolvedAt'];
  const rows = data.map((a) => [
    a.id,
    a.title,
    a.severity,
    a.status,
    a.patientName,
    a.doctorName,
    a.createdAt ? new Date(a.createdAt).toISOString() : '',
    a.resolvedAt !== 'N/A' ? new Date(a.resolvedAt).toISOString() : '',
  ]);
  const csv = [headers.join(','), ...rows.map((r) => r.map((v) => {
    const s = v == null ? '' : String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }).join(','))].join('\n');
  return csv;
};
