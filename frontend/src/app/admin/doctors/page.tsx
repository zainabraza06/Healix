'use client';

import { useState, useEffect, FormEvent } from 'react';
import { apiClient } from '@/lib/apiClient';
import ProtectedLayout from '@/components/ProtectedLayout';
import toast from 'react-hot-toast';
import {
  X, Search, UserPlus, Bell, Power,
  ArrowLeft, Activity, Clock, Loader,
  Download, FileText, Database, Code,
  AlertCircle, Phone, Mail, Shield, Briefcase, Calendar
} from 'lucide-react';
import { Doctor } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [requestFilter, setRequestFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phoneNumber: '',
    licenseNumber: '',
    specialization: '',
    qualifications: '',
    yearsOfExperience: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactEmail: '',
    emergencyContactRelationship: '',
  });
  const [registerLoading, setRegisterLoading] = useState(false);

  // Status Change Management State
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusAction, setStatusAction] = useState<'ACTIVATE' | 'DEACTIVATE'>('ACTIVATE');
  const [statusReason, setStatusReason] = useState('');
  const [statusActionLoading, setStatusActionLoading] = useState(false);

  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const handleExport = async (format: 'pdf' | 'csv' | 'json') => {
    try {
      const blob = await apiClient.downloadDoctors(format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `medical_personnel_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Personnel data exported as ${format.toUpperCase()}`);
    } catch (err) {
      console.error(err);
      toast.error('Export failed');
    }
  };

  const handleRegisterChange = (field: string, value: string) => {
    setRegisterForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleRegisterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!registerForm.firstName || !registerForm.lastName || !registerForm.email || !registerForm.password || !registerForm.licenseNumber) {
      toast.error('First name, last name, email, password, and license are required');
      return;
    }

    try {
      setRegisterLoading(true);
      const payload = {
        ...registerForm,
        yearsOfExperience: registerForm.yearsOfExperience ? Number(registerForm.yearsOfExperience) : 0,
      };
      const res = await apiClient.registerDoctorAsAdmin(payload);
      if (res.success) {
        toast.success('Doctor registered successfully');
        setRegisterForm({
          firstName: '',
          lastName: '',
          email: '',
          password: '',
          phoneNumber: '',
          licenseNumber: '',
          specialization: '',
          qualifications: '',
          yearsOfExperience: '',
          emergencyContactName: '',
          emergencyContactPhone: '',
          emergencyContactEmail: '',
          emergencyContactRelationship: '',
        });
        setShowRegisterForm(false);
        fetchDoctors();
      } else {
        toast.error(res.message || 'Registration failed');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Registration failed');
    } finally {
      setRegisterLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, [currentPage, searchTerm, requestFilter]);

  const fetchDoctors = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.getDoctors(
        currentPage,
        10,
        searchTerm,
        requestFilter === 'ALL' ? undefined : requestFilter
      );
      if (response.success && response.data) {
        setDoctors(response.data.content || []);
        setTotalPages(response.data.totalPages || 1);
      } else {
        toast.error(response.message || 'Failed to load doctors');
      }
    } catch (err) {
      toast.error('An error occurred while fetching doctors');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageStatus = async () => {
    if (!statusReason.trim()) {
      toast.error('Reason is required for email notification');
      return;
    }

    try {
      setStatusActionLoading(true);
      const response = await apiClient.manageDoctorStatus({
        doctorId: selectedDoctor._id || selectedDoctor.id,
        status: statusAction,
        reason: statusReason
      });

      if (response.success) {
        toast.success(`Doctor ${statusAction.toLowerCase()}d successfully!`);
        setShowStatusModal(false);
        setStatusReason('');
        fetchDoctors();
      }
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
    } finally {
      setStatusActionLoading(false);
    }
  }

  // ... (handleApprove, handleReject, handleRegister same - but make sure IDs are handled)

  return (
    <ProtectedLayout allowedRoles={['ADMIN']}>
      <div className="container-main py-10">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="animate-fade-in">
              <h1 className="text-4xl lg:text-5xl font-black text-slate-800 tracking-tight leading-none mb-3">
                Doctor <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">Personnel</span>
              </h1>
              <p className="text-slate-500 font-medium text-lg">Manage credentials, review status requests, and control platform access.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative group/export">
                <button
                  className="px-6 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  <Download className="w-5 h-5" /> Export Data
                </button>
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 opacity-0 invisible group-hover/export:opacity-100 group-hover/export:visible transition-all z-50">
                  <button onClick={() => handleExport('pdf')} className="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-600" /> Professional PDF
                  </button>
                  <button onClick={() => handleExport('csv')} className="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-600" /> CSV Spreadsheet
                  </button>
                  <button onClick={() => handleExport('json')} className="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition flex items-center gap-2">
                    <Code className="w-4 h-4 text-emerald-600" /> Data JSON
                  </button>
                </div>
              </div>

              <button
                onClick={() => setShowRegisterForm(!showRegisterForm)}
                className="group relative px-8 py-4 bg-slate-900 text-white font-black rounded-2xl overflow-hidden transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-slate-900/20"
              >
                <div className="relative z-10 flex items-center gap-3">
                  {showRegisterForm ? <X size={20} /> : <UserPlus size={20} />}
                  {showRegisterForm ? 'Close Registration' : 'Register New Doctor'}
                </div>
              </button>
            </div>
          </div>

          {showRegisterForm && (
            <div className="glass-card p-6 md:p-8 mb-8 border-white/60 shadow-xl">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-2xl font-black text-slate-800">Register New Doctor</h3>
                  <p className="text-slate-500 text-sm font-medium">Create a doctor account directly without the approval queue.</p>
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">Instant Activation</span>
              </div>

              <form onSubmit={handleRegisterSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">First Name</label>
                    <input
                      value={registerForm.firstName}
                      onChange={(e) => handleRegisterChange('firstName', e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
                      placeholder="Jane"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Last Name</label>
                    <input
                      value={registerForm.lastName}
                      onChange={(e) => handleRegisterChange('lastName', e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
                      placeholder="Doe"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Email</label>
                    <input
                      type="email"
                      value={registerForm.email}
                      onChange={(e) => handleRegisterChange('email', e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
                      placeholder="doctor@example.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Temporary Password</label>
                    <input
                      type="text"
                      value={registerForm.password}
                      onChange={(e) => handleRegisterChange('password', e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
                      placeholder="Auto-generate or set"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Phone Number</label>
                    <input
                      value={registerForm.phoneNumber}
                      onChange={(e) => handleRegisterChange('phoneNumber', e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">License Number</label>
                    <input
                      value={registerForm.licenseNumber}
                      onChange={(e) => handleRegisterChange('licenseNumber', e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
                      placeholder="MD-12345"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Specialization</label>
                    <input
                      value={registerForm.specialization}
                      onChange={(e) => handleRegisterChange('specialization', e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
                      placeholder="Cardiology"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Qualifications</label>
                    <input
                      value={registerForm.qualifications}
                      onChange={(e) => handleRegisterChange('qualifications', e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
                      placeholder="MD, PhD"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Years of Experience</label>
                    <input
                      type="number"
                      min="0"
                      value={registerForm.yearsOfExperience}
                      onChange={(e) => handleRegisterChange('yearsOfExperience', e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
                      placeholder="10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Emergency Contact Name</label>
                    <input
                      value={registerForm.emergencyContactName}
                      onChange={(e) => handleRegisterChange('emergencyContactName', e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
                      placeholder="Contact person"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Emergency Contact Relationship</label>
                    <input
                      value={registerForm.emergencyContactRelationship}
                      onChange={(e) => handleRegisterChange('emergencyContactRelationship', e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
                      placeholder="Partner, sibling, etc."
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Emergency Contact Phone</label>
                    <input
                      value={registerForm.emergencyContactPhone}
                      onChange={(e) => handleRegisterChange('emergencyContactPhone', e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
                      placeholder="+1 (555) 987-6543"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Emergency Contact Email</label>
                    <input
                      type="email"
                      value={registerForm.emergencyContactEmail}
                      onChange={(e) => handleRegisterChange('emergencyContactEmail', e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
                      placeholder="contact@example.com"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowRegisterForm(false)}
                    className="px-5 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition"
                    disabled={registerLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 bg-emerald-600 text-white font-black rounded-xl uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-700 transition shadow-lg shadow-emerald-500/20"
                    disabled={registerLoading}
                  >
                    {registerLoading ? <Loader size={18} className="animate-spin" /> : <UserPlus size={18} />}<span>{registerLoading ? 'Registering...' : 'Create Doctor Account'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Action Bar: Search & Filters */}
          <div className="glass-card p-4 mb-8 border-white/50 shadow-sm flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Search name, email, or license..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(0);
                }}
                className="w-full pl-12 pr-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex p-1 bg-slate-100/50 rounded-xl border border-slate-200/50">
                {['ALL', 'ANY_REQUEST', 'ACTIVATE_REQUEST', 'DEACTIVATE_REQUEST'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => {
                      setRequestFilter(filter);
                      setCurrentPage(0);
                    }}
                    className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${requestFilter === filter
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                      }`}
                  >
                    {filter.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table Overhaul */}
          {isLoading ? (
            <div className="glass-card py-32 flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin"></div>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Accessing Database...</p>
            </div>
          ) : doctors.length === 0 ? (
            <div className="glass-card py-20 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-slate-300">
                <Search size={32} className="text-slate-300" />
              </div>
              <h3 className="text-xl font-black text-slate-800">No Doctors Found</h3>
              <p className="text-slate-500 mt-1">Refine your search or clear filters to see more results.</p>
            </div>
          ) : (
            <>
              <div className="glass-card overflow-hidden p-0 border-white/50 shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-100">
                        <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Medical Personnel</th>
                        <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Credentials</th>
                        <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Security Status</th>
                        <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Account Activity</th>
                        <th className="px-6 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Control Panel</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {doctors.map((doctor) => (
                        <tr
                          key={doctor._id || doctor.id}
                          className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                          onClick={() => { setSelectedDoctor(doctor); setShowDetailsModal(true); }}
                        >
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-4">
                              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-100 to-white border border-white shadow-sm flex items-center justify-center text-slate-400 font-black group-hover:scale-110 transition-transform">
                                {doctor.user_id?.full_name?.charAt(0)}
                              </div>
                              <div>
                                <p className="font-bold text-slate-800">Dr. {doctor.user_id?.full_name}</p>
                                <p className="text-xs text-slate-500">{doctor.user_id?.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-wider mb-1">
                              {doctor.specialization}
                            </span>
                            <p className="text-xs font-mono text-slate-400 font-bold">{doctor.license_number}</p>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${doctor.user_id?.is_active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-300'}`}></div>
                                <span className={`text-xs font-black uppercase tracking-widest ${doctor.user_id?.is_active ? 'text-emerald-700' : 'text-slate-400'}`}>
                                  {doctor.user_id?.is_active ? 'Active' : 'Deactivated'}
                                </span>
                              </div>
                              <span className={`text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 rounded w-fit ${doctor.application_status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600' :
                                doctor.application_status === 'REJECTED' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                                }`}>
                                Verification: {doctor.application_status}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            {doctor.status_change_request?.status === 'PENDING' ? (
                              <div className="p-2.5 bg-amber-50 border border-amber-100 rounded-xl animate-pulse">
                                <p className="text-[9px] font-black text-amber-700 uppercase tracking-widest mb-0.5">
                                  Request: {doctor.status_change_request.type}
                                </p>
                                <p className="text-[10px] text-amber-600 font-medium italic line-clamp-1 max-w-[150px]">
                                  "{doctor.status_change_request.reason}"
                                </p>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400 font-medium italic">No pending requests</p>
                            )}
                          </td>
                          <td className="px-6 py-5" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2">
                              {doctor.status_change_request?.status === 'PENDING' ? (
                                <button
                                  onClick={() => {
                                    setSelectedDoctor(doctor);
                                    setStatusAction(doctor.status_change_request?.type || 'ACTIVATE');
                                    setShowStatusModal(true);
                                  }}
                                  className="px-4 py-2 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-slate-800 transition flex items-center gap-2"
                                >
                                  <Bell size={12} className="animate-bounce" />
                                  Review Request
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setSelectedDoctor(doctor);
                                    setStatusAction(doctor.user_id?.is_active ? 'DEACTIVATE' : 'ACTIVATE');
                                    setShowStatusModal(true);
                                  }}
                                  className={`p-2.5 rounded-xl transition-all ${doctor.user_id?.is_active
                                    ? 'bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600'
                                    : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                    }`}
                                  title={doctor.user_id?.is_active ? 'Deactivate Access' : 'Activate Access'}
                                >
                                  <Power size={18} />
                                </button>
                              )}
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
                    Page <span className="text-emerald-600">{currentPage + 1}</span> of {totalPages}
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

      {/* Doctor Details Modal */}
      <AnimatePresence>
        {showDetailsModal && selectedDoctor && (
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
                  <div className="w-20 h-20 rounded-3xl bg-emerald-100 flex items-center justify-center text-emerald-600 text-4xl font-black">
                    {selectedDoctor.user_id?.full_name?.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-slate-800 mb-1">Dr. {selectedDoctor.user_id?.full_name}</h2>
                    <p className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500 font-bold uppercase tracking-widest text-xs">Medical ID: {selectedDoctor.license_number || selectedDoctor.licenseNumber}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Professional Email</label>
                      <div className="flex items-center gap-3 text-slate-700 font-bold">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center"><Mail size={14} className="text-slate-400" /></div>
                        {selectedDoctor.user_id?.email}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Primary Specialization</label>
                      <div className="flex items-center gap-3 text-slate-700 font-bold">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center"><Briefcase size={14} className="text-slate-400" /></div>
                        {selectedDoctor.specialization}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Experience Level</label>
                      <div className="flex items-center gap-3 text-slate-700 font-bold">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0"><Clock size={14} className="text-slate-400" /></div>
                        {selectedDoctor.yearsOfExperience} Years Clinical Experience
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Account Status</label>
                      <div className={`px-4 py-2 rounded-xl font-black border text-xs flex items-center gap-2 w-fit ${selectedDoctor.user_id?.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                        <Shield size={14} /> {selectedDoctor.user_id?.is_active ? 'ACTIVE ACCESS' : 'SUSPENDED'}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Application Decision</label>
                      <div className="px-4 py-2 bg-slate-100/50 rounded-xl font-bold text-slate-700 border border-slate-200 uppercase text-xs w-fit">{selectedDoctor.application_status}</div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Registered Since</label>
                      <div className="flex items-center gap-3 text-slate-700 font-bold">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center"><Calendar size={14} className="text-slate-400" /></div>
                        {new Date(selectedDoctor.created_at).toLocaleDateString(undefined, { dateStyle: 'long' })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Emergency Contact Section */}
                <div className="mb-8 animate-in fade-in slide-in-from-bottom-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <AlertCircle className="w-3 h-3 text-emerald-500" /> Personnel Emergency Contact
                  </h4>
                  <div className="p-6 bg-slate-50 rounded-[24px] border border-slate-200/60 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Full Name & Relation</p>
                      <p className="font-bold text-slate-800">{selectedDoctor.user_id?.emergency_contact_name || 'Not Specified'} <span className="text-xs text-slate-500 font-medium lowercase">({selectedDoctor.user_id?.emergency_contact_relationship || 'none'})</span></p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Contact Details</p>
                      <p className="font-bold text-slate-800 flex items-center gap-2 text-xs"><Phone className="w-3 h-3" /> {selectedDoctor.user_id?.emergency_contact_phone || '---'}</p>
                      <p className="text-xs text-slate-500 font-medium flex items-center gap-2"><Mail className="w-3 h-3" /> {selectedDoctor.user_id?.emergency_contact_email || '---'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Status Management Modal */}
      {showStatusModal && selectedDoctor && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4 animate-in fade-in">
          <div className="glass-card p-8 max-w-md w-full border-white/60 shadow-2xl animate-in zoom-in-95">
            <div className="mb-6">
              <div className={`w-14 h-14 ${statusAction === 'ACTIVATE' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'} rounded-2xl flex items-center justify-center mb-6`}>
                <Activity size={28} />
              </div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-2 uppercase">
                {selectedDoctor.status_change_request?.status === 'PENDING' ? 'Confirm Request' : 'Manual Status Toggle'}
              </h3>
              <p className="text-slate-500 text-sm font-medium leading-relaxed">
                {statusAction === 'ACTIVATE'
                  ? `Grant platform access to Dr. ${selectedDoctor.user_id?.full_name}. This will re-enable their profile for patients.`
                  : `Suspend platform access for Dr. ${selectedDoctor.user_id?.full_name}. This will hide their profile from patients.`}
              </p>
            </div>

            {selectedDoctor.status_change_request?.status === 'PENDING' && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                <p className="text-[10px] font-black uppercase text-amber-700 tracking-widest mb-1.5 flex items-center gap-1">
                  <Clock size={12} /> Doctor's Request Details
                </p>
                <p className="text-sm font-bold text-slate-800">Reason for {selectedDoctor.status_change_request.type}:</p>
                <p className="text-xs text-slate-600 mt-1 font-medium italic leading-relaxed">
                  "{selectedDoctor.status_change_request.reason}"
                </p>
              </div>
            )}

            <div className="space-y-4">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Admin Resolution (sent via email)</label>
              <textarea
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="Provide details for the doctor regarding this action..."
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
          </div>
        </div>
      )}
    </ProtectedLayout>
  );
}
