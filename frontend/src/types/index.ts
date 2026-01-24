// User and Authentication Types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'PATIENT' | 'DOCTOR' | 'ADMIN';
  enabled: boolean;
  is_active: boolean;
  is_verified: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: User;
  role: string;
}

export interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  isLoading: boolean;
  isCheckAuthLoading: boolean;
  error: string | null;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
  errorCode?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  content: T[];
  pageNumber: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// Patient Types
export interface Patient extends User {
  dateOfBirth: string;
  address: string;
  phoneNumber: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  bloodType: string;
  emergencyContact: {
    name: string;
    phoneNumber: string;
    relationship: string;
  };
}

export interface MedicalRecordEntry {
  id?: string;
  name?: string;
  testName?: string;
  date: string;
  notes?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  hospital?: string;
  surgeon?: string;
  result?: string;
  unit?: string;
}

export interface MedicalRecord {
  patient_id: string;
  immunizations: MedicalRecordEntry[];
  allergies: MedicalRecordEntry[];
  operations: MedicalRecordEntry[];
  labResults: MedicalRecordEntry[];
  history: {
    completedAppointments: any[];
    alerts: any[];
  };
}

export interface VitalSigns {
  id: string;
  patientId: string;
  heartRate: number;
  systolicBP: number;
  diastolicBP: number;
  oxygenLevel: number;
  temperature: number;
  respiratoryRate: number;
  timestamp: string;
  notes?: string;
}

export interface Alert {
  id: string;
  patientId: string;
  doctorId: string;
  message: string;
  category: 'CRITICAL' | 'WARNING' | 'INFO';
  timestamp: string;
  acknowledged: boolean;
}

export interface PatientDashboard {
  patient: Patient;
  lastVitals?: VitalSigns;
  alerts: Alert[];
  doctors: Doctor[];
  hasVitalData: boolean;
  hasAlerts: boolean;
}

// Doctor Types
export interface Doctor extends User {
  _id?: string;
  user_id?: {
    _id: string;
    full_name: string;
    email: string;
    role: string;
    is_active: boolean;
  };
  specialization: string;
  licenseNumber: string;
  license_number?: string;
  yearsOfExperience: number;
  patients: Patient[];
  application_status?: string;
  status_change_request?: {
    type: 'ACTIVATE' | 'DEACTIVATE';
    reason: string;
    requested_at: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
  };
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  scheduledTime: string;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  type: 'IN_PERSON' | 'ONLINE' | 'PHONE';
  reason?: string;
  notes?: string;
}

export interface Prescription {
  id: string;
  patientId: string;
  doctorId: string;
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
  startDate: string;
  endDate: string;
  instructions?: string;
}

export interface DoctorDashboard {
  doctor: Doctor;
  upcomingAppointments: Appointment[];
  pendingRequests: Appointment[];
  alerts: Alert[];
  stats: {
    totalPatients: number;
    appointmentsToday: number;
    avgWaitTime: number;
    emergencyAlertsCount: number;
  };
}

// Admin Types
export interface Admin extends User {
  department?: string;
}

export interface SystemLog {
  id: string;
  adminId: string;
  action: string;
  timestamp: string;
  severity: 'INFO' | 'WARNING' | 'ERROR';
}

export interface DashboardStats {
  totalPatients: number;
  totalDoctors: number;
  totalAppointments: number;
  activeAlerts: number;
  pendingApprovals: number;
}

export interface AdminDashboard {
  admin: Admin;
  stats: DashboardStats;
  recentActivities: SystemLog[];
}

// Form Types
export interface RegistrationFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  dateOfBirth: string;
  address: string;
  phoneNumber: string;
  gender: string;
  bloodType: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
  emergencyContactEmail: string;
}

export interface VitalSignsFormData {
  heartRate: number;
  systolicBP: number;
  diastolicBP: number;
  oxygenLevel: number;
  temperature: number;
  respiratoryRate: number;
  notes?: string;
}

// UI State Types
export interface LoadingState {
  [key: string]: boolean;
}

export interface ErrorState {
  [key: string]: string | null;
}
