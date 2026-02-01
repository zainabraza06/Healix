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
          appointment_date: { $gte: todayStart, $lte: todayEnd },
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
        appointment_date: { $gte: new Date() }
      })
        .sort({ appointment_date: 1 })
        .limit(5)
        .populate({
          path: 'patient_id',
          populate: {
            path: 'user_id',
            select: 'full_name email'
          }
        });
    });

    // 3. Fetch Pending Requests
    const pendingRequests = await import('../models/Appointment.js').then(async (mod) => {
      const Appointment = mod.default;
      return await Appointment.find({
        doctor_id: doctorId,
        status: 'REQUESTED'
      })
        .sort({ created_at: -1 })
        .limit(5)
        .populate({
          path: 'patient_id',
          populate: {
            path: 'user_id',
            select: 'full_name email'
          }
        });
    });

    // 3.5. Fetch Reschedule Requests from Patients
    const rescheduleRequests = await import('../models/Appointment.js').then(async (mod) => {
      const Appointment = mod.default;
      return await Appointment.find({
        doctor_id: doctorId,
        status: 'RESCHEDULE_REQUESTED',
        reschedule_requested_by: 'PATIENT'
      })
        .sort({ created_at: -1 })
        .limit(5)
        .populate({
          path: 'patient_id',
          populate: {
            path: 'user_id',
            select: 'full_name email'
          }
        });
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
        .populate({
          path: 'patient_id',
          populate: {
            path: 'user_id',
            select: 'full_name email'
          }
        });
    });

    // 5. Weekly Activity (last 7 days)
    const weeklyActivity = [];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const count = await import('../models/Appointment.js').then(async (mod) => {
        const Appointment = mod.default;
        return await Appointment.countDocuments({
          doctor_id: doctorId,
          appointment_date: { $gte: dayStart, $lte: dayEnd },
          status: { $in: ['CONFIRMED', 'COMPLETED'] }
        });
      });

      weeklyActivity.push({
        name: days[dayStart.getDay()],
        appointments: count
      });
    }

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
        patientName: apt.patient_id?.user_id?.full_name || 'Unknown Patient',
        scheduledTime: apt.appointment_date,
        status: apt.status,
        type: apt.appointment_type
      })),
      pendingRequests: pendingRequests.map(req => ({
        id: req._id,
        patientId: req.patient_id?._id,
        patientName: req.patient_id?.user_id?.full_name || 'Unknown Patient',
        scheduledTime: req.appointment_date,
        appointmentType: req.appointment_type,
        createdAt: req.created_at
      })),
      rescheduleRequests: rescheduleRequests.map(req => ({
        id: req._id,
        patientId: req.patient_id?._id,
        patientName: req.patient_id?.user_id?.full_name || 'Unknown Patient',
        scheduledTime: req.appointment_date,
        appointmentType: req.appointment_type,
        rescheduleReason: req.reschedule_reason,
        createdAt: req.created_at
      })),
      alerts: alerts.map(alert => ({
        id: alert._id,
        patientId: alert.patient_id?._id,
        patientName: alert.patient_id?.user_id?.full_name || 'Unknown Patient',
        title: alert.title,
        message: alert.message,
        alertType: alert.alert_type,
        severity: alert.severity,
        status: alert.status,
        timestamp: alert.created_at
      })),
      weeklyActivity
    };
  } catch (error) {
    throw new Error(`Failed to fetch doctor dashboard: ${error.message}`);
  }
};

/**
 * Get patient vitals history for a doctor
 */
