"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/authStore";
import { apiClient } from "@/lib/apiClient";
import ProtectedLayout from "@/components/ProtectedLayout";
import { AlertCircle, ChevronLeft, ChevronRight, X, Stethoscope, MessageSquare, CheckCircle, Clock, Users, Plus, Activity, Calendar } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import dynamic from "next/dynamic";
import ChatModal from "@/components/ChatModal";
import CreateAlertModal from "@/components/CreateAlertModal";

// 3D Background
const Scene = dynamic(() => import('@/components/canvas/Scene'), { ssr: false });
const FloatingIcons = dynamic(() => import('@/components/canvas/FloatingIcons').then(mod => mod.FloatingIcons), { ssr: false });

export default function AllAlertsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'RESOLVED'>('ALL');
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [showDoctorSelect, setShowDoctorSelect] = useState(false);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null);
  const [currentAlertForConsult, setCurrentAlertForConsult] = useState<string | null>(null);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showCreateAlertModal, setShowCreateAlertModal] = useState(false);

  const pageSize = 10;

  useEffect(() => {
    if (user) {
      fetchAlerts();
      fetchDoctors();
    }
  }, [user, statusFilter, page]);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const statusQuery = statusFilter === 'ALL' ? '' : `&status=${statusFilter}`;
      const response = await apiClient.get(`/patient/alerts?page=${page}&size=${pageSize}${statusQuery}`);
      if (response.success && response.data) {
        setAlerts(response.data.content || []);
        setTotalPages(response.data.totalPages || 1);
      }
    } catch (error) {
      console.error('Failed to fetch alerts', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctors = async () => {
    try {
      setLoadingDoctors(true);
      const response = await apiClient.getAvailableDoctors();
      console.log('Doctors API Response:', response);
      if (response.success) {
        const doctorsListRaw = response.data || [];
        const doctorsList = doctorsListRaw.map((d: any) => ({
          ...d,
          id: d.id || d._id,
          name: d.name || `${d.firstName || ''} ${d.lastName || ''}`.trim()
        }));
        console.log('Doctors list:', doctorsList);
        setDoctors(doctorsList);
      } else {
        console.error('API returned success:false', response);
      }
    } catch (error) {
      console.error('Failed to fetch doctors', error);
      toast.error('Failed to load doctors');
    } finally {
      setLoadingDoctors(false);
    }
  };

  const handleConsultDoctor = (alertId: string) => {
    setCurrentAlertForConsult(alertId);
    setShowDoctorSelect(true);
    fetchDoctors();
  };

  const notifyDoctor = async () => {
    if (!selectedDoctor) {
      toast.error("Please select a doctor");
      return;
    }
    try {
      const res = await apiClient.notifyDoctorForCriticalVitals(selectedDoctor);
      if (res.success) {
        // Get the current alert details
        const currentAlert = alerts.find(a => a.id === currentAlertForConsult);
        
        // Prepare initial chat message with alert details
        const alertMessage = currentAlert ? `🚨 CRITICAL ALERT NOTIFICATION\n\n${currentAlert.message}\n\nI need immediate medical consultation regarding these critical vitals.` : "I need medical consultation regarding my recent critical vitals.";
        
        // Actually SEND the message so it appears in chat
        await apiClient.sendPatientChatMessage(selectedDoctor, alertMessage);
        
        toast.success('Doctor notified and message sent!');
        
        setShowDoctorSelect(false);
        setExpandedAlert(null);
        
        // Refresh alerts to reflect the new consultation status
        fetchAlerts();
        
        // Open chat modal
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

  const paginatedAlerts = alerts; // server-paginated now

  return (
    <ProtectedLayout allowedRoles={["PATIENT"]}>
      <div className="min-h-screen relative overflow-hidden bg-slate-50">
        {/* 3D Background */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          <Scene className="h-full w-full">
            <FloatingIcons />
          </Scene>
        </div>

        {/* Glass Gradient Overlay */}
        <div className="fixed inset-0 z-0 bg-gradient-to-b from-white/0 via-transparent to-white/60 pointer-events-none" />

        <div className="relative z-10 container-main py-8">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex-1">
              <button 
                onClick={() => router.back()}
                className="flex items-center gap-2 text-emerald-600 font-bold mb-4 hover:text-emerald-700 transition"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <h1 className="text-4xl font-black text-slate-800 mb-2">
                Health <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500">Alerts</span>
              </h1>
              <p className="text-slate-600 font-medium">{alerts.length} total alerts</p>
            </div>
            
            {/* Create Alert Button */}
            <button
              onClick={() => setShowCreateAlertModal(true)}
              className="h-14 px-6 bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:shadow-xl hover:shadow-emerald-200 transition-all flex items-center gap-3 group shadow-lg self-start"
            >
              <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
              Create Alert
            </button>
          </div>

          {/* Status Filters */}
          <div className="mb-6 flex flex-wrap gap-3">
            {['ALL', 'ACTIVE', 'RESOLVED'].map((status) => {
              const isActive = statusFilter === status;
              const label = status === 'ALL' ? 'All' : status === 'ACTIVE' ? 'Unresolved' : 'Resolved';
              return (
                <button
                  key={status}
                  onClick={() => { setPage(0); setStatusFilter(status as any); }}
                  className={`px-4 py-2 rounded-full text-sm font-semibold border transition ${isActive ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'}`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="glass-card p-12 text-center">
              <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-600 font-bold">Loading alerts...</p>
            </div>
          ) : alerts.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <AlertCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 font-bold text-lg">No alerts yet</p>
              <p className="text-slate-500 text-sm mt-2">Your health alerts will appear here</p>
            </div>
          ) : (
            <>
              <div className="glass-card overflow-hidden">
                <div className="grid divide-y divide-slate-200">
                  {paginatedAlerts.map((alert: any) => {
                    const getSeverityColor = (severity: string) => {
                      switch (severity?.toUpperCase()) {
                        case 'CRITICAL': return 'bg-red-200 text-red-900 border-red-300';
                        case 'HIGH': return 'bg-orange-200 text-orange-900 border-orange-300';
                        case 'MEDIUM': return 'bg-yellow-100 text-yellow-900 border-yellow-200';
                        case 'LOW': return 'bg-blue-100 text-blue-900 border-blue-200';
                        default: return 'bg-slate-100 text-slate-700 border-slate-200';
                      }
                    };

                    const getStatusBadge = (status: string) => {
                      switch (status?.toUpperCase()) {
                        case 'ACTIVE': return 'bg-red-600 text-white';
                        case 'RESOLVED': return 'bg-emerald-600 text-white';
                        case 'ACKNOWLEDGED': return 'bg-amber-500 text-white';
                        default: return 'bg-slate-500 text-white';
                      }
                    };

                    return (
                      <div
                        key={alert.id}
                        onClick={() => setExpandedAlert(alert.id)}
                        className="p-6 hover:bg-white/50 transition cursor-pointer"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${getStatusBadge(alert.status)}`}>
                            {alert.status}
                          </span>
                          <span className={`px-2 py-0.5 border rounded text-[10px] font-black uppercase tracking-wider ${getSeverityColor(alert.severity || alert.category)}`}>
                            {(alert.severity || alert.category)?.toUpperCase()} SEVERITY
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-3">{alert.message?.split('\n')[0] || 'Health Alert'}</h3>

                        {/* Doctor Info */}
                        {alert.doctor_name && (
                          <div className="flex flex-wrap gap-4 text-xs mb-3">
                            <div className="flex items-center gap-1.5">
                              <Stethoscope className="w-4 h-4 text-blue-600" />
                              <span className="font-semibold text-slate-700">Dr. {alert.doctor_name}</span>
                            </div>
                          </div>
                        )}

                        {/* Date */}
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
                          <Calendar className="w-4 h-4" />
                          <span>{new Date(alert.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        <p className="text-xs text-slate-400 italic">Click to view full details</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {totalPages > 1 && (
                <div className="mt-6 p-6 bg-white/50 border-t border-slate-200 flex items-center justify-between">
                  <button
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                    className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-slate-600 font-medium">
                    Page {page + 1} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                    disabled={page === totalPages - 1}
                    className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Alert Details Modal */}
        <AnimatePresence>
          {expandedAlert && (
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
                      <h3 className="text-2xl font-bold text-slate-800">{alerts.find((a) => a.id === expandedAlert)?.message.split('\n')[0] || 'Alert'}</h3>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-semibold whitespace-nowrap ${alerts.find((a) => a.id === expandedAlert)?.category === 'CRITICAL'
                          ? 'bg-red-200 text-red-800'
                          : alerts.find((a) => a.id === expandedAlert)?.category === 'WARNING'
                            ? 'bg-amber-200 text-amber-800'
                            : 'bg-blue-200 text-blue-800'
                          }`}
                      >
                        {alerts.find((a) => a.id === expandedAlert)?.category}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-2">{new Date(alerts.find((a) => a.id === expandedAlert)?.timestamp || '').toLocaleString()}</p>
                  </div>
                  <button
                    onClick={() => setExpandedAlert(null)}
                    className="text-slate-400 hover:text-slate-600 transition ml-4"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="p-6 space-y-6">
                  {alerts.find((a) => a.id === expandedAlert) && (() => {
                    const alert = alerts.find((a) => a.id === expandedAlert)!;
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
                                handleConsultDoctor(alert.id);
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
                setSelectedDoctor(null);
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
                  
                  {loadingDoctors ? (
                    <div className="flex justify-center py-12">
                      <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : doctors.length === 0 ? (
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
                            <option key={doctor.id} value={doctor.id}>
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
                      onClick={notifyDoctor} 
                      disabled={!selectedDoctor || loadingDoctors}
                      className="w-full h-16 bg-emerald-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-emerald-700 shadow-xl shadow-emerald-100 active:scale-[0.98] disabled:opacity-50 disabled:scale-100 transition-all flex items-center justify-center gap-3"
                    >
                      Initialize Consultation
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => {
                        setShowDoctorSelect(false);
                        setSelectedDoctor(null);
                        setCurrentAlertForConsult(null);
                      }} 
                      className="w-full h-16 bg-white text-slate-400 font-black uppercase tracking-widest text-xs rounded-2xl border-2 border-slate-100 hover:bg-slate-50 hover:text-slate-600 transition-all"
                    >
                      Maybe Later
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      <ChatModal 
        isOpen={showChatModal} 
        onClose={() => setShowChatModal(false)}
      />

      <CreateAlertModal 
        isOpen={showCreateAlertModal}
        onClose={() => setShowCreateAlertModal(false)}
        doctors={doctors}
        onAlertCreated={() => {
          setShowCreateAlertModal(false);
          fetchAlerts();
        }}
      />
    </ProtectedLayout>
  );
}
