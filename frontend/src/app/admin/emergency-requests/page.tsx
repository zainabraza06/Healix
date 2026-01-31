'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import ProtectedLayout from '@/components/ProtectedLayout';
import toast from 'react-hot-toast';
import { Clock, CheckCircle, XCircle, AlertTriangle, User, Calendar, FileText } from 'lucide-react';
import Spinner from '@/components/Spinner';

export default function AdminEmergencyRequestsPage() {
    const [patientRequests, setPatientRequests] = useState<any[]>([]);
    const [doctorRequests, setDoctorRequests] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'patient' | 'doctor'>('doctor');
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        try {
            setIsLoading(true);
            const [patientRes, doctorRes] = await Promise.all([
                apiClient.getEmergencyCancellations(),
                apiClient.getDoctorEmergencyRequests('PENDING')
            ]);

            if (patientRes.success) setPatientRequests(patientRes.data || []);
            if (doctorRes.success) setDoctorRequests(doctorRes.data || []);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load requests');
        } finally {
            setIsLoading(false);
        }
    };

    const handleApproveDoctor = async (id: string) => {
        try {
            setIsProcessing(true);
            const res = await apiClient.approveDoctorEmergencyReschedule(id);
            if (res.success) {
                toast.success('Request Approved');
                fetchRequests();
            } else {
                toast.error(res.message || 'Failed');
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Error approving request');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReviewPatient = async (id: string, approved: boolean) => {
        try {
            setIsProcessing(true);
            const res = await apiClient.reviewEmergencyCancellation(id, approved, approved ? 'Approved by Admin' : 'Rejected by Admin');
            if (res.success) {
                toast.success(`Request ${approved ? 'Approved' : 'Rejected'}`);
                fetchRequests();
            } else {
                toast.error(res.message || 'Failed');
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Error processing request');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <ProtectedLayout allowedRoles={['ADMIN']}>
            <div className="container-main py-8">
                <h1 className="text-3xl font-black text-slate-800 mb-2">Emergency Requests</h1>
                <p className="text-slate-500 font-bold mb-8">Manage urgent cancellation and reschedule requests</p>

                {/* Tabs */}
                <div className="flex gap-4 mb-8">
                    <button
                        onClick={() => setActiveTab('doctor')}
                        className={`px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'doctor' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                    >
                        Doctor Reschedules ({doctorRequests.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('patient')}
                        className={`px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'patient' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                    >
                        Patient Cancellations ({patientRequests.length})
                    </button>
                </div>

                {isLoading ? (
                    <div className="p-12 flex justify-center"><Spinner /></div>
                ) : (
                    <div className="grid gap-4">
                        {activeTab === 'doctor' ? (
                            doctorRequests.length === 0 ? (
                                <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-400 font-bold">No pending doctor requests</div>
                            ) : (
                                doctorRequests.map(req => (
                                    <div key={req._id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between gap-6">
                                        <div>
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-xs font-black uppercase tracking-widest">Reschedule</span>
                                                <span className="text-slate-400 text-xs font-bold">{new Date(req.created_at).toLocaleString()}</span>
                                            </div>
                                            <h3 className="text-lg font-black text-slate-800">Dr. {req.doctor_id?.user_id?.full_name}</h3>
                                            <p className="text-sm text-slate-500 font-bold mb-4">Patient: {req.appointment_id?.patient_id?.user_id?.full_name}</p>

                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Reason</p>
                                                <p className="text-slate-700 font-medium">{req.reason}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <button
                                                onClick={() => handleApproveDoctor(req._id)}
                                                disabled={isProcessing}
                                                className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                                            >
                                                Approve
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )
                        ) : (
                            patientRequests.length === 0 ? (
                                <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-400 font-bold">No pending patient requests</div>
                            ) : (
                                patientRequests.map(req => (
                                    <div key={req.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between gap-6">
                                        <div>
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-black uppercase tracking-widest">Cancellation</span>
                                                <span className="text-slate-400 text-xs font-bold">{new Date(req.createdAt).toLocaleString()}</span>
                                            </div>
                                            <h3 className="text-lg font-black text-slate-800">{req.patientName}</h3>
                                            <p className="text-sm text-slate-500 font-bold mb-4">Dr. {req.doctorName} • {new Date(req.appointmentDate).toLocaleDateString()}</p>

                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Reason</p>
                                                <p className="text-slate-700 font-medium">{req.reason}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <button
                                                onClick={() => handleReviewPatient(req.id, true)}
                                                disabled={isProcessing}
                                                className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                                            >
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => handleReviewPatient(req.id, false)}
                                                disabled={isProcessing}
                                                className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20 disabled:opacity-50"
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )
                        )}
                    </div>
                )}
            </div>
        </ProtectedLayout>
    );
}
