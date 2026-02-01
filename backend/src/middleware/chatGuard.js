import Appointment from '../models/Appointment.js';
import Alert from '../models/Alert.js';
import Patient from '../models/Patient.js';
import Doctor from '../models/Doctor.js';

/**
 * Calculate if a date is within one week from now
 */
const isWithinOneWeek = (date) => {
  if (!date) return false;
  const now = new Date();
  const targetDate = new Date(date);
  const oneWeekFromTarget = new Date(targetDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  return now <= oneWeekFromTarget;
};

/**
 * Verify whether chat is allowed between a patient and doctor.
 * Conditions:
 * 1. ACTIVE alert with the doctor - allowed
 * 2. RESOLVED alert with the doctor - allowed for 1 week after resolved_at
 * 3. COMPLETED/PAST appointment with the doctor - allowed for 1 week after appointment_date
 * 
 * Returns: { allowed: boolean, reason?: string }
 */
export const isChatAllowed = async (patientId, doctorId) => {
  // If either id missing, deny immediately
  if (!patientId || !doctorId) {
    return { allowed: false, reason: 'Invalid patient or doctor ID' };
  }

  // 1. Check for ACTIVE alerts
  const activeAlert = await Alert.findOne({
    patient_id: patientId,
    doctor_id: doctorId,
    status: 'ACTIVE',
  }).lean();

  if (activeAlert) {
    return { allowed: true, reason: 'Active alert consultation' };
  }

  // 2. Check for RESOLVED alerts within 1 week
  const resolvedAlert = await Alert.findOne({
    patient_id: patientId,
    doctor_id: doctorId,
    status: 'RESOLVED',
    resolved_at: { $exists: true },
  }).sort({ resolved_at: -1 }).lean();

  if (resolvedAlert && isWithinOneWeek(resolvedAlert.resolved_at)) {
    return { allowed: true, reason: 'Resolved alert - chat available for 1 week' };
  }

  // 3. Check for COMPLETED or past appointments within 1 week
  const completedAppointment = await Appointment.findOne({
    patient_id: patientId,
    doctor_id: doctorId,
    status: { $in: ['COMPLETED', 'PAST'] },
  }).sort({ appointment_date: -1 }).lean();

  if (completedAppointment && isWithinOneWeek(completedAppointment.appointment_date)) {
    return { allowed: true, reason: 'Completed appointment - chat available for 1 week' };
  }

  // Check if there was a resolved alert but expired
  if (resolvedAlert && !isWithinOneWeek(resolvedAlert.resolved_at)) {
    return { 
      allowed: false, 
      reason: 'Chat window expired. Alert was resolved more than 1 week ago.' 
    };
  }

  // Check if there was a completed appointment but expired
  if (completedAppointment && !isWithinOneWeek(completedAppointment.appointment_date)) {
    return { 
      allowed: false, 
      reason: 'Chat window expired. Appointment was completed more than 1 week ago.' 
    };
  }

  // No valid relationship found
  return { 
    allowed: false, 
    reason: 'No active alert or recent completed appointment with this doctor.' 
  };
};

/**
 * Legacy function for backward compatibility - returns boolean only
 */
export const isChatAllowedSimple = async (patientId, doctorId) => {
  const result = await isChatAllowed(patientId, doctorId);
  return result.allowed;
};

/**
 * Middleware helpers to resolve internal IDs and enforce chat permission.
 */
export const getPatientByUser = async (userId) => {
  const patient = await Patient.findOne({ user_id: userId }).lean();
  if (!patient) throw new Error('Patient record not found');
  return patient;
};

export const getDoctorByUser = async (userId) => {
  const doctor = await Doctor.findOne({ user_id: userId }).lean();
  if (!doctor) throw new Error('Doctor record not found');
  return doctor;
};
