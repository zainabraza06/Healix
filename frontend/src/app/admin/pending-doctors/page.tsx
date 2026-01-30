'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/authStore';
import { apiClient } from '@/lib/apiClient';
import ProtectedLayout from '@/components/ProtectedLayout';
import { Loader, ArrowLeft, CheckCircle, XCircle, Mail, Key, ShieldCheck, GraduationCap, Clock, Phone, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';

// 3D Background
const Scene = dynamic(() => import('@/components/canvas/Scene'), { ssr: false });
const FloatingIcons = dynamic(() => import('@/components/canvas/FloatingIcons'), { ssr: false });

interface Doctor {
  _id: string;
  user_id: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
  };
  license_number: string;
  specialization: string;
  qualifications: string;
  years_of_experience: number;
  created_at: string;
}

export default function PendingDoctorsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize] = useState(10);

  const formatStatus = (status: string): string => {
    return status
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  useEffect(() => {
    const fetchPendingDoctors = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get(`/admin/applications?status=PENDING&page=${currentPage}&size=${pageSize}`);
        if (response.success && response.data) {
          setDoctors(response.data.content || []);
          setTotalPages(response.data.totalPages || 1);
        }
      } catch (err: any) {
        console.error('Error fetching pending doctors:', err);
        toast.error('Failed to load pending doctors');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchPendingDoctors();
    }
  }, [user, currentPage]);

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setGeneratedPassword(password);
    return password;
  };

  const handleApprove = async () => {
    if (!selectedDoctor) return;

    try {
      setActionLoading(true);
      const password = generatePassword();

      await apiClient.approveDoctor({
        doctorId: selectedDoctor._id,
        password: password,
        doctorEmail: selectedDoctor.user_id.email,
      });

      toast.success('Doctor approved! Email sent with credentials.');
      setShowApprovalModal(false);
      setGeneratedPassword('');
      setSelectedDoctor(null);

      // Remove approved doctor from list
      setDoctors(doctors.filter(d => d._id !== selectedDoctor._id));
    } catch (err: any) {
      console.error('Error approving doctor:', err);
      toast.error(err.response?.data?.message || 'Failed to approve doctor');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedDoctor || !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    try {
      setActionLoading(true);

      await apiClient.rejectDoctor({
        doctorId: selectedDoctor._id,
        reason: rejectionReason,
        doctorEmail: selectedDoctor.user_id.email,
      });

      toast.success('Doctor application rejected! Email sent to doctor.');
      setShowRejectionModal(false);
      setRejectionReason('');
      setSelectedDoctor(null);

      // Remove rejected doctor from list
      setDoctors(doctors.filter(d => d._id !== selectedDoctor._id));
    } catch (err: any) {
      console.error('Error rejecting doctor:', err);
      toast.error(err.response?.data?.message || 'Failed to reject doctor');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <ProtectedLayout allowedRoles={['ADMIN']}>
        <div className="flex items-center justify-center h-screen bg-slate-50">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-emerald-100 rounded-full animate-pulse"></div>
              <div className="absolute inset-0 w-16 h-16 border-t-4 border-emerald-600 rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Loading Applications...</p>
          </div>
        </div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout allowedRoles={['ADMIN']}>
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
            <div className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
              <div>
                <button
                  onClick={() => router.back()}
                  className="mb-4 group flex items-center gap-2 text-slate-500 hover:text-emerald-600 transition-colors font-semibold uppercase tracking-wide text-xs"
                >
                  <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                  Back to Dashboard
                </button>
                <div className="animate-fade-in-up">
                  <h1 className="text-4xl md:text-5xl font-black text-slate-800 tracking-tight leading-tight mb-2">
                    Doctor <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">Applications</span>
                  </h1>
                  <p className="text-slate-600 text-lg font-medium max-w-2xl">
                    Review credential verifications and manage pending access requests.
                  </p>
                </div>
              </div>
              <div className="bg-white/60 backdrop-blur rounded-2xl px-5 py-3 border border-white shadow-sm flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-full text-amber-600">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Pending</p>
                  <p className="text-2xl font-black text-slate-800 leading-none">{doctors.length}</p>
                </div>
              </div>
            </div>

            {doctors.length > 0 ? (
              <div className="grid gap-6">
                {doctors.map((doctor, idx) => (
                  <div key={doctor._id} className="glass-card p-0 overflow-hidden animate-fade-in-up" style={{ animationDelay: `${idx * 100}ms` }}>
                    <div className="p-6 md:p-8 grid md:grid-cols-12 gap-8 items-start">
                      {/* Avatar/Initial */}
                      <div className="md:col-span-1 hidden md:flex items-center justify-center">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 border border-white shadow-inner flex items-center justify-center text-2xl font-black text-slate-400">
                          {doctor.user_id.name.charAt(0)}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="md:col-span-8 space-y-6">
                        <div>
                          <h3 className="text-2xl font-bold text-slate-800">{doctor.user_id.name}</h3>
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm">
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-100">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              {formatStatus(doctor.specialization)}
                            </span>
                            <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                              <Clock className="w-3.5 h-3.5" />
                              Applied {formatDate(doctor.created_at)}
                            </span>
                          </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                          <div className="space-y-4">
                            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition border border-transparent hover:border-slate-200">
                              <Mail className="w-4 h-4 text-slate-400 mt-0.5" />
                              <div>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Contact Email</p>
                                <p className="font-semibold text-slate-700">{doctor.user_id.email}</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition border border-transparent hover:border-slate-200">
                              <Phone className="w-4 h-4 text-slate-400 mt-0.5" />
                              <div>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Phone Number</p>
                                <p className="font-semibold text-slate-700">{doctor.user_id.phone || 'N/A'}</p>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition border border-transparent hover:border-slate-200">
                              <GraduationCap className="w-4 h-4 text-slate-400 mt-0.5" />
                              <div>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Qualifications</p>
                                <p className="font-semibold text-slate-700">{doctor.qualifications || 'N/A'}</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition border border-transparent hover:border-slate-200">
                              <div className="w-4 text-center font-bold text-slate-400">{doctor.years_of_experience}</div>
                              <div>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Years Experience</p>
                                <p className="font-semibold text-slate-700">{doctor.years_of_experience} Years</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2">
                          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 ml-1">License Verification</p>
                          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg text-slate-600 font-mono font-bold border border-slate-200">
                            <ShieldCheck className="w-4 h-4 text-slate-400" />
                            {doctor.license_number}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="md:col-span-3 flex flex-col gap-3 h-full justify-center border-l border-slate-100 pl-0 md:pl-8 mt-6 md:mt-0 pt-6 md:pt-0 border-t md:border-t-0">
                        <button
                          onClick={() => {
                            setSelectedDoctor(doctor);
                            setShowApprovalModal(true);
                          }}
                          className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:shadow-emerald-500/30 transition-all flex items-center justify-center gap-2 group"
                        >
                          <CheckCircle className="w-5 h-5 transition-transform group-hover:scale-110" />
                          Approve Access
                        </button>
                        <button
                          onClick={() => {
                            setSelectedDoctor(doctor);
                            setShowRejectionModal(true);
                          }}
                          className="w-full py-3.5 bg-white border border-red-100 text-red-600 font-bold rounded-xl hover:bg-red-50 hover:border-red-200 transition-all flex items-center justify-center gap-2 group"
                        >
                          <XCircle className="w-5 h-5 transition-transform group-hover:scale-110" />
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-card p-20 text-center border-white/50 bg-white/20">
                <div className="w-24 h-24 bg-gradient-to-tr from-emerald-50 to-teal-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border border-white">
                  <CheckCircle className="w-10 h-10 text-emerald-500" />
                </div>
                <h3 className="text-3xl font-black text-slate-800 mb-3 tracking-tight">All Clear!</h3>
                <p className="text-slate-600 text-lg max-w-md mx-auto">There are currently no pending verification requests. Great job staying on top of things!</p>
              </div>
            )}

            {/* Pagination */}
            {!loading && totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center">
                <div className="glass-panel px-4 py-2 flex items-center gap-4">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                    disabled={currentPage === 0}
                    className="p-2 hover:bg-white rounded-lg transition disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                  </button>
                  <span className="text-sm font-bold text-slate-600">
                    Page <span className="text-emerald-600">{currentPage + 1}</span> of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                    disabled={currentPage === totalPages - 1}
                    className="p-2 hover:bg-white rounded-lg transition disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <ArrowLeft className="w-5 h-5 text-slate-600 rotate-180" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Approval Modal */}
        {showApprovalModal && selectedDoctor && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="glass-card p-8 max-w-md w-full border-white/60 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="mb-6">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-4 text-emerald-600">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-black text-slate-800">Approve Application</h3>
                <p className="text-slate-600 mt-2">
                  You are about to grant access to <span className="font-bold text-slate-800">{selectedDoctor.user_id.name}</span>.
                </p>
              </div>

              <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 mb-6">
                <div className="flex gap-3">
                  <div className="mt-0.5"><Key className="w-4 h-4 text-blue-500" /></div>
                  <div className="text-sm text-blue-900">
                    <p className="font-bold mb-1">Credentials Generation</p>
                    <p className="opacity-80 leading-relaxed">System will auto-generate a secure password and email it to <strong>{selectedDoctor.user_id.email}</strong>.</p>
                  </div>
                </div>
              </div>

              {generatedPassword && (
                <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl relative overflow-hidden group">
                  <div className="relative z-10">
                    <p className="text-[10px] font-black uppercase text-emerald-800 tracking-widest mb-1">Generated Password</p>
                    <p className="font-mono text-xl text-emerald-700 font-bold break-all">{generatedPassword}</p>
                  </div>
                  <div className="absolute right-0 top-0 h-full w-20 bg-gradient-to-l from-emerald-100 to-transparent opacity-50"></div>
                </div>
              )}

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => {
                    setShowApprovalModal(false);
                    setGeneratedPassword('');
                  }}
                  className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition disabled:opacity-50"
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleApprove}
                  className="flex-1 px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-600/20 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  disabled={actionLoading}
                >
                  {actionLoading ? <Loader className="w-5 h-5 animate-spin" /> : 'Confirm Approval'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rejection Modal */}
        {showRejectionModal && selectedDoctor && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="glass-card p-8 max-w-md w-full border-white/60 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="mb-6">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
                  <XCircle className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-black text-slate-800">Reject Application</h3>
                <p className="text-slate-600 mt-2">
                  Deny access for <span className="font-bold text-slate-800">{selectedDoctor.user_id.name}</span>. This action cannot be undone easily.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Reason for Rejection</label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g., License verification failed, incomplete documentation..."
                    className="w-full p-4 bg-white/50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 resize-none text-sm font-medium transition-all shadow-sm"
                    rows={4}
                  />
                </div>

                <div className="bg-red-50/50 border border-red-100 rounded-2xl p-4">
                  <div className="flex gap-3">
                    <div className="mt-0.5"><Mail className="w-4 h-4 text-red-500" /></div>
                    <div className="text-sm text-red-900">
                      <p className="font-bold mb-1">Notification</p>
                      <p className="opacity-80">This reason will be emailed to <strong>{selectedDoctor.user_id.email}</strong>.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => {
                    setShowRejectionModal(false);
                    setRejectionReason('');
                  }}
                  className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition disabled:opacity-50"
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  className="flex-1 px-4 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 hover:shadow-lg hover:shadow-red-600/20 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  disabled={actionLoading || !rejectionReason.trim()}
                >
                  {actionLoading ? <Loader className="w-5 h-5 animate-spin" /> : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}
