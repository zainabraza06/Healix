'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import ProtectedLayout from '@/components/ProtectedLayout';
import toast from 'react-hot-toast';
import { User, Phone, MapPin, AlertCircle, Search, Activity, ShieldCheck, Heart, Thermometer, Droplets } from 'lucide-react';
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
                        onClick={() => setSelectedPatient(patient)}
                        className={`glass-card p-6 cursor-pointer group transition-all duration-300 relative overflow-hidden ${selectedPatient?.id === patient.id
                          ? 'border-emerald-500/50 ring-4 ring-emerald-500/5 bg-white/70 shadow-2xl scale-[1.02]'
                          : 'border-white/60 bg-white/40 hover:bg-white/60'
                          }`}
                      >
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                          <div className="flex items-center gap-6">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl transition-transform duration-500 group-hover:scale-110 ${selectedPatient?.id === patient.id
                              ? 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg'
                              : 'bg-white/50 text-slate-400'
                              }`}>
                              {patient.firstName?.charAt(0) || 'P'}
                            </div>
                            <div>
                              <h3 className="text-lg font-black text-slate-800 mb-1 tracking-tight">
                                {patient.firstName} {patient.lastName}
                              </h3>
                              <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                <span className="flex items-center gap-1.5 bg-slate-100/50 px-2 py-1 rounded-lg">
                                  <Activity size={12} className="text-emerald-500" />
                                  Active
                                </span>
                                {patient.phoneNumber && (
                                  <span className="flex items-center gap-1.5">
                                    <Phone size={12} />
                                    {patient.phoneNumber}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewVitals(patient.id);
                            }}
                            className={`px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${selectedPatient?.id === patient.id
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                          >
                            View Vitals
                          </button>
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
                      className="glass-card p-10 sticky top-4 border-white/60 shadow-2xl relative overflow-hidden group"
                    >
                      <div className="absolute top-0 right-0 p-8">
                        <User className="text-emerald-500/10 w-24 h-24" />
                      </div>

                      <h2 className="text-3xl font-black text-slate-800 mb-8 tracking-tight">
                        {selectedPatient.firstName} {selectedPatient.lastName}
                      </h2>

                      <div className="space-y-8">
                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Patient Email</p>
                            <p className="font-bold text-slate-700">{selectedPatient.email}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Phone</p>
                            <p className="font-bold text-slate-700">{selectedPatient.phoneNumber || 'Not provided'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Age / DOB</p>
                            <p className="font-bold text-slate-700">
                              {selectedPatient.dateOfBirth ? new Date(selectedPatient.dateOfBirth).toLocaleDateString() : 'N/A'}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Gender</p>
                            <p className="font-bold text-slate-700">{selectedPatient.gender || 'N/A'}</p>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Registered Address</p>
                          <p className="font-bold text-slate-700 flex items-start gap-2">
                            <MapPin size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                            {selectedPatient.address || 'Address not listed'}
                          </p>
                        </div>

                        {selectedPatient.vitals && (
                          <div className="mt-12 pt-12 border-t border-slate-200/50">
                            <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-3 tracking-tight uppercase">
                              <Activity size={18} className="text-emerald-500" />
                              Latest Clinical Vitals
                            </h3>
                            <div className="grid grid-cols-3 gap-4">
                              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex flex-col items-center gap-2">
                                <Heart className="text-emerald-600 w-5 h-5 mb-1" />
                                <span className="text-[9px] font-black uppercase text-emerald-600 tracking-tighter">Heart Rate</span>
                                <span className="text-lg font-black text-emerald-700">{selectedPatient.vitals.heartRate}</span>
                                <span className="text-[8px] font-bold text-emerald-500 uppercase">BPM</span>
                              </div>
                              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex flex-col items-center gap-2">
                                <Droplets className="text-blue-600 w-5 h-5 mb-1" />
                                <span className="text-[9px] font-black uppercase text-blue-600 tracking-tighter">Blood Pressure</span>
                                <span className="text-lg font-black text-blue-700">{selectedPatient.vitals.bloodPressure}</span>
                                <span className="text-[8px] font-bold text-blue-500 uppercase">SYS/DIA</span>
                              </div>
                              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex flex-col items-center gap-2">
                                <Thermometer className="text-amber-600 w-5 h-5 mb-1" />
                                <span className="text-[9px] font-black uppercase text-amber-600 tracking-tighter">Temp</span>
                                <span className="text-lg font-black text-amber-700">{selectedPatient.vitals.temperature}°C</span>
                                <span className="text-[8px] font-bold text-amber-500 uppercase">Celsius</span>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="pt-8">
                          <button className="w-full bg-slate-900 text-white py-4 px-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-black shadow-xl shadow-slate-900/10 transition-all flex items-center justify-center gap-3 active:scale-[0.98]">
                            <Activity size={16} />
                            Generate Clinical Prescription
                          </button>
                        </div>
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
