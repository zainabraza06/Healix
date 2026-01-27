'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/authStore';
import { apiClient } from '@/lib/apiClient';
import ProtectedLayout from '@/components/ProtectedLayout';
import { Loader, AlertCircle, Activity, TrendingUp, Users, Clock, Lock, Heart, Thermometer, Droplets, X, MessageSquare, CheckCircle, Stethoscope, ChevronRight } from 'lucide-react';
import { connectSocket, joinRooms, onChatReceive, offChatReceive } from '@/lib/socket';
import { useRouter } from 'next/navigation';
import ChangePasswordModal from '@/components/ChangePasswordModal';
import ChatModal from '@/components/ChatModal';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';

// Import chart wrapper components
import { AreaChartWrapper } from '@/components/charts/ChartWrappers';
import { motion, AnimatePresence } from 'framer-motion';

// 3D Background
const Scene = dynamic(() => import('@/components/canvas/Scene'), { ssr: false });
const FloatingIcons = dynamic(() => import('@/components/canvas/FloatingIcons').then(mod => mod.FloatingIcons), { ssr: false });

export default function PatientDashboard() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [showDoctorSelect, setShowDoctorSelect] = useState(false);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [currentAlertForConsult, setCurrentAlertForConsult] = useState<string | null>(null);
  const [showChatModal, setShowChatModal] = useState(false);

  // Interactive Vitals States
  const [timeframe, setTimeframe] = useState<7 | 30 | 90>(30);
  const [activeMetrics, setActiveMetrics] = useState<string[]>(['heartRate', 'systolicBP', 'oxygenLevel']);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  // Initialize socket and join patient room when dashboard data is available
  useEffect(() => {
    if (user && dashboardData?.patient?._id) {
      const socket = connectSocket(localStorage.getItem('token') || undefined);
      joinRooms({ role: 'PATIENT', patientId: dashboardData.patient._id, userId: user.id });

      const handleChat = (payload: any) => {
        // Basic toast for incoming chat; can be replaced with UI later
        toast.custom((t) => (
          <div className="glass-card p-4 border border-slate-200">
            <p className="font-bold text-slate-800">New message</p>
            <p className="text-slate-600 text-sm">{payload?.message?.text || 'Message received'}</p>
          </div>
        ));
      };
      onChatReceive(handleChat);

      return () => {
        offChatReceive(handleChat);
      };
    }
  }, [user, dashboardData?.patient?._id]);

  useEffect(() => {
    if (user && dashboardData) { // Only fetch history if dashboardData is already loaded
      fetchVitalsHistory();
    }
  }, [timeframe, user, dashboardData?.lastVitals]); // Re-fetch if timeframe changes or if dashboardData (specifically lastVitals) updates

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getPatientDashboard();
      if (response.success) {
        setDashboardData(response.data);
        // Initially fetch history for current timeframe after dashboard data is set
        // This will be triggered by the second useEffect due to dashboardData change
      } else {
        setError(response.message);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboard');
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchVitalsHistory = async () => {
    try {
      const response = await apiClient.getVitalsHistory(timeframe);
      if (response.success) {
        interface VitalRecord {
          recorded_at: string;
          heartRate?: number;
          systolicBP?: number;
          diastolicBP?: number;
          oxygenLevel?: number;
          temperature?: number;
          respiratoryRate?: number;
          name: string;
        }

        interface DashboardDataState {
          vitalsHistory: VitalRecord[];
          [key: string]: any;
        }

        setDashboardData((prev: DashboardDataState | null) => prev ? {
          ...prev,
          vitalsHistory: response.data.map((v: VitalRecord) => ({
            ...v,
            name: new Date(v.recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          }))
        } : null);
      } else {
        console.error('History fetch failed:', response.message);
      }
    } catch (error) {
      console.error('History fetch failed:', error);
    }
  };

  const fetchDoctors = async () => {
    try {
      const response = await apiClient.getAvailableDoctors();
      if (response.success && response.data) {
        setDoctors(response.data || []);
      }
    } catch (error) {
      // Fallback to any doctors present in dashboard data
      if (dashboardData?.doctors) {
        setDoctors(dashboardData.doctors);
      } else {
        console.error('Failed to fetch doctors', error);
      }
    }
  };

  const notifyDoctor = async () => {
    if (!selectedDoctor) return;
    try {
      const res = await apiClient.notifyDoctorForCriticalVitals(selectedDoctor);
      if (res.success) {
        // Find the active alert
        const activeAlert = dashboardData.alerts.find((a: any) => a.id === currentAlertForConsult);
        
        // Prepare and send automatic message
        const alertMessage = activeAlert ? `🚨 CRITICAL ALERT NOTIFICATION\n\n${activeAlert.message}\n\nI need immediate medical consultation regarding these critical vitals.` : "I need medical consultation regarding my recent critical vitals.";
        
        await apiClient.sendPatientChatMessage(selectedDoctor, alertMessage);

        toast.success('Doctor notified and message sent!');
        
        setShowDoctorSelect(false);
        setCurrentAlertForConsult(null);
        
        // Refresh dashboard to reflect consultation status
        fetchDashboardData();

        // Open chat modal after brief delay
        setTimeout(() => {
          setShowChatModal(true);
        }, 300);
      } else {
        toast.error(res.message || 'Failed to notify doctor');
      }
    } catch (error) {
      toast.error('Failed to notify doctor');
    }
  };

  if (loading) {
    return (
      <ProtectedLayout allowedRoles={['PATIENT']}>
        <div className="flex items-center justify-center h-96">
          <Loader className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout allowedRoles={['PATIENT']}>
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
                Welcome, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">{user?.firstName}!</span>
              </h1>
              <p className="text-slate-500 font-medium text-lg flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-500" />
                Here's your real-time health and vital signs overview.
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
            <div className="mb-6 p-4 bg-red-50/90 backdrop-blur border border-red-200 rounded-xl flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-red-900">Error</p>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Critical Vitals Alert - Compact Inline */}
          {dashboardData?.alerts && dashboardData.alerts.filter((alert: any) => {
            if (alert.category !== 'CRITICAL' || dismissedAlerts.has(alert.id)) return false;
            
            // Check if alert is within 24 hours
            const createdTime = new Date(alert.timestamp).getTime();
            const now = new Date().getTime();
            const hoursOld = (now - createdTime) / (1000 * 60 * 60);
            return hoursOld < 24;
          }).map((alert: any) => {
            const messageLines = alert.message.split('\n').filter((line: string) => line.trim());
            const issuesLine = messageLines.find((l: string) => l.toUpperCase().includes('ISSUES:'));
            const issuesText = issuesLine ? issuesLine.split(/issues:/i)[1] : '';
            const issues = issuesText ? issuesText.split(';').map((i: string) => i.trim()).filter((i: string) => i.length > 0) : [];
            
            return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setExpandedAlert(alert.id)}
              className="mb-6 p-4 bg-red-50 border border-red-300 rounded-lg shadow-md cursor-pointer hover:shadow-lg hover:bg-red-100 transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <p className="font-bold text-red-900 text-sm">🔴 Critical Vitals Alert</p>
                    <p className="text-xs text-red-700 mt-1">
                      {issues.length > 0 ? issues.slice(0, 2).join(', ') + (issues.length > 2 ? '...' : '') : 'Critical vitals detected'}
                    </p>
                    <p className="text-xs text-red-600 mt-0.5 font-semibold">Click for immediate recommendations & doctor consultation</p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDismissedAlerts(prev => new Set(prev).add(alert.id));
                  }}
                  className="p-1 hover:bg-red-200 rounded transition-colors flex-shrink-0"
                >
                  <X className="w-4 h-4 text-red-600" />
                </button>
              </div>
            </motion.div>
            );
          })}

          {/* Doctor Selection Modal */}
          {showDoctorSelect && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[200] p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white p-10 w-full max-w-md rounded-[3rem] border border-white/40 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] relative overflow-hidden"
              >
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-50 rounded-full blur-3xl opacity-60" />
                
                <div className="relative">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="p-4 bg-emerald-600 rounded-3xl shadow-xl shadow-emerald-200">
                      <Stethoscope className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-3xl font-black text-slate-800 tracking-tight leading-none">Consult</h3>
                      <p className="text-emerald-600 font-black uppercase tracking-widest text-[10px] mt-1">Specialist Selection</p>
                    </div>
                  </div>
                  
                  <p className="text-slate-500 font-bold text-sm mb-8 leading-relaxed">
                    Select a healthcare professional to review your clinical vitals and provide immediate guidance.
                  </p>
                  
                  <div className="relative mb-10 group">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1">Choose your provider</label>
                    <div className="relative">
                      <select
                        value={selectedDoctor}
                        onChange={(e) => setSelectedDoctor(e.target.value)}
                        className="w-full px-6 py-5 bg-slate-50 border-2 border-transparent rounded-[1.5rem] appearance-none focus:outline-none focus:bg-white focus:border-emerald-500 transition-all font-black text-slate-800 shadow-inner group-hover:bg-slate-100/50"
                      >
                        <option value="">{doctors.length === 0 ? 'Loading experts...' : 'Choose a professional...'}</option>
                        {doctors.map((doc) => (
                          <option key={doc.id || doc._id} value={doc.id || doc._id}>
                            {doc.name ? `Dr. ${doc.name}` : `Dr. ${doc.firstName || ''} ${doc.lastName || ''}`} — {doc.specialization || 'General Practice'}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <ChevronRight className="w-5 h-5 rotate-90" />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={notifyDoctor} 
                      disabled={!selectedDoctor}
                      className="w-full h-16 bg-emerald-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-emerald-700 shadow-xl shadow-emerald-100 active:scale-[0.98] disabled:opacity-50 disabled:scale-100 transition-all flex items-center justify-center gap-3"
                    >
                      Initialize Consultation
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => {
                        setShowDoctorSelect(false);
                        setSelectedDoctor('');
                      }} 
                      className="w-full h-16 bg-white text-slate-400 font-black uppercase tracking-widest text-xs rounded-2xl border-2 border-slate-100 hover:bg-slate-50 hover:text-slate-600 transition-all"
                    >
                      Maybe Later
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {dashboardData && (
            <>
              {/* Stats Cards */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
              >
                {[
                  { label: 'Heart Rate', value: `${dashboardData.lastVitals?.heartRate || '--'} bpm`, icon: Heart, color: 'rose' },
                  { label: 'Blood Pressure', value: `${dashboardData.lastVitals?.systolicBP || '--'}/${dashboardData.lastVitals?.diastolicBP || '--'}`, icon: TrendingUp, color: 'orange' },
                  { label: 'Oxygen Level', value: `${dashboardData.lastVitals?.oxygenLevel || '--'}%`, icon: Droplets, color: 'sky' },
                  { label: 'Temperature', value: `${dashboardData.lastVitals?.temperature || '--'}°F`, icon: Thermometer, color: 'amber' },
                ].map((stat, i) => (
                  <div key={i} className="glass-card p-6 border-white/40 hover:scale-[1.02] transition-transform duration-300">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-1">{stat.label}</p>
                        <p className="text-2xl font-black text-slate-800">{stat.value}</p>
                      </div>
                      <div className={`p-4 bg-${stat.color}-50 text-${stat.color}-600 rounded-2xl`}>
                        <stat.icon className="w-6 h-6" />
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>

              {/* Unified Trend Chart Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-card p-8 border-white/40 mb-8"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
                  <div>
                    <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                      <TrendingUp className="w-6 h-6 text-emerald-500" />
                      Health & Vitals Trends
                    </h2>
                    <p className="text-slate-500 font-medium">Visualize your progress over time</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200">
                    {[7, 30, 90].map((t) => (
                      <button
                        key={t}
                        onClick={() => setTimeframe(t as any)}
                        className={`px-5 py-2.5 rounded-xl text-sm font-black transition-all ${timeframe === t
                          ? 'bg-white text-emerald-600 shadow-lg shadow-emerald-500/10'
                          : 'text-slate-500 hover:text-slate-800'
                          }`}
                      >
                        {t === 7 ? 'Last Week' : t === 30 ? 'Last Month' : '3 Months'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Metric Selectors */}
                <div className="flex flex-wrap gap-3 mb-8">
                  {[
                    { id: 'heartRate', label: 'Heart Rate', color: '#f43f5e', icon: Heart },
                    { id: 'systolicBP', label: 'Blood Pressure', color: '#f59e0b', icon: Activity },
                    { id: 'oxygenLevel', label: 'Oxygen', color: '#0ea5e9', icon: Droplets },
                    { id: 'temperature', label: 'Temperature', color: '#8b5cf6', icon: Thermometer },
                    { id: 'respiratoryRate', label: 'Respiration', color: '#10b981', icon: Activity },
                  ].map((m) => {
                    const isActive = activeMetrics.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        onClick={() => setActiveMetrics(prev =>
                          isActive ? prev.filter(a => a !== m.id) : [...prev, m.id]
                        )}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 border-2 transition-all ${isActive
                          ? `bg-white border-[${m.color}] text-slate-800 shadow-md`
                          : 'bg-transparent border-slate-200 text-slate-400 hover:border-slate-300'
                          }`}
                        style={{ borderColor: isActive ? m.color : undefined }}
                      >
                        <m.icon className="w-3.5 h-3.5" style={{ color: isActive ? m.color : undefined }} />
                        {m.label}
                      </button>
                    );
                  })}
                </div>

                <div className="h-[400px] w-full flex items-center justify-center">
                  {dashboardData.vitalsHistory && dashboardData.vitalsHistory.length > 0 ? (
                    <AreaChartWrapper
                      data={dashboardData.vitalsHistory}
                      areas={[
                        { id: 'heartRate', stroke: '#f43f5e', label: 'Heart Rate' },
                        { id: 'systolicBP', stroke: '#f59e0b', label: 'Systolic BP' },
                        { id: 'diastolicBP', stroke: '#fbbf24', label: 'Diastolic BP' },
                        { id: 'oxygenLevel', stroke: '#0ea5e9', label: 'Oxygen Level' },
                        { id: 'temperature', stroke: '#8b5cf6', label: 'Temperature' },
                        { id: 'respiratoryRate', stroke: '#10b981', label: 'Respiration' },
                      ].filter(a => activeMetrics.includes(a.id) || (a.id === 'diastolicBP' && activeMetrics.includes('systolicBP')))
                        .map(a => ({
                          dataKey: a.id,
                          stroke: a.stroke,
                          gradientId: `${a.id}Gradient`
                        }))}
                    />
                  ) : (
                    <div className="text-center p-12 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200 w-full">
                      <div className="bg-white w-16 h-16 rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4 border border-slate-100">
                        <TrendingUp className="w-8 h-8 text-slate-300" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-800 mb-1">No data currently available</h3>
                      <p className="text-sm text-slate-500 max-w-xs mx-auto">
                        Your health vitals history will appear here once you start recording them.
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Main Content Grid */}
              <div className="grid lg:grid-cols-3 gap-8">
                {/* Alerts Section */}
                <div className="lg:col-span-2">
                  <div className="glass-panel p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-bold text-slate-800">Recent Alerts</h2>
                      <button 
                        onClick={() => router.push('/patient/alerts')} 
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 px-3 py-1 border border-emerald-200 rounded-lg hover:bg-emerald-50 transition-all"
                      >
                        View All
                      </button>
                    </div>
                    {dashboardData.alerts && dashboardData.alerts.length > 0 ? (
                      <div className="space-y-2">
                        {dashboardData.alerts.slice(0, 5).map((alert: any) => {
                          const createdTime = new Date(alert.timestamp).getTime();
                          const now = new Date().getTime();
                          const hoursOld = (now - createdTime) / (1000 * 60 * 60);
                          const isWithin24h = hoursOld < 24;
                          
                          return (
                            <motion.div
                              key={alert.id}
                              onClick={() => setExpandedAlert(alert.id)}
                              className={`p-3 rounded-lg border-l-4 backdrop-blur-sm cursor-pointer hover:shadow-md transition-all ${alert.category === 'CRITICAL'
                                ? 'bg-red-50/50 border-red-500 hover:bg-red-100/50'
                                : alert.category === 'WARNING'
                                  ? 'bg-amber-50/50 border-amber-500 hover:bg-amber-100/50'
                                  : 'bg-blue-50/50 border-blue-500 hover:bg-blue-100/50'
                                }`}
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="font-medium text-slate-800 text-sm">
                                      {alert.category === 'CRITICAL' ? '🔴' : alert.category === 'WARNING' ? '⚠️' : 'ℹ️'} {alert.message.split('\n')[0]}
                                    </p>
                                    {alert.status === 'RESOLVED' && (
                                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold uppercase">
                                        ✓ Resolved
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500 mt-1">
                                    {new Date(alert.timestamp).toLocaleString()}
                                    {!isWithin24h && ' • Expired'}
                                  </p>
                                </div>
                                <span
                                  className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ml-2 ${alert.category === 'CRITICAL'
                                    ? 'bg-red-200 text-red-800'
                                    : alert.category === 'WARNING'
                                      ? 'bg-amber-200 text-amber-800'
                                      : 'bg-blue-200 text-blue-800'
                                    }`}
                                >
                                  {alert.category}
                                </span>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-slate-500 text-center py-4">No alerts</p>
                    )}
                  </div>
                </div>

                {/* Upcoming Appointments Section */}
                <div>
                  <div className="glass-panel p-6">
                    <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-emerald-600" />
                      Upcoming Appointments
                    </h2>
                    {dashboardData.upcomingAppointments && dashboardData.upcomingAppointments.length > 0 ? (
                      <div className="space-y-3">
                        {dashboardData.upcomingAppointments.slice(0, 5).map((appointment: any) => (
                          <div key={appointment.id} className="p-3 bg-white/40 rounded-xl border border-white/50 backdrop-blur-sm hover:bg-white/60 transition">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-medium text-slate-800 text-sm">
                                  {appointment.doctorName}
                                </p>
                                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {new Date(appointment.scheduledTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                </p>
                              </div>
                              <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                                {appointment.type}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                        <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-400 text-sm font-medium">No upcoming appointments</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              
            </>
          )}
        </div>
      </div>

      {/* Alert Detail Modal */}
      <AnimatePresence>
        {expandedAlert && dashboardData?.alerts && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setExpandedAlert(null)}
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
                    <h3 className="text-2xl font-bold text-slate-800">{dashboardData.alerts.find((a: any) => a.id === expandedAlert)?.message.split('\n')[0] || 'Alert'}</h3>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-semibold whitespace-nowrap ${dashboardData.alerts.find((a: any) => a.id === expandedAlert)?.category === 'CRITICAL'
                        ? 'bg-red-200 text-red-800'
                        : dashboardData.alerts.find((a: any) => a.id === expandedAlert)?.category === 'WARNING'
                          ? 'bg-amber-200 text-amber-800'
                          : 'bg-blue-200 text-blue-800'
                        }`}
                    >
                      {dashboardData.alerts.find((a: any) => a.id === expandedAlert)?.category}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-2">{new Date(dashboardData.alerts.find((a: any) => a.id === expandedAlert)?.timestamp || '').toLocaleString()}</p>
                </div>
                <button
                  onClick={() => setExpandedAlert(null)}
                  className="text-slate-400 hover:text-slate-600 transition ml-4"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                {dashboardData.alerts.find((a: any) => a.id === expandedAlert) && (() => {
                  const alert = dashboardData.alerts.find((a: any) => a.id === expandedAlert)!;
                  const lines = (alert.message || '').split('\n').filter((l: string) => l.trim());
                  
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

                  const createdTime = new Date(alert.timestamp).getTime();
                  const now = new Date().getTime();
                  const hoursOld = (now - createdTime) / (1000 * 60 * 60);
                  const isWithin24h = hoursOld < 24;

                  return (
                    <>
                      {/* Doctor Consultation Status */}
                      {alert.doctor_id && (
                        <div className="p-4 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl text-white shadow-lg">
                          <div className="flex items-center gap-3 mb-2">
                            <Stethoscope className="w-5 h-5" />
                            <p className="text-sm font-bold">Consultation Active</p>
                          </div>
                          <p className="text-xs font-semibold opacity-90">
                            Being reviewed by Dr. {alert.doctor_name || 'a specialist'}
                          </p>
                          <div className="mt-3 pt-3 border-t border-white/20 text-[10px] font-bold uppercase tracking-widest opacity-80">
                            {alert.resolved_at 
                              ? `Resolved: ${new Date(alert.resolved_at).toLocaleDateString()}`
                              : 'Status: In Assessment'}
                          </div>
                        </div>
                      )}

                      {/* Doctor's Resolution - Instructions and Prescription */}
                      {alert.status === 'RESOLVED' && (alert.instructions || alert.prescription) && (
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="w-6 h-6 text-emerald-600" />
                            <h4 className="text-xl font-bold text-emerald-800">Alert Resolved</h4>
                          </div>
                          
                          {alert.instructions && (
                            <div className="bg-emerald-50 p-6 rounded-2xl border-2 border-emerald-200">
                              <div className="flex items-center gap-2 mb-3">
                                <Stethoscope className="w-5 h-5 text-emerald-700" />
                                <h5 className="text-sm font-bold text-emerald-900 uppercase tracking-wider">Doctor's Instructions</h5>
                              </div>
                              <p className="text-sm text-emerald-900 leading-relaxed whitespace-pre-wrap font-medium">
                                {alert.instructions}
                              </p>
                            </div>
                          )}

                          {alert.prescription && (
                            <div className="bg-blue-50 p-6 rounded-2xl border-2 border-blue-200">
                              <div className="flex items-center gap-2 mb-3">
                                <Activity className="w-5 h-5 text-blue-700" />
                                <h5 className="text-sm font-bold text-blue-900 uppercase tracking-wider">Prescription</h5>
                              </div>
                              <p className="text-sm text-blue-900 leading-relaxed whitespace-pre-wrap font-medium">
                                {alert.prescription}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

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

                      {!isWithin24h && (
                        <div className="p-4 bg-slate-100 border border-slate-200 rounded-2xl flex items-center gap-4">
                          <Clock className="w-5 h-5 text-slate-400" />
                          <p className="text-xs text-slate-500 font-bold leading-relaxed">
                            This alert was recorded over 24 hours ago. Symptoms may have changed since this analysis.
                          </p>
                        </div>
                      )}

                      <div className="flex gap-3 pt-6 border-t border-slate-100">
                        {/* Show consult button only if no doctor assigned and within 24h */}
                        {!alert.doctor_id && isWithin24h && alert.category === 'CRITICAL' && (
                          <button
                            onClick={() => {
                              setCurrentAlertForConsult(alert.id);
                              setShowDoctorSelect(true);
                            }}
                            className="flex-1 h-12 bg-slate-900 text-white font-black uppercase tracking-widest text-xs rounded-xl hover:bg-black transition-all flex items-center justify-center gap-2"
                          >
                            <Users className="w-4 h-4" />
                            Consult Specialist
                          </button>
                        )}
                        
                        {/* Show continue consultation if doctor already assigned */}
                        {alert.doctor_id && (
                          <button
                            onClick={() => {
                              setExpandedAlert(null);
                              setTimeout(() => setShowChatModal(true), 100);
                            }}
                            className="flex-1 h-12 bg-emerald-600 text-white font-black uppercase tracking-widest text-xs rounded-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                          >
                            <MessageSquare className="w-4 h-4" />
                            Message Doctor
                          </button>
                        )}
                        
                        <button
                          onClick={() => setExpandedAlert(null)}
                          className="flex-1 h-12 bg-slate-100 text-slate-600 font-black uppercase tracking-widest text-xs rounded-xl hover:bg-slate-200 transition-all"
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

      {/* Doctor Selection Modal */}
      <AnimatePresence>
        {showDoctorSelect && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[200] p-4"
            onClick={() => {
              setShowDoctorSelect(false);
              setSelectedDoctor('');
              setCurrentAlertForConsult(null);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white p-10 w-full max-w-md rounded-[3rem] border border-white/40 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] relative overflow-hidden"
            >
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-50 rounded-full blur-3xl opacity-60" />
              
              <div className="relative">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-4 bg-emerald-600 rounded-3xl shadow-xl shadow-emerald-200">
                    <Stethoscope className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-slate-800 tracking-tight leading-none">Consult</h3>
                    <p className="text-emerald-600 font-black uppercase tracking-widest text-[10px] mt-1">Specialist Selection</p>
                  </div>
                </div>
                
                <p className="text-slate-500 font-bold text-sm mb-8 leading-relaxed">
                  Select a healthcare professional to review your clinical vitals and provide immediate guidance.
                </p>
                
                {doctors.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                    <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">No experts available</p>
                  </div>
                ) : (
                  <div className="relative mb-10 group">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1">Choose your provider</label>
                    <div className="relative">
                      <select
                        value={selectedDoctor || ''}
                        onChange={(e) => setSelectedDoctor(e.target.value)}
                        className="w-full px-6 py-5 bg-slate-50 border-2 border-transparent rounded-[1.5rem] appearance-none focus:outline-none focus:bg-white focus:border-emerald-500 transition-all font-black text-slate-800 shadow-inner group-hover:bg-slate-100/50"
                      >
                        <option value="" disabled>Choose a professional...</option>
                        {doctors.map((doctor) => (
                          <option key={doctor.id || doctor._id} value={doctor.id || doctor._id}>
                            Dr. {doctor.name || doctor.firstName || 'Specialist'} {(!doctor.name && doctor.lastName) ? doctor.lastName : ''} — {doctor.specialization || 'General Practice'}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <ChevronRight className="w-5 h-5 rotate-90" />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <button 
                    onClick={async () => {
                      if (!selectedDoctor) {
                        toast.error("Please select a doctor");
                        return;
                      }
                      try {
                        const res = await apiClient.notifyDoctorForCriticalVitals(selectedDoctor);
                        if (res.success) {
                          const currentAlert = dashboardData.alerts.find((a: any) => a.id === currentAlertForConsult);
                          const selectedDoc = doctors.find(d => (d.id === selectedDoctor || d._id === selectedDoctor)) || { id: selectedDoctor, name: 'Consulting Doctor' };
                          
                          toast.success(`Specialist consultation initiated with Dr. ${selectedDoc.name}`);
                          setShowDoctorSelect(false);
                          setSelectedDoctor('');
                          
                          // Update alert data to show doctor assigned
                          if (currentAlert) {
                            currentAlert.doctor_id = selectedDoctor;
                            currentAlert.doctor_name = selectedDoc.name;
                          }
                          
                          // Refresh data
                          const response = await apiClient.getPatientDashboard();
                          if (response.success) {
                            setDashboardData(response.data);
                          }
                        } else {
                          toast.error("Failed to initialize consultation");
                        }
                      } catch (error) {
                        console.error("Error initializing consultation:", error);
                        toast.error("Error initializing consultation");
                      }
                    }} 
                    disabled={!selectedDoctor}
                    className="w-full h-16 bg-emerald-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-emerald-700 shadow-xl shadow-emerald-100 active:scale-[0.98] disabled:opacity-50 disabled:scale-100 transition-all flex items-center justify-center gap-3"
                  >
                    Initialize Consultation
                    <MessageSquare className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => {
                      setShowDoctorSelect(false);
                      setSelectedDoctor('');
                      setCurrentAlertForConsult(null);
                    }}
                    className="w-full h-16 bg-slate-100 text-slate-600 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ChangePasswordModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} />
      <ChatModal 
        isOpen={showChatModal} 
        onClose={() => setShowChatModal(false)}
      />
    </ProtectedLayout>
  );
}
