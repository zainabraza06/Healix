'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/authStore';
import { apiClient } from '@/lib/apiClient';
import ProtectedLayout from '@/components/ProtectedLayout';
import { Loader, AlertCircle, Calendar, Users, Clock, AlertTriangle, Lock, CheckCircle, XCircle, Activity, BarChart3, ShieldCheck, Power, X, MessageCircle, Bell, Stethoscope, Download, Video } from 'lucide-react';
import ChangePasswordModal from '@/components/ChangePasswordModal';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { connectSocket, joinRooms, onCriticalVitals, offCriticalVitals } from '@/lib/socket';

// Import chart wrapper components
import { PieChartWrapper, BarChartWrapper } from '@/components/charts/ChartWrappers';

// 3D Background
const Scene = dynamic(() => import('@/components/canvas/Scene'), { ssr: false });
const FloatingIcons = dynamic(() => import('@/components/canvas/FloatingIcons'), { ssr: false });

import { DoctorDashboard as DoctorDashboardData } from '@/types';

export default function DoctorDashboard() {
  const { user } = useAuthStore();
  const [dashboardData, setDashboardData] = useState<DoctorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  const [showCriticalAlertModal, setShowCriticalAlertModal] = useState(false);
  const [criticalAlertCount, setCriticalAlertCount] = useState(0);
  const [downloadingPatientId, setDownloadingPatientId] = useState<string | null>(null);

  // Status Change Request State
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusRequestType, setStatusRequestType] = useState<'ACTIVATE' | 'DEACTIVATE'>('DEACTIVATE');
  const [statusReason, setStatusReason] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [meetingLink, setMeetingLink] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getDoctorDashboard();
      if (response.success) {
        setDashboardData(response.data);
      } else {
        setError(response.message);
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError(err.message || 'Failed to fetch dashboard');
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusRequest = async () => {
    if (!statusReason.trim()) return;

    try {
      setStatusLoading(true);
      const response = await apiClient.requestStatusChange(statusRequestType, statusReason);
      if (response.success) {
        toast.success('Status change request submitted!');
        setShowStatusModal(false);
        setStatusReason('');
        fetchDashboard();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit request');
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  // Socket connection and critical alerts notification
  useEffect(() => {
    if (user && dashboardData?.doctor?._id) {
      connectSocket(localStorage.getItem('token') || undefined);
      joinRooms({ role: 'DOCTOR', doctorId: dashboardData.doctor._id, userId: user.id });

      // Check for critical alerts within 24 hours on mount
      const checkCriticalAlerts = () => {
        if (dashboardData.alerts && dashboardData.alerts.length > 0) {
          const now = new Date().getTime();
          const criticalAlertsWithin24h = dashboardData.alerts.filter((alert: any) => {
            const createdTime = new Date(alert.timestamp).getTime();
            const hoursOld = (now - createdTime) / (1000 * 60 * 60);
            return alert.severity === 'CRITICAL' && hoursOld < 24;
          });

          if (criticalAlertsWithin24h.length > 0) {
            setCriticalAlertCount(criticalAlertsWithin24h.length);
            setShowCriticalAlertModal(true);
          }
        }
      };

      checkCriticalAlerts();

      const handleCriticalAlert = (data: any) => {
        console.log('Critical alert received:', data);
        fetchDashboard(); // Refresh dashboard to show new alert

        // Show toast notification
        toast.custom((t) => (
          <div
            onClick={() => {
              toast.dismiss(t.id);
              setSelectedAlert(data);
            }}
            className="glass-card p-4 border-2 border-red-500 shadow-2xl cursor-pointer hover:scale-105 transition-transform max-w-md"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-100 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-red-600 animate-pulse" />
              </div>
              <div className="flex-1">
                <p className="font-black text-red-900 text-sm uppercase tracking-wide">🚨 Critical Alert</p>
                <p className="text-slate-700 text-sm mt-1 font-bold">
                  Patient: {data.patientName || 'Unknown'}
                </p>
                <p className="text-slate-500 text-xs mt-1">
                  {data.message?.split('\n')[0] || 'Critical vitals detected'}
                </p>
                <p className="text-emerald-600 text-xs mt-2 font-bold">Click to view details →</p>
              </div>
            </div>
          </div>
        ), { duration: 10000 });
      };

      onCriticalVitals(handleCriticalAlert);

      return () => {
        offCriticalVitals(handleCriticalAlert);
      };
    }
    return () => { };
  }, [user, dashboardData?.doctor?._id, dashboardData?.alerts]);

  const handleConfirmAppointment = async (req: any) => {
    if (req.appointmentType === 'ONLINE') {
      setSelectedRequest(req);
      setMeetingLink('');
      setShowConfirmModal(true);
    } else {
      confirmRequest(req.id);
    }
  };

  const confirmRequest = async (id: string, link?: string) => {
    try {
      setActionLoading(id);
      const response = await apiClient.confirmAppointment(id, link);
      if (response.success) {
        toast.success('Appointment confirmed');
        setShowConfirmModal(false);
        fetchDashboard();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to confirm');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelAppointment = async (id: string) => {
    try {
      setActionLoading(id);
      const response = await apiClient.cancelAppointment(id);
      if (response.success) {
        toast.success('Appointment cancelled');
        fetchDashboard();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel');
    } finally {
      setActionLoading(null);
    }
  };

  const downloadMedicalRecord = async (patientId?: string, patientName?: string) => {
    if (!patientId) {
      toast.error('Patient ID missing for this alert');
      return;
    }
    try {
      setDownloadingPatientId(patientId);
      const blob = await apiClient.downloadMedicalRecord(patientId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeName = (patientName || patientId).replace(/\s+/g, '_');
      link.download = `medical_record_${safeName}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('Medical record downloaded');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to download medical record');
    } finally {
      setDownloadingPatientId(null);
    }
  };

  // Calculate time remaining for request expiry (24 hours from creation)
  const getTimeRemaining = (createdAt: string): { hours: number; minutes: number; isExpired: boolean } => {
    const created = new Date(createdAt).getTime();
    const now = new Date().getTime();
    const expiryTime = created + 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const remaining = expiryTime - now;

    if (remaining <= 0) {
      return { hours: 0, minutes: 0, isExpired: true };
    }

    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

    return { hours, minutes, isExpired: false };
  };

  // Check if request is urgent (less than 2 hours remaining)
  const isRequestUrgent = (createdAt: string): boolean => {
    const { hours, minutes } = getTimeRemaining(createdAt);
    return hours === 0 && minutes <= 120;
  };

  if (loading) {
    return (
      <ProtectedLayout allowedRoles={['DOCTOR']}>
        <div className="flex items-center justify-center h-screen bg-slate-50/50">
          <div className="flex flex-col items-center gap-4">
            <Loader className="w-10 h-10 animate-spin text-emerald-600" />
            <p className="text-slate-500 font-medium animate-pulse">Loading medical records...</p>
          </div>
        </div>
      </ProtectedLayout>
    );
  }

  // Process data for charts
  const appointmentDistribution = dashboardData ? [
    { name: 'Upcoming', value: dashboardData.upcomingAppointments?.length || 0, color: '#10b981' },
    { name: 'Pending', value: dashboardData.pendingRequests?.length || 0, color: '#f59e0b' },
    { name: 'Alerts', value: dashboardData.stats?.emergencyAlertsCount || 0, color: '#ef4444' },
  ] : [];

  const weeklyActivity = dashboardData?.weeklyActivity || [];

  return (
    <ProtectedLayout allowedRoles={['DOCTOR']}>
      <div className="relative min-h-screen">
        {/* 3D Background */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          <Scene className="h-full w-full">
            <FloatingIcons />
          </Scene>
        </div>

        <div className="relative z-10 container-main py-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="animate-fade-in"
            >
              <h1 className="text-6xl font-black text-slate-800 tracking-tighter leading-none mb-4">
                Welcome, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">Dr. {user?.firstName}</span>
              </h1>
              <div className="flex items-center gap-4">
                <div className="px-4 py-1.5 bg-emerald-100 text-emerald-700 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm">
                  Full Access
                </div>
                <p className="text-slate-500 font-bold text-sm flex items-center gap-2 uppercase tracking-wide opacity-80">
                  <Activity className="w-4 h-4 text-emerald-500" />
                  Your Dashboard is up to date
                </p>
              </div>
            </motion.div>
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => setShowPasswordModal(true)}
              className="px-8 py-4 bg-white/40 backdrop-blur-xl border border-white/60 rounded-2xl text-slate-700 font-black uppercase tracking-[0.2em] text-[10px] hover:bg-emerald-50 hover:border-emerald-200 transition-all flex items-center gap-3 w-fit shadow-2xl shadow-emerald-500/5 group"
            >
              <div className="p-2.5 bg-emerald-100 rounded-xl group-hover:bg-emerald-200 transition-colors shadow-sm">
                <Lock className="w-4 h-4 text-emerald-600" />
              </div>
              Change Password
            </motion.button>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-red-50/90 backdrop-blur border border-red-200 rounded-2xl flex gap-3 animate-shake">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-red-700 font-medium">{error}</p>
            </div>
          )}

          {/* Appointment Status Overview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
          >
            <Link href="/doctor/appointments?tab=requests">
              <div className="glass-card p-6 border-white/40 hover:bg-white/60 transition-all cursor-pointer group">
                <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">Pending Requests</p>
                <p className="text-3xl font-black text-slate-800">{dashboardData?.pendingRequests?.length || 0}</p>
                <p className="text-[10px] text-slate-400 mt-3 font-bold uppercase tracking-wide group-hover:text-slate-600">View Details →</p>
              </div>
            </Link>
            <Link href="/doctor/appointments?tab=upcoming">
              <div className="glass-card p-6 border-white/40 hover:bg-emerald-50/60 transition-all cursor-pointer group">
                <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">Upcoming</p>
                <p className="text-3xl font-black text-emerald-600">{dashboardData?.upcomingAppointments?.length || 0}</p>
                <p className="text-[10px] text-slate-400 mt-3 font-bold uppercase tracking-wide group-hover:text-emerald-600">View Details →</p>
              </div>
            </Link>
            <Link href="/doctor/appointments?tab=rescheduling">
              <div className="glass-card p-6 border-white/40 hover:bg-cyan-50/60 transition-all cursor-pointer group">
                <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">Rescheduling</p>
                <p className="text-3xl font-black text-cyan-600">{dashboardData?.rescheduleRequests?.length || 0}</p>
                <p className="text-[10px] text-slate-400 mt-3 font-bold uppercase tracking-wide group-hover:text-cyan-600">View Details →</p>
              </div>
            </Link>
            <Link href="/doctor/appointments?tab=alerts">
              <div className="glass-card p-6 border-white/40 hover:bg-red-50/60 transition-all cursor-pointer group">
                <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">Critical Alerts</p>
                <p className="text-3xl font-black text-red-600">{dashboardData?.stats?.emergencyAlertsCount || 0}</p>
                <p className="text-[10px] text-slate-400 mt-3 font-bold uppercase tracking-wide group-hover:text-red-600">View Details →</p>
              </div>
            </Link>
          </motion.div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[
              { label: 'Total Patients', value: dashboardData?.stats?.totalPatients, icon: Users, gradient: 'from-blue-500/20 to-indigo-500/20', iconColor: 'text-blue-600' },
              { label: "Today's Schedule", value: dashboardData?.stats?.appointmentsToday, icon: Calendar, gradient: 'from-emerald-500/20 to-teal-500/20', iconColor: 'text-emerald-600' },
              { label: 'Avg Wait Time', value: `${dashboardData?.stats?.avgWaitTime}m`, icon: Clock, gradient: 'from-orange-500/20 to-amber-500/20', iconColor: 'text-orange-600' },
              { label: 'Active Alerts', value: dashboardData?.stats?.emergencyAlertsCount, icon: AlertTriangle, gradient: 'from-red-500/20 to-rose-500/20', iconColor: 'text-red-600' },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="glass-card p-6 border-white/40 hover:scale-[1.02] transition-all duration-300 group cursor-default"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-1">{stat.label}</p>
                    <p className="text-3xl font-black text-slate-800 tracking-tight">{stat.value || 0}</p>
                  </div>
                  <div className={`p-4 rounded-2xl bg-gradient-to-br ${stat.gradient} ${stat.iconColor} group-hover:scale-110 transition-transform duration-500`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid lg:grid-cols-3 gap-8 mb-8">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-2 glass-card p-8 border-white/40"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3 tracking-tight uppercase">
                  <div className="p-2 bg-emerald-100 rounded-xl">
                    <BarChart3 className="w-5 h-5 text-emerald-600" />
                  </div>
                  Consultation Activity
                </h2>
              </div>
              {weeklyActivity && (weeklyActivity as any[]).length > 0 && (weeklyActivity as any[]).some((d: any) => d.appointments > 0) ? (
                <div className="h-[300px]">
                  <BarChartWrapper data={weeklyActivity} categoryKey="name" dataKey="appointments" layout="horizontal" />
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="text-center group">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-500">
                      <BarChart3 className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No activity this week</p>
                  </div>
                </div>
              )}
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass-card p-8 border-white/40"
            >
              <h2 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-3 tracking-tight uppercase">
                <div className="p-2 bg-blue-100 rounded-xl">
                  <Activity className="w-5 h-5 text-blue-600" />
                </div>
                Case Mix
              </h2>
              {appointmentDistribution && appointmentDistribution.length > 0 && appointmentDistribution.some((d: any) => d.value > 0) ? (
                <div className="h-[300px]">
                  <PieChartWrapper data={appointmentDistribution} />
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="text-center group">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-500">
                      <Activity className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No case data</p>
                  </div>
                </div>
              )}
            </motion.div>
          </div>

          {/* Main Content Grid */}
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Appointments Column */}
            <div className="lg:col-span-2 space-y-8">
              {/* Upcoming Appointments */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-8 border-white/40"
              >
                <h2 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-3 tracking-tight uppercase">
                  <div className="p-2 bg-emerald-100 rounded-xl">
                    <Calendar className="w-5 h-5 text-emerald-600" />
                  </div>
                  Confirmed Appointments
                </h2>
                {dashboardData?.upcomingAppointments && dashboardData.upcomingAppointments.length > 0 ? (
                  <div className="space-y-4">
                    {dashboardData.upcomingAppointments.map((apt: any) => (
                      <div key={apt.id} className="p-5 bg-white/40 rounded-3xl border border-white/60 hover:bg-white/60 transition-all group">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-2xl flex items-center justify-center text-emerald-700 font-bold group-hover:scale-110 transition-transform duration-500 shadow-sm">
                              {apt.patientName?.charAt(0) || 'P'}
                            </div>
                            <div>
                              <p className="font-black text-slate-800 leading-tight">{apt.patientName || 'Anonymous Patient'}</p>
                              <div className="flex items-center gap-3 mt-1.5">
                                <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-wide">
                                  <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                                  {new Date(apt.scheduledTime).toLocaleDateString()}
                                </span>
                                <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-wide">
                                  <Clock className="w-3.5 h-3.5 text-emerald-500" />
                                  {new Date(apt.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="px-4 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm">
                              Confirmed
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 bg-slate-50/30 rounded-3xl border border-dashed border-slate-200">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Calendar className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No confirmed appointments</p>
                  </div>
                )}
              </motion.div>

              {/* Appointment Requests */}
              <div className="glass-card p-6 border-white/40">
                <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3 tracking-tight uppercase">
                  <div className="p-2 bg-amber-100 rounded-xl">
                    <AlertCircle className="w-5 h-5 text-amber-500" />
                  </div>
                  Pending Requests ({dashboardData?.pendingRequests?.length || 0})
                </h2>
                {dashboardData?.pendingRequests && dashboardData.pendingRequests.length > 0 ? (
                  <div className="space-y-4">
                    {dashboardData.pendingRequests.map((req: any) => {
                      const { hours, minutes, isExpired } = getTimeRemaining(req.createdAt || new Date().toISOString());
                      const urgent = isRequestUrgent(req.createdAt || new Date().toISOString());
                      return (
                        <div key={req.id} className={`p-6 rounded-3xl border transition-all group ${isExpired ? 'bg-red-50/40 border-red-100/50' : urgent ? 'bg-red-50/30 border-red-200/60 animate-pulse' : 'bg-amber-50/40 border-amber-100/50 hover:bg-amber-50/60'}`}>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                            <div className="flex items-center gap-4 flex-1">
                              <div className="w-14 h-14 bg-gradient-to-br from-amber-100 to-orange-100 rounded-2xl flex items-center justify-center text-amber-700 font-black text-xl group-hover:scale-110 transition-transform duration-500 shadow-sm">
                                {req.patientName?.charAt(0) || 'P'}
                              </div>
                              <div className="flex-1">
                                <p className="font-black text-slate-800 text-lg leading-tight">{req.patientName || 'New Patient'}</p>
                                <div className="flex flex-wrap items-center gap-3 mt-2">
                                  <span className="text-slate-500 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider bg-white/50 px-2 py-1 rounded-lg">
                                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                                    {new Date(req.scheduledTime).toLocaleDateString()}
                                  </span>
                                  <span className="text-slate-500 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider bg-white/50 px-2 py-1 rounded-lg">
                                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                                    {new Date(req.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  {/* Expiry countdown */}
                                  <span className={`flex items-center gap-1.5 text-xs font-black uppercase tracking-wider px-3 py-1 rounded-lg ${isExpired ? 'bg-red-100 text-red-700' : urgent ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-amber-100 text-amber-700'}`}>
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    {isExpired ? 'Expired - Auto-cancelling' : `${hours}h ${minutes}m remaining`}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <button
                                onClick={() => handleConfirmAppointment(req)}
                                disabled={actionLoading === req.id || isExpired}
                                className="px-6 py-3 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-xl shadow-emerald-600/20 active:scale-95 disabled:opacity-50"
                              >
                                {actionLoading === req.id ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                Confirm
                              </button>
                              <button
                                onClick={() => handleCancelAppointment(req.id)}
                                disabled={actionLoading === req.id || isExpired}
                                className="px-6 py-3 bg-white/80 text-slate-600 border border-slate-200 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all flex items-center gap-2 shadow-sm active:scale-95 disabled:opacity-50"
                              >
                                <XCircle className="w-4 h-4" />
                                Decline
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-16 bg-slate-50/30 rounded-3xl border border-dashed border-slate-200">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No pending requests</p>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar Column */}
            <div className="space-y-6">
              {/* Account Status Card */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="glass-card p-8 border-white/40 shadow-xl relative overflow-hidden group"
              >
                <div className="absolute -top-4 -right-4 p-8 opacity-5 group-hover:scale-110 group-hover:opacity-10 transition-all duration-700 rotate-12">
                  <ShieldCheck size={120} className={dashboardData?.doctor?.user_id?.is_active ? 'text-emerald-500' : 'text-slate-400'} />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-8">
                    <div className={`w-3 h-3 rounded-full ${dashboardData?.doctor?.user_id?.is_active ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)] animate-pulse' : 'bg-slate-400'}`}></div>
                    <h2 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Account Visibility</h2>
                  </div>

                  <div className="mb-8">
                    <div className="flex items-center gap-3">
                      <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm ${dashboardData?.doctor?.user_id?.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {dashboardData?.doctor?.user_id?.is_active ? 'Online' : 'Offline'}
                      </span>
                    </div>
                    <p className="text-slate-500 text-xs mt-4 font-bold leading-relaxed uppercase tracking-wide opacity-80">
                      {dashboardData?.doctor?.user_id?.is_active
                        ? 'Your profile is visible to patients for appointment booking.'
                        : 'Your profile is currently hidden from patients.'}
                    </p>
                  </div>

                  <div className="space-y-4">
                    {dashboardData?.doctor?.status_change_request?.status === 'PENDING' ? (
                      <div className="p-5 bg-amber-50/50 border border-amber-100 rounded-3xl backdrop-blur-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock size={14} className="text-amber-600 animate-spin-slow" />
                          <p className="text-xs font-black uppercase text-amber-700 tracking-widest">Awaiting Admin</p>
                        </div>
                        <p className="text-sm text-slate-800 font-bold">
                          {dashboardData.doctor.status_change_request.type} requested
                        </p>
                        <p className="text-xs text-amber-600 mt-2 italic line-clamp-2">
                          "{dashboardData.doctor.status_change_request.reason}"
                        </p>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setStatusRequestType(dashboardData?.doctor?.user_id?.is_active ? 'DEACTIVATE' : 'ACTIVATE');
                          setShowStatusModal(true);
                        }}
                        className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl active:scale-[0.98] flex items-center justify-center gap-3 ${dashboardData?.doctor?.user_id?.is_active
                          ? 'bg-slate-900 text-white hover:bg-black shadow-slate-900/10'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-600/10'
                          }`}
                      >
                        <Power size={14} />
                        Request {dashboardData?.doctor?.user_id?.is_active ? 'Deactivation' : 'Activation'}
                      </button>
                    )}
                    <p className="text-[9px] text-slate-400 text-center font-black tracking-[0.2em] uppercase">Security verified</p>
                  </div>
                </div>
              </motion.div>

              {/* Patient Alerts */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="glass-card p-8 border-white/40"
                data-alerts-section
              >
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-lg font-black text-slate-800 flex items-center gap-3 tracking-tighter uppercase">
                    <div className="p-2 bg-red-100 rounded-xl">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    </div>
                    Patient Alerts
                  </h2>
                  <span className="flex items-center gap-1 px-3 py-1 bg-red-50 text-red-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-red-100">
                    <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse shadow-[0_0_8px_rgba(220,38,38,0.5)]"></div>
                    Live
                  </span>
                </div>
                {dashboardData?.alerts && dashboardData.alerts.length > 0 ? (
                  <div className="space-y-4">
                    {dashboardData.alerts.map((alert: any) => (
                      <div
                        key={alert.id}
                        className="p-5 bg-red-50/40 rounded-3xl border border-red-100/50 group hover:bg-red-50/60 transition-all duration-300"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 cursor-pointer" onClick={() => setSelectedAlert(alert)}>
                            <p className="text-sm font-black text-red-900 group-hover:translate-x-1 transition-transform leading-tight">{alert.title || alert.message}</p>
                            <div className="flex items-center justify-between mt-4">
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-white/60 px-2 py-0.5 rounded-lg">{alert.patientName}</span>
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {alert.patientId && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadMedicalRecord(alert.patientId, alert.patientName);
                                }}
                                disabled={downloadingPatientId === alert.patientId}
                                className="p-3 bg-white/80 text-emerald-700 border border-emerald-100 rounded-2xl hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all shadow-sm disabled:opacity-50 active:scale-90"
                                title="Download medical record"
                              >
                                {downloadingPatientId === alert.patientId ? (
                                  <Loader className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Download className="w-4 h-4" />
                                )}
                              </button>
                            )}
                            {alert.patientId && (
                              <Link
                                href={`/doctor/chat/${alert.patientId}`}
                                className="p-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 active:scale-90"
                                title="Chat with patient"
                              >
                                <MessageCircle className="w-4 h-4" />
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-slate-50/30 rounded-3xl border border-dashed border-slate-200">
                    <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-8 h-8 text-emerald-300" />
                    </div>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">All patients stable</p>
                  </div>
                )}
              </motion.div>


            </div>
          </div>
        </div>
      </div>
      <ChangePasswordModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} />

      {/* Status Request Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4 animate-in fade-in">
          <div className="glass-card p-8 max-w-md w-full border-white/60 shadow-2xl animate-in zoom-in-95">
            <div className="mb-6">
              <div className={`w-12 h-12 ${statusRequestType === 'ACTIVATE' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'} rounded-2xl flex items-center justify-center mb-4`}>
                <Activity size={24} />
              </div>
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
                Request {statusRequestType === 'ACTIVATE' ? 'Activation' : 'Deactivation'}
              </h3>
              <p className="text-slate-500 text-sm mt-1 font-medium italic">
                Please provide a reason for this status change request.
              </p>
            </div>

            <div className="space-y-4">
              <textarea
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="e.g., Extended medical leave, temporary sabbatical, returning to practice..."
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium text-sm resize-none"
                rows={4}
              />
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => {
                  setShowStatusModal(false);
                  setStatusReason('');
                }}
                className="flex-1 py-3.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition"
                disabled={statusLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleStatusRequest}
                className="flex-1 py-3.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition shadow-lg flex items-center justify-center gap-2"
                disabled={statusLoading || !statusReason.trim()}
              >
                {statusLoading ? <Loader size={18} className="animate-spin" /> : 'Send Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Details Modal */}
      <AnimatePresence>
        {selectedAlert && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setSelectedAlert(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-start sticky top-0 bg-white">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-2xl font-bold text-slate-800">{selectedAlert?.message?.split('\n')[0] || 'Alert'}</h3>
                    <span className="px-3 py-1 rounded-full text-sm font-semibold whitespace-nowrap bg-red-200 text-red-800">
                      {selectedAlert?.severity || 'Alert'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-2">{new Date(selectedAlert?.timestamp || '').toLocaleString()}</p>
                </div>
                <button
                  onClick={() => setSelectedAlert(null)}
                  className="text-slate-400 hover:text-slate-600 transition ml-4"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                {selectedAlert && (() => {
                  const lines = (selectedAlert.message || '').split('\n').filter((l: string) => l.trim());

                  let issuesText = '';
                  let recsText = '';
                  let snapshotText = '';

                  for (const line of lines) {
                    if (line.toUpperCase().includes('ISSUES:')) {
                      issuesText = line.split(/issues:/i)[1] || '';
                    } else if (line.toUpperCase().includes('RECOMMENDATIONS:')) {
                      recsText = line.split(/recommendations:/i)[1] || '';
                    } else if (line.toUpperCase().includes('SNAPSHOT:')) {
                      snapshotText = line.split(/snapshot:/i)[1] || '';
                    }
                  }

                  const issues = issuesText.split(';').map((i: string) => i.trim()).filter((i: string) => i.length > 0);
                  const recs = recsText.split('|').map((r: string) => r.trim()).filter((r: string) => r.length > 0);

                  return (
                    <>
                      {/* Resolved Alert - Instructions and Prescription */}
                      {selectedAlert?.status === 'RESOLVED' && (selectedAlert?.instructions || selectedAlert?.prescription) && (
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="w-6 h-6 text-emerald-600" />
                            <h4 className="text-xl font-bold text-emerald-800">Alert Resolved</h4>
                          </div>

                          {selectedAlert?.instructions && (
                            <div className="bg-emerald-50 p-6 rounded-2xl border-2 border-emerald-200">
                              <div className="flex items-center gap-2 mb-3">
                                <Stethoscope className="w-5 h-5 text-emerald-700" />
                                <h5 className="text-sm font-bold text-emerald-900 uppercase tracking-wider">Doctor's Instructions</h5>
                              </div>
                              <p className="text-sm text-emerald-900 leading-relaxed whitespace-pre-wrap font-medium">
                                {selectedAlert.instructions}
                              </p>
                            </div>
                          )}

                          {selectedAlert?.prescription && (
                            <div className="bg-emerald-50 p-6 rounded-2xl border-2 border-emerald-200">
                              <div className="flex items-center gap-2 mb-3">
                                <Activity className="w-5 h-5 text-emerald-700" />
                                <h5 className="text-sm font-bold text-emerald-900 uppercase tracking-wider">Prescription</h5>
                              </div>
                              <p className="text-sm text-emerald-900 leading-relaxed whitespace-pre-wrap font-medium">
                                {selectedAlert.prescription}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Patient Information */}
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-2">Patient</p>
                        <p className="text-lg font-bold text-slate-800">{selectedAlert?.patientName || 'Unknown Patient'}</p>
                      </div>

                      {/* Critical Issues Section */}
                      {issues.length > 0 && (
                        <div>
                          <h4 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-red-600" />
                            Critical Issues
                          </h4>
                          <div className="space-y-2 bg-red-50 p-4 rounded-xl border border-red-200">
                            {issues.map((issue: string, idx: number) => (
                              <p key={idx} className="text-sm text-red-900 leading-relaxed">
                                • {issue}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Recommendations Section */}
                      {recs.length > 0 && (
                        <div>
                          <h4 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-emerald-600" />
                            Recommendations
                          </h4>
                          <div className="space-y-2 bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                            {recs.map((rec: string, idx: number) => (
                              <p key={idx} className="text-sm text-emerald-900 leading-relaxed">
                                ✓ {rec}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Snapshot Section */}
                      {snapshotText && (
                        <div>
                          <h4 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <Activity className="w-5 h-5 text-blue-600" />
                            Vitals Snapshot
                          </h4>
                          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                            <p className="text-sm text-blue-900 leading-relaxed font-mono">
                              {snapshotText}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-3 pt-6 border-t border-slate-100">
                        {(() => {
                          const patientId = selectedAlert?.patientId || selectedAlert?.patient_id;
                          return patientId ? (
                            <button
                              onClick={() => downloadMedicalRecord(patientId, selectedAlert?.patientName)}
                              disabled={downloadingPatientId === patientId}
                              className="flex-1 h-12 bg-slate-100 text-slate-700 font-black uppercase tracking-widest text-xs rounded-xl hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                            >
                              {downloadingPatientId === patientId ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                              Download record
                            </button>
                          ) : null;
                        })()}
                        <button
                          onClick={() => setSelectedAlert(null)}
                          className="flex-1 h-12 bg-slate-900 text-white font-black uppercase tracking-widest text-xs rounded-xl hover:bg-black transition-all"
                        >
                          Close
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Critical Alerts Notification Modal (on login) */}
      <AnimatePresence>
        {showCriticalAlertModal && criticalAlertCount > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setShowCriticalAlertModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
            >
              <div className="p-8">
                <div className="flex items-center justify-center mb-6">
                  <div className="relative">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center animate-pulse">
                      <Bell className="w-10 h-10 text-red-600" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-black">
                      {criticalAlertCount}
                    </div>
                  </div>
                </div>

                <h3 className="text-2xl font-black text-slate-800 text-center mb-2">
                  Critical Alerts!
                </h3>
                <p className="text-slate-600 text-center mb-6">
                  You have <span className="font-black text-red-600">{criticalAlertCount}</span> critical patient {criticalAlertCount === 1 ? 'alert' : 'alerts'} requiring immediate attention
                </p>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                  <p className="text-xs text-amber-800 font-bold flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Recent alerts (within 24 hours)
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCriticalAlertModal(false)}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => {
                      setShowCriticalAlertModal(false);
                      // Scroll to alerts section
                      const alertsSection = document.querySelector('[data-alerts-section]');
                      if (alertsSection) {
                        alertsSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                    }}
                    className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition shadow-lg flex items-center justify-center gap-2"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    View Alerts
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Confirm Appointment Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4 animate-in fade-in">
          <div className="glass-card p-8 max-w-md w-full border-white/60 shadow-2xl animate-in zoom-in-95">
            <div className="mb-6">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-4">
                <Video size={24} />
              </div>
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
                Online Consultation
              </h3>
              <p className="text-slate-500 text-sm mt-1 font-medium">
                This is an online appointment. Please provide a meeting link for the patient.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-slate-400 mb-2">
                  Meeting Link (Zoom/Meet)
                </label>
                <input
                  type="text"
                  value={meetingLink}
                  onChange={(e) => setMeetingLink(e.target.value)}
                  placeholder="https://..."
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium text-sm"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setMeetingLink('');
                  setSelectedRequest(null);
                }}
                className="flex-1 py-3.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition"
                disabled={actionLoading === selectedRequest?.id}
              >
                Cancel
              </button>
              <button
                onClick={() => confirmRequest(selectedRequest.id, meetingLink)}
                className="flex-1 py-3.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
                disabled={!meetingLink.trim() || actionLoading === selectedRequest?.id}
              >
                {actionLoading === selectedRequest?.id ? <Loader size={18} className="animate-spin" /> : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedLayout>
  );
}
