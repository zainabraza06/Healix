'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/authStore';
import { apiClient } from '@/lib/apiClient';
import ProtectedLayout from '@/components/ProtectedLayout';
import toast from 'react-hot-toast';
import { Calendar, Clock, MapPin, User, AlertCircle } from 'lucide-react';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';

export default function AppointmentsPage() {
  const { user } = useAuthStore();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBookForm, setShowBookForm] = useState(false);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    doctorId: '',
    appointmentDate: '',
    appointmentTime: '',
    reason: '',
  });

  useEffect(() => {
    fetchAppointments();
    fetchAvailableDoctors();
  }, []);

  const fetchAppointments = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.getPatientAppointments();
      if (response.success && response.data) {
        setAppointments(response.data);
      }
    } catch (err) {
      setError('Failed to load appointments');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAvailableDoctors = async () => {
    try {
      const response = await apiClient.getAvailableDoctors();
      if (response.success && response.data) {
        setDoctors(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch doctors:', err);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      const appointmentData = {
        doctorId: formData.doctorId,
        appointmentDateTime: `${formData.appointmentDate}T${formData.appointmentTime}`,
        reason: formData.reason,
      };

      const response = await apiClient.bookAppointment(appointmentData);

      if (response.success) {
        toast.success('Appointment booked successfully! Awaiting doctor confirmation.');
        setShowBookForm(false);
        setFormData({
          doctorId: '',
          appointmentDate: '',
          appointmentTime: '',
          reason: '',
        });
        fetchAppointments();
      } else {
        toast.error(response.message || 'Failed to book appointment');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'An error occurred while booking');
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    if (confirm('Are you sure you want to cancel this appointment?')) {
      try {
        const response = await apiClient.cancelPatientAppointment(appointmentId);
        if (response.success) {
          toast.success('Appointment cancelled successfully');
          fetchAppointments();
        } else {
          toast.error(response.message || 'Failed to cancel appointment');
        }
      } catch (err) {
        toast.error('An error occurred while cancelling');
      }
    }
  };

  const upcomingAppointments = appointments.filter(
    (apt) => new Date(apt.appointmentDate) >= new Date()
  );
  const pastAppointments = appointments.filter(
    (apt) => new Date(apt.appointmentDate) < new Date()
  );

  return (
    <ProtectedLayout allowedRoles={['PATIENT']}>
      <div className="container-main py-8">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8 flex justify-between items-center">
              <div>
                <h1 className="text-4xl font-bold text-slate-800 mb-2">Appointments</h1>
                <p className="text-slate-600">Manage your medical appointments</p>
              </div>
              <button
                onClick={() => setShowBookForm(!showBookForm)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-xl transition shadow-lg hover:shadow-emerald-500/30"
              >
                {showBookForm ? 'Close Form' : 'Book Appointment'}
              </button>
            </div>

            {/* Book Appointment Form */}
            {showBookForm && (
              <div className="glass-card mb-8 p-8 animate-float-delayed">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <h3 className="text-xl font-bold text-slate-800 mb-4">Book New Appointment</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-2">
                        Select Doctor
                      </label>
                      <select
                        name="doctorId"
                        value={formData.doctorId}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 bg-white/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 backdrop-blur-sm"
                        required
                      >
                        <option value="">Choose a doctor</option>
                        {doctors.map((doc) => (
                          <option key={doc.id} value={doc.id}>
                            Dr. {doc.firstName} {doc.lastName} - {doc.specialization}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-2">
                        Appointment Date
                      </label>
                      <input
                        type="date"
                        name="appointmentDate"
                        value={formData.appointmentDate}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 bg-white/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 backdrop-blur-sm"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-2">
                        Time
                      </label>
                      <input
                        type="time"
                        name="appointmentTime"
                        value={formData.appointmentTime}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 bg-white/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 backdrop-blur-sm"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-2">
                        Reason for Visit
                      </label>
                      <input
                        type="text"
                        name="reason"
                        value={formData.reason}
                        onChange={handleInputChange}
                        placeholder="e.g., Checkup, Follow-up"
                        className="w-full px-4 py-2 bg-white/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 backdrop-blur-sm"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      className="bg-emerald-600 text-white py-2 px-6 rounded-xl hover:bg-emerald-700 transition shadow-lg hover:shadow-emerald-500/20"
                    >
                      Book Appointment
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowBookForm(false)}
                      className="bg-slate-200 text-slate-700 py-2 px-6 rounded-xl hover:bg-slate-300 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Upcoming Appointments */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-800 mb-4">Upcoming Appointments</h2>
              {isLoading ? (
                <div className="glass-panel p-8 text-center">
                  <Spinner message="Loading appointments..." />
                </div>
              ) : upcomingAppointments.length === 0 ? (
                <EmptyState
                  icon={Calendar}
                  title="No upcoming appointments"
                />
              ) : (
                <div className="space-y-4">
                  {upcomingAppointments.map((apt, idx) => (
                    <div key={idx} className="glass-panel p-6 border-l-4 border-emerald-500 hover:shadow-lg transition-shadow">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-slate-800 mb-2">
                            Dr. {apt.doctorName}
                          </h3>
                          <div className="space-y-2 text-slate-600">
                            <div className="flex items-center gap-2">
                              <Calendar size={18} className="text-emerald-600" />
                              {new Date(apt.appointmentDate).toLocaleDateString()}
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock size={18} className="text-emerald-600" />
                              {apt.appointmentTime}
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin size={18} className="text-emerald-600" />
                              {apt.location || 'Online'}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCancelAppointment(apt.id)}
                            className="px-4 py-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-xl transition font-semibold"
                          >
                            Cancel
                          </button>
                          <button className="px-4 py-2 bg-emerald-100 text-emerald-600 hover:bg-emerald-200 rounded-xl transition font-semibold">
                            Reschedule
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Past Appointments */}
            {pastAppointments.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold text-slate-800 mb-4">Past Appointments</h2>
                <div className="space-y-4">
                  {pastAppointments.map((apt, idx) => (
                    <div key={idx} className="glass-panel p-6 border-l-4 border-slate-300 opacity-75">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-slate-800 mb-2">
                            Dr. {apt.doctorName}
                          </h3>
                          <div className="space-y-2 text-slate-600">
                            <div className="flex items-center gap-2">
                              <Calendar size={18} />
                              {new Date(apt.appointmentDate).toLocaleDateString()}
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock size={18} />
                              {apt.appointmentTime}
                            </div>
                          </div>
                        </div>
                        <span className="px-3 py-1 bg-slate-200/50 text-slate-700 rounded-full text-sm font-semibold backdrop-blur-sm">
                          Completed
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
    </ProtectedLayout>
  );
}