export const getPatientVitalsForDoctor = async (patientId, doctorId) => {
  try {
    const Vitals = (await import('../models/Vitals.js')).default;
    const Alert = (await import('../models/Alert.js')).default;
    const Appointment = (await import('../models/Appointment.js')).default;

    // Verify the doctor has a relationship with this patient (via alerts or appointments)
    const [hasAlert, hasAppointment] = await Promise.all([
      Alert.exists({ patient_id: patientId, doctor_id: doctorId }),
      Appointment.exists({ patient_id: patientId, doctor_id: doctorId, status: { $in: ['CONFIRMED', 'COMPLETED', 'PAST'] } })
    ]);

    if (!hasAlert && !hasAppointment) {
      throw new Error('You do not have access to this patient\'s vitals');
    }

    // Get latest vitals
    const latestVitals = await Vitals.findOne({ patient_id: patientId })
      .sort({ recorded_at: -1 })
      .lean();

    // Get vitals history (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const vitalsHistory = await Vitals.find({
      patient_id: patientId,
      recorded_at: { $gte: thirtyDaysAgo }
    })
      .sort({ recorded_at: -1 })
      .limit(100)
      .lean();

    if (!latestVitals) {
      return {
        latest: null,
        history: [],
        message: 'No vitals recorded for this patient'
      };
    }

    return {
      heartRate: latestVitals.heartRate,
      bloodPressure: `${latestVitals.systolicBP}/${latestVitals.diastolicBP}`,
      systolicBP: latestVitals.systolicBP,
      diastolicBP: latestVitals.diastolicBP,
      oxygenLevel: latestVitals.oxygenLevel,
      temperature: latestVitals.temperature,
      respiratoryRate: latestVitals.respiratoryRate,
      recordedAt: latestVitals.recorded_at,
      status: latestVitals.notes?.status || 'NORMAL',
      history: vitalsHistory.map(v => ({
        heartRate: v.heartRate,
        bloodPressure: `${v.systolicBP}/${v.diastolicBP}`,
        oxygenLevel: v.oxygenLevel,
        temperature: v.temperature,
        respiratoryRate: v.respiratoryRate,
        recordedAt: v.recorded_at,
        status: v.notes?.status || 'NORMAL'
      }))
    };
  } catch (error) {
    throw new Error(`Failed to fetch patient vitals: ${error.message}`);
  }
};

/**
 * Get all unique patients this doctor can chat with
 * Returns patients who have active alerts or confirmed/completed/past appointments
 */
export const getDoctorPatients = async (doctorId) => {
  try {
    // Get unique patient IDs from alerts (active or resolved)
    const alertPatients = await import('../models/Alert.js').then(async (mod) => {
      const Alert = mod.default;
      return await Alert.distinct('patient_id', {
        doctor_id: doctorId,
        status: { $in: ['ACTIVE', 'RESOLVED'] }
      });
    });

    // Get unique patient IDs from appointments (confirmed, completed, or past)
    const appointmentPatients = await import('../models/Appointment.js').then(async (mod) => {
      const Appointment = mod.default;
      return await Appointment.distinct('patient_id', {
        doctor_id: doctorId,
        status: { $in: ['CONFIRMED', 'COMPLETED', 'PAST'] }
      });
    });

    // Combine and deduplicate patient IDs
    const uniquePatientIds = [...new Set([...alertPatients, ...appointmentPatients])];

    // Fetch patient details with full user info
    const Patient = (await import('../models/Patient.js')).default;
    const patients = await Patient.find({ _id: { $in: uniquePatientIds } })
      .populate('user_id', 'full_name email phone date_of_birth gender blood_type address emergency_contact_name emergency_contact_phone')
      .lean();

    // Get appointment and alert counts for each patient
    const Appointment = (await import('../models/Appointment.js')).default;
    const Alert = (await import('../models/Alert.js')).default;

    const patientData = await Promise.all(patients.map(async (p) => {
      // Get counts
      const [appointmentCount, alertCount, activeAlertCount] = await Promise.all([
        Appointment.countDocuments({ 
          patient_id: p._id, 
          doctor_id: doctorId, 
          status: { $in: ['CONFIRMED', 'COMPLETED', 'PAST'] } 
        }),
        Alert.countDocuments({ patient_id: p._id, doctor_id: doctorId }),
        Alert.countDocuments({ patient_id: p._id, doctor_id: doctorId, status: 'ACTIVE' })
      ]);

      // Get last appointment date
      const lastAppointment = await Appointment.findOne({ 
        patient_id: p._id, 
        doctor_id: doctorId,
        status: { $in: ['COMPLETED', 'PAST'] }
      }).sort({ appointment_date: -1 }).lean();

      return {
        id: p._id.toString(),
        odlId: p._id.toString(),
        user_id: p.user_id?._id?.toString(),
        name: p.user_id?.full_name || 'Unknown Patient',
        firstName: p.user_id?.full_name?.split(' ')[0] || 'Unknown',
        lastName: p.user_id?.full_name?.split(' ').slice(1).join(' ') || '',
        email: p.user_id?.email || '',
        phoneNumber: p.user_id?.phone || '',
        dateOfBirth: p.user_id?.date_of_birth || null,
        gender: p.user_id?.gender || null,
        address: p.user_id?.address || '',
        bloodGroup: p.user_id?.blood_type || null,
        emergencyContact: p.user_id?.emergency_contact_name 
          ? `${p.user_id.emergency_contact_name} (${p.user_id.emergency_contact_phone || 'N/A'})`
          : null,
        appointmentCount,
        alertCount,
        activeAlertCount,
        lastAppointmentDate: lastAppointment?.appointment_date || null,
        hasActiveAlert: activeAlertCount > 0
      };
    }));

    return patientData;
  } catch (error) {
    throw new Error(`Failed to fetch doctor patients: ${error.message}`);
  }
};

