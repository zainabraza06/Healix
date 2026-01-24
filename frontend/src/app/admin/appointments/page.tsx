'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import ProtectedLayout from '@/components/ProtectedLayout';
import { Loader, ArrowLeft, Calendar, User, UserCheck, Clock, MapPin, Video } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface Appointment {
    _id: string;
    patient_id: {
        _id: string;
        user_id: {
            name: string;
            email: string;
        };
    };
    doctor_id: {
        _id: string;
        user_id: {
            name: string;
            email: string;
        };
    };
    appointment_date: string;
    appointment_time: string;
    appointment_type: 'ONLINE' | 'OFFLINE';
    status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
    reason?: string;
    location?: string;
    meeting_link?: string;
}

export default function AdminAppointmentsPage() {
    const router = useRouter();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [totalElements, setTotalElements] = useState(0);
    const [pageSize] = useState(10);

    const fetchAppointments = async () => {
        try {
            setLoading(true);
            const response = await apiClient.get(`/admin/appointments?page=${currentPage}&size=${pageSize}`);
            if (response.success && response.data) {
                setAppointments(response.data.content || []);
                setTotalPages(response.data.totalPages || 1);
                setTotalElements(response.data.totalElements || 0);
            }
        } catch (err: any) {
            console.error('Error fetching appointments:', err);
            toast.error('Failed to load appointments');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAppointments();
    }, [currentPage]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'COMPLETED': return 'bg-emerald-100 text-emerald-700';
            case 'CANCELLED': return 'bg-red-100 text-red-700';
            case 'SCHEDULED': return 'bg-blue-100 text-blue-700';
            case 'NO_SHOW': return 'bg-amber-100 text-amber-700';
            default: return 'bg-slate-100 text-slate-700';
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    return (
        <ProtectedLayout allowedRoles={['ADMIN']}>
            <div className="min-h-screen bg-slate-50 py-8">
                <div className="container-main">
                    {/* Header */}
                    <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.back()}
                                className="p-2 hover:bg-white rounded-lg transition"
                            >
                                <ArrowLeft className="w-6 h-6 text-slate-600" />
                            </button>
                            <div>
                                <h1 className="text-4xl font-bold text-slate-800">All Appointments</h1>
                                <p className="text-slate-600 mt-2">{totalElements} total appointments recorded</p>
                            </div>
                        </div>
                    </div>

                    {/* List */}
                    <div className="glass-card overflow-hidden">
                        {loading ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader className="w-10 h-10 animate-spin text-emerald-600" />
                            </div>
                        ) : appointments.length > 0 ? (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-white/50 border-b border-slate-200">
                                            <tr>
                                                <th className="px-6 py-4 font-semibold text-slate-700">Patient</th>
                                                <th className="px-6 py-4 font-semibold text-slate-700">Doctor</th>
                                                <th className="px-6 py-4 font-semibold text-slate-700">Date & Time</th>
                                                <th className="px-6 py-4 font-semibold text-slate-700">Type</th>
                                                <th className="px-6 py-4 font-semibold text-slate-700">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {appointments.map((apt) => (
                                                <tr key={apt._id} className="hover:bg-white/30 transition">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                                                                <User className="w-4 h-4 text-emerald-600" />
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-slate-800">{apt.patient_id?.user_id?.name || 'Deleted Patient'}</p>
                                                                <p className="text-xs text-slate-500">{apt.patient_id?.user_id?.email || 'N/A'}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                                                                <UserCheck className="w-4 h-4 text-blue-600" />
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-slate-800">{apt.doctor_id?.user_id?.name || 'Deleted Doctor'}</p>
                                                                <p className="text-xs text-slate-500">{apt.doctor_id?.user_id?.email || 'N/A'}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2 text-slate-700">
                                                            <Calendar className="w-4 h-4 text-slate-400" />
                                                            <span className="text-sm font-medium">{formatDate(apt.appointment_date)}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-slate-500 mt-1">
                                                            <Clock className="w-4 h-4" />
                                                            <span className="text-xs">{apt.appointment_time}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            {apt.appointment_type === 'ONLINE' ? (
                                                                <>
                                                                    <Video className="w-4 h-4 text-purple-500" />
                                                                    <span className="text-xs font-semibold text-purple-700 px-2 py-0.5 bg-purple-100 rounded">Online</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <MapPin className="w-4 h-4 text-teal-500" />
                                                                    <span className="text-xs font-semibold text-teal-700 px-2 py-0.5 bg-teal-100 rounded">In-Person</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getStatusColor(apt.status)}`}>
                                                            {apt.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination */}
                                {totalPages > 1 && (
                                    <div className="p-6 bg-white/50 border-t border-slate-200 flex items-center justify-between">
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                                            disabled={currentPage === 0}
                                            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
                                        >
                                            Previous
                                        </button>
                                        <span className="text-sm text-slate-600 font-medium">
                                            Page {currentPage + 1} of {totalPages}
                                        </span>
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                                            disabled={currentPage === totalPages - 1}
                                            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
                                        >
                                            Next
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="py-20 text-center">
                                <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-slate-800 mb-2">No appointments found</h3>
                                <p className="text-slate-500">There are no appointments recorded in the system yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </ProtectedLayout>
    );
}
