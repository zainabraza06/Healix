'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import ProtectedLayout from '@/components/ProtectedLayout';
import toast from 'react-hot-toast';
import { Bell, CheckCircle, Clock, X, Edit, Loader, AlertCircle, Activity, User, Calendar, Stethoscope, Download, ShieldCheck } from 'lucide-react';
import Spinner from '@/components/Spinner';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';

// 3D Background
const Scene = dynamic(() => import('@/components/canvas/Scene'), { ssr: false });
const FloatingIcons = dynamic(() => import('@/components/canvas/FloatingIcons'), { ssr: false });

export default function DoctorAlertsPage() {
  const [alerts, setAlerts] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('ACTIVE');
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveForm, setResolveForm] = useState({
    instructions: '',
    medications: [{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }],
    notes: ''
  });
  const [resolving, setResolving] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const pageSize = 10;

  useEffect(() => {
    fetchAlerts();
  }, [selectedStatus, currentPage]);

  const fetchAlerts = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.getDoctorAlerts(currentPage, pageSize, selectedStatus || undefined);
      if (response.success) {
        setAlerts(response.data);
      } else {
        setError(response.message || 'Failed to load alerts');
      }
    } catch (err) {
      setError('An error occurred while fetching alerts');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResolveAlert = async () => {
    if (!resolveForm.instructions.trim()) {
      toast.error('Please provide instructions');
      return;
    }

    // Filter out empty medications
    const medications = resolveForm.medications.filter(med => med.name.trim());
    if (medications.length === 0) {
      toast.error('Please add at least one medication');
      return;
    }

    const currentAlert = alerts.content?.find((a: any) => a.id === expandedAlert);
    if (!currentAlert) return;

    try {
      setResolving(true);
      const response = await apiClient.resolveAlert(
        currentAlert.id,
        resolveForm.instructions,
        JSON.stringify({
          medications,
          notes: resolveForm.notes
        })
      );

      if (response.success) {
        toast.success('Alert resolved successfully');
        setShowResolveModal(false);
        setResolveForm({
          instructions: '',
          medications: [{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }],
          notes: ''
        });
        setExpandedAlert(null);
        fetchAlerts();
      } else {
        toast.error(response.message || 'Failed to resolve alert');
      }
    } catch (err) {
      toast.error('An error occurred');
      console.error(err);
    } finally {
      setResolving(false);
    }
  };

  const openResolveModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowResolveModal(true);
    setResolveForm({
      instructions: '',
      medications: [{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }],
      notes: ''
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-300';
      case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'LOW': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const handleDownloadRecord = async (
    patientId?: string,
    patientName?: string,
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();
    if (!patientId) {
      toast.error('Patient ID missing for this alert');
      return;
    }
    try {
      setDownloadingId(patientId);
      const blob = await apiClient.downloadMedicalRecord(patientId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeName = (patientName || patientId).replace(/\s+/g, '_');
      link.download = `medical_record_${safeName}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('Medical record downloaded');
    } catch (err) {
      console.error(err);
      toast.error('Failed to download medical record');
    } finally {
      setDownloadingId(null);
    }
  };

  if (isLoading && !alerts) {
    return (
      <ProtectedLayout allowedRoles={['DOCTOR']}>
        <div className="flex items-center justify-center h-screen">
          <Spinner />
        </div>
      </ProtectedLayout>
    );
  }

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
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-12"
            >
              <h1 className="text-6xl font-black text-slate-800 tracking-tighter leading-none mb-4">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500 flex items-center gap-4">
                  <Bell className="w-12 h-12 text-emerald-500" />
                  Health Alerts
                </span>
              </h1>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Critical Monitoring & Patient Response
              </p>
            </motion.div>

            {/* Filter Tabs */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex flex-wrap gap-4 mb-10"
            >
              {['ALL', 'ACTIVE', 'RESOLVED'].map((status) => {
                const isActive = (status === 'ALL' && !selectedStatus) || selectedStatus === status;
                return (
                  <button
                    key={status}
                    onClick={() => {
                      setSelectedStatus(status === 'ALL' ? '' : status);
                      setCurrentPage(0);
                    }}
                    className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all relative overflow-hidden group ${isActive
                      ? 'bg-slate-900 text-white shadow-xl shadow-slate-200'
                      : 'bg-white/40 backdrop-blur-md text-slate-500 border border-white/60 hover:bg-white/60'
                      }`}
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      {status === 'ACTIVE' && <Activity size={12} className={isActive ? 'text-rose-400' : 'text-slate-400'} />}
                      {status}
                      {alerts && isActive && (
                        <span className="ml-2 px-2 py-0.5 rounded-lg bg-emerald-500 text-[8px]">
                          {alerts.totalElements || 0}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </motion.div>

            {/* Error State */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <p className="text-red-700">{error}</p>
              </div>
            )}

            {/* Alerts List */}
            {alerts && alerts.content && alerts.content.length > 0 ? (
              <div className="space-y-6">
                {alerts.content.map((alert: any, i: number) => {
                  const patientId = alert.patientId || alert.patient_id || alert.patient?._id;
                  const getSeverityStyles = (severity: string) => {
                    switch (severity?.toUpperCase()) {
                      case 'CRITICAL': return 'bg-rose-50 text-rose-600 border-rose-100 ring-rose-500/20';
                      case 'HIGH': return 'bg-orange-50 text-orange-600 border-orange-100 ring-orange-500/20';
                      case 'MEDIUM': return 'bg-amber-50 text-amber-600 border-amber-100 ring-amber-500/20';
                      case 'LOW': return 'bg-emerald-50 text-emerald-600 border-emerald-100 ring-emerald-500/20';
                      default: return 'bg-slate-50 text-slate-600 border-slate-100 ring-slate-500/20';
                    }
                  };

                  const getStatusBadge = (status: string) => {
                    switch (status?.toUpperCase()) {
                      case 'ACTIVE': return 'bg-rose-600 text-white shadow-lg shadow-rose-200';
                      case 'RESOLVED': return 'bg-emerald-600 text-white shadow-lg shadow-emerald-200';
                      case 'ACKNOWLEDGED': return 'bg-amber-500 text-white shadow-lg shadow-amber-200';
                      default: return 'bg-slate-500 text-white shadow-lg shadow-slate-200';
                    }
                  };

                  return (
                    <motion.div
                      key={alert.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => setExpandedAlert(alert.id)}
                      className="glass-card p-8 hover:bg-white/60 transition-all duration-300 cursor-pointer group border-white/60 relative overflow-hidden"
                    >
                      <div className="flex flex-col md:flex-row justify-between items-start gap-8">
                        <div className="flex-1">
                          <div className="flex items-center gap-4 mb-6">
                            <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${getStatusBadge(alert.status)}`}>
                              {alert.status}
                            </span>
                            <span className={`px-4 py-1.5 border rounded-full text-[9px] font-black uppercase tracking-widest ${getSeverityStyles(alert.severity)}`}>
                              {alert.severity} Priority
                            </span>
                          </div>

                          <h3 className="text-2xl font-black text-slate-800 mb-4 tracking-tight group-hover:text-emerald-600 transition-colors">
                            {alert.message?.split('\n')[0] || 'Clinical Health Alert'}
                          </h3>

                          <div className="flex flex-wrap items-center gap-6">
                            {alert.patientName && (
                              <div className="flex items-center gap-2.5 px-3 py-1.5 bg-white/50 rounded-xl">
                                <User className="w-4 h-4 text-emerald-600" />
                                <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">{alert.patientName}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2.5 px-3 py-1.5 bg-white/50 rounded-xl">
                              <Calendar className="w-4 h-4 text-slate-400" />
                              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                                {new Date(alert.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 w-full md:w-auto">
                          {patientId && (
                            <button
                              onClick={(e) => handleDownloadRecord(patientId, alert.patientName, e)}
                              disabled={downloadingId === patientId}
                              className="px-6 py-3.5 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 shadow-xl shadow-emerald-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 whitespace-nowrap"
                            >
                              {downloadingId === patientId ? (
                                <Loader className="w-4 h-4 animate-spin" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                              Medical Record
                            </button>
                          )}
                          <button className="px-6 py-3.5 bg-white/60 text-slate-600 border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all active:scale-[0.98]">
                            View Details
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="glass-card p-20 text-center border-white/40">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Bell size={40} className="text-slate-300" />
                </div>
                <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Clear skies! No active health alerts</p>
              </div>
            )}

            {/* Pagination */}
            {alerts && alerts.totalPages > 1 && (
              <div className="flex justify-center items-center gap-6 mt-12 pb-12">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="px-6 py-3 bg-white/40 backdrop-blur-md rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 disabled:opacity-30 transition-all hover:bg-white/60"
                >
                  Prev
                </button>
                <span className="text-slate-400 font-black text-[10px] uppercase tracking-[0.3em]">
                  Page {currentPage + 1} / {alerts.totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(alerts.totalPages - 1, p + 1))}
                  disabled={currentPage >= alerts.totalPages - 1}
                  className="px-6 py-3 bg-white/40 backdrop-blur-md rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 disabled:opacity-30 transition-all hover:bg-white/60"
                >
                  Next
                </button>
              </div>
            )}
          </div>
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
                      <h3 className="text-2xl font-bold text-slate-800">{alerts.content.find((a: any) => a.id === expandedAlert)?.message.split('\n')[0] || 'Alert'}</h3>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-semibold whitespace-nowrap ${(() => {
                          const alert = alerts.content.find((a: any) => a.id === expandedAlert);
                          switch (alert?.severity?.toUpperCase()) {
                            case 'CRITICAL': return 'bg-red-200 text-red-800';
                            case 'HIGH': return 'bg-orange-200 text-orange-800';
                            case 'MEDIUM': return 'bg-yellow-200 text-yellow-800';
                            case 'LOW': return 'bg-emerald-200 text-emerald-800';
                            default: return 'bg-slate-200 text-slate-800';
                          }
                        })()}`}
                      >
                        {alerts.content.find((a: any) => a.id === expandedAlert)?.severity}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-2">{new Date(alerts.content.find((a: any) => a.id === expandedAlert)?.timestamp || '').toLocaleString()}</p>
                  </div>
                  <button
                    onClick={() => setExpandedAlert(null)}
                    className="text-slate-400 hover:text-slate-600 transition ml-4"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="p-6 space-y-6">
                  {alerts.content.find((a: any) => a.id === expandedAlert) && (() => {
                    const alert = alerts.content.find((a: any) => a.id === expandedAlert)!;
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

                    return (
                      <>
                        {/* Patient Info */}
                        {alert.patientName && (
                          <div className="p-4 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl text-white shadow-lg">
                            <div className="flex items-center gap-3 mb-2">
                              <User className="w-5 h-5" />
                              <p className="text-sm font-bold">Patient Information</p>
                            </div>
                            <p className="text-lg font-bold">
                              {alert.patientName}
                            </p>
                            {alert.patientEmail && (
                              <p className="text-xs font-semibold opacity-90 mt-1">
                                {alert.patientEmail}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Alert Status */}
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
                                  <h5 className="text-sm font-bold text-emerald-900 uppercase tracking-wider">Your Instructions</h5>
                                </div>
                                <p className="text-sm text-emerald-900 leading-relaxed whitespace-pre-wrap font-medium">
                                  {alert.instructions}
                                </p>
                              </div>
                            )}

                            {alert.prescription && (
                              <div className="bg-emerald-50 p-6 rounded-2xl border-2 border-emerald-200">
                                <div className="flex items-center gap-2 mb-3">
                                  <Activity className="w-5 h-5 text-emerald-700" />
                                  <h5 className="text-sm font-bold text-emerald-900 uppercase tracking-wider">Prescription</h5>
                                </div>
                                {alert.prescriptionData?.medications && alert.prescriptionData.medications.length > 0 ? (
                                  <div className="space-y-4">
                                    {alert.prescriptionData.medications.map((med: any, idx: number) => (
                                      <div key={idx} className="bg-white p-4 rounded-lg border border-emerald-100">
                                        <h6 className="font-bold text-emerald-900 mb-2">{med.name}</h6>
                                        <div className="grid grid-cols-2 gap-2 text-xs text-emerald-800">
                                          <div>
                                            <p className="font-semibold text-emerald-700">Dosage</p>
                                            <p>{med.dosage}</p>
                                          </div>
                                          <div>
                                            <p className="font-semibold text-emerald-700">Frequency</p>
                                            <p>{med.frequency}</p>
                                          </div>
                                          <div className="col-span-2">
                                            <p className="font-semibold text-emerald-700">Duration</p>
                                            <p>{med.duration}</p>
                                          </div>
                                        </div>
                                        {med.instructions && (
                                          <p className="text-xs text-emerald-700 mt-2 italic">{med.instructions}</p>
                                        )}
                                      </div>
                                    ))}
                                    {alert.prescriptionData?.notes && (
                                      <div className="bg-white p-4 rounded-lg border border-emerald-100">
                                        <p className="text-xs font-semibold text-emerald-700 mb-1">Additional Notes</p>
                                        <p className="text-sm text-emerald-900">{alert.prescriptionData.notes}</p>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-sm text-emerald-900 leading-relaxed whitespace-pre-wrap font-medium">
                                    {alert.prescription}
                                  </p>
                                )}
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
                              <Activity className="w-5 h-5 text-emerald-600" />
                              Vitals Snapshot
                            </h4>
                            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                              <p className="text-sm text-emerald-900 leading-relaxed font-mono">
                                {snapshotText}
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="flex gap-3 pt-6 border-t border-slate-100">
                          {(() => {
                            const patientId = alert.patientId || alert.patient_id || alert.patient?._id;
                            return patientId ? (
                              <button
                                onClick={(e) => handleDownloadRecord(patientId, alert.patientName, e)}
                                disabled={downloadingId === patientId}
                                className="flex-1 h-12 bg-slate-100 text-slate-700 font-black uppercase tracking-widest text-xs rounded-xl hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                              >
                                {downloadingId === patientId ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                Download record
                              </button>
                            ) : null;
                          })()}
                          {/* Show resolve button for active alerts */}
                          {alert.status === 'ACTIVE' && (
                            <button
                              onClick={openResolveModal}
                              className="flex-1 h-12 bg-emerald-600 text-white font-black uppercase tracking-widest text-xs rounded-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                            >
                              <Edit className="w-4 h-4" />
                              Resolve Alert
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

        {/* Resolve Alert Modal */}
        <AnimatePresence>
          {showResolveModal && expandedAlert && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => !resolving && setShowResolveModal(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              >
                <div className="p-6 border-b border-slate-100 flex justify-between items-start sticky top-0 bg-white">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                      <Edit className="w-6 h-6 text-emerald-600" />
                      Resolve Alert
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">Patient: {alerts.content.find((a: any) => a.id === expandedAlert)?.patientName}</p>
                  </div>
                  <button
                    onClick={() => !resolving && setShowResolveModal(false)}
                    className="text-slate-400 hover:text-slate-600 transition"
                    disabled={resolving}
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  {/* Instructions (Required) */}
                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-2">
                      Instructions <span className="text-red-600">*</span>
                    </label>
                    <textarea
                      value={resolveForm.instructions}
                      onChange={(e) => setResolveForm({ ...resolveForm, instructions: e.target.value })}
                      placeholder="Provide instructions for the patient (e.g., rest, monitor vitals, visit ER if symptoms worsen...)"
                      className="w-full p-4 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none font-medium"
                      rows={4}
                      disabled={resolving}
                    />
                  </div>

                  {/* Medications */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <label className="block text-sm font-bold text-slate-800">
                        Medications <span className="text-red-600">*</span>
                      </label>
                      <button
                        onClick={() => setResolveForm({
                          ...resolveForm,
                          medications: [...resolveForm.medications, { name: '', dosage: '', frequency: '', duration: '', instructions: '' }]
                        })}
                        className="text-xs px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 font-bold"
                        disabled={resolving}
                      >
                        + Add Medication
                      </button>
                    </div>
                    <div className="space-y-3">
                      {resolveForm.medications.map((med, idx) => (
                        <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                          <div className="flex justify-between items-start mb-3">
                            <h4 className="text-xs font-bold text-slate-600 uppercase">Medication {idx + 1}</h4>
                            {resolveForm.medications.length > 1 && (
                              <button
                                onClick={() => setResolveForm({
                                  ...resolveForm,
                                  medications: resolveForm.medications.filter((_, i) => i !== idx)
                                })}
                                className="text-red-600 hover:text-red-700 font-bold text-sm"
                                disabled={resolving}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs font-semibold text-slate-600 mb-1 block">Name</label>
                              <input
                                type="text"
                                value={med.name}
                                onChange={(e) => {
                                  const newMeds = [...resolveForm.medications];
                                  newMeds[idx].name = e.target.value;
                                  setResolveForm({ ...resolveForm, medications: newMeds });
                                }}
                                placeholder="e.g., Aspirin"
                                className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                disabled={resolving}
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-slate-600 mb-1 block">Dosage</label>
                              <input
                                type="text"
                                value={med.dosage}
                                onChange={(e) => {
                                  const newMeds = [...resolveForm.medications];
                                  newMeds[idx].dosage = e.target.value;
                                  setResolveForm({ ...resolveForm, medications: newMeds });
                                }}
                                placeholder="e.g., 500mg"
                                className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                disabled={resolving}
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-slate-600 mb-1 block">Frequency</label>
                              <input
                                type="text"
                                value={med.frequency}
                                onChange={(e) => {
                                  const newMeds = [...resolveForm.medications];
                                  newMeds[idx].frequency = e.target.value;
                                  setResolveForm({ ...resolveForm, medications: newMeds });
                                }}
                                placeholder="e.g., 3 times daily"
                                className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                disabled={resolving}
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-slate-600 mb-1 block">Duration</label>
                              <input
                                type="text"
                                value={med.duration}
                                onChange={(e) => {
                                  const newMeds = [...resolveForm.medications];
                                  newMeds[idx].duration = e.target.value;
                                  setResolveForm({ ...resolveForm, medications: newMeds });
                                }}
                                placeholder="e.g., 7 days"
                                className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                disabled={resolving}
                              />
                            </div>
                          </div>
                          <div className="mt-3">
                            <label className="text-xs font-semibold text-slate-600 mb-1 block">Instructions</label>
                            <input
                              type="text"
                              value={med.instructions}
                              onChange={(e) => {
                                const newMeds = [...resolveForm.medications];
                                newMeds[idx].instructions = e.target.value;
                                setResolveForm({ ...resolveForm, medications: newMeds });
                              }}
                              placeholder="e.g., Take with food, avoid alcohol"
                              className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              disabled={resolving}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-2">
                      Additional Notes <span className="text-slate-400 text-xs">(Optional)</span>
                    </label>
                    <textarea
                      value={resolveForm.notes}
                      onChange={(e) => setResolveForm({ ...resolveForm, notes: e.target.value })}
                      placeholder="Any additional information or warnings for the patient..."
                      className="w-full p-4 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none font-medium"
                      rows={3}
                      disabled={resolving}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-6 border-t border-slate-100">
                    <button
                      onClick={() => setShowResolveModal(false)}
                      className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition"
                      disabled={resolving}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleResolveAlert}
                      disabled={resolving || !resolveForm.instructions.trim() || resolveForm.medications.filter(m => m.name.trim()).length === 0}
                      className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {resolving ? (
                        <>
                          <Loader className="w-5 h-5 animate-spin" />
                          Resolving...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-5 h-5" />
                          Resolve Alert
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ProtectedLayout >
  );
}
