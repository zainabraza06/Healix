import axios, { AxiosInstance, AxiosError } from 'axios';
import { ApiResponse, PaginatedResponse, MedicalRecord } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

class ApiClient {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      withCredentials: true, // send/receive http-only cookies for auth
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Load token from localStorage if available
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('token');
      if (this.token) {
        this.setAuthHeader(this.token);
      }
    }

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        // Let the error propagate - components will handle redirects
        return Promise.reject(error);
      }
    );
  }

  setAuthHeader(token: string): void {
    this.token = token;
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  clearAuthHeader(): void {
    this.token = null;
    delete this.client.defaults.headers.common['Authorization'];
  }

  // Generic HTTP Methods
  async get<T = any>(url: string, config?: any): Promise<ApiResponse<T>> {
    const response = await this.client.get(url, config);
    return response.data;
  }

  async post<T = any>(url: string, data?: any, config?: any): Promise<ApiResponse<T>> {
    const response = await this.client.post(url, data, config);
    return response.data;
  }

  async put<T = any>(url: string, data?: any, config?: any): Promise<ApiResponse<T>> {
    const response = await this.client.put(url, data, config);
    return response.data;
  }

  async delete<T = any>(url: string, config?: any): Promise<ApiResponse<T>> {
    const response = await this.client.delete(url, config);
    return response.data;
  }

  // Auth Endpoints
  async login(email: string, password: string): Promise<ApiResponse<any>> {
    const response = await this.client.post('/auth/login', { email, password });
    return response.data;
  }

  async logout(): Promise<ApiResponse<void>> {
    const response = await this.client.post('/auth/logout');
    return response.data;
  }

  async refreshToken(): Promise<ApiResponse<any>> {
    const refreshToken = localStorage.getItem('refreshToken');
    const response = await this.client.post('/auth/refresh-token', { refreshToken });
    return response.data;
  }

  async validateToken(): Promise<ApiResponse<boolean>> {
    const response = await this.client.get('/auth/validate-token');
    return response.data;
  }

  async getCurrentUser(): Promise<ApiResponse<any>> {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  async registerPatient(data: any): Promise<ApiResponse<any>> {
    const response = await this.client.post('/auth/register-patient', data);
    return response.data;
  }

  async registerDoctor(data: any): Promise<ApiResponse<any>> {
    const response = await this.client.post('/auth/register-doctor', data);
    return response.data;
  }

  async changePassword(data: any): Promise<ApiResponse<any>> {
    const response = await this.client.post('/auth/change-password', data);
    return response.data;
  }

  async registerAdmin(data: any): Promise<ApiResponse<any>> {
    // Public admin creation endpoint (no token required)
    const response = await this.client.post('/auth/register-admin', data);
    return response.data;
  }

  async verifyEmail(token: string): Promise<ApiResponse<void>> {
    const response = await this.client.get(`/auth/verify-email?token=${token}`);
    return response.data;
  }

  async renewVerificationToken(email: string): Promise<ApiResponse<void>> {
    const response = await this.client.post(`/auth/renew-token?email=${email}`);
    return response.data;
  }

  async forgotPassword(email: string): Promise<ApiResponse<void>> {
    const response = await this.client.post('/auth/forgot-password', { email });
    return response.data;
  }

  async resetPassword(token: string, newPassword: string): Promise<ApiResponse<void>> {
    const response = await this.client.post('/auth/reset-password', { token, newPassword });
    return response.data;
  }


  // Patient Endpoints
  async getPatientDashboard(): Promise<ApiResponse<any>> {
    const response = await this.client.get('/patient/dashboard');
    return response.data;
  }

  async getPatientProfile(): Promise<ApiResponse<any>> {
    const response = await this.client.get('/patient/profile');
    return response.data;
  }

  async updatePatientProfile(data: any): Promise<ApiResponse<any>> {
    const response = await this.client.put('/patient/profile', data);
    return response.data;
  }

  async getMedicalRecords(): Promise<ApiResponse<MedicalRecord>> {
    const response = await this.client.get('/patient/medical-records');
    return response.data;
  }

  async downloadMedicalRecord(patientId: string): Promise<Blob> {
    const response = await this.client.get(`/medical-records/${patientId}/download`, {
      responseType: 'blob',
    });
    return response.data as Blob;
  }

  async addMedicalRecordEntry(type: string, data: any): Promise<ApiResponse<any>> {
    const response = await this.client.post(`/patient/medical-records/${type}`, data);
    return response.data;
  }

  async getVitalsHistory(days: number = 30): Promise<ApiResponse<any>> {
    const response = await this.client.get(`/patient/vitals/history?days=${days}`);
    return response.data;
  }

  async uploadVitalsCSV(file: File): Promise<ApiResponse<any>> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.client.post('/patient/vitals/upload-csv', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async notifyDoctorForCriticalVitals(doctorId: string): Promise<ApiResponse<any>> {
    const response = await this.client.post('/patient/vitals/consultation-notify', { doctorId });
    return response.data;
  }

  async downloadCSVTemplate(): Promise<Blob> {
    const response = await this.client.get('/patient/vitals/csv-template', {
      responseType: 'blob',
    });
    return response.data;
  }

  async getPatientAlerts(): Promise<ApiResponse<any>> {
    const response = await this.client.get('/patient/alerts');
    return response.data;
  }

  async createEmergencyAlert(data: any): Promise<ApiResponse<any>> {
    const response = await this.client.post('/patient/alert/emergency', data);
    return response.data;
  }

  // Chat (Patient)
  async checkPatientChatEligibility(doctorId: string): Promise<ApiResponse<{ allowed: boolean; reason: string }>> {
    const response = await this.client.get(`/chat/patient/${doctorId}/can-chat`);
    return response.data;
  }

  async getPatientChatHistory(doctorId: string): Promise<ApiResponse<any[]>> {
    const response = await this.client.get(`/chat/patient/${doctorId}/history`);
    return response.data;
  }

  async sendPatientChatMessage(doctorId: string, text: string): Promise<ApiResponse<any>> {
    const response = await this.client.post(`/chat/patient/${doctorId}/message`, { text });
    return response.data;
  }

  async requestDataDeletion(): Promise<ApiResponse<any>> {
    const response = await this.client.post('/patient/delete-request');
    return response.data;
  }

  async getAvailableDoctors(): Promise<ApiResponse<any[]>> {
    const response = await this.client.get('/patient/doctors');
    return response.data;
  }

  async getPatientAppointments(page: number = 0, size: number = 10, status?: string): Promise<ApiResponse<any>> {
    const params = new URLSearchParams({
      page: page.toString(),
      size: size.toString(),
      ...(status && { status }),
    });
    const response = await this.client.get(`/patient/appointments?${params}`);
    return response.data;
  }

  async getPastPatientAppointments(page: number = 0, size: number = 10): Promise<ApiResponse<any>> {
    const params = new URLSearchParams({
      page: page.toString(),
      size: size.toString(),
    });
    const response = await this.client.get(`/patient/appointments/past?${params}`);
    return response.data;
  }

  async getAvailableSlots(doctorId: string, date: string): Promise<ApiResponse<any[]>> {
    const response = await this.client.get(`/patient/appointments/slots?doctorId=${doctorId}&date=${date}`);
    return response.data;
  }

  async bookAppointment(data: any): Promise<ApiResponse<any>> {
    const response = await this.client.post('/patient/appointments/book', data);
    return response.data;
  }

  async cancelPatientAppointment(appointmentId: string, reason: string): Promise<ApiResponse<any>> {
    const response = await this.client.post(`/patient/appointments/${appointmentId}/cancel`, { reason });
    return response.data;
  }

  async requestEmergencyCancellation(appointmentId: string, reason: string): Promise<ApiResponse<any>> {
    const response = await this.client.post(`/patient/appointments/${appointmentId}/emergency-cancel`, { reason });
    return response.data;
  }

  async processAppointmentPayment(appointmentId: string): Promise<ApiResponse<any>> {
    const response = await this.client.post(`/patient/appointments/${appointmentId}/pay`);
    return response.data;
  }

  async rescheduleAppointmentPatient(appointmentId: string, date: string, time: string, reason: string): Promise<ApiResponse<any>> {
    const response = await this.client.post(`/patient/appointments/${appointmentId}/reschedule`, { date, time, reason });
    return response.data;
  }

  async createStripeCheckout(appointmentId: string): Promise<ApiResponse<{ sessionId: string; url: string }>> {
    const response = await this.client.post(`/patient/appointments/${appointmentId}/checkout`);
    return response.data;
  }

  async verifyStripePayment(sessionId: string): Promise<ApiResponse<any>> {
    const response = await this.client.get(`/patient/appointments/verify-payment?sessionId=${sessionId}`);
    return response.data;
  }

  async getAppointmentDetails(appointmentId: string): Promise<ApiResponse<any>> {
    const response = await this.client.get(`/patient/appointments/${appointmentId}`);
    return response.data;
  }

  // Doctor Endpoints
  async getDoctorDashboard(): Promise<ApiResponse<any>> {
    const response = await this.client.get('/doctor/dashboard');
    return response.data;
  }

  async getDoctorProfile(): Promise<ApiResponse<any>> {
    const response = await this.client.get('/doctor/profile');
    return response.data;
  }

  async updateDoctorProfile(data: any): Promise<ApiResponse<any>> {
    const response = await this.client.put('/doctor/profile', data);
    return response.data;
  }

  async getDoctorPatients(): Promise<ApiResponse<any>> {
    const response = await this.client.get('/doctor/patients');
    return response.data;
  }

  async getPatientMedicalSummary(patientId: string): Promise<ApiResponse<any>> {
    const response = await this.client.get(`/doctor/patients/${patientId}/medical-summary`);
    return response.data;
  }

  async downloadPatientMedicalRecord(patientId: string): Promise<Blob> {
    const response = await this.client.get(`/medical-records/${patientId}/download`, {
      responseType: 'blob'
    });
    return response.data;
  }

  async getAppointmentRequests(page: number = 0, size: number = 10): Promise<ApiResponse<any>> {
    const params = new URLSearchParams({
      page: page.toString(),
      size: size.toString(),
    });
    const response = await this.client.get(`/doctor/appointments/requests?${params}`);
    return response.data;
  }

  async getDoctorAppointments(status?: string, date?: string, page: number = 0, size: number = 10): Promise<ApiResponse<any>> {
    const params = new URLSearchParams({
      page: page.toString(),
      size: size.toString(),
      ...(status && { status }),
      ...(date && { date }),
    });
    const response = await this.client.get(`/doctor/appointments?${params.toString()}`);
    return response.data;
  }

  async getPastDoctorAppointments(page: number = 0, size: number = 10): Promise<ApiResponse<any>> {
    const params = new URLSearchParams({
      page: page.toString(),
      size: size.toString(),
    });
    const response = await this.client.get(`/doctor/appointments/past?${params.toString()}`);
    return response.data;
  }

  async getDoctorDailySchedule(date?: string): Promise<ApiResponse<any>> {
    const url = date ? `/doctor/appointments/today?date=${date}` : '/doctor/appointments/today';
    const response = await this.client.get(url);
    return response.data;
  }

  async getDoctorNextDaySchedule(): Promise<ApiResponse<any>> {
    const response = await this.client.get('/doctor/appointments/tomorrow');
    return response.data;
  }

  async confirmAppointment(appointmentId: string, meetingLink?: string): Promise<ApiResponse<any>> {
    const response = await this.client.post(`/doctor/appointments/${appointmentId}/confirm`, { meetingLink });
    return response.data;
  }

  async cancelDoctorAppointment(appointmentId: string, reason: string): Promise<ApiResponse<any>> {
    const response = await this.client.post(`/doctor/appointments/${appointmentId}/cancel`, { reason });
    return response.data;
  }

  async cancelAppointment(appointmentId: string, reason: string = 'Cancelled by doctor'): Promise<ApiResponse<any>> {
    const response = await this.client.post(`/doctor/appointments/${appointmentId}/cancel`, { reason });
    return response.data;
  }

  async requestReschedule(appointmentId: string, reason: string): Promise<ApiResponse<any>> {
    const response = await this.client.post(`/doctor/appointments/${appointmentId}/request-reschedule`, { reason });
    return response.data;
  }

  async rejectReschedule(appointmentId: string, reason: string): Promise<ApiResponse<any>> {
    const response = await this.client.post(`/doctor/appointments/${appointmentId}/reject-reschedule`, { reason });
    return response.data;
  }

  async respondToRescheduleRejection(appointmentId: string, action: 'keep_original' | 'cancel', reason?: string): Promise<ApiResponse<any>> {
    const response = await this.client.post(`/patient/appointments/${appointmentId}/reschedule-rejection-response`, { action, reason });
    return response.data;
  }

  async requestDoctorEmergencyReschedule(appointmentId: string, reason: string): Promise<ApiResponse<any>> {
    const response = await this.client.post(`/doctor/appointments/${appointmentId}/request-emergency-reschedule`, { reason });
    return response.data;
  }

  async completeAppointment(appointmentId: string, medications: any[], instructions: string): Promise<ApiResponse<any>> {
    const response = await this.client.post(`/doctor/appointments/${appointmentId}/complete`, { medications, instructions });
    return response.data;
  }

  async markNoShow(appointmentId: string): Promise<ApiResponse<any>> {
    const response = await this.client.post(`/doctor/appointments/${appointmentId}/no-show`);
    return response.data;
  }

  async getPatientVitals(patientId: string): Promise<ApiResponse<any>> {
    const response = await this.client.get(`/doctor/patients/${patientId}/vitals`);
    return response.data;
  }

  async createPrescription(data: any): Promise<ApiResponse<any>> {
    const response = await this.client.post('/doctor/prescriptions', data);
    return response.data;
  }

  async getDoctorAlerts(page?: number, size?: number, status?: string): Promise<ApiResponse<any>> {
    const params = new URLSearchParams();
    if (page !== undefined) params.append('page', page.toString());
    if (size !== undefined) params.append('size', size.toString());
    if (status) params.append('status', status);

    const response = await this.client.get(`/doctor/alerts?${params.toString()}`);
    return response.data;
  }

  async resolveAlert(alertId: string, instructions: string, prescription?: string): Promise<ApiResponse<any>> {
    const response = await this.client.post(`/doctor/alerts/${alertId}/resolve`, {
      instructions,
      prescription
    });
    return response.data;
  }

  async acknowledgeAlert(alertId: string): Promise<ApiResponse<any>> {
    const response = await this.client.post(`/doctor/alerts/${alertId}/acknowledge`);
    return response.data;
  }

  async requestStatusChange(type: 'ACTIVATE' | 'DEACTIVATE', reason: string): Promise<ApiResponse<any>> {
    const response = await this.client.post('/doctor/request-status-change', { type, reason });
    return response.data;
  }

  // Admin Endpoints
  async getAdminDashboard(): Promise<ApiResponse<any>> {
    const response = await this.client.get('/admin/dashboard');
    return response.data;
  }

  async getPatients(page: number = 0, size: number = 10, search?: string, isActive?: 'true' | 'false' | 'active' | 'deactivated'): Promise<ApiResponse<PaginatedResponse<any>>> {
    const params = new URLSearchParams({
      page: page.toString(),
      size: size.toString(),
      ...(search && { search }),
      ...(isActive && { isActive }),
    });
    const response = await this.client.get(`/admin/patients?${params}`);
    return response.data;
  }

  async getDoctors(page: number = 0, size: number = 10, search?: string, requestStatus?: string): Promise<ApiResponse<PaginatedResponse<any>>> {
    const params = new URLSearchParams({
      page: page.toString(),
      size: size.toString(),
      ...(search && { search }),
      ...(requestStatus && { requestStatus }),
    });
    const response = await this.client.get(`/admin/doctors?${params}`);
    return response.data;
  }

  async enablePatient(patientId: string): Promise<ApiResponse<any>> {
    const response = await this.client.post(`/admin/patients/${patientId}/enable`);
    return response.data;
  }

  async disablePatient(patientId: string): Promise<ApiResponse<any>> {
    const response = await this.client.post(`/admin/patients/${patientId}/disable`);
    return response.data;
  }

  async managePatientStatus(data: { patientId: string; status: 'ACTIVATE' | 'DEACTIVATE'; reason: string }): Promise<ApiResponse<any>> {
    const response = await this.client.post('/admin/patients/manage-status', data);
    return response.data;
  }

  async registerDoctorAsAdmin(data: any): Promise<ApiResponse<any>> {
    const response = await this.client.post('/admin/doctors/register', data);
    return response.data;
  }

  async approveDoctor(data: { doctorId: string; password: string; doctorEmail: string }): Promise<ApiResponse<any>> {
    const response = await this.client.post('/admin/approve-doctor', data);
    return response.data;
  }

  async rejectDoctor(data: { doctorId: string; reason: string; doctorEmail: string }): Promise<ApiResponse<any>> {
    const response = await this.client.post('/admin/reject-doctor', data);
    return response.data;
  }

  async getLogs(page: number = 0, size: number = 20): Promise<ApiResponse<PaginatedResponse<any>>> {
    const response = await this.client.get(`/admin/logs?page=${page}&size=${size}`);
    return response.data;
  }

  async downloadLogs(format: 'csv' | 'json' | 'pdf' = 'csv'): Promise<Blob> {
    const response = await this.client.get(`/admin/logs/download?format=${format}`, {
      responseType: 'blob',
    });
    return response.data as Blob;
  }

  async downloadAlerts(format: 'csv' | 'json' | 'pdf' = 'csv'): Promise<Blob> {
    const response = await this.client.get(`/admin/alerts/export?format=${format}`, {
      responseType: 'blob',
    });
    return response.data as Blob;
  }

  async downloadDoctors(format: 'csv' | 'json' | 'pdf' = 'csv'): Promise<Blob> {
    const response = await this.client.get(`/admin/doctors/download?format=${format}`, {
      responseType: 'blob',
    });
    return response.data as Blob;
  }

  async downloadPatients(format: 'csv' | 'json' | 'pdf' = 'csv', isActive?: 'true' | 'false' | 'active' | 'deactivated'): Promise<Blob> {
    const params = new URLSearchParams({ format, ...(isActive && { isActive }) });
    const response = await this.client.get(`/admin/patients/download?${params.toString()}`, {
      responseType: 'blob',
    });
    return response.data as Blob;
  }

  async manageDoctorStatus(data: { doctorId: string; status: 'ACTIVATE' | 'DEACTIVATE'; reason: string }): Promise<ApiResponse<any>> {
    const response = await this.client.post('/admin/doctors/manage-status', data);
    return response.data;
  }

  async getStatistics(): Promise<ApiResponse<any>> {
    const response = await this.client.get('/admin/statistics');
    return response.data;
  }

  async getAdminProfile(): Promise<ApiResponse<any>> {
    const response = await this.client.get('/admin/profile');
    return response.data;
  }

  async updateAdminProfile(data: any): Promise<ApiResponse<any>> {
    const response = await this.client.put('/admin/profile', data);
    return response.data;
  }

  async getEmergencyCancellations(): Promise<ApiResponse<any[]>> {
    const response = await this.client.get('/admin/emergency-cancellations');
    return response.data;
  }

  async reviewEmergencyCancellation(requestId: string, approved: boolean, notes: string): Promise<ApiResponse<any>> {
    const response = await this.client.post(`/admin/emergency-cancellations/${requestId}/review`, { approved, notes });
    return response.data;
  }

  async getDoctorEmergencyRequests(status: string = 'PENDING'): Promise<ApiResponse<any[]>> {
    const response = await this.client.get(`/admin/emergency-reschedules?status=${status}`);
    return response.data;
  }

  async approveDoctorEmergencyReschedule(requestId: string): Promise<ApiResponse<any>> {
    const response = await this.client.post(`/admin/emergency-reschedules/${requestId}/approve`);
    return response.data;
  }

  // Chat (Doctor)
  async getDoctorChatHistory(patientId: string): Promise<ApiResponse<any[]>> {
    const response = await this.client.get(`/chat/doctor/${patientId}/history`);
    return response.data;
  }

  async sendDoctorChatMessage(patientId: string, text: string): Promise<ApiResponse<any>> {
    const response = await this.client.post(`/chat/doctor/${patientId}/message`, { text });
    return response.data;
  }

  // Logs
  async getMyActivityLogs(page: number = 0, size: number = 20): Promise<ApiResponse<any>> {
    const response = await this.client.get(`/logs/activity/my?page=${page}&size=${size}`);
    return response.data;
  }

  async getAllLogs(filters?: any, page: number = 0, size: number = 50): Promise<ApiResponse<any>> {
    let query = `?page=${page}&size=${size}`;
    if (filters?.userId) query += `&userId=${filters.userId}`;
    if (filters?.level) query += `&level=${filters.level}`;
    if (filters?.action) query += `&action=${filters.action}`;
    if (filters?.entityType) query += `&entityType=${filters.entityType}`;
    if (filters?.status) query += `&status=${filters.status}`;

    const response = await this.client.get(`/logs/${query}`);
    return response.data;
  }

  async getUserActivityLogs(userId: string, page: number = 0, size: number = 50): Promise<ApiResponse<any>> {
    const response = await this.client.get(`/logs/user/${userId}?page=${page}&size=${size}`);
    return response.data;
  }

  async createPatientAlert(data: any): Promise<ApiResponse<any>> {
    const response = await this.client.post('/patient/alert/create', data);
    return response.data;
  }
}

export const apiClient = new ApiClient();

