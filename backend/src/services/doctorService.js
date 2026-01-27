import { sendApplicationStatusEmail } from '../config/email.js';
import User from '../models/User.js';
import Doctor from '../models/Doctor.js';

export const getPendingApplications = async () => {
  const doctors = await Doctor.find({ application_status: 'PENDING' }).populate('user_id');
  return doctors;
};

export const approveApplication = async (doctorId) => {
  // Get doctor info
  const doctor = await Doctor.findById(doctorId);
  if (!doctor) {
    throw new Error('Doctor not found');
  }

  const user = await User.findById(doctor.user_id);
  if (!user) {
    throw new Error('User not found');
  }

  if (user.role !== 'DOCTOR') {
    throw new Error('User is not a doctor');
  }

  // Update user status
  await User.findByIdAndUpdate(
    doctor.user_id,
    { is_active: true }
  );

  // Update doctor application status
  await Doctor.findByIdAndUpdate(
    doctorId,
    {
      application_status: 'APPROVED',
      approved_at: new Date(),
    }
  );

  // Send approval email
  try {
    await sendApplicationStatusEmail(user.email, user.full_name, true);
  } catch (emailError) {
    console.error('Failed to send approval email:', emailError);
  }

  return true;
};

export const rejectApplication = async (doctorId, reason = '') => {
  // Get doctor info
  const doctor = await Doctor.findById(doctorId);
  if (!doctor) {
    throw new Error('Doctor not found');
  }

  const user = await User.findById(doctor.user_id);
  if (!user) {
    throw new Error('User not found');
  }

  if (user.role !== 'DOCTOR') {
    throw new Error('User is not a doctor');
  }

  // Update doctor application status
  await Doctor.findByIdAndUpdate(
    doctorId,
    {
      application_status: 'REJECTED',
      rejection_reason: reason,
      rejected_at: new Date(),
    }
  );

  // Send rejection email
  try {
    await sendApplicationStatusEmail(user.email, user.full_name, false, reason);
  } catch (emailError) {
    console.error('Failed to send rejection email:', emailError);
  }

  return true;
};

export const getAllDoctors = async (page = 0, size = 10, search = '') => {
  try {
    const skip = page * size;

    const doctors = await Doctor.find()
      .populate('user_id')
      .skip(skip)
      .limit(size)
      .sort({ created_at: -1 })
      .lean();

    // Filter by search if provided
    const filteredDoctors = search
      ? doctors.filter(
        (d) =>
          d.user_id?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
          d.user_id?.email?.toLowerCase().includes(search.toLowerCase()) ||
          d.license_number?.toLowerCase().includes(search.toLowerCase()) ||
          d.specialization?.toLowerCase().includes(search.toLowerCase())
      )
      : doctors;

    const totalDoctors = await Doctor.countDocuments();

    return {
      success: true,
      data: {
        content: filteredDoctors,
        totalPages: Math.ceil(totalDoctors / size),
        totalElements: totalDoctors,
        currentPage: page,
        size: size,
      },
    };
  } catch (error) {
    throw new Error(`Failed to fetch doctors: ${error.message}`);
  }
};

export const getAllDoctorsController = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const size = parseInt(req.query.size) || 10;
    const search = req.query.search || '';

    const result = await getAllDoctors(page, size, search);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getDoctorById = async (doctorId) => {
  return await Doctor.findById(doctorId).populate('user_id');
};

export const getDoctorByIdController = async (req, res, next) => {
  try {
    const { doctorId } = req.params;
    const doctor = await getDoctorById(doctorId);
    res.json({ success: true, data: doctor });
  } catch (error) {
    next(error);
  }
};

export const updateDoctor = async (doctorId, updates) => {
  await Doctor.findByIdAndUpdate(
    doctorId,
    updates,
    { new: true }
  );
  return getDoctorById(doctorId);
};

export const requestDoctorStatusChange = async (doctorId, type, reason) => {
  const doctor = await Doctor.findById(doctorId).populate('user_id');
  if (!doctor) {
    throw new Error('Doctor not found');
  }

  if (!['ACTIVATE', 'DEACTIVATE'].includes(type)) {
    const err = new Error('Invalid status change type');
    err.statusCode = 400;
    throw err;
  }

  doctor.status_change_request = {
    type,
    reason,
    requested_at: new Date(),
    status: 'PENDING',
  };

  await doctor.save();
  return doctor;
};

/**
 * Get Doctor Dashboard data
 */
