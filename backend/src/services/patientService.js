import Patient from '../models/Patient.js';
import User from '../models/User.js';
import Alert from '../models/Alert.js';

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

    const now = new Date();
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
      Alert.find({
        patient_id: patient._id
      }).populate({
        path: 'doctor_id',
        populate: { path: 'user_id', select: 'full_name' }
      }).sort({ created_at: -1 }).limit(5).lean()
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
        timestamp: a.created_at,
        doctor_id: a.doctor_id?._id,
        doctor_name: a.doctor_id?.user_id?.full_name,
        resolved_at: a.resolved_at,
        status: a.status
      }))
    };
  } catch (error) {
    throw new Error(`Dashboard aggregation failed: ${error.message}`);
  }
};

/**
 * Get paginated alerts for a patient
 */
export const getPatientAlerts = async (userId, page = 0, size = 10, status) => {
  try {
    const patient = await Patient.findOne({ user_id: userId }).lean();
    if (!patient) throw new Error('Patient record not found');

    const query = { patient_id: patient._id };
    if (status) query.status = status;

    const alerts = await Alert.find(query)
      .populate({
        path: 'doctor_id',
        populate: { path: 'user_id', select: 'full_name name email' },
      })
      .sort({ created_at: -1 })
      .skip(page * size)
      .limit(size)
      .lean();

    const totalElements = await Alert.countDocuments(query);
    const totalPages = Math.ceil(totalElements / size);

    const content = alerts.map((a) => ({
      id: a._id,
      message: a.message,
      category: a.alert_type,
      timestamp: a.created_at,
      doctor_id: a.doctor_id?._id,
      doctor_name: a.doctor_id?.user_id?.full_name || a.doctor_id?.user_id?.name || null,
      resolved_at: a.resolved_at,
      status: a.status,
      severity: a.severity,
      instructions: a.instructions,
      prescription: a.prescription,
    }));

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
    throw new Error(`Failed to fetch patient alerts: ${error.message}`);
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

    // Ensure status is present and accurate, even for legacy records
    const normalized = vitals.map(v => {
      const computed = analyzeVitals({
        heartRate: v.heartRate,
        systolicBP: v.systolicBP,
        diastolicBP: v.diastolicBP,
        oxygenLevel: v.oxygenLevel,
        temperature: v.temperature,
        respiratoryRate: v.respiratoryRate,
      });
      return {
        ...v,
        status: v.status || (computed.isCritical ? 'CRITICAL' : 'NORMAL')
      };
    });

    return normalized;
  } catch (error) {
    throw new Error(`Failed to fetch vitals history: ${error.message}`);
  }
};

/**
 * Check if vitals are critical and return issues
 */
const analyzeVitals = (vitals) => {
  const issues = [];
  const recommendations = [];

  // Heart Rate (Normal: 60-100 bpm)
  if (vitals.heartRate < 60) {
    issues.push('Low heart rate (Bradycardia)');
    recommendations.push('Rest and avoid strenuous activity. Consult your doctor if you feel dizzy or fatigued.');
  } else if (vitals.heartRate > 100) {
    issues.push('High heart rate (Tachycardia)');
    recommendations.push('Try deep breathing exercises. Avoid caffeine and seek medical attention if persistent.');
  }

  // Blood Pressure (Normal: <120/80)
  if (vitals.systolicBP >= 180 || vitals.diastolicBP >= 120) {
    issues.push('Hypertensive Crisis');
    recommendations.push('URGENT: Seek immediate medical attention. This is a medical emergency.');
  } else if (vitals.systolicBP >= 140 || vitals.diastolicBP >= 90) {
    issues.push('High blood pressure (Hypertension)');
    recommendations.push('Monitor regularly, reduce salt intake, and consult your doctor for proper management.');
  } else if (vitals.systolicBP < 90 || vitals.diastolicBP < 60) {
    issues.push('Low blood pressure (Hypotension)');
    recommendations.push('Stay hydrated, avoid sudden position changes. Contact doctor if symptomatic.');
  }

  // Oxygen Level (Normal: 95-100%)
  if (vitals.oxygenLevel < 90) {
    issues.push('Critically low oxygen saturation');
    recommendations.push('URGENT: Seek immediate medical attention. Sit upright and try to remain calm.');
  } else if (vitals.oxygenLevel < 95) {
    issues.push('Low oxygen saturation');
    recommendations.push('Monitor closely. Practice deep breathing. Contact your doctor if it persists.');
  }

  // Temperature (Normal: 97-99°F)
  if (vitals.temperature >= 103) {
    issues.push('High fever');
    recommendations.push('Take fever-reducing medication, stay hydrated, and contact your doctor immediately.');
  } else if (vitals.temperature >= 100.4) {
    issues.push('Fever detected');
    recommendations.push('Rest, stay hydrated, and monitor temperature. Contact doctor if it persists beyond 3 days.');
  } else if (vitals.temperature < 95) {
    issues.push('Hypothermia');
    recommendations.push('Warm up gradually with blankets. Seek medical attention if you feel confused or drowsy.');
  }

  // Respiratory Rate (Normal: 12-20 breaths/min)
  if (vitals.respiratoryRate && (vitals.respiratoryRate < 12 || vitals.respiratoryRate > 20)) {
    issues.push(vitals.respiratoryRate < 12 ? 'Low respiratory rate' : 'High respiratory rate');
    recommendations.push('Monitor breathing. Contact your doctor if you experience shortness of breath.');
  }

  return { isCritical: issues.length > 0, issues, recommendations };
};

