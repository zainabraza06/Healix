export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export const minLength = (value: string, len: number) => value.trim().length >= len;
export const required = (value: string) => value.trim().length > 0;

export function validateRegistration(form: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}) {
  const errors: Record<string, string> = {};
  if (!required(form.firstName)) errors.firstName = 'First name is required';
  if (!required(form.lastName)) errors.lastName = 'Last name is required';
  if (!isEmail(form.email)) errors.email = 'Invalid email';
  if (!minLength(form.password, 6)) errors.password = 'Password must be at least 6 characters';
  if (form.password !== form.confirmPassword) errors.confirmPassword = 'Passwords do not match';
  return errors;
}

export function validateDoctorRegistration(form: {
  licenseNumber: string;
  specialization: string;
  yearsOfExperience: string;
}) {
  const errors: Record<string, string> = {};
  if (!required(form.licenseNumber)) errors.licenseNumber = 'License number is required';
  if (!required(form.specialization)) errors.specialization = 'Specialization is required';
  if (!required(form.yearsOfExperience)) errors.yearsOfExperience = 'Years of experience is required';
  return errors;
}

export function validateAppointment(form: {
  doctorId: string;
  appointmentDate: string;
  appointmentTime: string;
  reason: string;
}) {
  const errors: Record<string, string> = {};
  if (!required(form.doctorId)) errors.doctorId = 'Doctor is required';
  if (!required(form.appointmentDate)) errors.appointmentDate = 'Date is required';
  if (!required(form.appointmentTime)) errors.appointmentTime = 'Time is required';
  if (!required(form.reason)) errors.reason = 'Reason is required';
  return errors;
}