export const getDoctorDashboard = async (doctorId) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Get doctor info to get associated user_id if needed
    const doctor = await Doctor.findById(doctorId).populate('user_id');
    if (!doctor) throw new Error('Doctor not found');

    // 1. Fetch Stats
    const [totalPatients, appointmentsToday, emergencyAlertsCount] = await Promise.all([
      // Total unique patients the doctor has confirmed appointments with
      import('../models/Appointment.js').then(async (mod) => {
        const Appointment = mod.default;
        const patients = await Appointment.distinct('patient_id', { doctor_id: doctorId, status: 'CONFIRMED' });
        return patients.length;
      }),
      // Appointments scheduled for today
      import('../models/Appointment.js').then(async (mod) => {
        const Appointment = mod.default;
        return await Appointment.countDocuments({
          doctor_id: doctorId,
          scheduled_time: { $gte: todayStart, $lte: todayEnd },
          status: { $ne: 'CANCELLED' }
        });
      }),
      // Active alerts for patients associated with this doctor
      import('../models/Alert.js').then(async (mod) => {
        const Alert = mod.default;
        return await Alert.countDocuments({
          doctor_id: doctorId,
          status: 'ACTIVE'
        });
      })
    ]);

    // 2. Fetch Upcoming Appointments (Confirmed)
    const upcomingAppointments = await import('../models/Appointment.js').then(async (mod) => {
      const Appointment = mod.default;
      return await Appointment.find({
        doctor_id: doctorId,
        status: 'CONFIRMED',
        scheduled_time: { $gte: new Date() }
      })
        .sort({ scheduled_time: 1 })
        .limit(5)
        .populate('patient_id', 'full_name email');
    });

    // 3. Fetch Pending Requests
    const pendingRequests = await import('../models/Appointment.js').then(async (mod) => {
      const Appointment = mod.default;
      return await Appointment.find({
        doctor_id: doctorId,
        status: 'PENDING'
      })
        .sort({ created_at: -1 })
        .limit(5)
        .populate('patient_id', 'full_name email');
    });

    // 4. Fetch Critical Alerts
    const alerts = await import('../models/Alert.js').then(async (mod) => {
      const Alert = mod.default;
      return await Alert.find({
        doctor_id: doctorId,
        status: 'ACTIVE'
      })
        .sort({ created_at: -1 })
        .limit(5)
        .populate('patient_id', 'full_name email');
    });

    return {
      doctor,
      stats: {
        totalPatients,
        appointmentsToday,
        avgWaitTime: 15, // Mock value as per existing UI
        emergencyAlertsCount
      },
      upcomingAppointments: upcomingAppointments.map(apt => ({
        id: apt._id,
        patientId: apt.patient_id?._id,
        patientName: apt.patient_id?.full_name,
        scheduledTime: apt.scheduled_time,
        status: apt.status,
        type: apt.type
      })),
      pendingRequests: pendingRequests.map(req => ({
        id: req._id,
        patientId: req.patient_id?._id,
        patientName: req.patient_id?.full_name,
        scheduledTime: req.scheduled_time,
        type: req.type
      })),
      alerts: alerts.map(alert => ({
        id: alert._id,
        patientId: alert.patient_id?._id,
        patientName: alert.patient_id?.full_name,
        title: alert.title,
        message: alert.message,
        alertType: alert.alert_type,
        severity: alert.severity,
        status: alert.status,
        timestamp: alert.created_at
      }))
    };
  } catch (error) {
    throw new Error(`Failed to fetch doctor dashboard: ${error.message}`);
  }
};

/**
 * Get all unique patients this doctor can chat with
 * Returns patients who have active alerts or confirmed appointments
 */
export const getDoctorPatients = async (doctorId) => {
  try {
    // Get unique patient IDs from alerts
    const alertPatients = await import('../models/Alert.js').then(async (mod) => {
      const Alert = mod.default;
      return await Alert.distinct('patient_id', {
        doctor_id: doctorId,
        status: 'ACTIVE'
      });
    });

    // Get unique patient IDs from confirmed appointments
    const appointmentPatients = await import('../models/Appointment.js').then(async (mod) => {
      const Appointment = mod.default;
      return await Appointment.distinct('patient_id', {
        doctor_id: doctorId,
        status: 'CONFIRMED'
      });
    });

    // Combine and deduplicate patient IDs
    const uniquePatientIds = [...new Set([...alertPatients, ...appointmentPatients])];

    // Fetch patient details
    const Patient = (await import('../models/Patient.js')).default;
    const patients = await Patient.find({ _id: { $in: uniquePatientIds } })
      .populate('user_id', 'full_name email')
      .lean();

    return patients.map(p => ({
      id: p._id.toString(),
      user_id: p.user_id?._id?.toString(),
      name: p.user_id?.full_name || 'Unknown Patient',
      email: p.user_id?.email || ''
    }));
  } catch (error) {
    throw new Error(`Failed to fetch doctor patients: ${error.message}`);
  }
};
