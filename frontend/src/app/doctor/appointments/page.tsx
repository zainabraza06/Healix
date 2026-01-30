'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import ProtectedLayout from '@/components/ProtectedLayout';
import toast from 'react-hot-toast';
import { Calendar, Clock, User, CheckCircle, AlertCircle } from 'lucide-react';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';

export default function DoctorAppointmentsPage() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'requests' | 'upcoming'>('requests');
  const [showRescheduleForm, setShowRescheduleForm] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [rescheduleData, setRescheduleData] = useState({
    newDate: '',
    newTime: '',
  });

  // Pagination state
  const [requestsPage, setRequestsPage] = useState(0);
  const [requestsTotalPages, setRequestsTotalPages] = useState(0);
  const [appointmentsPage, setAppointmentsPage] = useState(0);
  const [appointmentsTotalPages, setAppointmentsTotalPages] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    fetchData();
  }, [requestsPage, appointmentsPage]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [requestsRes, appointmentsRes] = await Promise.all([
        apiClient.getAppointmentRequests(requestsPage, pageSize),
        apiClient.getDoctorAppointments('CONFIRMED', undefined, appointmentsPage, pageSize),
      ]);

      if (requestsRes.success) {
        setRequests(requestsRes.data?.content || []);
        setRequestsTotalPages(requestsRes.data?.totalPages || 0);
      }
      if (appointmentsRes.success) {
        setAppointments(appointmentsRes.data?.content || []);
        setAppointmentsTotalPages(appointmentsRes.data?.totalPages || 0);
      }
    } catch (err) {
      setError('Failed to load appointments');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmAppointment = async (appointmentId: string) => {
    try {
      const response = await apiClient.confirmAppointment(appointmentId);
      if (response.success) {
        toast.success('Appointment confirmed!');
        fetchData();
      } else {
        toast.error(response.message || 'Failed to confirm appointment');
      }
    } catch (err) {
      toast.error('An error occurred');
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    if (confirm('Are you sure you want to cancel this appointment?')) {
      try {
        const response = await apiClient.cancelAppointment(appointmentId, 'Cancelled by doctor');
        if (response.success) {
          toast.success('Appointment cancelled');
          fetchData();
        } else {
          toast.error(response.message || 'Failed to cancel');
        }
      } catch (err) {
        toast.error('An error occurred');
      }
    }
  };

  const handleReschedule = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!rescheduleData.newDate || !rescheduleData.newTime) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      const dateTime = `${rescheduleData.newDate}T${rescheduleData.newTime}`;
      const response = await apiClient.rescheduleAppointment(selectedAppointment.id, dateTime);
      if (response.success) {
        toast.success('Appointment rescheduled!');
        setShowRescheduleForm(false);
        fetchData();
      } else {
        toast.error(response.message || 'Failed to reschedule');
      }
    } catch (err) {
      toast.error('An error occurred');
    }
  };

  return (
    <ProtectedLayout allowedRoles={['DOCTOR']}>
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Appointments</h1>
            <p className="text-gray-600">Manage patient appointments</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-8">
            <button
              onClick={() => setActiveTab('requests')}
              className={`px-6 py-2 rounded-lg font-semibold transition ${activeTab === 'requests'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border-2 border-gray-300'
                }`}
            >
              Appointment Requests ({requests.length})
            </button>
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`px-6 py-2 rounded-lg font-semibold transition ${activeTab === 'upcoming'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border-2 border-gray-300'
                }`}
            >
              Upcoming ({appointments.length})
            </button>
          </div>

          {/* Reschedule Form Modal */}
          {showRescheduleForm && selectedAppointment && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg p-8 max-w-md w-full">
                <h2 className="text-2xl font-bold mb-4">Reschedule Appointment</h2>
                <form onSubmit={handleReschedule} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      New Date
                    </label>
                    <input
                      type="date"
                      value={rescheduleData.newDate}
                      onChange={(e) =>
                        setRescheduleData({ ...rescheduleData, newDate: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      New Time
                    </label>
                    <input
                      type="time"
                      value={rescheduleData.newTime}
                      onChange={(e) =>
                        setRescheduleData({ ...rescheduleData, newTime: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div className="flex gap-2 pt-4">
                    <button
                      type="submit"
                      className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
                    >
                      Reschedule
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRescheduleForm(false)}
                      className="flex-1 bg-gray-300 text-gray-800 py-2 rounded-lg hover:bg-gray-400 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Content */}
          {isLoading ? (
            <div className="card bg-white">
              <Spinner size="lg" message="Loading appointments..." />
            </div>
          ) : error ? (
            <div className="card bg-red-50 border-2 border-red-200 flex items-center gap-3">
              <AlertCircle className="text-red-600" size={24} />
              <p className="text-red-700">{error}</p>
            </div>
          ) : activeTab === 'requests' ? (
            <>
              {requests.length === 0 ? (
                <EmptyState
                  icon={CheckCircle}
                  title="No pending requests"
                />
              ) : (
                <div className="space-y-4">
                  {requests.map((req) => (
                    <div key={req.id} className="card bg-yellow-50 border-l-4 border-yellow-600">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-800 mb-2">
                            {req.patientName || 'Unknown Patient'}
                          </h3>
                          <div className="space-y-2 text-gray-600 text-sm">
                            <div className="flex items-center gap-2">
                              <Calendar size={18} />
                              {new Date(req.appointmentDate).toLocaleDateString()}
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock size={18} />
                              {req.slotStartTime}
                            </div>
                            {req.reason && (
                              <div className="flex items-center gap-2">
                                <User size={18} />
                                Reason: {req.reason}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleConfirmAppointment(req.id)}
                            className="px-4 py-2 bg-green-100 text-green-600 hover:bg-green-200 rounded-lg transition font-semibold"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => handleCancelAppointment(req.id)}
                            className="px-4 py-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition font-semibold"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination controls for appointment requests */}
              {!isLoading && requests.length > 0 && requestsTotalPages > 1 && (
                <div className="flex justify-center items-center gap-4 mt-6">
                  <button
                    onClick={() => setRequestsPage(prev => Math.max(0, prev - 1))}
                    disabled={requestsPage === 0}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold"
                  >
                    Previous
                  </button>
                  <span className="text-gray-600 font-medium">
                    Page {requestsPage + 1} of {requestsTotalPages}
                  </span>
                  <button
                    onClick={() => setRequestsPage(prev => Math.min(requestsTotalPages - 1, prev + 1))}
                    disabled={requestsPage >= requestsTotalPages - 1}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              {appointments.length === 0 ? (
                <div className="card bg-white text-center py-12">
                  <Calendar size={48} className="mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600 text-lg">No upcoming appointments</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {appointments.map((apt) => (
                    <div key={apt.id} className="card bg-white border-l-4 border-blue-600">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-800 mb-2">
                            {apt.patientName || 'Unknown Patient'}
                          </h3>
                          <div className="space-y-2 text-gray-600 text-sm">
                            <div className="flex items-center gap-2">
                              <Calendar size={18} />
                              {new Date(apt.appointmentDate).toLocaleDateString()}
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock size={18} />
                              {apt.slotStartTime}
                            </div>
                            {apt.reason && (
                              <div className="flex items-center gap-2">
                                <User size={18} />
                                Reason: {apt.reason}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedAppointment(apt);
                              setShowRescheduleForm(true);
                            }}
                            className="px-4 py-2 bg-blue-100 text-blue-600 hover:bg-blue-200 rounded-lg transition font-semibold"
                          >
                            Reschedule
                          </button>
                          <button
                            onClick={() => handleCancelAppointment(apt.id)}
                            className="px-4 py-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition font-semibold"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination controls for upcoming appointments */}
              {!isLoading && appointments.length > 0 && appointmentsTotalPages > 1 && (
                <div className="flex justify-center items-center gap-4 mt-6">
                  <button
                    onClick={() => setAppointmentsPage(prev => Math.max(0, prev - 1))}
                    disabled={appointmentsPage === 0}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold"
                  >
                    Previous
                  </button>
                  <span className="text-gray-600 font-medium">
                    Page {appointmentsPage + 1} of {appointmentsTotalPages}
                  </span>
                  <button
                    onClick={() => setAppointmentsPage(prev => Math.min(appointmentsTotalPages - 1, prev + 1))}
                    disabled={appointmentsPage >= appointmentsTotalPages - 1}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </ProtectedLayout>
  );
}
