'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/authStore';
import { apiClient } from '@/lib/apiClient';
import ProtectedLayout from '@/components/ProtectedLayout';
import { Loader, AlertCircle, Calendar, Users, Clock, AlertTriangle, Lock, CheckCircle, XCircle, Activity, BarChart3, ShieldCheck, Power, X, MessageCircle } from 'lucide-react';
import ChangePasswordModal from '@/components/ChangePasswordModal';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

// Import chart wrapper components
import { PieChartWrapper, BarChartWrapper } from '@/components/charts/ChartWrappers';

// 3D Background
const Scene = dynamic(() => import('@/components/canvas/Scene'), { ssr: false });
const FloatingIcons = dynamic(() => import('@/components/canvas/FloatingIcons').then(mod => mod.FloatingIcons), { ssr: false });

import { DoctorDashboard as DoctorDashboardData } from '@/types';

export default function DoctorDashboard() {
  const { user } = useAuthStore();
  const [dashboardData, setDashboardData] = useState<DoctorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<any>(null);

  // Status Change Request State
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusRequestType, setStatusRequestType] = useState<'ACTIVATE' | 'DEACTIVATE'>('DEACTIVATE');
  const [statusReason, setStatusReason] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);

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

  const handleConfirmAppointment = async (id: string) => {
    try {
      setActionLoading(id);
      const response = await apiClient.confirmAppointment(id);
      if (response.success) {
        toast.success('Appointment confirmed');
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
      const response = await apiClient.cancelAppointment(id, 'Cancelled by doctor');
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

  const weeklyActivity = [
    { name: 'Mon', appointments: 4 },
    { name: 'Tue', appointments: 7 },
    { name: 'Wed', appointments: 5 },
    { name: 'Thu', appointments: 8 },
    { name: 'Fri', appointments: 6 },
    { name: 'Sat', appointments: 2 },
    { name: 'Sun', appointments: 1 },
  ];

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
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div className="animate-fade-in">
              <h1 className="text-5xl font-black text-slate-800 tracking-tight leading-none mb-3">
                Welcome, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">Dr. {user?.firstName}</span>
              </h1>
              <p className="text-slate-500 font-medium text-lg flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-500" />
                You have {dashboardData?.stats?.appointmentsToday || 0} appointments scheduled for today.
              </p>
            </div>
            <button
              onClick={() => setShowPasswordModal(true)}
              className="px-6 py-3 bg-white/80 backdrop-blur border border-slate-200 rounded-2xl text-slate-700 font-black uppercase tracking-widest hover:bg-emerald-50 hover:border-emerald-200 transition-all flex items-center gap-3 w-fit shadow-lg shadow-emerald-500/5 group"
            >
              <div className="p-2 bg-emerald-100 rounded-xl group-hover:bg-emerald-200 transition-colors">
                <Lock className="w-4 h-4 text-emerald-600" />
              </div>
              Security Settings
            </button>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-red-50/90 backdrop-blur border border-red-200 rounded-2xl flex gap-3 animate-shake">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-red-700 font-medium">{error}</p>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[
              { label: 'Total Patients', value: dashboardData?.stats?.totalPatients, icon: Users, color: 'blue' },
              { label: "Today's Schedule", value: dashboardData?.stats?.appointmentsToday, icon: Calendar, color: 'emerald' },
              { label: 'Avg Wait Time', value: `${dashboardData?.stats?.avgWaitTime}m`, icon: Clock, color: 'orange' },
              { label: 'Active Alerts', value: dashboardData?.stats?.emergencyAlertsCount, icon: AlertTriangle, color: 'red' },
            ].map((stat, i) => (
              <div key={i} className="glass-card p-6 border-white/40 hover:scale-[1.02] transition-transform duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-1">{stat.label}</p>
                    <p className="text-3xl font-black text-slate-800">{stat.value || 0}</p>
                  </div>
                  <div className={`p-4 bg-${stat.color}-50 text-${stat.color}-600 rounded-2xl`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid lg:grid-cols-3 gap-8 mb-8">
            <div className="lg:col-span-2 glass-card p-6 border-white/40">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-emerald-600" />
                  Weekly Consultation Activity
                </h2>
              </div>
              <div className="h-[300px]">
                <BarChartWrapper data={weeklyActivity} categoryKey="name" dataKey="appointments" layout="horizontal" />
              </div>
            </div>
            <div className="glass-card p-6 border-white/40">
              <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                Case Distribution
              </h2>
              <div className="h-[300px]">
                <PieChartWrapper data={appointmentDistribution} />
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Appointments Column */}
            <div className="lg:col-span-2 space-y-8">
              {/* Upcoming Appointments */}
              <div className="glass-card p-6 border-white/40">
                <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-600" />
                  Upcoming Confirmed Appointments
                </h2>
                {dashboardData?.upcomingAppointments && dashboardData.upcomingAppointments.length > 0 ? (
                  <div className="space-y-4">
                    {dashboardData.upcomingAppointments.map((apt: any) => (
                      <div key={apt.id} className="p-4 bg-white/40 rounded-2xl border border-white/60 hover:bg-white/60 transition group">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 font-bold group-hover:scale-110 transition-transform">
                              {apt.patientName?.charAt(0) || 'P'}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800">{apt.patientName || 'Anonymous Patient'}</p>
                              <p className="text-sm text-slate-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(apt.scheduledTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="px-3 py-1 bg-emerald-100/50 text-emerald-700 rounded-full text-xs font-bold uppercase tracking-wider">
                              Confirmed
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                    <p className="text-slate-400 font-medium">No confirmed appointments found</p>
                  </div>
                )}
              </div>

              {/* Appointment Requests */}
              <div className="glass-card p-6 border-white/40">
                <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  New Appointment Requests ({dashboardData?.pendingRequests?.length || 0})
                </h2>
                {dashboardData?.pendingRequests && dashboardData.pendingRequests.length > 0 ? (
                  <div className="space-y-4">
                    {dashboardData.pendingRequests.map((req: any) => (
                      <div key={req.id} className="p-5 bg-amber-50/30 rounded-2xl border border-amber-100/50 hover:bg-amber-50/50 transition">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <p className="font-bold text-slate-800 text-lg">{req.patientName || 'New Patient'}</p>
                            <p className="text-slate-600 flex items-center gap-1.5 mt-1 font-medium">
                              <Calendar className="w-4 h-4 text-amber-600" />
                              Requested: {new Date(req.scheduledTime).toLocaleString()}
                            </p>
                            <p className="text-xs text-slate-400 mt-1 uppercase font-bold tracking-widest">{req.type} CONSULTATION</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleConfirmAppointment(req.id)}
                              disabled={actionLoading === req.id}
                              className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                            >
                              {actionLoading === req.id ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                              Confirm
                            </button>
                            <button
                              onClick={() => handleCancelAppointment(req.id)}
                              disabled={actionLoading === req.id}
                              className="px-4 py-2 bg-white text-slate-600 border border-slate-200 rounded-xl text-sm font-bold hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition flex items-center gap-2 shadow-sm"
                            >
                              <XCircle className="w-4 h-4" />
                              Decline
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                    <p className="text-slate-400 font-medium">No pending requests</p>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar Column */}
            <div className="space-y-6">
              {/* Account Status Card */}
              <div className="glass-card p-6 border-white/40 shadow-lg relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                  <ShieldCheck size={80} className={dashboardData?.doctor?.user_id?.is_active ? 'text-emerald-500' : 'text-slate-400'} />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <div className={`w-2 h-2 rounded-full ${dashboardData?.doctor?.user_id?.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
                    <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Account Status</h2>
                  </div>

                  <div className="mb-6">
                    <span className={`px-4 py-1.5 rounded-2xl text-xs font-black uppercase tracking-widest ${dashboardData?.doctor?.user_id?.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {dashboardData?.doctor?.user_id?.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <p className="text-slate-500 text-xs mt-3 font-medium leading-relaxed">
                      {dashboardData?.doctor?.user_id?.is_active
                        ? 'Your profile is visible to patients. You can receive new appointment requests.'
                        : 'Your profile is currently hidden. You won\'t receive new appointment requests.'}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {dashboardData?.doctor?.status_change_request?.status === 'PENDING' ? (
                      <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                        <p className="text-[10px] font-black uppercase text-amber-700 tracking-widest mb-1 flex items-center gap-1">
                          <Clock size={10} /> Pending Request
                        </p>
                        <p className="text-xs text-amber-900 font-bold">
                          {dashboardData.doctor.status_change_request.type} Requested
                        </p>
                        <p className="text-[10px] text-amber-600 mt-1 line-clamp-2 italic">
                          "{dashboardData.doctor.status_change_request.reason}"
                        </p>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setStatusRequestType(dashboardData?.doctor?.user_id?.is_active ? 'DEACTIVATE' : 'ACTIVATE');
                          setShowStatusModal(true);
                        }}
                        className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-2 ${dashboardData?.doctor?.user_id?.is_active
                          ? 'bg-slate-200 text-slate-700 hover:bg-slate-800 hover:text-white'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                          }`}
                      >
                        <Power size={14} />
                        Request {dashboardData?.doctor?.user_id?.is_active ? 'Deactivation' : 'Activation'}
                      </button>
                    )}
                    <p className="text-[10px] text-slate-400 text-center font-bold tracking-widest uppercase">Admin approval required</p>
                  </div>
                </div>
              </div>

              {/* Critical Alerts */}
              <div className="glass-card p-6 border-white/40">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    Patient Alerts
                  </h2>
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-black uppercase tracking-tighter">Live</span>
                </div>
                {dashboardData?.alerts && dashboardData.alerts.length > 0 ? (
                  <div className="space-y-4">
                    {dashboardData.alerts.map((alert: any) => (
                      <div 
                        key={alert.id} 
                        className="p-4 bg-red-50/50 rounded-2xl border border-red-100 group hover:bg-red-50 transition duration-300"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 cursor-pointer" onClick={() => setSelectedAlert(alert)}>
                            <p className="text-sm font-bold text-red-900 group-hover:translate-x-1 transition-transform">{alert.title || alert.message}</p>
                            <div className="flex items-center justify-between mt-3">
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{alert.patientName}</span>
                              <span className="text-[10px] font-medium text-slate-400">{new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                          {alert.patientId && (
                            <Link
                              href={`/doctor/chat/${alert.patientId}`}
                              className="p-2 bg-blue-100 text-blue-600 rounded-xl hover:bg-blue-200 transition-colors flex-shrink-0"
                              title="Chat with patient"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <CheckCircle className="w-6 h-6 text-emerald-600" />
                    </div>
                    <p className="text-slate-500 text-sm font-medium">All patients are stable</p>
                  </div>
                )}
              </div>

              {/* Quick Navigation */}
              <div className="space-y-3">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2 mb-4">Quick Links</p>
                <Link href="/doctor/patients" className="w-full glass-card p-4 hover:bg-white transition-all flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-xl group-hover:scale-110 transition-transform">
                      <Users className="w-5 h-5" />
                    </div>
                    <p className="font-bold text-slate-700">Patient Database</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    →
                  </div>
                </Link>
                <Link href="/doctor/appointments" className="w-full glass-card p-4 hover:bg-white transition-all flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 text-purple-600 rounded-xl group-hover:scale-110 transition-transform">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <p className="font-bold text-slate-700">Manage Schedule</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                    →
                  </div>
                </Link>
              </div>
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
    </ProtectedLayout>
  );
}
