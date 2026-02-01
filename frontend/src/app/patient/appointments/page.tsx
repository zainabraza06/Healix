'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '@/lib/authStore';
import { apiClient } from '@/lib/apiClient';
import ProtectedLayout from '@/components/ProtectedLayout';
import toast from 'react-hot-toast';
import { Calendar, Clock, MapPin, AlertCircle, Video, CreditCard, X, Activity, Plus } from 'lucide-react';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';

// 3D Background
const Scene = dynamic(() => import('@/components/canvas/Scene'), { ssr: false });
const FloatingIcons = dynamic(() => import('@/components/canvas/FloatingIcons'), { ssr: false });

interface Appointment {
  id: string;
  doctorId: string;
  doctorName: string;
  specialization?: string;
  appointmentDate: string;
  slotStartTime: string;
  slotEndTime: string;
  appointmentType: 'ONLINE' | 'OFFLINE';
  status: 'REQUESTED' | 'CONFIRMED' | 'PAST' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW' | 'RESCHEDULE_REQUESTED';
  reason: string;
  meetingLink?: string;
  paymentStatus?: 'PENDING' | 'PAID' | 'REFUNDED';
  cancellationReason?: string;
  doctorCancelledRescheduleRequest?: boolean;
  doctorCancellationReason?: string;
  rescheduleRequestedBy?: 'PATIENT' | 'DOCTOR';
  rescheduleReason?: string;
  rescheduleRejected?: boolean;
  rescheduleRejectionReason?: string;
  patientRespondedToDoctorReschedule?: boolean;
  prescription?: {
    medications?: Array<{
      name: string;
      dosage: string;
      frequency: string;
      duration: string;
      instructions?: string;
    }>;
    notes?: string;
  } | null;
  instructions?: string;
}

interface Doctor {
  id: string;
  name: string;
  specialization: string;
}

interface Slot {
  time: string;
  available: boolean;
}

