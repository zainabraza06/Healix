'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import ProtectedLayout from '@/components/ProtectedLayout';
import toast from 'react-hot-toast';
import { User, Phone, MapPin, AlertCircle, Search, Activity, ShieldCheck, Heart, Thermometer, Droplets, Download, Calendar, FileText, Pill, ChevronRight, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';

// 3D Background
const Scene = dynamic(() => import('@/components/canvas/Scene'), { ssr: false });
const FloatingIcons = dynamic(() => import('@/components/canvas/FloatingIcons'), { ssr: false });

export default function DoctorPatientsPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [medicalSummary, setMedicalSummary] = useState<any>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.getDoctorPatients();
      if (response.success && response.data) {
        setPatients(response.data.patients || response.data || []);
      } else {
        setError(response.message || 'Failed to load patients');
      }
    } catch (err) {
      setError('An error occurred while fetching patients');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewVitals = async (patientId: string) => {
    try {
      const response = await apiClient.getPatientVitals(patientId);
      if (response.success) {
        toast.success('Vitals loaded');
        setSelectedPatient({
          ...patients.find((p) => p.id === patientId),
          vitals: response.data,
        });
      }
    } catch (err) {
      toast.error('Failed to load vitals');
    }
  };

  const handleSelectPatient = async (patient: any) => {
    setSelectedPatient(patient);
    setMedicalSummary(null);
    
    try {
      setLoadingSummary(true);
      const response = await apiClient.getPatientMedicalSummary(patient.id);
      if (response.success) {
        setMedicalSummary(response.data);
      }
    } catch (err) {
      console.error('Failed to load medical summary:', err);
    } finally {
      setLoadingSummary(false);
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
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Medical record downloaded');
    } catch (err) {
      toast.error('Failed to download medical record');
      console.error(err);
    } finally {
      setIsDownloading(false);
    }
  };

  const filteredPatients = patients.filter(
    (patient) =>
      patient.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-12"
            >
              <h1 className="text-6xl font-black text-slate-800 tracking-tighter leading-none mb-4">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">My Patients</span>
              </h1>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Healthcare Directory & Monitoring
              </p>
            </motion.div>

            {/* Search */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-12"
            >
              <div className="relative group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-14 pr-6 py-5 bg-white/40 backdrop-blur-md border border-white/60 rounded-3xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 transition-all font-bold text-slate-700 shadow-xl shadow-slate-200/20"
                />
              </div>
            </motion.div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              {/* Patient List */}
              <div className="lg:col-span-7">
                {isLoading ? (
                  <div className="glass-card p-20 flex flex-col items-center justify-center border-white/40">
                    <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-6"></div>
                    <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Synchronizing Records...</p>
                  </div>
                ) : error ? (
                  <div className="glass-card p-8 border-red-200/50 bg-red-50/50 backdrop-blur-md flex items-center gap-4 animate-shake">
                    <div className="p-3 bg-red-100 rounded-2xl">
                      <AlertCircle className="text-red-600" size={24} />
                    </div>
                    <p className="text-red-700 font-bold uppercase tracking-widest text-xs">{error}</p>
                  </div>
                ) : filteredPatients.length === 0 ? (
                  <div className="glass-card p-20 text-center border-white/40">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <User size={40} className="text-slate-300" />
                    </div>
                    <p className="text-slate-400 font-black uppercase tracking-widest text-xs">No patients found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredPatients.map((patient, i) => (
                      <motion.div
                        key={patient.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={() => handleSelectPatient(patient)}
                        className={`glass-card p-6 cursor-pointer group transition-all duration-300 relative overflow-hidden ${selectedPatient?.id === patient.id
                          ? 'border-emerald-500/50 ring-4 ring-emerald-500/5 bg-white/70 shadow-2xl scale-[1.02]'
                          : 'border-white/60 bg-white/40 hover:bg-white/60'
                          }`}
                      >
                        {/* Active Alert Badge */}
                        {patient.hasActiveAlert && (
                          <div className="absolute top-3 right-3">
                            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-[9px] font-black uppercase tracking-widest">
                              <AlertTriangle size={10} />
                              Active Alert
                            </span>
                          </div>
                        )}
                        
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                          <div className="flex items-center gap-6">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl transition-transform duration-500 group-hover:scale-110 ${selectedPatient?.id === patient.id
                              ? 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg'
                              : patient.hasActiveAlert 
                                ? 'bg-gradient-to-br from-red-100 to-orange-100 text-red-600'
                                : 'bg-white/50 text-slate-400'
                              }`}>
                              {patient.firstName?.charAt(0) || patient.name?.charAt(0) || 'P'}
                            </div>
                            <div>
                              <h3 className="text-lg font-black text-slate-800 mb-1 tracking-tight">
                                {patient.name || `${patient.firstName} ${patient.lastName}`}
                              </h3>
                              <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                {patient.appointmentCount > 0 && (
                                  <span className="flex items-center gap-1.5 bg-blue-50 text-blue-600 px-2 py-1 rounded-lg">
                                    <Calendar size={12} />
                                    {patient.appointmentCount} Appts
                                  </span>
                                )}
                                {patient.alertCount > 0 && (
                                  <span className="flex items-center gap-1.5 bg-amber-50 text-amber-600 px-2 py-1 rounded-lg">
                                    <AlertCircle size={12} />
                                    {patient.alertCount} Alerts
                                  </span>
                                )}
                                {patient.email && (
                                  <span className="flex items-center gap-1.5 text-slate-400 normal-case font-medium">
                                    {patient.email}
                                  </span>
                                )}
                              </div>
                              {patient.lastAppointmentDate && (
                                <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                  <Clock size={10} />
                                  Last visit: {new Date(patient.lastAppointmentDate).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
                          <ChevronRight size={20} className={`text-slate-300 group-hover:text-emerald-500 transition-colors ${selectedPatient?.id === patient.id ? 'text-emerald-500' : ''}`} />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Patient Details */}
              <div className="lg:col-span-5">
                <AnimatePresence mode="wait">
                  {selectedPatient ? (
                    <motion.div
                      key={selectedPatient.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="glass-card p-8 sticky top-4 border-white/60 shadow-2xl relative overflow-hidden max-h-[calc(100vh-120px)] overflow-y-auto"
                    >
                      <div className="absolute top-0 right-0 p-6 pointer-events-none">
                        <User className="text-emerald-500/10 w-20 h-20" />
                      </div>

                      {/* Header with name and actions */}
                      <div className="mb-6">
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight pr-20">
                          {selectedPatient.full_name || selectedPatient.name || `${selectedPatient.firstName || ''} ${selectedPatient.lastName || ''}`.trim() || 'Unknown'}
                        </h2>
                        {selectedPatient.hasActiveAlert && (
                          <span className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-red-100 text-red-600 rounded-full text-xs font-bold">
                            <AlertTriangle size={12} />
                            Has Active Alert
                          </span>
                        )}
                        <div className="flex gap-2 mt-4">
                          <button
                            onClick={() => handleViewVitals(selectedPatient.id)}
                            className="px-3 py-2 bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold hover:bg-emerald-200 transition-all flex items-center gap-2"
                          >
                            <Activity size={14} />
                            Vitals
                          </button>
                          <button
                            onClick={() => handleDownloadRecord(selectedPatient.id)}
                            disabled={isDownloading}
                            className="px-3 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all flex items-center gap-2 disabled:opacity-50"
                          >
                            <Download size={14} />
                            {isDownloading ? 'Downloading...' : 'Download'}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-6">
                        {/* Personal Information */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email</p>
                            <p className="font-semibold text-slate-700 text-sm break-all">{selectedPatient.email || 'N/A'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone</p>
                            <p className="font-semibold text-slate-700 text-sm">{selectedPatient.phone || selectedPatient.phoneNumber || 'N/A'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date of Birth</p>
                            <p className="font-semibold text-slate-700 text-sm">
                              {(selectedPatient.date_of_birth || selectedPatient.dateOfBirth) 
                                ? new Date(selectedPatient.date_of_birth || selectedPatient.dateOfBirth).toLocaleDateString() 
                                : 'N/A'}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gender</p>
                            <p className="font-semibold text-slate-700 text-sm capitalize">{selectedPatient.gender || 'N/A'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Blood Group</p>
                            <p className="font-semibold text-slate-700 text-sm">{selectedPatient.blood_group || selectedPatient.bloodGroup || 'N/A'}</p>
                          </div>
                          {(selectedPatient.emergency_contact || selectedPatient.emergencyContact) && (
                            <div className="space-y-1">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Emergency</p>
                              <p className="font-semibold text-slate-700 text-sm">{selectedPatient.emergency_contact || selectedPatient.emergencyContact}</p>
                            </div>
                          )}
                        </div>

                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Address</p>
                          <p className="font-semibold text-slate-700 text-sm flex items-start gap-2">
                            <MapPin size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                            {selectedPatient.address || 'Address not listed'}
                          </p>
                        </div>

                        {/* Loading Medical Summary */}
                        {loadingSummary && (
                          <div className="flex items-center justify-center py-6">
                            <RefreshCw size={20} className="text-emerald-500 animate-spin" />
                            <span className="ml-2 text-slate-500 font-medium text-sm">Loading summary...</span>
                          </div>
                        )}

                        {/* Medical Summary */}
                        {!loadingSummary && medicalSummary && (
                          <>
                            {/* Statistics */}
                            <div className="grid grid-cols-4 gap-2">
                              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-center">
                                <Calendar className="text-blue-600 w-4 h-4 mx-auto mb-1" />
                                <span className="text-xl font-black text-blue-700">{medicalSummary.statistics?.totalAppointments || 0}</span>
                                <p className="text-[8px] font-bold text-blue-500 uppercase">Appts</p>
                              </div>
                              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-center">
                                <AlertCircle className="text-amber-600 w-4 h-4 mx-auto mb-1" />
                                <span className="text-xl font-black text-amber-700">{medicalSummary.statistics?.totalAlerts || 0}</span>
                                <p className="text-[8px] font-bold text-amber-500 uppercase">Alerts</p>
                              </div>
                              <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 text-center">
                                <Pill className="text-purple-600 w-4 h-4 mx-auto mb-1" />
                                <span className="text-xl font-black text-purple-700">{medicalSummary.statistics?.totalPrescriptions || 0}</span>
                                <p className="text-[8px] font-bold text-purple-500 uppercase">Rx</p>
                              </div>
                              <div className="p-3 bg-red-50 rounded-xl border border-red-100 text-center">
                                <AlertTriangle className="text-red-600 w-4 h-4 mx-auto mb-1" />
                                <span className="text-xl font-black text-red-700">{medicalSummary.statistics?.activeAlerts || 0}</span>
                                <p className="text-[8px] font-bold text-red-500 uppercase">Active</p>
                              </div>
                            </div>

                            {/* Allergies */}
                            {medicalSummary.medicalInfo?.allergies && medicalSummary.medicalInfo.allergies.length > 0 && (
                              <div className="p-3 bg-orange-50 rounded-xl border border-orange-100">
                                <h4 className="text-[10px] font-black text-orange-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                                  <AlertTriangle size={12} />
                                  Allergies
                                </h4>
                                <div className="flex flex-wrap gap-1.5">
                                  {medicalSummary.medicalInfo.allergies.map((allergy: any, idx: number) => (
                                    <span key={idx} className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      allergy.severity === 'severe' ? 'bg-red-100 text-red-700' :
                                      allergy.severity === 'moderate' ? 'bg-orange-100 text-orange-700' :
                                      'bg-yellow-100 text-yellow-700'
                                    }`}>
                                      {typeof allergy === 'string' ? allergy : allergy.name}
                                      {allergy.severity && <span className="ml-1 opacity-70">({allergy.severity})</span>}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Recent Appointments */}
                            {medicalSummary.recentAppointments && medicalSummary.recentAppointments.length > 0 && (
                              <div>
                                <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                                  <Calendar size={12} className="text-blue-500" />
                                  Recent Appointments
                                </h4>
                                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                  {medicalSummary.recentAppointments.slice(0, 5).map((apt: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                                      <div>
                                        <p className="text-xs font-bold text-slate-700">
                                          {apt.date ? new Date(apt.date).toLocaleDateString() : 'N/A'}
                                        </p>
                                        <p className="text-[10px] text-slate-500 truncate max-w-[150px]">{apt.reason || apt.type || 'General'}</p>
                                      </div>
                                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                        apt.status === 'COMPLETED' ? 'bg-green-100 text-green-600' :
                                        apt.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-600' :
                                        'bg-slate-100 text-slate-600'
                                      }`}>
                                        {apt.status}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Recent Prescriptions */}
                            {medicalSummary.prescriptions && medicalSummary.prescriptions.length > 0 && (
                              <div>
                                <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                                  <Pill size={12} className="text-purple-500" />
                                  Recent Prescriptions
                                </h4>
                                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                  {medicalSummary.prescriptions.slice(0, 5).map((rx: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between p-2 bg-purple-50 rounded-lg">
                                      <div>
                                        <p className="text-xs font-bold text-slate-700">
                                          {rx.medications && rx.medications.length > 0 
                                            ? rx.medications.map((m: any) => m.name || m.medication).join(', ')
                                            : 'Prescription'}
                                        </p>
                                        <p className="text-[10px] text-slate-500">{rx.notes || 'No notes'}</p>
                                      </div>
                                      <span className="text-[10px] text-purple-600 font-medium">
                                        {rx.issuedDate ? new Date(rx.issuedDate).toLocaleDateString() : 'N/A'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}

                        {/* Vitals Section - only show if available */}
                        {selectedPatient.vitals && (
                          <div className="pt-4 border-t border-slate-200/50">
                            <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2 uppercase">
                              <Activity size={14} className="text-emerald-500" />
                              Latest Vitals
                            </h3>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                                <Heart className="text-emerald-600 w-4 h-4 mx-auto mb-1" />
                                <span className="text-[9px] font-black uppercase text-emerald-600">HR</span>
                                <p className="text-lg font-black text-emerald-700">{selectedPatient.vitals.heartRate}</p>
                                <span className="text-[8px] font-bold text-emerald-500">BPM</span>
                              </div>
                              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-center">
                                <Droplets className="text-blue-600 w-4 h-4 mx-auto mb-1" />
                                <span className="text-[9px] font-black uppercase text-blue-600">BP</span>
                                <p className="text-lg font-black text-blue-700">{selectedPatient.vitals.bloodPressure}</p>
                                <span className="text-[8px] font-bold text-blue-500">mmHg</span>
                              </div>
                              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-center">
                                <Thermometer className="text-amber-600 w-4 h-4 mx-auto mb-1" />
                                <span className="text-[9px] font-black uppercase text-amber-600">Temp</span>
                                <p className="text-lg font-black text-amber-700">{selectedPatient.vitals.temperature}°</p>
                                <span className="text-[8px] font-bold text-amber-500">°C</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ) : (
                    <div className="glass-card p-20 text-center border-white/40 flex flex-col items-center justify-center opacity-50 h-[600px]">
                      <div className="w-24 h-24 bg-slate-100 rounded-3xl flex items-center justify-center mb-6">
                        <User size={48} className="text-slate-300" />
                      </div>
                      <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-xs max-w-[200px] leading-relaxed">
                        Select a patient from the list to view comprehensive details
                      </p>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedLayout>
  );
}
