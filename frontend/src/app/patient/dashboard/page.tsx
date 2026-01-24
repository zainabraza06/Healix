'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/authStore';
import { apiClient } from '@/lib/apiClient';
import ProtectedLayout from '@/components/ProtectedLayout';
import { Loader, AlertCircle, Activity, TrendingUp, Users, Clock, Lock, Heart, Thermometer, Droplets, X, MessageSquare } from 'lucide-react';
import { connectSocket, joinRooms, onChatReceive, offChatReceive } from '@/lib/socket';
import { useRouter } from 'next/navigation';
import ChangePasswordModal from '@/components/ChangePasswordModal';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';

// Import chart wrapper components
import { AreaChartWrapper } from '@/components/charts/ChartWrappers';
import { motion } from 'framer-motion';

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
        setDashboardData(prev => prev ? {
          ...prev,
          vitalsHistory: response.data.map((v: any) => ({
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
        toast.success('Doctor notified! Opening chat...');
        setShowDoctorSelect(false);
        // Redirect to chat after brief delay
        setTimeout(() => {
          router.push(`/patient/chat/${selectedDoctor}`);
        }, 500);
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
          {dashboardData?.alerts && dashboardData.alerts.filter((alert: any) => 
            alert.category === 'CRITICAL' && !dismissedAlerts.has(alert.id)
          ).map((alert: any) => {
            const messageLines = alert.message.split('\n').filter((line: string) => line.trim());
            const issuesLine = messageLines.find((l: string) => l.includes('Issues:'));
            const issues = issuesLine ? issuesLine.replace('Issues: ', '').split('; ').slice(0, 2) : [];
            
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
                      {issues.slice(0, 1).map(i => i.trim()).join(', ')}
                      {issues.length > 1 && ` + ${issues.length} more`}
                    </p>
                    <p className="text-xs text-red-600 mt-0.5">Click to view details</p>
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

          {/* Alert Details Modal */}
          {expandedAlert && dashboardData?.alerts && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div 
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => setExpandedAlert(null)}
              ></div>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl"
              >
                {(() => {
                  const alert = dashboardData.alerts.find((a: any) => a.id === expandedAlert);
                  if (!alert) return null;
                  
                  // Check if alert is within 24 hours
                  const createdTime = new Date(alert.timestamp).getTime();
                  const now = new Date().getTime();
                  const hoursOld = (now - createdTime) / (1000 * 60 * 60);
                  const isWithin24h = hoursOld < 24;
                  
                  const msg = alert.message || '';
                  const lines = msg.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                  
                  // Issues are on the line after title (line 1)
                  let issues: string[] = [];
                  if (lines.length > 1) {
                    const issuesLine = lines[1];
                    if (!issuesLine.includes('RECOMMENDATIONS')) {
                      issues = issuesLine.split(',').map(i => i.trim()).filter(i => i.length > 0);
                    }
                  }
                  
                  // Recommendations start after "RECOMMENDATIONS:\" line (only show if within 24h)
                  let recs: string[] = [];
                  if (isWithin24h) {
                    const recsStartIdx = lines.findIndex(l => l.includes('RECOMMENDATIONS'));
                    if (recsStartIdx !== -1 && recsStartIdx < lines.length - 1) {
                      recs = lines.slice(recsStartIdx + 1).filter(r => r.length > 0);
                    }
                  }
                  
                  return (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-black text-slate-800">Alert Details</h2>
                        <button onClick={() => setExpandedAlert(null)} className="p-1 hover:bg-slate-100 rounded">
                          <X className="w-5 h-5 text-slate-600" />
                        </button>
                      </div>
                      
                      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                        {/* Issues */}
                        {issues.length > 0 ? (
                          <div>
                            <p className="font-bold text-red-900 text-sm mb-2">🔴 Critical Issues:</p>
                            <div className="space-y-2 bg-red-50 p-3 rounded-lg border border-red-200">
                              {issues.map((issue: string, i: number) => (
                                <p key={i} className="text-sm text-red-800 leading-relaxed">
                                  • {issue}
                                </p>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {/* Recommendations (only within 24h) */}
                        {isWithin24h && recs.length > 0 && (
                          <div>
                            <p className="font-bold text-orange-900 text-sm mb-2">💡 What to Do:</p>
                            <div className="space-y-2 bg-orange-50 p-3 rounded-lg border border-orange-200">
                              {recs.map((rec: string, i: number) => (
                                <p key={i} className="text-sm text-orange-800 leading-relaxed">
                                  • {rec}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Alert Age Warning */}
                        {!isWithin24h && (
                          <div className="p-3 bg-slate-100 border border-slate-300 rounded-lg">
                            <p className="text-xs text-slate-700">
                              ℹ️ This alert is older than 24 hours. Consultation is no longer available.
                            </p>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 pt-4 border-t">
                          {isWithin24h && (
                            <button
                              onClick={() => {
                                setExpandedAlert(null);
                                setShowDoctorSelect(true);
                                fetchDoctors();
                              }}
                              className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-all"
                            >
                              Consult Doctor
                            </button>
                          )}
                          <button
                            onClick={() => setExpandedAlert(null)}
                            className={`${isWithin24h ? 'flex-1' : 'w-full'} px-4 py-2 bg-slate-200 text-slate-800 text-sm font-bold rounded-lg hover:bg-slate-300 transition-all`}
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </motion.div>
            </div>
          )}

          {/* Doctor Selection Modal */}
          {showDoctorSelect && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
              <div className="glass-card p-6 w-full max-w-md">
                <h3 className="text-xl font-black text-slate-800 mb-4">Select a Doctor</h3>
                <select
                  value={selectedDoctor}
                  onChange={(e) => setSelectedDoctor(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl mb-4"
                >
                  <option value="">Choose a doctor</option>
                  {doctors.map((doc) => (
                    <option key={doc.id || doc._id} value={doc.id || doc._id}>
                      Dr. {doc.firstName || doc.user_id?.full_name} {doc.lastName || ''}
                    </option>
                  ))}
                </select>
                <div className="flex gap-3">
                  <button onClick={() => setShowDoctorSelect(false)} className="px-5 py-2 bg-slate-200 rounded-xl">Cancel</button>
                  <button onClick={notifyDoctor} className="px-5 py-2 bg-emerald-600 text-white rounded-xl">Notify</button>
                </div>
              </div>
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
                      {dashboardData.alerts && dashboardData.alerts.length > 5 && (
                        <button onClick={() => router.push('/patient/alerts')} className="text-xs font-bold text-emerald-600 hover:text-emerald-700 px-3 py-1 border border-emerald-200 rounded-lg hover:bg-emerald-50 transition-all">
                          View All
                        </button>
                      )}
                    </div>
                    {dashboardData.alerts && dashboardData.alerts.length > 0 ? (
                      <div className="space-y-2">
                        {dashboardData.alerts.slice(0, 5).map((alert: any) => (
                          <div
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
                                <p className="font-medium text-slate-800 text-sm">
                                  {alert.category === 'CRITICAL' ? '🔴' : alert.category === 'WARNING' ? '⚠️' : 'ℹ️'} {alert.message.split('\n')[0]}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                  {new Date(alert.timestamp).toLocaleString()}
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
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 text-center py-4">No alerts</p>
                    )}
                  </div>
                </div>

                {/* Doctors Section */}
                <div>
                  <div className="glass-panel p-6">
                    <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <Users className="w-5 h-5 text-emerald-600" />
                      Doctors
                    </h2>
                    {dashboardData.doctors && dashboardData.doctors.length > 0 ? (
                      <div className="space-y-3">
                        {dashboardData.doctors.slice(0, 5).map((doctor: any) => (
                          <div key={doctor.id} className="p-3 bg-white/40 rounded-xl border border-white/50 backdrop-blur-sm">
                            <p className="font-medium text-slate-800">
                              Dr. {doctor.firstName} {doctor.lastName}
                            </p>
                            <p className="text-xs text-slate-500">{doctor.specialization}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 text-center py-4">No doctors assigned</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="mt-8 grid md:grid-cols-4 gap-4">
                <button onClick={() => router.push('/patient/vitals')} className="glass-card p-4 hover:bg-white/60 transition text-center group">
                  <Activity className="w-6 h-6 text-blue-600 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <p className="font-semibold text-slate-800">Upload Vitals</p>
                  <p className="text-xs text-slate-500">Share vital signs data</p>
                </button>
                <button className="glass-card p-4 hover:bg-white/60 transition text-center group">
                  <Clock className="w-6 h-6 text-emerald-600 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <p className="font-semibold text-slate-800">Book Appointment</p>
                  <p className="text-xs text-slate-500">Schedule with a doctor</p>
                </button>
                <button className="glass-card p-4 hover:bg-white/60 transition text-center group">
                  <MessageSquare className="w-6 h-6 text-purple-600 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <p className="font-semibold text-slate-800">Messages</p>
                  <p className="text-xs text-slate-500">Chat with doctors</p>
                </button>
                <button className="glass-card p-4 hover:bg-white/60 transition text-center group">
                  <AlertCircle className="w-6 h-6 text-red-600 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <p className="font-semibold text-slate-800">Emergency Alert</p>
                  <p className="text-xs text-slate-500">Send urgent notification</p>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <ChangePasswordModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} />
    </ProtectedLayout>
  );
}
