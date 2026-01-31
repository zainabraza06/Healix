'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import ProtectedLayout from '@/components/ProtectedLayout';
import toast from 'react-hot-toast';
import { Calendar, Clock, CheckCircle, Trash2, Edit3, X, Activity, DollarSign } from 'lucide-react';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';

// 3D Background
const Scene = dynamic(() => import('@/components/canvas/Scene'), { ssr: false });
const FloatingIcons = dynamic(() => import('@/components/canvas/FloatingIcons'), { ssr: false });

export default function DoctorAppointmentsPage() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [reschedulingRequests, setReschedulingRequests] = useState<any[]>([]);
  const [completedAppointments, setCompletedAppointments] = useState<any[]>([]);
  const [cancelledAppointments, setCancelledAppointments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'requests' | 'upcoming' | 'rescheduling' | 'completed' | 'cancelled'>('requests');
  const [showRescheduleForm, setShowRescheduleForm] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [showEmergencyRescheduleModal, setShowEmergencyRescheduleModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rescheduleReason, setRescheduleReason] = useState('');

  // Pagination state
  const [requestsPage, setRequestsPage] = useState(0);
  const [requestsTotalPages, setRequestsTotalPages] = useState(0);
  const [appointmentsPage, setAppointmentsPage] = useState(0);
  const [appointmentsTotalPages, setAppointmentsTotalPages] = useState(0);
  const [reschedulingPage, setReschedulingPage] = useState(0);
  const [reschedulingTotalPages, setReschedulingTotalPages] = useState(0);
  const [completedPage, setCompletedPage] = useState(0);
  const [completedTotalPages, setCompletedTotalPages] = useState(0);
  const [cancelledPage, setCancelledPage] = useState(0);
  const [cancelledTotalPages, setCancelledTotalPages] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    fetchData();
  }, [requestsPage, appointmentsPage, reschedulingPage, completedPage, cancelledPage]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [requestsRes, appointmentsRes, reschedulingRes, completedRes, cancelledRes] = await Promise.all([
        apiClient.getAppointmentRequests(requestsPage, pageSize),
        apiClient.getDoctorAppointments('CONFIRMED', undefined, appointmentsPage, pageSize),
        apiClient.getDoctorAppointments('RESCHEDULE_REQUESTED', undefined, reschedulingPage, pageSize),
        apiClient.getDoctorAppointments('COMPLETED', undefined, completedPage, pageSize),
        apiClient.getDoctorAppointments('CANCELLED', undefined, cancelledPage, pageSize),
      ]);

      if (requestsRes.success) {
        setRequests(requestsRes.data?.content || []);
        setRequestsTotalPages(requestsRes.data?.totalPages || 0);
      }
      if (appointmentsRes.success) {
        setAppointments(appointmentsRes.data?.content || []);
        setAppointmentsTotalPages(appointmentsRes.data?.totalPages || 0);
      }
      if (reschedulingRes.success) {
        setReschedulingRequests(reschedulingRes.data?.content || []);
        setReschedulingTotalPages(reschedulingRes.data?.totalPages || 0);
      }
      if (completedRes.success) {
        setCompletedAppointments(completedRes.data?.content || []);
        setCompletedTotalPages(completedRes.data?.totalPages || 0);
      }
      if (cancelledRes.success) {
        setCancelledAppointments(cancelledRes.data?.content || []);
        setCancelledTotalPages(cancelledRes.data?.totalPages || 0);
      }
    } catch (err) {
      setError('Failed to load appointments');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmAppointment = async (apt: any) => {
    if (apt.appointmentType === 'ONLINE') {
      setSelectedAppointment(apt);
      setMeetingLink('');
      setShowConfirmModal(true);
    } else {
      confirmAction(apt.id);
    }
  };

  const confirmAction = async (appointmentId: string, link?: string) => {
    try {
      setIsSubmitting(true);
      const response = await apiClient.confirmAppointment(appointmentId, link);
      if (response.success) {
        toast.success('Appointment confirmed!');
        setShowConfirmModal(false);
        fetchData();
      } else {
        toast.error(response.message || 'Failed to confirm appointment');
      }
    } catch (err) {
      toast.error('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeclineRequest = async () => {
    if (!declineReason.trim()) {
      toast.error('Please provide a reason for declining');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await apiClient.cancelAppointment(selectedAppointment.id, declineReason.trim());
      if (response.success) {
        toast.success('Request declined successfully');
        setShowDeclineModal(false);
        setDeclineReason('');
        setSelectedAppointment(null);
        fetchData();
      } else {
        toast.error(response.message || 'Failed to decline');
      }
    } catch (err) {
      toast.error('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    if (confirm('Are you sure you want to cancel this confirmed appointment?')) {
      try {
        const response = await apiClient.cancelAppointment(appointmentId, 'Cancelled by doctor');
        if (response.success) {
          toast.success('Appointment cancelled');
          fetchData();
        } else {
          toast.error(response.message || 'Failed to cancel');
        }
      } catch (err: any) {
        if (err.response?.data?.canRequestEmergencyReschedule) {
          // Show emergency modal
          const apt = appointments.find(a => a.id === appointmentId);
          setSelectedAppointment(apt);
          setRescheduleReason('');
          setShowEmergencyRescheduleModal(true);
          return;
        }
        toast.error(err.response?.data?.message || 'An error occurred');
      }
    }
  };

  const handleEmergencyRescheduleSubmit = async () => {
    if (!selectedAppointment || !rescheduleReason.trim()) {
      toast.error('Please provide a reason');
      return;
    }
    try {
      setIsSubmitting(true);
      const response = await apiClient.requestDoctorEmergencyReschedule(selectedAppointment.id, rescheduleReason);
      if (response.success) {
        toast.success('Emergency reschedule request sent to Admin');
        setShowEmergencyRescheduleModal(false);
        setRescheduleReason('');
        setSelectedAppointment(null);
      } else {
        toast.error(response.message || 'Failed to submit request');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppointment || !rescheduleReason) return;

    try {
      setIsSubmitting(true);
      const response = await apiClient.requestReschedule(
        selectedAppointment.id,
        rescheduleReason
      );

      if (response.success) {
        toast.success('Reschedule request sent to patient');
        setShowRescheduleForm(false);
        setRescheduleReason('');
        setSelectedAppointment(null);
        fetchData();
      } else {
        toast.error(response.message || 'Failed to request reschedule');
      }
    } catch (err) {
      toast.error('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ProtectedLayout allowedRoles={['DOCTOR']}>
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
            className="mb-12"
          >
            <h1 className="text-6xl font-black text-slate-800 tracking-tighter leading-none mb-4">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">Appointments</span>
            </h1>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              Manage and reschedule patient consultations
            </p>
          </motion.div>

          {/* Tabs */}
          <div className="flex gap-2 mb-10 p-2 bg-white/20 backdrop-blur-md rounded-2xl border border-white/40 overflow-x-auto">
            <button
              onClick={() => { setActiveTab('requests'); setRequestsPage(0); }}
              className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'requests'
                ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/10'
                : 'bg-transparent text-slate-600 hover:bg-white/40'
                }`}
            >
              Requests ({requests.length})
            </button>
            <button
              onClick={() => { setActiveTab('upcoming'); setAppointmentsPage(0); }}
              className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'upcoming'
                ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-600/10'
                : 'bg-transparent text-slate-600 hover:bg-white/40'
                }`}
            >
              Upcoming ({appointments.length})
            </button>
            <button
              onClick={() => { setActiveTab('rescheduling'); setReschedulingPage(0); }}
              className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'rescheduling'
                ? 'bg-cyan-600 text-white shadow-xl shadow-cyan-600/10'
                : 'bg-transparent text-slate-600 hover:bg-white/40'
                }`}
            >
              Rescheduling ({reschedulingRequests.length})
            </button>
            <button
              onClick={() => { setActiveTab('completed'); setCompletedPage(0); }}
              className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'completed'
                ? 'bg-teal-600 text-white shadow-xl shadow-teal-600/10'
                : 'bg-transparent text-slate-600 hover:bg-white/40'
                }`}
            >
              Completed ({completedAppointments.length})
            </button>
            <button
              onClick={() => { setActiveTab('cancelled'); setCancelledPage(0); }}
              className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'cancelled'
                ? 'bg-red-600 text-white shadow-xl shadow-red-600/10'
                : 'bg-transparent text-slate-600 hover:bg-white/40'
                }`}
            >
              Cancelled ({cancelledAppointments.length})
            </button>
          </div>

          {/* Reschedule Form Modal */}
          <AnimatePresence>
            {showRescheduleForm && selectedAppointment && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="glass-card p-10 max-w-md w-full border-white/60 shadow-2xl"
                >
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Reschedule</h2>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Patient: {selectedAppointment.patientName}</p>
                    </div>
                    <button onClick={() => setShowRescheduleForm(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                      <X size={20} className="text-slate-400" />
                    </button>
                  </div>

                  <form onSubmit={handleReschedule} className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">
                        Reason for Rescheduling
                      </label>
                      <textarea
                        value={rescheduleReason}
                        onChange={(e) => setRescheduleReason(e.target.value)}
                        placeholder="e.g., Clinical emergency, schedule adjustment..."
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold text-slate-700 min-h-[100px] resize-none"
                        required
                      />
                    </div>
                    <div className="flex gap-3 pt-6">
                      <button
                        type="button"
                        onClick={() => setShowRescheduleForm(false)}
                        className="flex-1 px-6 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-[0.98]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 px-6 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black shadow-xl shadow-slate-900/20 transition-all active:scale-[0.98]"
                      >
                        {isSubmitting ? 'Rescheduling...' : 'Request Reschedule'}
                      </button>
                    </div>
                  </form>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Emergency Reschedule Modal */}
          <AnimatePresence>
            {showEmergencyRescheduleModal && selectedAppointment && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="glass-card p-10 max-w-md w-full border-red-500/30 shadow-2xl bg-red-50/10"
                >
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h2 className="text-2xl font-black text-red-600 tracking-tight uppercase">Emergency Reschedule</h2>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Less than 24h remaining</p>
                    </div>
                    <button onClick={() => setShowEmergencyRescheduleModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                      <X size={20} className="text-slate-400" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="p-4 bg-red-100 rounded-2xl border border-red-200">
                      <p className="text-xs font-bold text-red-800">
                        Direct cancellation is not allowed within 24 hours. You can request an emergency reschedule, which requires Admin approval.
                      </p>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">
                        Reason for Emergency
                      </label>
                      <textarea
                        value={rescheduleReason}
                        onChange={(e) => setRescheduleReason(e.target.value)}
                        placeholder="Explain the emergency situation..."
                        className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-500 transition-all font-bold text-slate-700 min-h-[120px] resize-none"
                        required
                      />
                    </div>
                    <div className="flex gap-3 pt-6">
                      <button
                        type="button"
                        onClick={() => setShowEmergencyRescheduleModal(false)}
                        className="flex-1 px-6 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-[0.98]"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleEmergencyRescheduleSubmit}
                        disabled={isSubmitting || !rescheduleReason.trim()}
                        className="flex-1 px-6 py-4 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 shadow-xl shadow-red-600/20 transition-all active:scale-[0.98]"
                      >
                        {isSubmitting ? 'Requesting...' : 'Request Admin'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Decline Request Modal */}
          <AnimatePresence>
            {showDeclineModal && selectedAppointment && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="glass-card p-10 max-w-md w-full border-white/60 shadow-2xl"
                >
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Decline Request</h2>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Patient: {selectedAppointment.patientName}</p>
                    </div>
                    <button onClick={() => setShowDeclineModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                      <X size={20} className="text-slate-400" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">
                        Reason for Declining
                      </label>
                      <textarea
                        value={declineReason}
                        onChange={(e) => setDeclineReason(e.target.value)}
                        placeholder="e.g., Scheduling conflict, referred to specialist..."
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-500 transition-all font-bold text-slate-700 min-h-[120px] resize-none"
                        required
                      />
                    </div>
                    <div className="flex gap-3 pt-6">
                      <button
                        type="button"
                        onClick={() => setShowDeclineModal(false)}
                        className="flex-1 px-6 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-[0.98]"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeclineRequest}
                        disabled={isSubmitting || !declineReason.trim()}
                        className="flex-1 px-6 py-4 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 shadow-xl shadow-red-600/20 transition-all active:scale-[0.98]"
                      >
                        {isSubmitting ? 'Declining...' : 'Decline'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Confirm Appointment Modal (Online) */}
          <AnimatePresence>
            {showConfirmModal && selectedAppointment && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="glass-card p-10 max-w-md w-full border-white/60 shadow-2xl"
                >
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Confirm Online Consultation</h2>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Patient: {selectedAppointment.patientName}</p>
                    </div>
                    <button onClick={() => setShowConfirmModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                      <X size={20} className="text-slate-400" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                      <p className="text-xs font-bold text-emerald-800 leading-relaxed uppercase tracking-tighter">
                        This is an online appointment. A meeting link is required for the patient to join.
                      </p>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">
                        Meeting Link (Zoom, Google Meet, etc.)
                      </label>
                      <input
                        type="url"
                        value={meetingLink}
                        onChange={(e) => setMeetingLink(e.target.value)}
                        placeholder="https://meet.google.com/..."
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold text-slate-700"
                        required
                      />
                    </div>

                    <div className="flex gap-3 pt-6">
                      <button
                        type="button"
                        onClick={() => setShowConfirmModal(false)}
                        className="flex-1 px-6 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-[0.98]"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => confirmAction(selectedAppointment.id, meetingLink)}
                        disabled={isSubmitting || !meetingLink.trim()}
                        className="flex-1 px-6 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 shadow-xl shadow-emerald-600/20 transition-all active:scale-[0.98]"
                      >
                        {isSubmitting ? 'Confirming...' : 'Confirm'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {isLoading ? (
                <div className="glass-card p-20 flex flex-col items-center justify-center border-white/40">
                  <Spinner size="lg" message="Synchronizing appointments..." />
                </div>
              ) : activeTab === 'requests' ? (
                <>
                  {requests.length === 0 ? (
                    <EmptyState
                      icon={CheckCircle}
                      title="No pending requests"
                    />
                  ) : (
                    <div className="grid grid-cols-1 gap-6">
                      {requests.map((req, i) => (
                        <motion.div
                          key={req.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="glass-card p-8 border-white/40 bg-white/40 group hover:bg-white/60 transition-all duration-300"
                        >
                          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                            <div className="flex items-center gap-6">
                              <div className="w-16 h-16 bg-gradient-to-br from-amber-100 to-orange-100 rounded-2xl flex items-center justify-center text-amber-700 font-black text-2xl group-hover:scale-110 transition-transform duration-500 shadow-sm">
                                {req.patientName?.charAt(0) || 'P'}
                              </div>
                              <div>
                                <h3 className="text-xl font-black text-slate-800 mb-2 tracking-tight">
                                  {req.patientName || 'Unknown Patient'}
                                </h3>
                                <div className="flex flex-wrap items-center gap-4">
                                  <span className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest bg-white/50 px-3 py-1.5 rounded-xl">
                                    <Calendar size={14} className="text-amber-600" />
                                    {new Date(req.appointmentDate).toLocaleDateString()}
                                  </span>
                                  <span className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest bg-white/50 px-3 py-1.5 rounded-xl">
                                    <Clock size={14} className="text-amber-600" />
                                    {req.slotStartTime}
                                  </span>
                                  {req.type && (
                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">{req.type}</span>
                                  )}
                                </div>
                                {req.reason && (
                                  <p className="mt-4 text-xs font-bold text-slate-400 uppercase tracking-wide leading-relaxed">
                                    Reason: <span className="text-slate-600 normal-case font-medium">{req.reason}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-3 w-full md:w-auto">
                              <button
                                onClick={() => handleConfirmAppointment(req)}
                                className="flex-1 md:flex-none px-8 py-3.5 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 shadow-xl shadow-emerald-600/20 transition-all active:scale-[0.98]"
                              >
                                {isSubmitting && selectedAppointment?.id === req.id ? '...' : 'Confirm'}
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedAppointment(req);
                                  setDeclineReason('');
                                  setShowDeclineModal(true);
                                }}
                                className="flex-1 md:flex-none px-8 py-3.5 bg-white/60 text-slate-600 border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-all active:scale-[0.98]"
                              >
                                Decline
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {!isLoading && requests.length > 0 && requestsTotalPages > 1 && (
                    <div className="flex justify-center items-center gap-6 mt-12">
                      <button
                        onClick={() => setRequestsPage(prev => Math.max(0, prev - 1))}
                        disabled={requestsPage === 0}
                        className="px-6 py-3 bg-white/40 backdrop-blur-md rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 disabled:opacity-30 transition-all hover:bg-white/60"
                      >
                        Prev
                      </button>
                      <span className="text-slate-400 font-black text-[10px] uppercase tracking-[0.3em]">
                        Page {requestsPage + 1} / {requestsTotalPages}
                      </span>
                      <button
                        onClick={() => setRequestsPage(prev => Math.min(requestsTotalPages - 1, prev + 1))}
                        disabled={requestsPage >= requestsTotalPages - 1}
                        className="px-6 py-3 bg-white/40 backdrop-blur-md rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 disabled:opacity-30 transition-all hover:bg-white/60"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              ) : activeTab === 'upcoming' ? (
                <>
                  {appointments.length === 0 ? (
                    <div className="glass-card p-20 text-center border-white/40">
                      <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Calendar size={40} className="text-slate-300" />
                      </div>
                      <p className="text-slate-400 font-black uppercase tracking-widest text-xs">No upcoming appointments</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-6">
                      {appointments.map((apt, i) => (
                        <motion.div
                          key={apt.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="glass-card p-8 border-white/40 bg-white/40 group hover:bg-white/60 transition-all duration-300"
                        >
                          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                            <div className="flex items-center gap-6">
                              <div className="w-16 h-16 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-2xl flex items-center justify-center text-emerald-700 font-black text-2xl group-hover:scale-110 transition-transform duration-500 shadow-sm">
                                {apt.patientName?.charAt(0) || 'P'}
                              </div>
                              <div>
                                <h3 className="text-xl font-black text-slate-800 mb-2 tracking-tight">
                                  {apt.patientName || 'Unknown Patient'}
                                </h3>
                                <div className="flex flex-wrap items-center gap-4">
                                  <span className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest bg-white/50 px-3 py-1.5 rounded-xl">
                                    <Calendar size={14} className="text-emerald-600" />
                                    {new Date(apt.appointmentDate).toLocaleDateString()}
                                  </span>
                                  <span className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest bg-white/50 px-3 py-1.5 rounded-xl">
                                    <Clock size={14} className="text-emerald-600" />
                                    {apt.slotStartTime}
                                  </span>
                                  <span className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl ${apt.paymentStatus === 'PAID'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-amber-100 text-amber-700'
                                    }`}>
                                    <DollarSign size={14} />
                                    {apt.paymentStatus || 'PENDING'}
                                  </span>
                                </div>
                                {apt.reason && (
                                  <p className="mt-4 text-xs font-bold text-slate-400 uppercase tracking-wide leading-relaxed">
                                    Condition: <span className="text-slate-600 normal-case font-medium">{apt.reason}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-3 w-full md:w-auto">
                              <button
                                onClick={() => {
                                  setSelectedAppointment(apt);
                                  setShowRescheduleForm(true);
                                }}
                                className="flex-1 md:flex-none px-8 py-3.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black shadow-xl shadow-slate-900/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                              >
                                <Edit3 size={14} />
                                Reschedule
                              </button>
                              {apt.paymentStatus !== 'PAID' && (
                                <button
                                  onClick={() => handleCancelAppointment(apt.id)}
                                  className="flex-1 md:flex-none px-8 py-3.5 bg-white/60 text-slate-600 border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                  <Trash2 size={14} />
                                  Cancel
                                </button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {!isLoading && appointments.length > 0 && appointmentsTotalPages > 1 && (
                    <div className="flex justify-center items-center gap-6 mt-12">
                      <button
                        onClick={() => setAppointmentsPage(prev => Math.max(0, prev - 1))}
                        disabled={appointmentsPage === 0}
                        className="px-6 py-3 bg-white/40 backdrop-blur-md rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 disabled:opacity-30 transition-all hover:bg-white/60"
                      >
                        Prev
                      </button>
                      <span className="text-slate-400 font-black text-[10px] uppercase tracking-[0.3em]">
                        Page {appointmentsPage + 1} / {appointmentsTotalPages}
                      </span>
                      <button
                        onClick={() => setAppointmentsPage(prev => Math.min(appointmentsTotalPages - 1, prev + 1))}
                        disabled={appointmentsPage >= appointmentsTotalPages - 1}
                        className="px-6 py-3 bg-white/40 backdrop-blur-md rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 disabled:opacity-30 transition-all hover:bg-white/60"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              ) : activeTab === 'rescheduling' ? (
                <>
                  {reschedulingRequests.length === 0 ? (
                    <EmptyState
                      icon={Edit3}
                      title="No rescheduling requests"
                    />
                  ) : (
                    <div className="grid grid-cols-1 gap-6">
                      {reschedulingRequests.map((req, i) => (
                        <motion.div
                          key={req.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="glass-card p-8 border-white/40 bg-cyan-50/40 group hover:bg-cyan-50/60 transition-all duration-300"
                        >
                          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                            <div className="flex items-center gap-6">
                              <div className="w-16 h-16 bg-gradient-to-br from-cyan-100 to-blue-100 rounded-2xl flex items-center justify-center text-cyan-700 font-black text-2xl group-hover:scale-110 transition-transform duration-500 shadow-sm">
                                {req.patientName?.charAt(0) || 'P'}
                              </div>
                              <div>
                                <h3 className="text-xl font-black text-slate-800 mb-2 tracking-tight">
                                  {req.patientName || 'Unknown Patient'}
                                </h3>
                                <div className="flex flex-wrap items-center gap-4">
                                  <span className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest bg-white/50 px-3 py-1.5 rounded-xl">
                                    <Calendar size={14} className="text-cyan-600" />
                                    {new Date(req.appointmentDate).toLocaleDateString()}
                                  </span>
                                  <span className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest bg-white/50 px-3 py-1.5 rounded-xl">
                                    <Clock size={14} className="text-cyan-600" />
                                    {req.slotStartTime}
                                  </span>
                                </div>
                                {req.rescheduleReason && (
                                  <p className="mt-4 text-xs font-bold text-slate-400 uppercase tracking-wide leading-relaxed">
                                    Reason: <span className="text-slate-600 normal-case font-medium">{req.rescheduleReason}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-3 w-full md:w-auto">
                              {/* If patient has proposed a new time (rescheduleRequestedBy === 'PATIENT'), only allow Approve or Reschedule (no Reject/Cancel) */}
                              {((req.rescheduleStatus === 'PENDING' || !req.rescheduleStatus) && req.rescheduleRequestedBy === 'PATIENT') ? (
                                <>
                                  <button
                                    onClick={async () => {
                                      setIsSubmitting(true);
                                      try {
                                        const response = await apiClient.confirmAppointment(req.id);
                                        if (response.success) {
                                          toast.success('Reschedule approved!');
                                          fetchData();
                                        } else {
                                          toast.error(response.message || 'Failed to approve reschedule');
                                        }
                                      } catch (err) {
                                        toast.error('An error occurred');
                                      } finally {
                                        setIsSubmitting(false);
                                      }
                                    }}
                                    disabled={isSubmitting}
                                    className="flex-1 md:flex-none px-8 py-3.5 bg-cyan-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-cyan-700 shadow-xl shadow-cyan-600/20 transition-all active:scale-[0.98]"
                                  >
                                    {isSubmitting ? 'Approving...' : 'Approve'}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedAppointment(req);
                                      setShowRescheduleForm(true);
                                    }}
                                    className="flex-1 md:flex-none px-8 py-3.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black shadow-xl shadow-slate-900/20 transition-all active:scale-[0.98]"
                                  >
                                    Reschedule
                                  </button>
                                </>
                              ) : (req.rescheduleStatus === 'PENDING' || !req.rescheduleStatus) ? (
                                <>
                                  <button
                                    onClick={() => {
                                      setSelectedAppointment(req);
                                      setDeclineReason('');
                                      setShowDeclineModal(true);
                                    }}
                                    className="flex-1 md:flex-none px-8 py-3.5 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 shadow-xl shadow-red-600/20 transition-all active:scale-[0.98]"
                                  >
                                    Reject
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedAppointment(req);
                                      setShowRescheduleForm(true);
                                    }}
                                    className="flex-1 md:flex-none px-8 py-3.5 bg-cyan-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-cyan-700 shadow-xl shadow-cyan-600/20 transition-all active:scale-[0.98]"
                                  >
                                    Approve
                                  </button>
                                </>
                              ) : req.rescheduleStatus === 'APPROVED' ? (
                                <span className="px-6 py-3.5 bg-emerald-100 text-emerald-700 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center">Reschedule Approved</span>
                              ) : req.rescheduleStatus === 'REJECTED' ? (
                                <span className="px-6 py-3.5 bg-red-100 text-red-700 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center">Reschedule Rejected</span>
                              ) : null}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </>
              ) : activeTab === 'completed' ? (
                <>
                  {completedAppointments.length === 0 ? (
                    <EmptyState
                      icon={CheckCircle}
                      title="No completed appointments"
                    />
                  ) : (
                    <div className="grid grid-cols-1 gap-6">
                      {completedAppointments.map((apt, i) => (
                        <motion.div
                          key={apt.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="glass-card p-8 border-white/40 bg-teal-50/40 group hover:bg-teal-50/60 transition-all duration-300"
                        >
                          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                            <div className="flex items-center gap-6">
                              <div className="w-16 h-16 bg-gradient-to-br from-teal-100 to-green-100 rounded-2xl flex items-center justify-center text-teal-700 font-black text-2xl group-hover:scale-110 transition-transform duration-500 shadow-sm">
                                {apt.patientName?.charAt(0) || 'P'}
                              </div>
                              <div>
                                <h3 className="text-xl font-black text-slate-800 mb-2 tracking-tight">
                                  {apt.patientName || 'Unknown Patient'}
                                </h3>
                                <div className="flex flex-wrap items-center gap-4">
                                  <span className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest bg-white/50 px-3 py-1.5 rounded-xl">
                                    <Calendar size={14} className="text-teal-600" />
                                    {new Date(apt.appointmentDate).toLocaleDateString()}
                                  </span>
                                  <span className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest bg-white/50 px-3 py-1.5 rounded-xl">
                                    <Clock size={14} className="text-teal-600" />
                                    {apt.slotStartTime}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </>
              ) : activeTab === 'cancelled' ? (
                <>
                  {cancelledAppointments.length === 0 ? (
                    <EmptyState
                      icon={CheckCircle}
                      title="No cancelled appointments"
                    />
                  ) : (
                    <div className="grid grid-cols-1 gap-6">
                      {cancelledAppointments.map((apt, i) => (
                        <motion.div
                          key={apt.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="glass-card p-8 border-white/40 bg-red-50/40 group hover:bg-red-50/60 transition-all duration-300"
                        >
                          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                            <div className="flex items-center gap-6">
                              <div className="w-16 h-16 bg-gradient-to-br from-red-100 to-pink-100 rounded-2xl flex items-center justify-center text-red-700 font-black text-2xl group-hover:scale-110 transition-transform duration-500 shadow-sm">
                                {apt.patientName?.charAt(0) || 'P'}
                              </div>
                              <div>
                                <h3 className="text-xl font-black text-slate-800 mb-2 tracking-tight">
                                  {apt.patientName || 'Unknown Patient'}
                                </h3>
                                <div className="flex flex-wrap items-center gap-4">
                                  <span className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest bg-white/50 px-3 py-1.5 rounded-xl">
                                    <Calendar size={14} className="text-red-600" />
                                    {new Date(apt.appointmentDate).toLocaleDateString()}
                                  </span>
                                  <span className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest bg-white/50 px-3 py-1.5 rounded-xl">
                                    <Clock size={14} className="text-red-600" />
                                    {apt.slotStartTime}
                                  </span>
                                </div>
                                {apt.cancellationReason && (
                                  <p className="mt-4 text-xs font-bold text-slate-400 uppercase tracking-wide leading-relaxed">
                                    Reason: <span className="text-slate-600 normal-case font-medium">{apt.cancellationReason}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </div >
    </ProtectedLayout >
  );
}
