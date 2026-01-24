import Patient from '../models/Patient.js';
import User from '../models/User.js';

/**
 * Get all patients with pagination and search
 */
export const getAllPatients = async (page = 0, size = 10, search = '') => {
  try {
    const skip = page * size;
    const searchQuery = search
      ? {
        $or: [
          { 'user_id.full_name': { $regex: search, $options: 'i' } },
          { 'user_id.email': { $regex: search, $options: 'i' } },
        ],
      }
      : {};

    const patients = await Patient.find()
      .populate('user_id')
      .skip(skip)
      .limit(size)
      .sort({ created_at: -1 })
      .lean();

    // Filter by search if provided
    const filteredPatients = search
      ? patients.filter(
        (p) =>
          p.user_id?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
          p.user_id?.email?.toLowerCase().includes(search.toLowerCase())
      )
      : patients;

    const totalPatients = await Patient.countDocuments();

    return {
      content: filteredPatients,
      totalPages: Math.ceil(totalPatients / size),
      totalElements: totalPatients,
      currentPage: page,
      size: size,
    };
  } catch (error) {
    throw new Error(`Failed to fetch patients: ${error.message}`);
  }
};

/**
 * Get patient by ID
 */
export const getPatientById = async (patientId) => {
  try {
    const patient = await Patient.findById(patientId).populate('user_id').lean();
    if (!patient) {
      throw new Error('Patient not found');
    }
    return patient;
  } catch (error) {
    throw new Error(`Failed to fetch patient: ${error.message}`);
  }
};

/**
 * Disable/Enable patient
 */
export const togglePatientStatus = async (patientId, isActive) => {
  try {
    const patient = await Patient.findById(patientId).populate('user_id');
    if (!patient) {
      throw new Error('Patient not found');
    }

    await User.findByIdAndUpdate(patient.user_id._id, { is_active: isActive });
    return patient;
  } catch (error) {
    throw new Error(`Failed to update patient status: ${error.message}`);
  }
};

/**
 * Get aggregated dashboard data for a patient
 */
export const getPatientDashboardData = async (userId) => {
  try {
    const patient = await Patient.findOne({ user_id: userId }).lean();
    if (!patient) throw new Error('Patient record not found');

    const [lastVitals, upcomingAppointments, alerts] = await Promise.all([
      import('../models/Vitals.js').then(m => m.default.findOne({ patient_id: patient._id }).sort({ recorded_at: -1 }).lean()),
      import('../models/Appointment.js').then(m => m.default.find({
        patient_id: patient._id,
        appointment_date: { $gte: new Date() },
        status: { $ne: 'CANCELLED' }
      }).populate({
        path: 'doctor_id',
        populate: { path: 'user_id', select: 'full_name' }
      }).sort({ appointment_date: 1 }).limit(5).lean()),
      import('../models/Alert.js').then(m => m.default.find({
        patient_id: patient._id,
        status: 'ACTIVE'
      }).sort({ created_at: -1 }).limit(5).lean())
    ]);

    return {
      patient,
      lastVitals,
      upcomingAppointments: upcomingAppointments.map(apt => ({
        id: apt._id,
        doctorName: apt.doctor_id?.user_id?.full_name || 'Assigned Doctor',
        scheduledTime: apt.appointment_date,
        type: apt.type || 'GENERAL',
        status: apt.status
      })),
      alerts: alerts.map(a => ({
        id: a._id,
        message: a.message,
        category: a.alert_type,
        timestamp: a.created_at
      }))
    };
  } catch (error) {
    throw new Error(`Dashboard aggregation failed: ${error.message}`);
  }
};

/**
 * Get vital signs history for charts
 */
export const getVitalsHistory = async (userId, days = 30) => {
  try {
    const patient = await Patient.findOne({ user_id: userId }).lean();
    if (!patient) throw new Error('Patient record not found');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const vitals = await import('../models/Vitals.js').then(m => m.default.find({
      patient_id: patient._id,
      recorded_at: { $gte: startDate }
    }).sort({ recorded_at: 1 }).lean());

    return vitals;
  } catch (error) {
    throw new Error(`Failed to fetch vitals history: ${error.message}`);
  }
};