export default function AppointmentsPage() {
  const { user } = useAuthStore();

  // State for appointments
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('confirmed');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const pageSize = 10;

  // State for booking new appointment
  const [showBookForm, setShowBookForm] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [appointmentType, setAppointmentType] = useState<'ONLINE' | 'OFFLINE'>('OFFLINE');
  const [reason, setReason] = useState('');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal states
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // Reschedule Modal State
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [appointmentToReschedule, setAppointmentToReschedule] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSlot, setRescheduleSlot] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduleAvailableSlots, setRescheduleAvailableSlots] = useState<Slot[]>([]);
  const [isLoadingRescheduleSlots, setIsLoadingRescheduleSlots] = useState(false);

  // Doctor Cancelled Reschedule Modal State
  const [showDocCancelledModal, setShowDocCancelledModal] = useState(false);
  const [appointmentWithDocCancel, setAppointmentWithDocCancel] = useState<Appointment | null>(null);
  const [docCancelReason, setDocCancelReason] = useState('');
  const [isProcessingDocCancel, setIsProcessingDocCancel] = useState(false);

  // Rejection Response Modal State
  const [showRejectionResponseModal, setShowRejectionResponseModal] = useState(false);
  const [appointmentForRejectionResponse, setAppointmentForRejectionResponse] = useState<Appointment | null>(null);
  const [rejectionResponseAction, setRejectionResponseAction] = useState<'keep_original' | 'cancel' | null>(null);
  const [isProcessingRejectionResponse, setIsProcessingRejectionResponse] = useState(false);

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
  }, [activeTab, currentPage]);

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

  // Check if appointment can be cancelled
  const canCancelAppointment = (apt: Appointment): boolean => {
    // Can cancel REQUESTED anytime (withdraw request)
    if (apt.status === 'REQUESTED') {
      return true;
    }

    // Can cancel RESCHEDULE_REQUESTED anytime
    if (apt.status === 'RESCHEDULE_REQUESTED') {
      return true;
    }

    if (apt.status === 'CONFIRMED') {
      // Can cancel only if 24 hours before the appointment
      const appointmentDate = new Date(apt.appointmentDate);
      const now = new Date();
      const diffHours = (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      return diffHours >= 24;
    }

    return false;
  };

  // Get cancellation disabled reason
  const getCancellationDisabledReason = (apt: Appointment): string => {
    if (apt.status === 'CONFIRMED') {
      const appointmentDate = new Date(apt.appointmentDate);
      const now = new Date();
      const diffHours = (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (diffHours < 24) {
        return 'Cannot cancel within 24 hours of appointment';
      }
    }
    return '';
  };

  // Check if video consultation button should be shown
  // Only show 15 minutes before appointment until appointment end time
  const canShowVideoConsultation = (apt: Appointment): boolean => {
    const appointmentDate = new Date(apt.appointmentDate);
    const [hours, minutes] = apt.slotStartTime.split(':').map(Number);
    const appointmentStart = new Date(appointmentDate);
    appointmentStart.setHours(hours, minutes, 0, 0);

    // End time is 30 minutes after start (slot duration)
    const appointmentEnd = new Date(appointmentStart);
    appointmentEnd.setMinutes(appointmentEnd.getMinutes() + 30);

    const now = new Date();

    // Show if we're within 15 minutes before start OR during the appointment
    const fifteenMinutesBefore = new Date(appointmentStart);
    fifteenMinutesBefore.setMinutes(fifteenMinutesBefore.getMinutes() - 15);

    return now >= fifteenMinutesBefore && now <= appointmentEnd;
  };

  const handleCancelAppointment = async () => {
    if (!appointmentToCancel || !cancelReason.trim()) {
      toast.error('Please provide a cancellation reason');
      return;
    }

    try {
      setIsCancelling(true);
      
      // Use different endpoint for RESCHEDULE_REQUESTED appointments
      const endpoint = appointmentToCancel.status === 'RESCHEDULE_REQUESTED'
        ? `/patient/appointments/${appointmentToCancel.id}/cancel-reschedule-requested`
        : `/patient/appointments/${appointmentToCancel.id}/cancel`;

      const response = await apiClient.post(endpoint, {
        reason: cancelReason
      });

      if (response.success) {
        const message = 
          appointmentToCancel.status === 'RESCHEDULE_REQUESTED'
            ? 'Appointment cancelled. Full refund processed.'
            : appointmentToCancel.status === 'REQUESTED'
            ? 'Appointment request withdrawn successfully'
            : 'Appointment cancelled successfully';
        
        toast.success(message);
        setShowCancelModal(false);
        setAppointmentToCancel(null);
        setCancelReason('');
        fetchAppointments();
      } else {
        toast.error(response.message || 'Failed to cancel appointment');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error cancelling appointment');
      console.error(err);
    } finally {
      setIsCancelling(false);
    }
  };

  // Handle response to reschedule rejection
  const handleRejectionResponse = async () => {
    if (!appointmentForRejectionResponse || !rejectionResponseAction) {
      return;
    }

    try {
      setIsProcessingRejectionResponse(true);
      const response = await apiClient.respondToRescheduleRejection(
        appointmentForRejectionResponse.id,
        rejectionResponseAction
      );

      if (response.success) {
        if (rejectionResponseAction === 'keep_original') {
          toast.success('Original appointment slot restored successfully');
        } else {
          toast.success('Appointment cancelled. Rs. 750 refunded (Rs. 250 deducted as processing fee)');
        }
        setShowRejectionResponseModal(false);
        setAppointmentForRejectionResponse(null);
        setRejectionResponseAction(null);
        fetchAppointments();
      } else {
        toast.error(response.message || 'Failed to process response');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error processing response');
      console.error(err);
    } finally {
      setIsProcessingRejectionResponse(false);
    }
  };

  // Open Reschedule Modal
  const openRescheduleModal = (apt: Appointment) => {
    // Check 24h constraint if CONFIRMED
    if (apt.status === 'CONFIRMED') {
      const appointmentDate = new Date(apt.appointmentDate);
      const now = new Date();
      const diffHours = (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (diffHours < 24) {
        toast.error('Cannot reschedule within 24 hours of appointment. Please contact support.');
        return;
      }
    }

    setAppointmentToReschedule(apt);
    setRescheduleDate('');
    setRescheduleSlot('');
    setRescheduleReason('');
    setRescheduleAvailableSlots([]);
    setShowRescheduleModal(true);
  };

  // Fetch slots for reschedule date
  useEffect(() => {
    if (showRescheduleModal && appointmentToReschedule && rescheduleDate) {
      const fetchRescheduleSlots = async () => {
        try {
          setIsLoadingRescheduleSlots(true);
          const response = await apiClient.getAvailableSlots(appointmentToReschedule.doctorId, rescheduleDate);
          if (response.success && response.data) {
            setRescheduleAvailableSlots(response.data);
          }
        } catch (err) {
          console.error(err);
          toast.error('Failed to load slots');
        } finally {
          setIsLoadingRescheduleSlots(false);
        }
      };

      const dateObj = new Date(rescheduleDate);
      dateObj.setHours(0, 0, 0, 0);

      // Validate booking window (3 to 30 days)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const minDate = new Date(today);
      minDate.setDate(today.getDate() + 3);
      const maxDate = new Date(today);
      maxDate.setDate(today.getDate() + 30);

      if (dateObj < minDate || dateObj > maxDate) {
        setRescheduleAvailableSlots([]);
        toast.error('Please select a date between 3 and 30 days from today');
        return;
      }

      // Check for weekend
      const day = dateObj.getDay();
      if (day === 0 || day === 6) {
        setRescheduleAvailableSlots([]);
        toast.error('Appointments cannot be rescheduled to weekends');
        return;
      }

      // Basic validation
      if (/^\d{4}-\d{2}-\d{2}$/.test(rescheduleDate)) {
        fetchRescheduleSlots();
      }
    }
  }, [rescheduleDate, appointmentToReschedule, showRescheduleModal]);

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointmentToReschedule || !rescheduleDate || !rescheduleSlot) {
      toast.error('Please select date and time');
      return;
    }

    const dateObj = new Date(rescheduleDate);
    dateObj.setHours(0, 0, 0, 0);

    // Validate booking window (3 to 30 days)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const minDate = new Date(today);
    minDate.setDate(today.getDate() + 3);
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + 30);

    if (dateObj < minDate) {
      toast.error('Appointments must be booked at least 3 days in advance');
      return;
    }

    if (dateObj > maxDate) {
      toast.error('Appointments cannot be booked more than 30 days in advance');
      return;
    }

    // Check for weekend
    const day = dateObj.getDay();
    if (day === 0 || day === 6) {
      toast.error('Appointments cannot be rescheduled to weekends');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await apiClient.rescheduleAppointmentPatient(
        appointmentToReschedule.id,
        rescheduleDate,
        rescheduleSlot,
        rescheduleReason
      );

      if (response.success) {
        toast.success('Appointment rescheduled successfully!');
        setShowRescheduleModal(false);
        setAppointmentToReschedule(null);
        fetchAppointments();
      } else {
        toast.error(response.message || 'Failed to reschedule');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayNow = async (appointmentId: string) => {
    try {
      setIsLoading(true);
      const response = await apiClient.createStripeCheckout(appointmentId);
      if (response.success && response.data?.url) {
        window.location.href = response.data.url;
      } else {
        toast.error(response.message || 'Failed to initiate payment');
      }
    } catch (err) {
      console.error('Payment error:', err);
      toast.error('An error occurred during payment initiation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDocCancelledRescheduleResponse = async (choice: 'keep' | 'cancel') => {
    if (!appointmentWithDocCancel) return;

    try {
      setIsProcessingDocCancel(true);
      const response = await apiClient.post(
        `/patient/appointments/${appointmentWithDocCancel.id}/doctor-cancelled-reschedule-response`,
        {
          choice,
          reason: docCancelReason,
        }
      );

      if (response.success) {
        toast.success(
          choice === 'keep'
            ? 'Appointment confirmed for original slot!'
            : 'Appointment cancelled. Refund will be processed.'
        );
        setShowDocCancelledModal(false);
        setAppointmentWithDocCancel(null);
        setDocCancelReason('');
        fetchAppointments();
      } else {
        toast.error(response.message || 'Failed to process response');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'An error occurred');
    } finally {
      setIsProcessingDocCancel(false);
    }
  };

  useEffect(() => {
    if (selectedDoctor && selectedDate) {
      // Basic format check before fetching
      if (/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
        fetchAvailableSlots();
      } else {
        setAvailableSlots([]);
      }
    }
  }, [selectedDoctor, selectedDate]);

  const fetchAppointments = async () => {
    try {
      setIsLoading(true);

      // Fetch based on active tab
      let response;
      if (activeTab === 'past') {
        response = await apiClient.getPastPatientAppointments(currentPage, pageSize);
      } else {
        let statusFilter = '';
        if (activeTab === 'confirmed') {
          statusFilter = 'CONFIRMED';
        } else if (activeTab === 'requested') {
          statusFilter = 'REQUESTED';
        } else if (activeTab === 'cancelled') {
          statusFilter = 'CANCELLED';
        } else if (activeTab === 'completed') {
          statusFilter = 'COMPLETED,NO_SHOW';
        } else if (activeTab === 'rescheduling') {
          statusFilter = 'RESCHEDULE_REQUESTED';
        }
        response = await apiClient.getPatientAppointments(currentPage, pageSize, statusFilter);
      }

      if (response.success && response.data) {
        setAppointments(response.data.content || []);
        setTotalPages(response.data.totalPages || 0);
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
    // Validate date before fetching
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDateObj = new Date(selectedDate);
    selectedDateObj.setHours(0, 0, 0, 0);

    const minDate = new Date(today);
    minDate.setDate(today.getDate() + 3);
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + 30);

    if (selectedDateObj < minDate || selectedDateObj > maxDate) {
      setAvailableSlots([]);
      return;
    }

    // Check if weekend
    const dayOfWeek = selectedDateObj.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      setAvailableSlots([]);
      toast.error('Appointments are not available on weekends (Saturday & Sunday)');
      return;
    }

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

    // Explicit date validation
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDateObj = new Date(selectedDate);
    selectedDateObj.setHours(0, 0, 0, 0);

    const minDate = new Date(today);
    minDate.setDate(today.getDate() + 3);
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + 30);

    if (selectedDateObj < minDate) {
      toast.error('Appointments must be booked at least 3 days in advance');
      return;
    }

    if (selectedDateObj > maxDate) {
      toast.error('Appointments cannot be booked more than 30 days in advance');
      return;
    }

    // Check if weekend
    const dayOfWeek = selectedDateObj.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      toast.error('Appointments are not available on weekends');
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

  const isAppointmentPast = (apt: Appointment) => {
    const appointmentDate = new Date(apt.appointmentDate);
    const endTime = apt.slotEndTime || apt.slotStartTime;
    if (!endTime) return false;
    const [hours, minutes] = endTime.split(':').map(Number);
    const appointmentEnd = new Date(appointmentDate);
    appointmentEnd.setHours(hours || 0, minutes || 0, 0, 0);
    return appointmentEnd.getTime() <= new Date().getTime();
  };

  const resetBookingForm = () => {
    setSelectedDoctor('');
    setSelectedDate('');
    setSelectedSlot('');
    setAppointmentType('OFFLINE');
    setReason('');
    setAvailableSlots([]);
  };

  // Helper function to render slot selection content
  const renderSlotSelectionContent = () => {
    if (typeof window === 'undefined' || !selectedDoctor || !selectedDate) {
      return null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDateObj = new Date(selectedDate);
    selectedDateObj.setHours(0, 0, 0, 0);

    const minDate = new Date(today);
    minDate.setDate(today.getDate() + 3);
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + 30);

    const dayOfWeek = selectedDateObj.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return (
        <p className="text-red-500 text-[10px] font-black uppercase tracking-[0.2em]">
          Not available on weekends
        </p>
      );
    }

    if (selectedDateObj < minDate || selectedDateObj > maxDate) {
      return (
        <p className="text-amber-600 text-[10px] font-black uppercase tracking-[0.2em]">
          Please select a date between {new Date(minBookingDate).toLocaleDateString()} and {new Date(maxBookingDate).toLocaleDateString()}
        </p>
      );
    }

    if (isLoadingSlots) {
      return (
        <div className="flex items-center gap-3 text-emerald-600 font-bold text-xs uppercase tracking-widest">
          <Spinner size="sm" /> Loading Slots...
        </div>
      );
    }

    if (availableSlots.length === 0) {
      return (
        <p className="text-red-500 text-[10px] font-black uppercase tracking-[0.2em]">
          No slots available for this date
        </p>
      );
    }

    return (
      <div className="grid grid-cols-3 gap-2">
        {availableSlots.map((slot) => (
          <button
            key={slot.time}
            type="button"
            onClick={() => setSelectedSlot(slot.time)}
            className={`py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${
              selectedSlot === slot.time
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                : 'bg-white/40 border border-white/60 text-slate-600 hover:bg-white/60'
            }`}
          >
            {slot.time}
          </button>
        ))}
      </div>
    );
  };

  // Filter appointments based on active tab
  const getFilteredAppointments = () => {
    let filtered = appointments;
    
    if (activeTab === 'doctorRequests') {
      filtered = appointments.filter(
        (apt) => apt.status === 'RESCHEDULE_REQUESTED' && apt.rescheduleRequestedBy === 'DOCTOR'
      );
    } else if (activeTab === 'rescheduling') {
      filtered = appointments.filter(
        (apt) => apt.status === 'RESCHEDULE_REQUESTED' && apt.rescheduleRequestedBy === 'PATIENT'
      );
    } else if (activeTab === 'requested') {
      filtered = appointments.filter((apt) => apt.status === 'REQUESTED');
    } else if (activeTab === 'confirmed') {
      filtered = appointments.filter((apt) => apt.status === 'CONFIRMED');
    } else if (activeTab === 'cancelled') {
      filtered = appointments.filter((apt) => apt.status === 'CANCELLED');
    } else if (activeTab === 'completed') {
      filtered = appointments.filter((apt) => apt.status === 'COMPLETED' || apt.status === 'NO_SHOW');
    } else if (activeTab === 'past') {
      filtered = appointments.filter((apt) => apt.status === 'PAST');
    }
    
    return filtered;
  };

  const filteredAppointments = getFilteredAppointments();

  return (
    <ProtectedLayout allowedRoles={['PATIENT']}>
      <div className="relative min-h-screen">
        {/* 3D Background */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          <Scene className="h-full w-full">
            <FloatingIcons />
          </Scene>
        </div>

        <div className="relative z-10 container-main py-12">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
          >
            <div>
              <h1 className="text-6xl font-black text-slate-800 tracking-tighter leading-none mb-4">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">Appointments</span>
              </h1>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-500" />
                Book and manage your healthcare consultations
              </p>
            </div>
            <button
              onClick={() => setShowBookForm(!showBookForm)}
              className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black shadow-xl shadow-slate-900/20 transition-all active:scale-[0.98] flex items-center gap-2 group"
            >
              {showBookForm ? <X size={16} /> : <Plus size={16} className="group-hover:rotate-90 transition-transform" />}
              {showBookForm ? 'Close Form' : 'New Appointment'}
            </button>
          </motion.div>

          <AnimatePresence mode="wait">
            {showBookForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="glass-card mb-12 p-10 border-white/60 shadow-2xl">
                  <form onSubmit={handleBookAppointment} className="space-y-8">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                        <Calendar className="text-emerald-600" size={20} />
                      </div>
                      <h3 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Request Appointment</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Appointment Type */}
                      <div className="space-y-4">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Select Type</label>
                        <div className="flex gap-4">
                          <button
                            type="button"
                            onClick={() => setAppointmentType('OFFLINE')}
                            className={`flex-1 py-4 px-6 rounded-2xl border transition-all flex items-center justify-center gap-3 font-bold text-xs uppercase tracking-widest ${
                              appointmentType === 'OFFLINE'
                                ? 'bg-slate-900 text-white border-slate-900 shadow-xl shadow-slate-900/10'
                                : 'bg-white/40 text-slate-600 border-white/60 hover:bg-white/60'
                            }`}
                          >
                            <MapPin size={16} />
                            In-Person
                          </button>
                          <button
                            type="button"
                            onClick={() => setAppointmentType('ONLINE')}
                            className={`flex-1 py-4 px-6 rounded-2xl border transition-all flex items-center justify-center gap-3 font-bold text-xs uppercase tracking-widest ${
                              appointmentType === 'ONLINE'
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xl shadow-emerald-600/10'
                                : 'bg-white/40 text-slate-600 border-white/60 hover:bg-white/60'
                            }`}
                          >
                            <Video size={16} />
                            Video Call
                          </button>
                        </div>
                      </div>

                      {/* Doctor Selection */}
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Choose Specialist</label>
                        <select
                          value={selectedDoctor}
                          onChange={(e) => setSelectedDoctor(e.target.value)}
                          className="w-full px-6 py-4 bg-white/40 backdrop-blur-md border border-white/60 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold text-slate-700 appearance-none"
                          required
                        >
                          <option value="">Select a Specialist</option>
                          {doctors.map((doc) => (
                            <option key={doc.id} value={doc.id}>
                              Dr. {doc.name} - {doc.specialization}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Date Selection */}
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Preferred Date</label>
                        <input
                          type="date"
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          min={minBookingDate}
                          max={maxBookingDate}
                          className="w-full px-6 py-4 bg-white/40 backdrop-blur-md border border-white/60 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold text-slate-700"
                          required
                        />
                        {selectedDate && (new Date(selectedDate).getDay() === 0 || new Date(selectedDate).getDay() === 6) && (
                          <div className="mt-3 p-3 bg-red-100 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 animate-pulse">
                            <AlertCircle size={16} />
                            <span className="text-xs font-black uppercase tracking-widest">Weekends are unavailable</span>
                          </div>
                        )}
                        {!selectedDate || (new Date(selectedDate).getDay() !== 0 && new Date(selectedDate).getDay() !== 6) ? (
                          <p className="mt-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Available from {new Date(minBookingDate).toLocaleDateString()} onwards (Mon-Fri)
                          </p>
                        ) : null}
                      </div>

                      {/* Slot Selection */}
                      {selectedDoctor && selectedDate && (
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Available Slots</label>
                          {renderSlotSelectionContent()}
                        </div>
                      )}
                    </div>

                    {/* Reason */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Symptoms or Reason for Consultation</label>
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Please describe your health concern..."
                        rows={3}
                        className="w-full px-6 py-4 bg-white/40 backdrop-blur-md border border-white/60 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold text-slate-700 resize-none"
                        required
                      />
                    </div>

                    {/* Fee Summary */}
                    <div className="p-6 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                          <CreditCard className="text-emerald-600" size={20} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Consultation Fee</p>
                          <p className="text-xl font-black text-slate-800">Rs. 1,000</p>
                        </div>
                      </div>
                      <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest text-right max-w-[150px]">
                        Payment required after specialist approval
                      </p>
                    </div>

                    <div className="flex gap-4 pt-4">
                      <button
                        type="submit"
                        disabled={isSubmitting || !selectedSlot}
                        className="px-10 py-5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black shadow-2xl shadow-slate-900/20 transition-all active:scale-[0.98] disabled:opacity-50"
                      >
                        {isSubmitting ? 'Processing Request...' : 'Send Appointment Request'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowBookForm(false); resetBookingForm(); }}
                        className="px-10 py-5 bg-white/40 text-slate-600 border border-white/60 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/60 transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tabbed Appointments Section */}
          <div className="mb-12">
            {/* Tabs Navigation */}
            <div className="flex items-center gap-4 mb-8 flex-wrap">
              <button
                onClick={() => setActiveTab('confirmed')}
                className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === 'confirmed'
                    ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-600/20'
                    : 'bg-white/40 text-slate-600 border border-white/60 hover:bg-white/60'
                }`}
              >
                Confirmed
              </button>
              <button
                onClick={() => setActiveTab('requested')}
                className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === 'requested'
                    ? 'bg-amber-600 text-white shadow-xl shadow-amber-600/20'
                    : 'bg-white/40 text-slate-600 border border-white/60 hover:bg-white/60'
                }`}
              >
                Requested
              </button>
              <button
                onClick={() => setActiveTab('cancelled')}
                className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === 'cancelled'
                    ? 'bg-red-600 text-white shadow-xl shadow-red-600/20'
                    : 'bg-white/40 text-slate-600 border border-white/60 hover:bg-white/60'
                }`}
              >
                Cancelled
              </button>
              <button
                onClick={() => setActiveTab('completed')}
                className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === 'completed'
                    ? 'bg-teal-600 text-white shadow-xl shadow-teal-600/20'
                    : 'bg-white/40 text-slate-600 border border-white/60 hover:bg-white/60'
                }`}
              >
                Completed
              </button>
              <button
                onClick={() => setActiveTab('doctorRequests')}
                className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === 'doctorRequests'
                    ? 'bg-cyan-600 text-white shadow-xl shadow-cyan-600/20'
                    : 'bg-white/40 text-slate-600 border border-white/60 hover:bg-white/60'
                }`}
              >
                Doctor Requests
              </button>
              <button
                onClick={() => setActiveTab('rescheduling')}
                className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === 'rescheduling'
                    ? 'bg-sky-600 text-white shadow-xl shadow-blue-600/20'
                    : 'bg-white/40 text-slate-600 border border-white/60 hover:bg-white/60'
                }`}
              >
                Rescheduling
              </button>
              <button
                onClick={() => setActiveTab('past')}
                className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === 'past'
                    ? 'bg-purple-600 text-white shadow-xl shadow-purple-600/20'
                    : 'bg-white/40 text-slate-600 border border-white/60 hover:bg-white/60'
                }`}
              >
                Past
              </button>
            </div>

            {/* Appointments Content */}
            {isLoading ? (
              <div className="glass-card p-20 flex flex-col items-center justify-center border-white/40">
                <Spinner size="lg" message="Loading appointments..." />
              </div>
            ) : filteredAppointments.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title={`No ${activeTab} appointments`}
                message="Your schedule is clear"
              />
            ) : (
              <div className="space-y-6">
                {filteredAppointments.map((apt, i) => (
                  <motion.div
                    key={apt.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="glass-card p-8 border-white/60 bg-white/40 hover:bg-white/60 transition-all duration-500 relative"
                  >
                    {/* Status indicator bar */}
                    <div className={`absolute top-0 left-0 w-1.5 h-full ${
                      activeTab === 'confirmed' ? 'bg-emerald-500' :
                      activeTab === 'requested' ? 'bg-amber-500' :
                      activeTab === 'rescheduling' ? 'bg-cyan-500' :
                      activeTab === 'doctorRequests' ? 'bg-blue-500' :
                      activeTab === 'completed' ? 'bg-teal-500' :
                      activeTab === 'past' ? 'bg-purple-500' :
                      'bg-red-500'
                    }`} />

                    <div className="flex flex-col lg:flex-row gap-6">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl shadow-sm flex-shrink-0 ${
                        activeTab === 'confirmed' ? 'bg-emerald-100 text-emerald-700' :
                        activeTab === 'requested' ? 'bg-amber-100 text-amber-700' :
                        activeTab === 'rescheduling' ? 'bg-cyan-100 text-cyan-700' :
                        activeTab === 'doctorRequests' ? 'bg-blue-100 text-blue-700' :
                        activeTab === 'completed' ? 'bg-teal-100 text-teal-700' :
                        activeTab === 'past' ? 'bg-purple-100 text-purple-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {apt.doctorName?.charAt(0) || 'D'}
                      </div>

                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3 mb-4">
                          <h3 className="text-xl font-black text-slate-800 tracking-tight">
                            Dr. {apt.doctorName}
                          </h3>
                          <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${
                            apt.appointmentType === 'ONLINE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {apt.appointmentType}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {/* Status for Rescheduling Tab */}
                                                    {activeTab === 'rescheduling' && (
                                                      <div className="flex items-center gap-2 col-span-full">
                                                        <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${
                                                          apt.rescheduleRejected 
                                                            ? 'bg-red-100 text-red-700'
                                                            : 'bg-blue-100 text-blue-700'
                                                        }`}>
                                                          {apt.rescheduleRejected
                                                            ? 'Doctor Rejected - Action Required'
                                                            : apt.status === 'RESCHEDULE_REQUESTED' && apt.rescheduleRequestedBy === 'PATIENT'
                                                              ? 'In Progress (Waiting for Doctor Response)'
                                                              : apt.status === 'RESCHEDULE_REQUESTED' && apt.rescheduleRequestedBy === 'DOCTOR'
                                                                ? 'Doctor Requested Reschedule'
                                                                : 'Rescheduling'}
                                                        </span>
                                                      </div>
                                                    )}
                                                    {/* Reschedule Rejection Reason */}
                                                    {activeTab === 'rescheduling' && apt.rescheduleRejected && apt.rescheduleRejectionReason && (
                                                      <div className="col-span-full flex items-start gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-red-50 px-3 py-2 rounded-xl">
                                                        <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                                                        <div>
                                                          <p className="text-red-600 font-black">Doctor's Reason:</p>
                                                          <p className="text-slate-700 normal-case font-medium mt-1">{apt.rescheduleRejectionReason}</p>
                                                        </div>
                                                      </div>
                                                    )}
                                                    {/* Status for Past Tab */}
                                                    {activeTab === 'past' && (
                                                      <div className="flex items-center gap-2 col-span-full">
                                                        <span className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-purple-100 text-purple-700">
                                                          Past (Needs Action)
                                                        </span>
                                                      </div>
                                                    )}
                          <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-white/50 px-3 py-2 rounded-xl">
                            <Calendar size={14} className="text-emerald-500" />
                            {new Date(apt.appointmentDate).toLocaleDateString(undefined, {
                              month: 'short', day: 'numeric', year: 'numeric'
                            })}
                          </div>
                          <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-white/50 px-3 py-2 rounded-xl">
                            <Clock size={14} className="text-emerald-500" />
                            {apt.slotStartTime}
                          </div>

                          {/* Appointment Reason - Show for REQUESTED and RESCHEDULING tabs */}
                          {(activeTab === 'requested' || activeTab === 'rescheduling' || activeTab === 'doctorRequests') && apt.reason && (
                            <div className="col-span-full flex items-start gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-emerald-50 px-3 py-2 rounded-xl">
                              <AlertCircle size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-emerald-600 font-black">Reason:</p>
                                <p className="text-slate-700 normal-case font-medium mt-1">{apt.reason}</p>
                              </div>
                            </div>
                          )}

                          {/* Payment Status - Only for Confirmed Tab */}
                          {activeTab === 'confirmed' && (
                            <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest bg-white/50 px-3 py-2 rounded-xl">
                              <CreditCard size={14} className={apt.paymentStatus === 'PAID' ? 'text-emerald-500' : 'text-amber-500'} />
                              <span className={apt.paymentStatus === 'PAID' ? 'text-emerald-600' : 'text-amber-600'}>
                                {apt.paymentStatus === 'PAID' ? 'Paid' : 'Pending'}
                              </span>
                            </div>
                          )}

                          {/* Cancellation Reason - Only for Cancelled Tab */}
                          {activeTab === 'cancelled' && apt.cancellationReason && (
                            <div className="col-span-full flex items-start gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-red-50 px-3 py-2 rounded-xl">
                              <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                              <span className="text-red-600">{apt.cancellationReason}</span>
                            </div>
                          )}

                          {/* Reschedule Reason - For Doctor Requests Tab */}
                          {activeTab === 'doctorRequests' && apt.rescheduleReason && (
                            <div className="col-span-full flex items-start gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-cyan-50 px-3 py-2 rounded-xl">
                              <AlertCircle size={14} className="text-cyan-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-cyan-600 font-black">Doctor's Reason:</p>
                                <p className="text-slate-700 normal-case font-medium mt-1">{apt.rescheduleReason}</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Online Meeting Link */}
                        {apt.appointmentType === 'ONLINE' && apt.meetingLink && activeTab === 'confirmed' && apt.paymentStatus === 'PAID' && canShowVideoConsultation(apt) && (
                          <div className="mt-6">
                            <a href={apt.meetingLink} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-3 px-6 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
                            >
                              <Video size={14} /> Join Video Consultation
                            </a>
                          </div>
                        )}

                        {/* Pay Now Button */}
                        {activeTab === 'confirmed' && apt.paymentStatus !== 'PAID' && (
                          <div className="mt-6 p-6 bg-amber-50 rounded-2xl border border-amber-100 flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                                <CreditCard className="text-amber-600" size={20} />
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest leading-tight">Action Required</p>
                                <p className="text-sm font-bold text-slate-700 mt-1">Secure your appointment with payment</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handlePayNow(apt.id)}
                              disabled={isLoading}
                              className="w-full md:w-auto px-8 py-4 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 transition-all shadow-lg shadow-amber-600/20 active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                              <CreditCard size={14} />
                              {isLoading ? 'Processing...' : 'Pay Now'}
                            </button>
                          </div>
                        )}

                        {/* Action Buttons */}
                        {(activeTab === 'requested' || activeTab === 'confirmed' || activeTab === 'rescheduling' || activeTab === 'doctorRequests' || activeTab === 'past' || activeTab === 'completed') && (
                          <div className="mt-6 flex flex-wrap items-center gap-4">
                            {/* Past Appointments - Show prescription and instructions */}
                            {(activeTab === 'past' || activeTab === 'completed') && apt.status === 'COMPLETED' && 
                              typeof apt.prescription === 'object' &&
                              Array.isArray((apt.prescription as any).medications) &&
                              (apt.prescription as any).medications.length > 0 && (
                              <div className="w-full bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                                <h4 className="text-sm font-black text-emerald-800 uppercase tracking-widest mb-3">Prescription</h4>
                                <div className="space-y-3 mb-4">
                                  {(apt.prescription as any).medications.map((med: any, idx: number) => (
                                    <div key={idx} className="bg-white p-3 rounded-lg border border-emerald-100">
                                      <p className="font-semibold text-emerald-800">{med.name} - {med.dosage}</p>
                                      <p className="text-xs text-slate-600 mt-1">Frequency: {med.frequency} | Duration: {med.duration}</p>
                                      {med.instructions && <p className="text-xs text-slate-600 mt-1 italic">Instructions: {med.instructions}</p>}
                                    </div>
                                  ))}
                                </div>
                                {(apt.prescription as any).notes && (
                                  <>
                                    <h4 className="text-sm font-black text-emerald-800 uppercase tracking-widest mb-2">Follow-up Instructions</h4>
                                    <p className="text-sm text-slate-700">{(apt.prescription as any).notes}</p>
                                  </>
                                )}
                              </div>
                            )}

                            {/* Reschedule Button - For Doctor Requests tab, this shows the doctor's request */}
                            {activeTab === 'doctorRequests' ? (
                              apt.patientRespondedToDoctorReschedule ? (
                                <div className="flex flex-col items-start gap-2">
                                  <span className="px-6 py-3 bg-amber-100 text-amber-700 rounded-xl text-[10px] font-black uppercase tracking-widest">
                                    Reschedule Sent - Waiting for Doctor Response
                                  </span>
                                  <span className="text-[9px] text-slate-500 font-medium">
                                    Doctor will accept or propose another date
                                  </span>
                                </div>
                              ) : (
                                <button
                                  onClick={() => openRescheduleModal(apt)}
                                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20"
                                >
                                  Respond to Reschedule Request
                                </button>
                              )
                            ) : activeTab === 'rescheduling' && apt.rescheduleRequestedBy === 'PATIENT' && apt.rescheduleRejected ? (
                              /* Patient-initiated reschedule was rejected by doctor - show response options */
                              <div className="flex flex-col gap-4 w-full">
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                                  <p className="text-sm font-semibold text-red-800 mb-2">Doctor Rejected Your Reschedule Request</p>
                                  <p className="text-xs text-slate-600">Please choose how to proceed:</p>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                  <button
                                    onClick={() => {
                                      setAppointmentForRejectionResponse(apt);
                                      setRejectionResponseAction('keep_original');
                                      setShowRejectionResponseModal(true);
                                    }}
                                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-600/20"
                                  >
                                    Keep Original Slot
                                  </button>
                                  <button
                                    onClick={() => {
                                      setAppointmentForRejectionResponse(apt);
                                      setRejectionResponseAction('cancel');
                                      setShowRejectionResponseModal(true);
                                    }}
                                    className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-red-600/20"
                                  >
                                    Cancel (₹250 Deduction)
                                  </button>
                                </div>
                              </div>
                            ) : activeTab === 'rescheduling' && apt.rescheduleRequestedBy === 'PATIENT' && !apt.rescheduleRejected ? (
                              /* Patient-initiated reschedule waiting for doctor response */
                              <div className="flex flex-col items-start gap-2">
                                <span className="px-6 py-3 bg-blue-100 text-blue-700 rounded-xl text-[10px] font-black uppercase tracking-widest">
                                  Waiting for Doctor Response
                                </span>
                                <span className="text-[9px] text-slate-500 font-medium">
                                  Doctor will approve or reject your reschedule request
                                </span>
                              </div>
                            ) : (activeTab === 'confirmed' || (activeTab === 'rescheduling' && apt.rescheduleRequestedBy === 'DOCTOR')) && (
                              <button
                                onClick={() => openRescheduleModal(apt)}
                                className="px-6 py-3 bg-cyan-100 hover:bg-cyan-200 text-cyan-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                              >
                                {activeTab === 'rescheduling' ? 'Accept & Pick Time' : 'Reschedule'}
                              </button>
                            )}

                            {/* Cancel Button - Only show for non-past appointments */}
                            {activeTab !== 'past' && activeTab !== 'completed' && canCancelAppointment(apt) ? (
                              <button
                                onClick={() => {
                                  setAppointmentToCancel(apt);
                                  setCancelReason('');
                                  setShowCancelModal(true);
                                }}
                                className="px-6 py-3 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                              >
                                Cancel Appointment
                              </button>
                            ) : activeTab !== 'past' && activeTab !== 'completed' && !canCancelAppointment(apt) ? (
                              <button
                                disabled
                                title={getCancellationDisabledReason(apt)}
                                className="px-6 py-3 bg-slate-100 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest opacity-50 cursor-not-allowed"
                              >
                                Cannot Cancel
                              </button>
                            ) : null}
                            {!canCancelAppointment(apt) && activeTab === 'confirmed' && (
                              <span className="text-[9px] text-red-600 font-bold uppercase tracking-widest">
                                {getCancellationDisabledReason(apt)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-6 mt-12">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                      disabled={currentPage === 0}
                      className="px-6 py-3 bg-white/40 backdrop-blur-md rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 disabled:opacity-30 transition-all hover:bg-white/60"
                    >
                      Prev
                    </button>
                    <span className="text-slate-400 font-black text-[10px] uppercase tracking-[0.3em]">
                      {currentPage + 1} / {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                      disabled={currentPage >= totalPages - 1}
                      className="px-6 py-3 bg-white/40 backdrop-blur-md rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 disabled:opacity-30 transition-all hover:bg-white/60"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reschedule Modal */}
      <AnimatePresence>
        {showRescheduleModal && appointmentToReschedule && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-card p-10 max-w-lg w-full border-white/60 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Reschedule Appointment</h2>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
                    Dr. {appointmentToReschedule.doctorName}
                  </p>
                </div>
                <button onClick={() => setShowRescheduleModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              {appointmentToReschedule.status === 'RESCHEDULE_REQUESTED' && (
                <div className="mb-6 p-4 bg-cyan-50 border border-cyan-100 rounded-2xl">
                  <p className="text-[10px] font-black text-cyan-800 uppercase tracking-widest mb-1">Doctor Request</p>
                  <p className="text-sm font-bold text-slate-700">The doctor requested a reschedule. Pick a new time below. (Free of charge)</p>
                </div>
              )}

              <form onSubmit={handleRescheduleSubmit} className="space-y-6">
                {/* Date Selection */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">New Date</label>
                  <input
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    min={minBookingDate}
                    max={maxBookingDate}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold text-slate-700"
                    required
                  />
                  {rescheduleDate && (new Date(rescheduleDate).getDay() === 0 || new Date(rescheduleDate).getDay() === 6) && (
                    <div className="mt-3 p-3 bg-red-100 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 animate-pulse">
                      <AlertCircle size={16} />
                      <span className="text-xs font-black uppercase tracking-widest">Weekends are unavailable</span>
                    </div>
                  )}
                </div>

                {/* Slot Selection */}
                {rescheduleDate && (
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Available Slots</label>
                    {isLoadingRescheduleSlots ? (
                      <div className="flex items-center gap-3 text-emerald-600 font-bold text-xs uppercase tracking-widest">
                        <Spinner size="sm" /> Loading Slots...
                      </div>
                    ) : rescheduleAvailableSlots.length === 0 ? (
                      <p className="text-red-500 text-[10px] font-black uppercase tracking-[0.2em]">No slots available</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {rescheduleAvailableSlots
                          .filter((slot) => slot.time !== appointmentToReschedule.slotStartTime)
                          .map((slot) => (
                            <button
                              key={slot.time}
                              type="button"
                              onClick={() => setRescheduleSlot(slot.time)}
                              className={`py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${
                                rescheduleSlot === slot.time
                                  ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/20'
                                  : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-white'
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
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Reason</label>
                  <textarea
                    value={rescheduleReason}
                    onChange={(e) => setRescheduleReason(e.target.value)}
                    placeholder="Why do you need to reschedule?"
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all font-bold text-slate-700 min-h-[100px] resize-none"
                    required
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="submit"
                    disabled={isSubmitting || !rescheduleSlot}
                    className="flex-1 px-6 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black shadow-xl shadow-slate-900/20 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {isSubmitting ? 'Confirming...' : 'Confirm Reschedule'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRescheduleModal(false)}
                    className="flex-1 px-6 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Doctor Cancelled Reschedule Modal - Only for rescheduling tab */}
      <AnimatePresence>
        {activeTab === 'rescheduling' && showDocCancelledModal && appointmentWithDocCancel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-card p-10 max-w-lg w-full border-white/60 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Action Required</h2>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
                    {appointmentWithDocCancel?.doctorCancelledRescheduleRequest ? 'Doctor Cancelled Reschedule' : 'Doctor Reschedule Request'}
                  </p>
                </div>
                <button onClick={() => setShowDocCancelledModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              {appointmentWithDocCancel?.doctorCancelledRescheduleRequest ? (
                // Doctor cancelled reschedule request - old logic
                <>
                  <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl">
                    <p className="text-[10px] font-black text-red-800 uppercase tracking-widest mb-2">Reschedule Cancelled</p>
                    <p className="text-sm font-bold text-slate-700 mb-2">
                      Dr. {appointmentWithDocCancel.doctorName} cancelled the reschedule request.
                    </p>
                    <p className="text-xs text-slate-600">
                      <strong>Reason:</strong> {appointmentWithDocCancel.doctorCancellationReason}
                    </p>
                  </div>

                  <div className="mb-8 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">Original Appointment</p>
                    <div className="space-y-2 text-sm font-bold text-slate-700">
                      <p>📅 {new Date(appointmentWithDocCancel.appointmentDate).toDateString()}</p>
                      <p>🕐 {appointmentWithDocCancel.slotStartTime} - {appointmentWithDocCancel.slotEndTime}</p>
                      {appointmentWithDocCancel.paymentStatus === 'PAID' && (
                        <p className="text-emerald-600">💰 Paid: Rs. 1,000</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                // Doctor requested reschedule - new logic
                <>
                  <div className="mb-6 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                    <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-2">Reschedule Request</p>
                    <p className="text-sm font-bold text-slate-700 mb-2">
                      Dr. {appointmentWithDocCancel.doctorName} has requested to reschedule your appointment.
                    </p>
                    <p className="text-xs text-slate-600">
                      <strong>Reason:</strong> {appointmentWithDocCancel.rescheduleReason || 'Not provided'}
                    </p>
                  </div>

                  <div className="mb-8 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">Original Appointment</p>
                    <div className="space-y-2 text-sm font-bold text-slate-700">
                      <p>📅 {new Date(appointmentWithDocCancel.appointmentDate).toDateString()}</p>
                      <p>🕐 {appointmentWithDocCancel.slotStartTime} - {appointmentWithDocCancel.slotEndTime}</p>
                      {appointmentWithDocCancel.paymentStatus === 'PAID' && (
                        <p className="text-emerald-600">💰 Paid: Rs. 1,000</p>
                      )}
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-4 mb-8">
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Choose an option:</p>
                
                {/* Option 1: Keep */}
                <div className="p-4 border-2 border-emerald-200 rounded-2xl bg-emerald-50 cursor-pointer hover:bg-emerald-100 transition-colors">
                  <button
                    onClick={() => handleDocCancelledRescheduleResponse('keep')}
                    disabled={isProcessingDocCancel}
                    className="w-full text-left disabled:opacity-50"
                  >
                    <p className="font-black text-emerald-700 mb-2">
                      {appointmentWithDocCancel?.doctorCancelledRescheduleRequest ? '✓ Keep Original Slot' : '✓ Keep Original Appointment'}
                    </p>
                    <p className="text-xs text-emerald-600">
                      {appointmentWithDocCancel?.doctorCancelledRescheduleRequest 
                        ? 'Confirm your appointment for the original date and time. No changes will be made.'
                        : 'Decline the reschedule request and keep your current appointment as is.'}
                    </p>
                  </button>
                </div>

                {/* Option 2: Cancel */}
                <div className="p-4 border-2 border-red-200 rounded-2xl bg-red-50 cursor-pointer hover:bg-red-100 transition-colors">
                  <p className="font-black text-red-700 mb-2">
                    {appointmentWithDocCancel?.doctorCancelledRescheduleRequest ? '✕ Cancel Completely' : '✕ Cancel Appointment'}
                  </p>
                  <p className="text-xs text-red-600 mb-3">
                    {appointmentWithDocCancel?.doctorCancelledRescheduleRequest
                      ? (appointmentWithDocCancel.paymentStatus === 'PAID'
                        ? 'Appointment will be cancelled. Refund: Rs. 750 (Deduction: Rs. 250)'
                        : 'Appointment will be cancelled.')
                      : (appointmentWithDocCancel.paymentStatus === 'PAID'
                        ? 'The appointment will be cancelled. You will receive a refund with deduction of Rs. 250.'
                        : 'The appointment will be cancelled.')}
                  </p>
                  {appointmentWithDocCancel?.paymentStatus === 'PAID' && (
                    <div className="mb-3">
                      <label className="block text-[10px] font-black text-red-700 uppercase tracking-widest mb-2">Reason (optional)</label>
                      <textarea
                        value={docCancelReason}
                        onChange={(e) => setDocCancelReason(e.target.value)}
                        placeholder="Why are you cancelling?"
                        className="w-full px-3 py-2 bg-white border border-red-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-xs font-bold resize-none"
                        rows={2}
                      />
                    </div>
                  )}
                  <button
                    onClick={() => handleDocCancelledRescheduleResponse('cancel')}
                    disabled={isProcessingDocCancel}
                    className="w-full px-4 py-2 bg-red-600 text-white text-xs font-black rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {isProcessingDocCancel ? 'Processing...' : 'Confirm ' + (appointmentWithDocCancel?.doctorCancelledRescheduleRequest ? 'Cancellation' : 'Cancellation')}
                  </button>
                </div>
              </div>

              <button
                onClick={() => setShowDocCancelledModal(false)}
                disabled={isProcessingDocCancel}
                className="w-full px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-50"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rejection Response Modal */}
      <AnimatePresence>
        {showRejectionResponseModal && appointmentForRejectionResponse && rejectionResponseAction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-card p-10 max-w-md w-full border-white/60 shadow-2xl"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight uppercase">
                    {rejectionResponseAction === 'keep_original' ? 'Keep Original Slot' : 'Cancel Appointment'}
                  </h3>
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">
                    With Dr. {appointmentForRejectionResponse.doctorName}
                  </p>
                </div>
                <button 
                  onClick={() => { 
                    setShowRejectionResponseModal(false); 
                    setAppointmentForRejectionResponse(null); 
                    setRejectionResponseAction(null); 
                  }} 
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              {rejectionResponseAction === 'keep_original' ? (
                <div className="mb-6 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <p className="text-sm font-bold text-emerald-700 mb-2">Restore Original Appointment</p>
                  <p className="text-xs text-slate-600">
                    Your appointment will be restored to its original confirmed slot:
                  </p>
                  <div className="mt-3 p-3 bg-white rounded-xl">
                    <p className="text-sm font-semibold text-slate-800">
                      {new Date(appointmentForRejectionResponse.appointmentDate).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                    <p className="text-xs text-slate-500">
                      Time: {appointmentForRejectionResponse.slotStartTime} - {appointmentForRejectionResponse.slotEndTime}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mb-6 p-4 bg-red-50 rounded-2xl border border-red-100">
                  <p className="text-sm font-bold text-red-700 mb-2">Cancel & Refund</p>
                  <p className="text-xs text-slate-600 mb-3">
                    Since you initiated the reschedule request, a ₹250 processing fee will be deducted.
                  </p>
                  <div className="bg-white rounded-xl p-3 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Original Payment:</span>
                      <span className="font-semibold">₹1,000</span>
                    </div>
                    <div className="flex justify-between text-sm text-red-600">
                      <span>Processing Fee:</span>
                      <span className="font-semibold">-₹250</span>
                    </div>
                    <hr className="my-2" />
                    <div className="flex justify-between text-sm font-bold text-emerald-700">
                      <span>Refund Amount:</span>
                      <span>₹750</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleRejectionResponse}
                  disabled={isProcessingRejectionResponse}
                  className={`flex-1 px-6 py-4 ${
                    rejectionResponseAction === 'keep_original' 
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20' 
                      : 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
                  } disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-[0.98]`}
                >
                  {isProcessingRejectionResponse 
                    ? 'Processing...' 
                    : rejectionResponseAction === 'keep_original' 
                      ? 'Confirm Keep Original' 
                      : 'Confirm Cancellation'
                  }
                </button>
                <button
                  onClick={() => { 
                    setShowRejectionResponseModal(false); 
                    setAppointmentForRejectionResponse(null); 
                    setRejectionResponseAction(null); 
                  }}
                  className="flex-1 px-6 py-4 bg-white/40 text-slate-600 border border-white/60 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/60 transition-all"
                >
                  Go Back
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel Appointment Modal */}
      <AnimatePresence>
        {showCancelModal && appointmentToCancel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-card p-10 max-w-md w-full border-white/60 shadow-2xl"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Cancel Appointment</h3>
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">With Dr. {appointmentToCancel.doctorName}</p>
                </div>
                <button onClick={() => { setShowCancelModal(false); setAppointmentToCancel(null); setCancelReason(''); }} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="mb-6 p-4 bg-red-50 rounded-2xl border border-red-100">
                <p className="text-[10px] font-bold text-red-700 uppercase tracking-widest">
                  ⚠ This action cannot be undone
                </p>
                {/* Refund info for reschedule cancellation */}
                {appointmentToCancel && appointmentToCancel.status === 'RESCHEDULE_REQUESTED' && appointmentToCancel.paymentStatus === 'PAID' && (
                  appointmentToCancel.rescheduleRequestedBy === 'PATIENT' ? (
                    <p className="mt-2 text-xs text-red-600 font-bold">
                      Refund: Rs. 750 (Deduction: Rs. 250 for cancellation)
                    </p>
                  ) : appointmentToCancel.rescheduleRequestedBy === 'DOCTOR' ? (
                    <p className="mt-2 text-xs text-emerald-600 font-bold">
                      Full refund: Rs. 1,000 (Doctor requested reschedule)
                    </p>
                  ) : null
                )}
              </div>

              <div className="space-y-4 mb-8">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  Cancellation Reason
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Please explain why you're cancelling this appointment..."
                  rows={4}
                  className="w-full px-6 py-4 bg-white/40 backdrop-blur-md border border-white/60 rounded-2xl focus:outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-500 transition-all font-bold text-slate-700 resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCancelAppointment}
                  disabled={isCancelling || !cancelReason.trim()}
                  className="flex-1 px-6 py-4 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-red-600/20 active:scale-[0.98]"
                >
                  {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
                <button
                  onClick={() => { setShowCancelModal(false); setAppointmentToCancel(null); setCancelReason(''); }}
                  className="flex-1 px-6 py-4 bg-white/40 text-slate-600 border border-white/60 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/60 transition-all"
                >
                  Keep Appointment
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ProtectedLayout>
  );
}