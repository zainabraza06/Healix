'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import ProtectedLayout from '@/components/ProtectedLayout';
import { Loader, ArrowLeft, Calendar, Clock, Download, FileText, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';

// 3D Background - matches admin/patient dashboards
const Scene = dynamic(() => import('@/components/canvas/Scene'), { ssr: false });
const FloatingIcons = dynamic(() => import('@/components/canvas/FloatingIcons'), { ssr: false });

interface Appointment {
    _id: string;
    patient_id: {
        _id: string;
        user_id: {
            full_name?: string;
            name?: string;
            email: string;
        };
    };
    doctor_id: {
        _id: string;
        user_id: {
            full_name?: string;
            name?: string;
            email: string;
        };
    };
    appointment_date: string;
    appointment_time?: string;
    slot_start_time?: string;
    slot_end_time?: string;
    appointment_type: 'ONLINE' | 'OFFLINE';
    status: 'REQUESTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
    payment_status?: 'PENDING' | 'PAID' | 'REFUNDED' | 'PARTIAL_REFUND';
    prescription?: string;
    instructions?: string;
    reason?: string;
    notes?: string;
    location?: string;
    meeting_link?: string;
    challan_number?: string;
    payment_amount?: number;
    paid_at?: string;
    completed_at?: string;
    cancellation_reason?: string;
    cancelled_by?: string;
    cancelled_at?: string;
    created_at?: string;
}

type TabType = 'CONFIRMED' | 'REQUESTED' | 'CANCELLED' | 'COMPLETED';

export default function AdminAppointmentsPage() {
    const router = useRouter();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [pageSize] = useState(10);
    const [activeTab, setActiveTab] = useState<TabType>('CONFIRMED');
    const [paymentFilter, setPaymentFilter] = useState<string>('');
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [exportLoading, setExportLoading] = useState(false);

    const fetchAppointments = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: String(currentPage),
                size: String(pageSize),
                status: activeTab,
            });
            if (activeTab === 'CONFIRMED' && paymentFilter) {
                params.append('payment_status', paymentFilter);
            }

            const response = await apiClient.get(`/admin/appointments?${params.toString()}`);
            if (response.success && response.data) {
                setAppointments(response.data.content || []);
                setTotalPages(response.data.totalPages || 1);
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
    }, [currentPage, activeTab, paymentFilter]);

    const handleExport = async (format: 'csv' | 'json' | 'pdf') => {
        try {
            setExportLoading(true);
            const params = new URLSearchParams({ format, status: activeTab });
            if (activeTab === 'CONFIRMED' && paymentFilter) {
                params.append('payment_status', paymentFilter);
            }

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/admin/appointments/download?${params.toString()}`,
                {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('token')}`,
                    },
                }
            );

            if (!response.ok) throw new Error('Export failed');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `appointments_${activeTab.toLowerCase()}.${format}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            toast.success(`Exported as ${format.toUpperCase()}`);
        } catch (err: any) {
            console.error('Export error:', err);
            toast.error('Failed to export data');
        } finally {
            setExportLoading(false);
        }
    };

    const handleViewDetails = (apt: Appointment) => {
        setSelectedAppointment(apt);
        setShowDetailsModal(true);
    };

    const getPaymentColor = (payment: string) => {
        switch (payment) {
            case 'PAID': return 'bg-emerald-100 text-emerald-700';
            case 'PENDING': return 'bg-amber-100 text-amber-700';
            case 'REFUNDED': return 'bg-slate-100 text-slate-700';
            case 'PARTIAL_REFUND': return 'bg-slate-100 text-slate-700';
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
            <div className="min-h-screen relative overflow-hidden bg-slate-50">
                {/* 3D Background - matches admin dashboard */}
                <div className="fixed inset-0 z-0 pointer-events-none opacity-50">
                    <Scene className="h-full w-full">
                        <FloatingIcons />
                    </Scene>
                </div>
                <div className="fixed inset-0 z-0 bg-gradient-to-b from-white/20 via-transparent to-white/80 pointer-events-none" />

                <div className="relative z-10 container-main py-8">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <div>
                            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600">
                                Appointments Management
                            </h1>
                            <p className="text-slate-500 font-medium mt-1">
                                Review and manage all appointments across the platform
                            </p>
                        </div>
                        <button
                            onClick={() => router.back()}
                            className="px-4 py-2 bg-white/50 backdrop-blur-sm border border-slate-200 rounded-xl text-slate-700 font-semibold hover:bg-white transition flex items-center gap-2 w-fit shadow-sm"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="mb-6 flex flex-wrap gap-2">
                        {(['CONFIRMED', 'REQUESTED', 'COMPLETED', 'CANCELLED'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => {
                                    setActiveTab(tab);
                                    setCurrentPage(0);
                                    setPaymentFilter('');
                                }}
                                className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                                    activeTab === tab
                                        ? 'bg-white/80 backdrop-blur-sm border border-slate-200 text-slate-800 shadow-md'
                                        : 'bg-white/40 backdrop-blur-sm border border-slate-100 text-slate-600 hover:bg-white/60 hover:border-slate-200'
                                }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Filters & Download - always visible */}
                    <div className="mb-6 flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                        <div className="flex items-center gap-4">
                            {activeTab === 'CONFIRMED' && (
                                <>
                                    <label className="text-sm font-semibold text-slate-600">
                                        Payment Filter:
                                    </label>
                                    <select
                                        value={paymentFilter}
                                        onChange={(e) => {
                                            setPaymentFilter(e.target.value);
                                            setCurrentPage(0);
                                        }}
                                        className="px-4 py-2.5 bg-white/60 backdrop-blur-sm border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400/30 focus:border-slate-400 transition-all"
                                    >
                                        <option value="">All Payments</option>
                                        <option value="PENDING">Pending</option>
                                        <option value="PAID">Paid</option>
                                    </select>
                                </>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleExport('csv')}
                                disabled={exportLoading || appointments.length === 0}
                                className="flex items-center gap-2 px-4 py-2.5 bg-white/60 backdrop-blur-sm border border-slate-200 rounded-xl text-slate-700 font-semibold text-sm hover:bg-white transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                            >
                                <Download className="w-4 h-4" />
                                CSV
                            </button>
                            <button
                                onClick={() => handleExport('json')}
                                disabled={exportLoading || appointments.length === 0}
                                className="flex items-center gap-2 px-4 py-2.5 bg-white/60 backdrop-blur-sm border border-slate-200 rounded-xl text-slate-700 font-semibold text-sm hover:bg-white transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                            >
                                <FileText className="w-4 h-4" />
                                JSON
                            </button>
                            <button
                                onClick={() => handleExport('pdf')}
                                disabled={exportLoading || appointments.length === 0}
                                className="flex items-center gap-2 px-4 py-2.5 bg-white/60 backdrop-blur-sm border border-slate-200 rounded-xl text-slate-700 font-semibold text-sm hover:bg-white transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                            >
                                <Download className="w-4 h-4" />
                                PDF
                            </button>
                        </div>
                    </div>

                    {/* List */}
                    <div className="glass-card p-6 mb-8">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <Loader className="w-8 h-8 animate-spin text-emerald-600" />
                                <p className="text-slate-500 font-medium mt-4">Loading appointments...</p>
                            </div>
                        ) : appointments.length > 0 ? (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-200">
                                                <th className="text-left py-3 px-4 font-semibold text-slate-700">Patient</th>
                                                <th className="text-left py-3 px-4 font-semibold text-slate-700">Doctor</th>
                                                <th className="text-left py-3 px-4 font-semibold text-slate-700">Date & Time</th>
                                                <th className="text-left py-3 px-4 font-semibold text-slate-700">Type</th>
                                                {(activeTab === 'CONFIRMED' || activeTab === 'COMPLETED') && (
                                                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Payment</th>
                                                )}
                                                {activeTab === 'CANCELLED' && (
                                                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Cancel Reason</th>
                                                )}
                                                <th className="text-center py-3 px-4 font-semibold text-slate-700">Details</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {appointments.map((apt) => (
                                                <tr key={apt._id} onClick={() => handleViewDetails(apt)} className="border-b border-slate-100 hover:bg-white/40 transition cursor-pointer">
                                                    <td className="py-3 px-4">
                                                        <p className="font-medium text-slate-800">{apt.patient_id?.user_id?.full_name || apt.patient_id?.user_id?.name || 'Deleted Patient'}</p>
                                                        <p className="text-xs text-slate-500">{apt.patient_id?.user_id?.email || 'N/A'}</p>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <p className="font-medium text-slate-800">Dr. {apt.doctor_id?.user_id?.full_name || apt.doctor_id?.user_id?.name || 'Deleted Doctor'}</p>
                                                    </td>
                                                    <td className="py-3 px-4 text-slate-600">
                                                        <p>{formatDate(apt.appointment_date)}</p>
                                                        <p className="text-xs text-slate-500">{apt.slot_start_time || apt.appointment_time}</p>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${apt.appointment_type === 'ONLINE' ? 'bg-blue-100 text-blue-700' : 'bg-teal-100 text-teal-700'}`}>
                                                            {apt.appointment_type === 'ONLINE' ? 'Online' : 'In-Person'}
                                                        </span>
                                                    </td>
                                                    {(activeTab === 'CONFIRMED' || activeTab === 'COMPLETED') && (
                                                        <td className="py-3 px-4">
                                                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPaymentColor(apt.payment_status || 'PENDING')}`}>
                                                                {apt.payment_status || 'PENDING'}
                                                            </span>
                                                        </td>
                                                    )}
                                                    {activeTab === 'CANCELLED' && (
                                                        <td className="py-3 px-4">
                                                            <p className="text-slate-600 line-clamp-2 max-w-[200px]">
                                                                {apt.cancellation_reason || '—'}
                                                            </p>
                                                            {apt.cancelled_by && (
                                                                <p className="text-xs text-slate-500 mt-1">
                                                                    by {apt.cancelled_by}
                                                                </p>
                                                            )}
                                                        </td>
                                                    )}
                                                    <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                        <button
                                                            onClick={() => handleViewDetails(apt)}
                                                            className="p-2 bg-white/60 border border-slate-200 text-slate-600 hover:bg-white rounded-lg transition"
                                                            title="View Details"
                                                        >
                                                            <FileText size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination */}
                                {totalPages > 1 && (
                                    <div className="pt-4 flex items-center justify-center gap-4">
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                                            disabled={currentPage === 0}
                                            className="px-4 py-2 bg-white/60 border border-slate-200 rounded-xl text-slate-700 font-medium hover:bg-white transition disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            <ArrowLeft size={18} className="inline" />
                                        </button>
                                        <span className="text-sm font-medium text-slate-600">
                                            Page <span className="font-semibold text-emerald-600">{currentPage + 1}</span> of {totalPages}
                                        </span>
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                                            disabled={currentPage === totalPages - 1}
                                            className="px-4 py-2 bg-white/60 border border-slate-200 rounded-xl text-slate-700 font-medium hover:bg-white transition disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            <ArrowLeft size={18} className="inline rotate-180" />
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-center py-16">
                                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-200">
                                    <Calendar size={28} className="text-slate-400" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-800">No appointments found</h3>
                                <p className="text-slate-500 mt-1 text-sm font-medium">
                                    {activeTab === 'CONFIRMED' && paymentFilter 
                                        ? `No ${paymentFilter.toLowerCase()} appointments in this category.`
                                        : 'Refine your search or clear filters to see more results.'}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Details Modal - status-aware, matches admin dashboard modal style */}
                    {showDetailsModal && selectedAppointment && (
                        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                                <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white">
                                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                        <FileText className="w-5 h-5 text-emerald-600" />
                                        Appointment Details
                                    </h2>
                                    <button
                                        onClick={() => setShowDetailsModal(false)}
                                        className="text-slate-400 hover:text-slate-600 transition p-1"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-sm text-slate-600 mb-1">Patient</p>
                                            <p className="font-semibold text-slate-800">
                                                {selectedAppointment.patient_id?.user_id?.full_name ||
                                                    selectedAppointment.patient_id?.user_id?.name ||
                                                    'N/A'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-slate-600 mb-1">Doctor</p>
                                            <p className="font-semibold text-slate-800">
                                                {selectedAppointment.doctor_id?.user_id?.full_name ||
                                                    selectedAppointment.doctor_id?.user_id?.name ||
                                                    'N/A'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-slate-600 mb-1">Date</p>
                                            <p className="font-semibold text-slate-800">
                                                {formatDate(selectedAppointment.appointment_date)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-slate-600 mb-1">Time</p>
                                            <p className="font-semibold text-slate-800">
                                                {selectedAppointment.slot_start_time || selectedAppointment.appointment_time || '—'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-slate-600 mb-1">Status</p>
                                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                                                selectedAppointment.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                                                selectedAppointment.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                                                selectedAppointment.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-700' :
                                                'bg-slate-100 text-slate-700'
                                            }`}>
                                                {selectedAppointment.status}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-sm text-slate-600 mb-1">Type</p>
                                            <p className="font-semibold text-slate-800">
                                                {selectedAppointment.appointment_type === 'ONLINE' ? 'Online' : 'In-Person'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* CANCELLED: show cancellation details */}
                                    {selectedAppointment.status === 'CANCELLED' && (
                                        <div className="border-t border-slate-200 pt-4">
                                            <h3 className="font-bold text-lg text-slate-800 mb-3">Cancellation Details</h3>
                                            <div className="bg-red-50 p-4 rounded-xl border border-red-100 space-y-2">
                                                <p><span className="text-slate-600 font-medium">Reason:</span> {selectedAppointment.cancellation_reason || '—'}</p>
                                                <p><span className="text-slate-600 font-medium">Cancelled by:</span> {selectedAppointment.cancelled_by || '—'}</p>
                                                <p><span className="text-slate-600 font-medium">Cancelled at:</span> {selectedAppointment.cancelled_at ? formatDate(selectedAppointment.cancelled_at) : '—'}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* CONFIRMED: show payment details */}
                                    {selectedAppointment.status === 'CONFIRMED' && (
                                        <div className="border-t border-slate-200 pt-4">
                                            <h3 className="font-bold text-lg text-slate-800 mb-3">Payment</h3>
                                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 space-y-2">
                                                <p><span className="text-slate-600 font-medium">Status:</span> <span className={getPaymentColor(selectedAppointment.payment_status || 'PENDING')}>{selectedAppointment.payment_status || 'PENDING'}</span></p>
                                                <p><span className="text-slate-600 font-medium">Amount:</span> Rs. {selectedAppointment.payment_amount ?? '—'}</p>
                                                <p><span className="text-slate-600 font-medium">Challan:</span> {selectedAppointment.challan_number || '—'}</p>
                                                {selectedAppointment.paid_at && <p><span className="text-slate-600 font-medium">Paid at:</span> {formatDate(selectedAppointment.paid_at)}</p>}
                                            </div>
                                        </div>
                                    )}

                                    {/* REQUESTED: show reason and notes */}
                                    {selectedAppointment.status === 'REQUESTED' && (
                                        <div className="border-t border-slate-200 pt-4">
                                            <h3 className="font-bold text-lg text-slate-800 mb-3">Request Details</h3>
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                                                <p><span className="text-slate-600 font-medium">Reason:</span> {selectedAppointment.reason || '—'}</p>
                                                {selectedAppointment.notes && <p><span className="text-slate-600 font-medium">Notes:</span> {selectedAppointment.notes}</p>}
                                            </div>
                                        </div>
                                    )}

                                    {/* COMPLETED: prescription and instructions */}
                                    {selectedAppointment.status === 'COMPLETED' && (
                                        <>
                                            <div className="border-t border-slate-200 pt-4">
                                                <h3 className="font-bold text-lg text-slate-800 mb-3">Prescription</h3>
                                                <div className="bg-blue-50 p-4 rounded-lg">
                                                    <p className="text-slate-700 whitespace-pre-wrap">
                                                        {selectedAppointment.prescription || 'No prescription provided'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="border-t border-slate-200 pt-4">
                                                <h3 className="font-bold text-lg text-slate-800 mb-3">Instructions</h3>
                                                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                                                    <p className="text-slate-700 whitespace-pre-wrap">
                                                        {selectedAppointment.instructions || 'No instructions provided'}
                                                    </p>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* Reason - show for non-cancelled when available */}
                                    {selectedAppointment.reason && selectedAppointment.status !== 'REQUESTED' && selectedAppointment.status !== 'CANCELLED' && (
                                        <div className="border-t border-slate-200 pt-4">
                                            <h3 className="font-bold text-lg text-slate-800 mb-3">Visit Reason</h3>
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                                <p className="text-slate-700">{selectedAppointment.reason}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </ProtectedLayout>
    );
}
