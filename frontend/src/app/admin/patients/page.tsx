'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import ProtectedLayout from '@/components/ProtectedLayout';
import toast from 'react-hot-toast';
import {
  X, Search, Power,
  ArrowLeft, Loader, Activity,
  Download, FileText, Database,
  User, Mail, Phone, MapPin, Calendar, Heart, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminPatientsPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Status Management State
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusAction, setStatusAction] = useState<'ACTIVATE' | 'DEACTIVATE'>('ACTIVATE');
  const [statusReason, setStatusReason] = useState('');
  const [statusActionLoading, setStatusActionLoading] = useState(false);

  useEffect(() => {
    fetchPatients();
  }, [currentPage, searchTerm, statusFilter]);

  const fetchPatients = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get('/admin/patients', {
        params: { page: currentPage, size: 10, search: searchTerm },
      });
      if (response.success && response.data) {
        setPatients(response.data.content || []);
        setTotalPages(response.data.totalPages || 1);
      } else {
        toast.error(response.message || 'Failed to load patients');
      }
    } catch (err) {
      toast.error('An error occurred while fetching patients');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async (format: 'pdf' | 'csv' | 'json') => {
    try {
      const blob = await apiClient.downloadPatients(format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `patient_registry.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Patient registry exported as ${format.toUpperCase()}`);
    } catch (err) {
      toast.error('Failed to export patient registry');
      console.error(err);
    }
  };

  const handleDownloadRecord = async (patientId: string) => {
    try {
      setIsDownloading(true);
      const blob = await apiClient.downloadPatientMedicalRecord(patientId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `medical_record_${patientId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Medical record downloaded');
    } catch (err) {
      toast.error('Failed to download record');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleManageStatus = async () => {
    if (!statusReason.trim()) {
      toast.error('Reason is required for email notification');
      return;
    }

    try {
      setStatusActionLoading(true);
      const response = await apiClient.managePatientStatus({
        patientId: selectedPatient._id || selectedPatient.id,
        status: statusAction,
        reason: statusReason
      });

      if (response.success) {
        toast.success(`Patient account ${statusAction.toLowerCase()}d successfully!`);
        setShowStatusModal(false);
        setStatusReason('');
        fetchPatients();
      }
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
    } finally {
      setStatusActionLoading(false);
    }
  };

  return (
    <ProtectedLayout allowedRoles={['ADMIN']}>
      <div className="container-main py-10">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="animate-fade-in">
              <h1 className="text-4xl lg:text-5xl font-black text-slate-800 tracking-tight leading-none mb-3">
                Patient <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-emerald-500">Registry</span>
              </h1>
              <p className="text-slate-500 font-medium text-lg">Monitor patient activity, manage account access, and review medical history.</p>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="glass-card p-4 mb-8 border-white/50 shadow-sm flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Search patient name or email..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(0);
                }}
                className="w-full pl-12 pr-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium transition-all"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="relative group">
                <button className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all shadow-sm">
                  <Download size={18} /> Export Data
                </button>
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 p-2 hidden group-hover:block z-20">
                  <button onClick={() => handleExport('csv')} className="w-full text-left px-4 py-2 hover:bg-slate-50 rounded-lg text-sm font-medium text-slate-600 flex items-center gap-2">
                    <FileText size={14} className="text-emerald-500" /> Export as CSV
                  </button>
                  <button onClick={() => handleExport('json')} className="w-full text-left px-4 py-2 hover:bg-slate-50 rounded-lg text-sm font-medium text-slate-600 flex items-center gap-2">
                    <Database size={14} className="text-blue-500" /> Export as JSON
                  </button>
                  <button onClick={() => handleExport('pdf')} className="w-full text-left px-4 py-2 hover:bg-slate-50 rounded-lg text-sm font-medium text-slate-600 flex items-center gap-2">
                    <FileText size={14} className="text-red-500" /> Export as PDF
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Patients Listing */}
          {isLoading ? (
            <div className="glass-card py-32 flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-teal-100 border-t-teal-600 rounded-full animate-spin"></div>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Syncing Patient Data...</p>
            </div>
          ) : patients.length === 0 ? (
            <div className="glass-card py-20 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-slate-300">
                <User size={32} className="text-slate-300" />
              </div>
              <h3 className="text-xl font-black text-slate-800">No Patients Found</h3>
              <p className="text-slate-500 mt-1">Refine your search parameters to find a specific patient.</p>
            </div>
          ) : (
            <>
              <div className="glass-card overflow-hidden p-0 border-white/50 shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-100">
                        <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Patient Profile</th>
                        <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact Information</th>
                        <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Security Status</th>
                        <th className="px-6 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Management</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {patients.map((p) => (
                        <tr
                          key={p._id}
                          className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                          onClick={() => { setSelectedPatient(p); setShowDetailsModal(true); }}
                        >
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-4">
                              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-100 to-white border border-white shadow-sm flex items-center justify-center text-teal-600 font-black group-hover:scale-110 transition-transform">
                                {p.user_id?.full_name?.charAt(0) || 'P'}
                              </div>
                              <div>
                                <p className="font-bold text-slate-800">{p.user_id?.full_name || 'Anonymous'}</p>
                                <p className="text-xs text-slate-400 font-medium uppercase tracking-tighter">Blood Type: {p.user_id?.blood_type || 'N/A'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <p className="text-sm font-bold text-slate-600 flex items-center gap-2 mb-1">
                              <Mail size={12} className="text-slate-400" /> {p.user_id?.email}
                            </p>
                            <p className="text-xs text-slate-400 font-medium flex items-center gap-2">
                              <Phone size={12} /> {p.user_id?.phone || 'No phone'}
                            </p>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${p.user_id?.is_active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-400'}`}></div>
                              <span className={`text-xs font-black uppercase tracking-widest ${p.user_id?.is_active ? 'text-emerald-700' : 'text-red-600'}`}>
                                {p.user_id?.is_active ? 'Active' : 'Disabled'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-5" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setSelectedPatient(p);
                                  setStatusAction(p.user_id?.is_active ? 'DEACTIVATE' : 'ACTIVATE');
                                  setShowStatusModal(true);
                                }}
                                className={`p-2.5 rounded-xl transition-all ${p.user_id?.is_active
                                  ? 'bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600'
                                  : 'bg-teal-50 text-teal-600 hover:bg-teal-100'}`}
                                title={p.user_id?.is_active ? 'Deactivate Access' : 'Activate Access'}
                              >
                                <Power size={18} />
                              </button>
                              <button
                                onClick={() => { setSelectedPatient(p); setShowDetailsModal(true); }}
                                className="p-2.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl transition-all"
                              >
                                <FileText size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              <div className="mt-8 flex justify-center">
                <div className="glass-card px-4 py-2 flex items-center gap-6 shadow-sm">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                    disabled={currentPage === 0}
                    className="p-2 hover:bg-slate-100 rounded-lg transition disabled:opacity-30"
                  >
                    <ArrowLeft size={18} className="text-slate-600" />
                  </button>
                  <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
                    Page <span className="text-teal-600">{currentPage + 1}</span> of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                    disabled={currentPage === totalPages - 1}
                    className="p-2 hover:bg-slate-100 rounded-lg transition disabled:opacity-30"
                  >
                    <ArrowLeft size={18} className="text-slate-600 rotate-180" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Status Management Modal */}
      <AnimatePresence>
        {showStatusModal && selectedPatient && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-in fade-in">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card p-8 max-w-md w-full border-white/60 shadow-2xl animate-in zoom-in-95"
            >
              <div className="mb-6">
                <div className={`w-14 h-14 ${statusAction === 'ACTIVATE' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'} rounded-2xl flex items-center justify-center mb-6`}>
                  <Activity size={28} />
                </div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-2 uppercase">
                  Patient Status Toggle
                </h3>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">
                  {statusAction === 'ACTIVATE'
                    ? `Grant platform access to ${selectedPatient.user_id?.full_name}. This will re-enable their profile.`
                    : `Suspend platform access for ${selectedPatient.user_id?.full_name}. This will restrict their account access.`}
                </p>
              </div>

              <div className="space-y-4">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reason for Status Change (Emailed to patient)</label>
                <textarea
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="Provide essential details regarding this account action..."
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-medium text-sm resize-none"
                  rows={4}
                />
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => {
                    setShowStatusModal(false);
                    setStatusReason('');
                  }}
                  className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-50 transition"
                  disabled={statusActionLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleManageStatus}
                  className={`flex-1 py-4 text-white font-bold rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 ${statusAction === 'ACTIVATE' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20' : 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
                    }`}
                  disabled={statusActionLoading || !statusReason.trim()}
                >
                  {statusActionLoading ? <Loader size={18} className="animate-spin" /> :
                    statusAction === 'ACTIVATE' ? 'Confirm Activation' : 'Confirm Suspension'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Details Modal */}
      <AnimatePresence>
        {showDetailsModal && selectedPatient && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[150] p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[32px] max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative border border-white/20 custom-scrollbar"
            >
              <button
                onClick={() => setShowDetailsModal(false)}
                className="absolute top-6 right-6 p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-colors z-10"
              >
                <X size={20} />
              </button>

              <div className="p-8 md:p-12">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-10">
                  <div className="w-20 h-20 rounded-3xl bg-teal-100 flex items-center justify-center text-teal-600 text-4xl font-black">
                    {selectedPatient.user_id?.full_name?.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-slate-800 mb-1">{selectedPatient.user_id?.full_name}</h2>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Patient UID: {selectedPatient._id}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Primary Email</label>
                      <div className="flex items-center gap-3 text-slate-700 font-bold">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center"><Mail size={14} className="text-slate-400" /></div>
                        {selectedPatient.user_id?.email}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Phone Number</label>
                      <div className="flex items-center gap-3 text-slate-700 font-bold">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center"><Phone size={14} className="text-slate-400" /></div>
                        {selectedPatient.user_id?.phone || 'Not provided'}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Physical Address</label>
                      <div className="flex items-center gap-3 text-slate-700 font-bold">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0"><MapPin size={14} className="text-slate-400" /></div>
                        {selectedPatient.user_id?.address || 'N/A'}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Gender</label>
                        <div className="px-4 py-2 bg-slate-50 rounded-xl font-bold text-slate-700 border border-slate-100 uppercase text-xs">{selectedPatient.user_id?.gender || 'OTHER'}</div>
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Blood Type</label>
                        <div className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl font-black border border-rose-100 text-xs flex items-center gap-2"><Heart size={14} /> {selectedPatient.user_id?.blood_type || 'N/A'}</div>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Date of Birth</label>
                      <div className="flex items-center gap-3 text-slate-700 font-bold">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center"><Calendar size={14} className="text-slate-400" /></div>
                        {selectedPatient.user_id?.date_of_birth ? new Date(selectedPatient.user_id.date_of_birth).toLocaleDateString(undefined, { dateStyle: 'long' }) : 'Unknown'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Emergency Contact Section */}
                <div className="mb-10 animate-in fade-in slide-in-from-bottom-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <AlertCircle className="w-3 h-3 text-emerald-500" /> Emergency Contact Representative
                  </h4>
                  <div className="p-6 bg-emerald-50/30 rounded-[24px] border border-emerald-100/50 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Full Name & Relation</p>
                      <p className="font-bold text-slate-800">{selectedPatient.user_id?.emergency_contact_name || 'Not Designated'} <span className="text-xs text-emerald-500 font-medium lowercase">({selectedPatient.user_id?.emergency_contact_relationship || 'none'})</span></p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Contact Details</p>
                      <p className="font-bold text-slate-800 flex items-center gap-2"><Phone className="w-3 h-3" /> {selectedPatient.user_id?.emergency_contact_phone || '---'}</p>
                      <p className="text-xs text-slate-500 font-medium flex items-center gap-2"><Mail className="w-3 h-3" /> {selectedPatient.user_id?.emergency_contact_email || '---'}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 flex items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-teal-600 flex items-center justify-center text-white shadow-lg shadow-teal-600/30">
                      <Activity size={24} />
                    </div>
                    <div>
                      <p className="font-black text-slate-800">Medical Data Access</p>
                      <p className="text-xs text-slate-500 font-medium">Export comprehensive health history</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownloadRecord(selectedPatient._id)}
                    disabled={isDownloading}
                    className="px-6 py-3 bg-white text-slate-900 border border-slate-200 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                  >
                    {isDownloading ? <Loader size={16} className="animate-spin" /> : <Download size={16} />}
                    Download PDF
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ProtectedLayout>
  );
}
