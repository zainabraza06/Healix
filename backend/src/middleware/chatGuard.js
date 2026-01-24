import Appointment from '../models/Appointment.js';
import Alert from '../models/Alert.js';
import Patient from '../models/Patient.js';
import Doctor from '../models/Doctor.js';

/**
 * Verify whether chat is allowed between a patient and doctor.
 * Conditions:
 * - There exists an appointment between the patient and doctor (past or upcoming),
 *   where status is not CANCELLED, or upcoming appointment_date >= now.
 * - OR there is an ACTIVE CRITICAL alert for the patient that is linked to the doctor (doctor_id) and not expired.
 */
export const isChatAllowed = async (patientId, doctorId) => {
  const now = new Date();

  // Check appointment relationship
  const appointment = await Appointment.findOne({
    patient_id: patientId,
    doctor_id: doctorId,
    $or: [
      { status: { $in: ['PENDING', 'CONFIRMED', 'COMPLETED'] } },
      { appointment_date: { $gte: now }, status: { $ne: 'CANCELLED' } },
    ],
  }).lean();

  if (appointment) return true;

  // Check critical alert consultation linkage
  const alert = await Alert.findOne({
    patient_id: patientId,
    doctor_id: doctorId,
    alert_type: 'CRITICAL',
    status: 'ACTIVE',
    $or: [
      { expires_at: { $exists: false } },
      { expires_at: { $gte: now } },
    ],
  }).lean();

  return !!alert;
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
