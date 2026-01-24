"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/authStore";
import { apiClient } from "@/lib/apiClient";
import ProtectedLayout from "@/components/ProtectedLayout";
import { AlertCircle, ChevronLeft, ChevronRight, X, Stethoscope, MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import dynamic from "next/dynamic";

// 3D Background
const Scene = dynamic(() => import('@/components/canvas/Scene'), { ssr: false });
const FloatingIcons = dynamic(() => import('@/components/canvas/FloatingIcons').then(mod => mod.FloatingIcons), { ssr: false });

export default function AllAlertsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [showDoctorSelect, setShowDoctorSelect] = useState(false);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null);
  const [currentAlertForConsult, setCurrentAlertForConsult] = useState<string | null>(null);

  const pageSize = 10;

  useEffect(() => {
    if (user) {
      fetchAlerts();
      fetchDoctors();
    }
  }, [user]);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getPatientDashboard();
      if (response.success) {
        setAlerts(response.data.alerts || []);
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
      if (response.success && response.data) {
        setDoctors(response.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch doctors', error);
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
        toast.success('Doctor notified! Opening chat...');
        setShowDoctorSelect(false);
        setExpandedAlert(null);
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

  const paginatedAlerts = alerts.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(alerts.length / pageSize);

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
          <div className="mb-8">
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
              <div className="space-y-4 mb-8">
                {paginatedAlerts.map((alert: any) => {
                  const createdTime = new Date(alert.timestamp).getTime();
                  const now = new Date().getTime();
                  const hoursOld = (now - createdTime) / (1000 * 60 * 60);
                  const isWithin24h = hoursOld < 24;

                  return (
                    <motion.div
                      key={alert.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => setExpandedAlert(alert.id)}
                      className={`glass-card p-6 border-l-4 cursor-pointer hover:shadow-xl transition-all ${
                        alert.category === 'CRITICAL'
                          ? 'border-red-500 hover:border-red-600'
                          : alert.category === 'WARNING'
                          ? 'border-amber-500 hover:border-amber-600'
                          : 'border-blue-500 hover:border-blue-600'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-bold text-slate-800 text-base mb-1">
                            {alert.category === 'CRITICAL' ? '🔴' : alert.category === 'WARNING' ? '⚠️' : 'ℹ️'} {alert.message.split('\n')[0]}
                          </p>
                          <p className="text-sm text-slate-500 font-medium">
                            {new Date(alert.timestamp).toLocaleString()}
                            {!isWithin24h && ' • Expired'}
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-black whitespace-nowrap ml-4 ${
                          alert.category === 'CRITICAL'
                            ? 'bg-red-100 text-red-800'
                            : alert.category === 'WARNING'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {alert.category}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-8">
                  <button
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                    className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <p className="text-sm font-black text-slate-700">
                    Page {page + 1} of {totalPages}
                  </p>
                  <button
                    onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                    disabled={page === totalPages - 1}
                    className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Alert Detail Modal */}
        <AnimatePresence>
          {expandedAlert && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              onClick={() => setExpandedAlert(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="glass-card max-w-lg w-full p-8 max-h-[90vh] overflow-y-auto"
              >
                {alerts.find((a) => a.id === expandedAlert) && (() => {
                  const alert = alerts.find((a) => a.id === expandedAlert)!;
                  const createdTime = new Date(alert.timestamp).getTime();
                  const now = new Date().getTime();
                  const hoursOld = (now - createdTime) / (1000 * 60 * 60);
                  const isWithin24h = hoursOld < 24;

                  const lines = alert.message.split('\n').filter((l: string) => l.trim());
                  const title = lines[0] || 'Alert';
                  let issues: string[] = [];
                  let recommendations: string[] = [];

                  if (lines.length > 1) {
                    issues = lines[1]
                      .split(',')
                      .map((i: string) => i.trim())
                      .filter((i: string) => i);

                    const recIndex = lines.findIndex((l: string) =>
                      l.toUpperCase().includes('RECOMMENDATIONS')
                    );

                    if (recIndex !== -1) {
                      recommendations = lines
                        .slice(recIndex + 1)
                        .map((r: string) => r.trim())
                        .filter((r: string) => r);
                    }
                  }

                  return (
                    <>
                      <div className="flex justify-between items-start mb-6">
                        <h2 className="text-2xl font-black text-slate-800">{title}</h2>
                        <button
                          onClick={() => setExpandedAlert(null)}
                          className="text-slate-400 hover:text-slate-600 transition"
                        >
                          <X className="w-6 h-6" />
                        </button>
                      </div>

                      <div className={`inline-block px-3 py-1 rounded-full text-xs font-black mb-4 ${
                        alert.category === 'CRITICAL'
                          ? 'bg-red-100 text-red-800'
                          : alert.category === 'WARNING'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {alert.category}
                      </div>

                      <p className="text-sm text-slate-500 font-medium mb-6">
                        {new Date(alert.timestamp).toLocaleString()}
                        {!isWithin24h && ' • Alert expired - consultation window closed'}
                      </p>

                      {issues.length > 0 && (
                        <div className="mb-6 p-4 bg-red-50/50 rounded-xl border border-red-100">
                          <h3 className="font-black text-slate-800 text-sm mb-3 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-red-500" />
                            Issues Detected
                          </h3>
                          <ul className="space-y-2">
                            {issues.map((issue: string, idx: number) => (
                              <li key={idx} className="text-sm text-slate-700 flex gap-2 font-medium">
                                <span className="text-red-500 font-bold">•</span> {issue}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {recommendations.length > 0 && isWithin24h && (
                        <div className="mb-6 p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
                          <h3 className="font-black text-slate-800 text-sm mb-3 flex items-center gap-2">
                            <Stethoscope className="w-4 h-4 text-emerald-500" />
                            Recommendations
                          </h3>
                          <ul className="space-y-2">
                            {recommendations.map((rec: string, idx: number) => (
                              <li key={idx} className="text-sm text-slate-700 flex gap-2 font-medium">
                                <span className="text-emerald-500 font-bold">✓</span> {rec}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {!isWithin24h && (
                        <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                          <p className="text-sm text-slate-600 font-medium italic">
                            ⏱️ This alert has expired. The 24-hour consultation window has closed.
                          </p>
                        </div>
                      )}

                      <div className="flex gap-3">
                        {isWithin24h && alert.category === 'CRITICAL' && (
                          <button
                            onClick={() => {
                              handleConsultDoctor(alert.id);
                            }}
                            className="flex-1 btn-primary flex items-center justify-center gap-2"
                          >
                            <MessageSquare className="w-4 h-4" />
                            Consult Doctor
                          </button>
                        )}
                        <button
                          onClick={() => setExpandedAlert(null)}
                          className={`${isWithin24h && alert.category === 'CRITICAL' ? 'flex-1' : 'w-full'} btn-secondary`}
                        >
                          Close
                        </button>
                      </div>
                    </>
                  );
                })()}
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
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              onClick={() => {
                setShowDoctorSelect(false);
                setSelectedDoctor(null);
                setCurrentAlertForConsult(null);
              }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="glass-card max-w-md w-full p-8"
              >
                <div className="flex justify-between items-start mb-6">
                  <h2 className="text-2xl font-black text-slate-800">Select Doctor</h2>
                  <button
                    onClick={() => {
                      setShowDoctorSelect(false);
                      setSelectedDoctor(null);
                      setCurrentAlertForConsult(null);
                    }}
                    className="text-slate-400 hover:text-slate-600 transition"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <p className="text-sm text-slate-600 font-medium mb-6">
                  Choose a doctor to start consultation regarding your critical alert.
                </p>

                {loadingDoctors ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : doctors.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-slate-500 font-medium">No doctors available at the moment.</p>
                  </div>
                ) : (
                  <>
                    <div className="mb-6">
                      <label className="block text-sm font-black text-slate-700 mb-3">
                        Available Doctors
                      </label>
                      <div className="relative">
                        <select
                          value={selectedDoctor || ''}
                          onChange={(e) => setSelectedDoctor(e.target.value)}
                          className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:border-blue-500 transition appearance-none"
                        >
                          <option value="" disabled>
                            Select a doctor...
                          </option>
                          {doctors.map((doctor) => (
                            <option key={doctor.id} value={doctor.id}>
                              Dr. {doctor.name} - {doctor.specialization || 'General'} {doctor.qualifications ? `(${doctor.qualifications})` : ''}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                          </svg>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          if (selectedDoctor) {
                            notifyDoctor();
                          } else {
                            toast.error('Please select a doctor first');
                          }
                        }}
                        disabled={!selectedDoctor}
                        className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <Stethoscope className="w-4 h-4" />
                        Notify Doctor
                      </button>
                      <button
                        onClick={() => {
                          setShowDoctorSelect(false);
                          setSelectedDoctor(null);
                          setCurrentAlertForConsult(null);
                        }}
                        className="flex-1 btn-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ProtectedLayout>
  );
}