/**
 * Get all alerts assigned to this doctor with pagination
 */
export const getDoctorAlerts = async (doctorId, page = 0, size = 10, status) => {
  try {
    const Alert = (await import('../models/Alert.js')).default;
    const Prescription = (await import('../models/Prescription.js')).default;
    const query = { doctor_id: doctorId };

    if (status) {
      query.status = status;
    }

    const alerts = await Alert.find(query)
      .populate({
        path: 'patient_id',
        select: 'user_id',
        populate: {
          path: 'user_id',
          select: 'full_name email'
        }
      })
      .populate({
        path: 'prescription_id',
        select: 'medications notes status issued_date'
      })
      .sort({ created_at: -1 })
      .skip(page * size)
      .limit(size)
      .lean();

    const totalElements = await Alert.countDocuments(query);
    const totalPages = Math.ceil(totalElements / size);

    return {
      content: alerts.map(alert => ({
        id: alert._id,
        patientId: alert.patient_id?._id,
        patientName: alert.patient_id?.user_id?.full_name || 'Unknown Patient',
        patientEmail: alert.patient_id?.user_id?.email,
        title: alert.title,
        message: alert.message,
        alertType: alert.alert_type,
        severity: alert.severity,
        status: alert.status,
        instructions: alert.instructions,
        prescription: alert.prescription,
        prescriptionId: alert.prescription_id?._id,
        prescriptionData: alert.prescription_id,
        createdAt: alert.created_at,
        resolvedAt: alert.resolved_at,
        timestamp: alert.created_at
      })),
      pageNumber: page,
      pageSize: size,
      totalElements,
      totalPages,
      hasNext: page < totalPages - 1,
      hasPrevious: page > 0
    };
  } catch (error) {
    throw new Error(`Failed to fetch doctor alerts: ${error.message}`);
  }
};

/**
 * Resolve an alert with instructions and optional prescription
 */
export const resolveAlert = async (alertId, doctorId, instructions, prescriptionData) => {
  try {
    const Alert = (await import('../models/Alert.js')).default;
    const Prescription = (await import('../models/Prescription.js')).default;

    const alert = await Alert.findById(alertId);
    if (!alert) {
      const err = new Error('Alert not found');
      err.statusCode = 404;
      throw err;
    }

    // Verify this alert belongs to this doctor
    if (alert.doctor_id.toString() !== doctorId.toString()) {
      const err = new Error('Unauthorized to resolve this alert');
      err.statusCode = 403;
      throw err;
    }

    let prescriptionId = null;

    // Create prescription if provided
    if (prescriptionData && (prescriptionData.medications?.length > 0 || prescriptionData.notes)) {
      try {
        const newPrescription = new Prescription({
          patient_id: alert.patient_id,
          doctor_id: doctorId,
          alert_id: alertId,
          medications: prescriptionData.medications || [],
          notes: prescriptionData.notes || '',
          status: 'ACTIVE',
          issued_date: new Date(),
        });
        const savedPrescription = await newPrescription.save();
        prescriptionId = savedPrescription._id;
      } catch (prescError) {
        console.error('Error creating prescription:', prescError);
        // Continue without prescription if creation fails
      }
    }

    // Update alert with resolution
    alert.status = 'RESOLVED';
    alert.instructions = instructions;
    alert.prescription = prescriptionData?.medications
      ? JSON.stringify(prescriptionData.medications)
      : (prescriptionData?.notes || null);
    alert.prescription_id = prescriptionId;
    alert.resolved_at = new Date();

    await alert.save();

    return await Alert.findById(alertId)
      .populate({ path: 'patient_id', select: 'full_name email user_id', populate: { path: 'user_id', select: '_id full_name email' } })
      .lean();
  } catch (error) {
    throw error;
  }
};
