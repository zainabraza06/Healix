'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '@/lib/authStore';
import { apiClient } from '@/lib/apiClient';
import ProtectedLayout from '@/components/ProtectedLayout';
import toast from 'react-hot-toast';
import { Calendar, Clock, MapPin, AlertCircle, Video, CreditCard, X, MessageCircle, FileText } from 'lucide-react';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';

interface Appointment {
  id: string;
  doctorId: string;
  doctorName: string;
  specialization?: string;
  appointmentDate: string;
  slotStartTime: string;
  slotEndTime: string;
  appointmentType: 'ONLINE' | 'OFFLINE';
  status: 'REQUESTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  reason: string;
  meetingLink?: string;
  location?: string;
  paymentStatus: 'PENDING' | 'PAID' | 'REFUNDED' | 'PARTIAL_REFUND';
  paymentAmount: number;
  refundAmount?: number;
  challanNumber?: string;
  prescription?: string;
  instructions?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  chatEnabled?: boolean;
}

interface Doctor {
  id: string;
  name: string;
  specialization: string;
}

interface Slot {
  time: string;
  endTime: string;
  available: boolean;
}

export default function AppointmentsPage() {
  const { } = useAuthStore();
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [pastAppointments, setPastAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  // Pagination state
  const [upcomingPage, setUpcomingPage] = useState(0);
  const [upcomingTotalPages, setUpcomingTotalPages] = useState(0);
  const [pastPage, setPastPage] = useState(0);
  const [pastTotalPages, setPastTotalPages] = useState(0);
  const pageSize = 10;

  // Booking form state
  const [showBookForm, setShowBookForm] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [appointmentType, setAppointmentType] = useState<'ONLINE' | 'OFFLINE'>('OFFLINE');
  const [reason, setReason] = useState('');
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal states
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isEmergencyCancel, setIsEmergencyCancel] = useState(false);

  // Calculate booking window dates (3 days to 30 days from now)
  const { minBookingDate, maxBookingDate } = useMemo(() => {
    const today = new Date();

    const min = new Date(today);
    min.setDate(today.getDate() + 3);

    const max = new Date(today);
    max.setDate(today.getDate() + 30);

    return {
      minBookingDate: min.toISOString().split('T')[0],
      maxBookingDate: max.toISOString().split('T')[0]
    };
  }, []);

  useEffect(() => {
    fetchAppointments();
    fetchAvailableDoctors();

    // Check for Stripe payment callback
    const urlParams = new URLSearchParams(window.location.search);
    const payment = urlParams.get('payment');
    const sessionId = urlParams.get('session_id');

    if (payment === 'success' && sessionId) {
      handlePaymentCallback(sessionId);
    } else if (payment === 'cancelled') {
      toast.error('Payment was cancelled');
    }

    // Clean up URL
    if (payment) {
      window.history.replaceState({}, '', '/patient/appointments');
    }
  }, [upcomingPage, pastPage]);

  const handlePaymentCallback = async (sessionId: string) => {
    try {
      const response = await apiClient.verifyStripePayment(sessionId);
      if (response.success) {
        toast.success('Payment completed successfully!');
        fetchAppointments();
      }
    } catch (err) {
      toast.error('Payment verification failed');
      console.error(err);
    }
  };

  useEffect(() => {
    if (selectedDoctor && selectedDate) {
      fetchAvailableSlots();
    }
  }, [selectedDoctor, selectedDate]);

  const fetchAppointments = async () => {
    try {
      setIsLoading(true);

      // Fetch upcoming (REQUESTED, CONFIRMED) and past (COMPLETED, CANCELLED, NO_SHOW) separately
      const [upcomingRes, pastRes] = await Promise.all([
        apiClient.getPatientAppointments(upcomingPage, pageSize, 'REQUESTED,CONFIRMED'),
        apiClient.getPatientAppointments(pastPage, pageSize, 'COMPLETED,CANCELLED,NO_SHOW'),
      ]);

      if (upcomingRes.success && upcomingRes.data) {
        setUpcomingAppointments(upcomingRes.data.content || []);
        setUpcomingTotalPages(upcomingRes.data.totalPages || 0);
      }

      if (pastRes.success && pastRes.data) {
        setPastAppointments(pastRes.data.content || []);
        setPastTotalPages(pastRes.data.totalPages || 0);
      }
    } catch (err) {
      toast.error('Failed to load appointments');
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

  const fetchAvailableSlots = async () => {
    try {
      setIsLoadingSlots(true);
      setSelectedSlot('');
      const response = await apiClient.getAvailableSlots(selectedDoctor, selectedDate);
      if (response.success && response.data) {
        setAvailableSlots(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch slots:', err);
      toast.error('Failed to load available slots');
    } finally {
      setIsLoadingSlots(false);
    }
  };

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDoctor || !selectedDate || !selectedSlot || !reason) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await apiClient.bookAppointment({
        doctorId: selectedDoctor,
        appointmentDate: selectedDate,
        slotStartTime: selectedSlot,
        appointmentType,
        reason,
      });

      if (response.success) {
        toast.success('Appointment requested successfully!');
        setShowBookForm(false);
        resetBookingForm();
        fetchAppointments();
      } else {
        toast.error(response.message || 'Failed to book appointment');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetBookingForm = () => {
    setSelectedDoctor('');
    setSelectedDate('');
    setSelectedSlot('');
    setAppointmentType('OFFLINE');
    setReason('');
    setAvailableSlots([]);
  };

  const handleCancelClick = (apt: Appointment) => {
    setSelectedAppointment(apt);
    setCancelReason('');

    // Check if this needs emergency cancellation
    if (apt.status === 'CONFIRMED') {
      const aptDate = new Date(apt.appointmentDate);
      const now = new Date();
      const daysDiff = Math.ceil((aptDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      setIsEmergencyCancel(daysDiff < 3);
    } else {
      setIsEmergencyCancel(false);
    }

    setShowCancelModal(true);
  };

  const handleCancelConfirm = async () => {
    if (!selectedAppointment || !cancelReason) {
      toast.error('Please provide a reason for cancellation');
      return;
    }

    try {
      setIsSubmitting(true);
      let response;

      if (isEmergencyCancel) {
        response = await apiClient.requestEmergencyCancellation(selectedAppointment.id, cancelReason);
        if (response.success) {
          toast.success('Emergency cancellation request submitted. Admin will review shortly.');
        }
      } else {
        response = await apiClient.cancelPatientAppointment(selectedAppointment.id, cancelReason);
        if (response.success) {
          const refundAmount = response.data?.refundAmount || 0;
          toast.success(`Appointment cancelled. ${refundAmount > 0 ? `Refund: Rs. ${refundAmount}` : ''}`);
        }
      }

      setShowCancelModal(false);
      fetchAppointments();
    } catch (err: any) {
      if (err.response?.data?.needsEmergencyCancellation) {
        setIsEmergencyCancel(true);
        toast.error('This appointment requires emergency cancellation approval');
      } else {
        toast.error(err.response?.data?.message || 'Failed to cancel appointment');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentClick = (apt: Appointment) => {
    setSelectedAppointment(apt);
    setShowPaymentModal(true);
  };

  const handlePaymentConfirm = async () => {
    if (!selectedAppointment) return;

    try {
      setIsSubmitting(true);

      // Create Stripe Checkout session and redirect
      const response = await apiClient.createStripeCheckout(selectedAppointment.id);

      if (response.success && response.data?.url) {
        // Redirect to Stripe Checkout
        window.location.href = response.data.url;
      } else {
        toast.error('Failed to create checkout session');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Payment initialization failed');
      setIsSubmitting(false);
    }
  };

  const handleDetailsClick = (apt: Appointment) => {
    setSelectedAppointment(apt);
    setShowDetailsModal(true);
  };

  const getStatusBadge = (status: string, paymentStatus?: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      REQUESTED: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Requested' },
      CONFIRMED: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: paymentStatus === 'PAID' ? 'Confirmed' : 'Awaiting Payment' },
      COMPLETED: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Completed' },
      CANCELLED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelled' },
      NO_SHOW: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'No Show' },
    };
    const badge = badges[status] || badges.REQUESTED;
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <ProtectedLayout allowedRoles={['PATIENT']}>
      <div className="container-main py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8 flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold text-slate-800 mb-2">Appointments</h1>
              <p className="text-slate-600">Book and manage your medical appointments</p>
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
              <form onSubmit={handleBookAppointment} className="space-y-6">
                <h3 className="text-xl font-bold text-slate-800 mb-4">Book New Appointment</h3>

                {/* Appointment Type Toggle */}
                <div className="flex gap-4 mb-4">
                  <button
                    type="button"
                    onClick={() => setAppointmentType('OFFLINE')}
                    className={`flex-1 py-3 px-4 rounded-xl border-2 transition flex items-center justify-center gap-2 ${appointmentType === 'OFFLINE'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 hover:border-slate-300'
                      }`}
                  >
                    <MapPin size={20} />
                    In-Person Visit
                  </button>
                  <button
                    type="button"
                    onClick={() => setAppointmentType('ONLINE')}
                    className={`flex-1 py-3 px-4 rounded-xl border-2 transition flex items-center justify-center gap-2 ${appointmentType === 'ONLINE'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 hover:border-slate-300'
                      }`}
                  >
                    <Video size={20} />
                    Online Consultation
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Doctor Selection */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">
                      Select Doctor *
                    </label>
                    <select
                      value={selectedDoctor}
                      onChange={(e) => setSelectedDoctor(e.target.value)}
                      className="w-full px-4 py-3 bg-white/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 backdrop-blur-sm"
                      required
                    >
                      <option value="">Choose a doctor</option>
                      {doctors.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          Dr. {doc.name} - {doc.specialization}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Date Selection */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">
                      Appointment Date * <span className="text-xs text-slate-400">(3 - 30 days advance)</span>
                    </label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedDate(val);

                        // Only show toast if it's a complete date and out of range
                        if (val.length === 10) {
                          if (val < minBookingDate || val > maxBookingDate) {
                            toast.error(`Please select a date between ${minBookingDate} and ${maxBookingDate}`);
                          }
                        }
                      }}
                      min={minBookingDate}
                      max={maxBookingDate}
                      className="w-full px-4 py-3 bg-white/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 backdrop-blur-sm"
                      required
                    />
                  </div>
                </div>

                {/* Time Slots */}
                {selectedDoctor && selectedDate && (
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">
                      Select Time Slot *
                    </label>
                    {isLoadingSlots ? (
                      <div className="flex items-center justify-center py-8">
                        <Spinner message="Loading available slots..." />
                      </div>
                    ) : availableSlots.length === 0 ? (
                      <p className="text-slate-500 py-4">No available slots for this date</p>
                    ) : (
                      <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                        {availableSlots.map((slot) => (
                          <button
                            key={slot.time}
                            type="button"
                            onClick={() => setSelectedSlot(slot.time)}
                            className={`py-2 px-3 rounded-lg text-sm font-medium transition ${selectedSlot === slot.time
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white/70 border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50'
                              }`}
                          >
                            {slot.time}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Reason */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    Reason for Visit *
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Describe your symptoms or reason for consultation..."
                    rows={3}
                    className="w-full px-4 py-3 bg-white/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 backdrop-blur-sm resize-none"
                    required
                  />
                </div>

                {/* Fee Notice */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                  <CreditCard className="text-amber-600 mt-0.5" size={20} />
                  <div>
                    <p className="font-medium text-amber-800">Appointment Fee: Rs. 1,000</p>
                    <p className="text-sm text-amber-700">Payment required after doctor confirms the appointment</p>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={isSubmitting || !selectedSlot}
                    className="bg-emerald-600 text-white py-3 px-6 rounded-xl hover:bg-emerald-700 transition shadow-lg hover:shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Booking...' : 'Request Appointment'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowBookForm(false); resetBookingForm(); }}
                    className="bg-slate-200 text-slate-700 py-3 px-6 rounded-xl hover:bg-slate-300 transition"
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
                message="Book an appointment to get started"
              />
            ) : (
              <>
                <div className="space-y-4">
                  {upcomingAppointments.map((apt) => (
                    <div
                      key={apt.id}
                      className={`glass-panel p-6 border-l-4 hover:shadow-lg transition-shadow ${apt.status === 'CONFIRMED' ? 'border-emerald-500' : 'border-amber-500'
                        }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-slate-800">
                              Dr. {apt.doctorName}
                            </h3>
                            {getStatusBadge(apt.status, apt.paymentStatus)}
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${apt.appointmentType === 'ONLINE'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-slate-100 text-slate-700'
                              }`}>
                              {apt.appointmentType}
                            </span>
                          </div>
                          <div className="space-y-2 text-slate-600">
                            <div className="flex items-center gap-2">
                              <Calendar size={18} className="text-emerald-600" />
                              {new Date(apt.appointmentDate).toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock size={18} className="text-emerald-600" />
                              {apt.slotStartTime} - {apt.slotEndTime}
                            </div>
                            {apt.appointmentType === 'OFFLINE' && (
                              <div className="flex items-center gap-2">
                                <MapPin size={18} className="text-emerald-600" />
                                {apt.location || 'Healix Medical Center'}
                              </div>
                            )}
                            {apt.appointmentType === 'ONLINE' && apt.meetingLink && (
                              <div className="flex items-center gap-2">
                                <Video size={18} className="text-blue-600" />
                                <a href={apt.meetingLink} target="_blank" rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline">
                                  Join Meeting
                                </a>
                              </div>
                            )}
                          </div>
                          {apt.status === 'CONFIRMED' && apt.paymentStatus === 'PENDING' && apt.challanNumber && (
                            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                              <p className="text-sm text-amber-800">
                                <strong>Payment Required</strong> - Challan: {apt.challanNumber}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          {apt.status === 'CONFIRMED' && apt.paymentStatus === 'PENDING' && (
                            <button
                              onClick={() => handlePaymentClick(apt)}
                              className="px-4 py-2 bg-emerald-100 text-emerald-600 hover:bg-emerald-200 rounded-xl transition font-semibold flex items-center gap-2"
                            >
                              <CreditCard size={16} /> Pay Now
                            </button>
                          )}
                          <button
                            onClick={() => handleCancelClick(apt)}
                            className="px-4 py-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-xl transition font-semibold flex items-center gap-2"
                          >
                            <X size={16} /> Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination controls for upcoming appointments */}
                {!isLoading && upcomingAppointments.length > 0 && upcomingTotalPages > 1 && (
                  <div className="flex justify-center items-center gap-4 mt-6">
                    <button
                      onClick={() => setUpcomingPage(prev => Math.max(0, prev - 1))}
                      disabled={upcomingPage === 0}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold"
                    >
                      Previous
                    </button>
                    <span className="text-gray-600 font-medium">
                      Page {upcomingPage + 1} of {upcomingTotalPages}
                    </span>
                    <button
                      onClick={() => setUpcomingPage(prev => Math.min(upcomingTotalPages - 1, prev + 1))}
                      disabled={upcomingPage >= upcomingTotalPages - 1}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Past Appointments */}
          {pastAppointments.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-slate-800 mb-4">Past Appointments</h2>
              <div className="space-y-4">
                {pastAppointments.map((apt) => (
                  <div
                    key={apt.id}
                    className={`glass-panel p-6 border-l-4 ${apt.status === 'COMPLETED' ? 'border-blue-500' : 'border-slate-300'
                      } opacity-90`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-slate-800">
                            Dr. {apt.doctorName}
                          </h3>
                          {getStatusBadge(apt.status)}
                        </div>
                        <div className="space-y-2 text-slate-600">
                          <div className="flex items-center gap-2">
                            <Calendar size={18} />
                            {new Date(apt.appointmentDate).toLocaleDateString()}
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock size={18} />
                            {apt.slotStartTime}
                          </div>
                        </div>
                        {apt.status === 'CANCELLED' && apt.cancellationReason && (
                          <p className="mt-2 text-sm text-red-600">
                            Cancelled by {apt.cancelledBy?.toLowerCase()}: {apt.cancellationReason}
                          </p>
                        )}
                        {apt.refundAmount && apt.refundAmount > 0 && (
                          <p className="mt-1 text-sm text-emerald-600">
                            Refund: Rs. {apt.refundAmount}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {apt.status === 'COMPLETED' && (
                          <>
                            <button
                              onClick={() => handleDetailsClick(apt)}
                              className="px-4 py-2 bg-blue-100 text-blue-600 hover:bg-blue-200 rounded-xl transition font-semibold flex items-center gap-2"
                            >
                              <FileText size={16} /> Details
                            </button>
                            {apt.chatEnabled && (
                              <button
                                onClick={() => window.location.href = '/patient/chat'}
                                className="px-4 py-2 bg-emerald-100 text-emerald-600 hover:bg-emerald-200 rounded-xl transition font-semibold flex items-center gap-2"
                              >
                                <MessageCircle size={16} /> Chat
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination controls for past appointments */}
              {!isLoading && pastAppointments.length > 0 && pastTotalPages > 1 && (
                <div className="flex justify-center items-center gap-4 mt-6">
                  <button
                    onClick={() => setPastPage(prev => Math.max(0, prev - 1))}
                    disabled={pastPage === 0}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold"
                  >
                    Previous
                  </button>
                  <span className="text-gray-600 font-medium">
                    Page {pastPage + 1} of {pastTotalPages}
                  </span>
                  <button
                    onClick={() => setPastPage(prev => Math.min(pastTotalPages - 1, prev + 1))}
                    disabled={pastPage >= pastTotalPages - 1}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && selectedAppointment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-slate-800 mb-4">
              {isEmergencyCancel ? 'Emergency Cancellation Request' : 'Cancel Appointment'}
            </h3>

            {isEmergencyCancel && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="text-amber-600 mt-0.5" size={20} />
                  <div>
                    <p className="font-medium text-amber-800">Less than 3 days remaining</p>
                    <p className="text-sm text-amber-700">Your request will be reviewed by admin. Full refund if approved.</p>
                  </div>
                </div>
              </div>
            )}

            {!isEmergencyCancel && selectedAppointment.paymentStatus === 'PAID' && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                <p className="text-sm text-blue-800">
                  <strong>Refund Policy:</strong> Rs. 250 will be deducted. You will receive Rs. 750 refund.
                </p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Reason for cancellation *
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Please provide a reason..."
                rows={3}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                required
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCancelConfirm}
                disabled={isSubmitting || !cancelReason}
                className="flex-1 bg-red-600 text-white py-3 rounded-xl hover:bg-red-700 transition disabled:opacity-50"
              >
                {isSubmitting ? 'Processing...' : isEmergencyCancel ? 'Submit Request' : 'Confirm Cancel'}
              </button>
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 bg-slate-200 text-slate-700 py-3 rounded-xl hover:bg-slate-300 transition"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedAppointment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Complete Payment</h3>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
              <div className="flex justify-between mb-2">
                <span className="text-slate-600">Consultation Fee</span>
                <span className="font-bold text-slate-800">Rs. {selectedAppointment.paymentAmount}</span>
              </div>
              <p className="text-xs text-emerald-600">Secure payment via Stripe Checkout</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 bg-blue-500 text-white text-xs font-bold rounded">STRIPE TEST MODE</span>
              </div>
              <p className="text-sm text-blue-700">
                This demonstration uses Stripe Test Mode. You can use test cards (e.g., 4242 4242...) to complete this flow without a real transaction.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handlePaymentConfirm}
                disabled={isSubmitting}
                className="flex-[2] bg-emerald-600 text-white py-3 rounded-xl hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-2 font-bold shadow-lg shadow-emerald-600/20"
              >
                {isSubmitting ? <Spinner size="sm" /> : <CreditCard size={18} />}
                {isSubmitting ? 'Initializing...' : 'Proceed to Checkout'}
              </button>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 bg-slate-200 text-slate-700 py-3 rounded-xl hover:bg-slate-300 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedAppointment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-slate-800">Appointment Details</h3>
              <button onClick={() => setShowDetailsModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-slate-500">Doctor</span>
                    <p className="font-medium">Dr. {selectedAppointment.doctorName}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Date</span>
                    <p className="font-medium">{new Date(selectedAppointment.appointmentDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Time</span>
                    <p className="font-medium">{selectedAppointment.slotStartTime}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Type</span>
                    <p className="font-medium">{selectedAppointment.appointmentType}</p>
                  </div>
                </div>
              </div>

              {selectedAppointment.prescription && (
                <div>
                  <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                    <FileText size={18} className="text-emerald-600" />
                    Prescription
                  </h4>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 whitespace-pre-wrap text-sm">
                    {selectedAppointment.prescription}
                  </div>
                </div>
              )}

              {selectedAppointment.instructions && (
                <div>
                  <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                    <AlertCircle size={18} className="text-blue-600" />
                    Doctor's Instructions
                  </h4>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 whitespace-pre-wrap text-sm">
                    {selectedAppointment.instructions}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowDetailsModal(false)}
              className="w-full mt-6 bg-slate-200 text-slate-700 py-3 rounded-xl hover:bg-slate-300 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </ProtectedLayout>
  );
}