/**
 * Process uploaded CSV and create vitals records with critical detection
 */
export const processVitalsCSV = async (userId, csvContent) => {
  try {
    const patient = await Patient.findOne({ user_id: userId });
    if (!patient) throw new Error('Patient record not found');

    const Vitals = await import('../models/Vitals.js').then(m => m.default);
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    
    const vitalsRecords = [];
    let mostCriticalVitals = null;
    let maxIssuesCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length < headers.length - 1) continue; // Skip incomplete rows

      const dateIdx = headers.indexOf('date');
      const timeIdx = headers.indexOf('time');
      const systolicIdx = headers.indexOf('bloodpressuresystolic');
      const diastolicIdx = headers.indexOf('bloodpressurediastolic');
      const heartRateIdx = headers.indexOf('heartrate');
      const tempIdx = headers.indexOf('temperature');
      const o2Idx = headers.indexOf('oxygensaturation');
      const respIdx = headers.indexOf('respiratoryrate');
      const notesIdx = headers.indexOf('notes');

      const recordedAt = new Date(`${values[dateIdx]} ${values[timeIdx] || '00:00'}`);
      
      const vitalsData = {
        patient_id: patient._id,
        systolicBP: parseInt(values[systolicIdx]) || 120,
        diastolicBP: parseInt(values[diastolicIdx]) || 80,
        heartRate: parseInt(values[heartRateIdx]) || 72,
        temperature: parseFloat(values[tempIdx]) || 98.6,
        oxygenLevel: parseInt(values[o2Idx]) || 98,
        respiratoryRate: respIdx >= 0 ? parseInt(values[respIdx]) || 16 : 16,
        notes: notesIdx >= 0 ? values[notesIdx] : '',
        recorded_at: recordedAt
      };

      const analysis = analyzeVitals(vitalsData);
        vitalsData.status = analysis.isCritical ? 'CRITICAL' : 'NORMAL';
      
      if (analysis.isCritical && analysis.issues.length > maxIssuesCount) {
        maxIssuesCount = analysis.issues.length;
        mostCriticalVitals = { ...vitalsData, analysis };
      }

      const vital = new Vitals(vitalsData);
      await vital.save();
      vitalsRecords.push(vital);
    }

    let criticalAlert = null;
    if (mostCriticalVitals) {
      // Create alert that expires in 24 hours
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const alertMessage = [
        `Issues: ${mostCriticalVitals.analysis.issues.join('; ')}`,
        `Recommendations: ${mostCriticalVitals.analysis.recommendations.join(' | ')}`,
        `Snapshot: HR ${mostCriticalVitals.heartRate} bpm, BP ${mostCriticalVitals.systolicBP}/${mostCriticalVitals.diastolicBP}, O2 ${mostCriticalVitals.oxygenLevel}%, Temp ${mostCriticalVitals.temperature}°F, RR ${mostCriticalVitals.respiratoryRate}/min`
      ].join('\n');

      criticalAlert = new Alert({
        patient_id: patient._id,
        doctor_id: null,
        alert_type: 'CRITICAL',
        title: 'Critical Vitals - Immediate Attention Required',
        message: alertMessage,
        severity: 'CRITICAL',
        status: 'ACTIVE',
        expires_at: expiresAt
      });
      
      await criticalAlert.save();
    }

    return {
      vitalsCount: vitalsRecords.length,
      criticalAlert: criticalAlert ? {
        id: criticalAlert._id,
        issues: mostCriticalVitals.analysis.issues,
        recommendations: mostCriticalVitals.analysis.recommendations,
        snapshot: {
          recorded_at: mostCriticalVitals.recorded_at,
          heartRate: mostCriticalVitals.heartRate,
          systolicBP: mostCriticalVitals.systolicBP,
          diastolicBP: mostCriticalVitals.diastolicBP,
          oxygenLevel: mostCriticalVitals.oxygenLevel,
          temperature: mostCriticalVitals.temperature,
          respiratoryRate: mostCriticalVitals.respiratoryRate,
          notes: mostCriticalVitals.notes,
        }
      } : null
    };
  } catch (error) {
    throw new Error(`CSV processing failed: ${error.message}`);
  }
};
