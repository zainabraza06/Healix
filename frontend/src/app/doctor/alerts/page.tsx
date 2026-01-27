'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import ProtectedLayout from '@/components/ProtectedLayout';
import toast from 'react-hot-toast';
import { Bell, CheckCircle, Clock, X, Edit, Loader, AlertCircle, Activity, User, Calendar, Stethoscope } from 'lucide-react';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';
import { motion, AnimatePresence } from 'framer-motion';

export default function DoctorAlertsPage() {
  const [alerts, setAlerts] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('ACTIVE');
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveForm, setResolveForm] = useState({ instructions: '', prescription: '' });
  const [resolving, setResolving] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
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

    const currentAlert = alerts.content?.find((a: any) => a.id === expandedAlert);
    if (!currentAlert) return;

    try {
      setResolving(true);
      const response = await apiClient.resolveAlert(
        currentAlert.id,
        resolveForm.instructions,
        resolveForm.prescription || undefined
      );

      if (response.success) {
        toast.success('Alert resolved successfully');
        setShowResolveModal(false);
        setResolveForm({ instructions: '', prescription: '' });
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
    setResolveForm({ instructions: '', prescription: '' });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-300';
      case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'LOW': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
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
      <div className="container-main py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-black text-slate-800 mb-2 flex items-center gap-3">
            <Bell className="w-10 h-10 text-emerald-600" />
            Patient Alerts
          </h1>
          <p className="text-slate-600">Monitor and respond to patient health alerts</p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
          {['ALL', 'ACTIVE', 'RESOLVED'].map((status) => (
            <button
              key={status}
              onClick={() => {
                setSelectedStatus(status === 'ALL' ? '' : status);
                setCurrentPage(0);
              }}
              className={`px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all whitespace-nowrap ${
                (status === 'ALL' && !selectedStatus) || selectedStatus === status
                  ? 'bg-emerald-600 text-white shadow-lg'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {status}
              {alerts && (
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-white/20">
                  {status === 'ALL' ? alerts.totalElements : status === selectedStatus ? alerts.content?.length || 0 : 0}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Alerts List */}
        {alerts && alerts.content && alerts.content.length > 0 ? (
          <div className="glass-card overflow-hidden">
            <div className="grid divide-y divide-slate-200">
              {alerts.content.map((alert: any) => {
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
                      <span className={`px-2 py-0.5 border rounded text-[10px] font-black uppercase tracking-wider ${getSeverityColor(alert.severity)}`}>
                        {alert.severity} SEVERITY
                      </span>
                      {alert.status === 'RESOLVED' && (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-black uppercase tracking-wider">
                          ✓ RESOLVED
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-3">{alert.message?.split('\n')[0] || 'Health Alert'}</h3>

                    {/* Patient Info */}
                    {alert.patientName && (
                      <div className="flex flex-wrap gap-4 text-xs mb-3">
                        <div className="flex items-center gap-1.5">
                          <User className="w-4 h-4 text-blue-600" />
                          <span className="font-semibold text-slate-700">{alert.patientName}</span>
                        </div>
                      </div>
                    )}

                    {/* Date */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(alert.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    <p className="text-xs text-slate-400 italic">Click to view full details{alert.status === 'RESOLVED' && (alert.instructions || alert.prescription) ? ' including your instructions' : ''}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <EmptyState title="No Alerts" message="No alerts found" icon={Bell} />
        )}

        {/* Pagination */}
        {alerts && alerts.totalPages > 1 && (
          <div className="mt-6 p-6 bg-white/50 border-t border-slate-200 flex items-center justify-between">
            <button
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
            >
              Previous
            </button>
            <span className="text-sm text-slate-600 font-medium">
              Page {currentPage + 1} of {alerts.totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(alerts.totalPages - 1, p + 1))}
              disabled={currentPage >= alerts.totalPages - 1}
              className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
            >
              Next
            </button>
          </div>
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
                    <h3 className="text-2xl font-bold text-slate-800">{alerts.content.find((a: any) => a.id === expandedAlert)?.message.split('\n')[0] || 'Alert'}</h3>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-semibold whitespace-nowrap ${(() => {
                        const alert = alerts.content.find((a: any) => a.id === expandedAlert);
                        switch (alert?.severity?.toUpperCase()) {
                          case 'CRITICAL': return 'bg-red-200 text-red-800';
                          case 'HIGH': return 'bg-orange-200 text-orange-800';
                          case 'MEDIUM': return 'bg-yellow-200 text-yellow-800';
                          case 'LOW': return 'bg-blue-200 text-blue-800';
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
                        <div className="p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl text-white shadow-lg">
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

                      <div className="flex gap-3 pt-6 border-t border-slate-100">
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
                    rows={5}
                    disabled={resolving}
                  />
                </div>

                {/* Prescription (Optional) */}
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-2">
                    Prescription <span className="text-slate-400 text-xs">(Optional)</span>
                  </label>
                  <textarea
                    value={resolveForm.prescription}
                    onChange={(e) => setResolveForm({ ...resolveForm, prescription: e.target.value })}
                    placeholder="Enter prescription details (medications, dosage, duration...)"
                    className="w-full p-4 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none font-medium"
                    rows={4}
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
                    disabled={resolving || !resolveForm.instructions.trim()}
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
    </ProtectedLayout>
  );
}
