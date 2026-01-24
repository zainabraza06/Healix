'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import ProtectedLayout from '@/components/ProtectedLayout';
import { Loader, ArrowLeft, User, UserCheck, Calendar, ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface Alert {
    _id: string;
    patient_id?: {
        _id: string;
        user_id: {
            name: string;
            email: string;
        };
    };
    doctor_id?: {
        _id: string;
        user_id: {
            name: string;
            email: string;
        };
    };
    alert_type: 'CRITICAL' | 'WARNING' | 'INFO';
    title: string;
    message: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    status: 'ACTIVE' | 'RESOLVED' | 'ACKNOWLEDGED';
    created_at: string;
}

export default function AdminAlertsPage() {
    const router = useRouter();
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [totalElements, setTotalElements] = useState(0);
    const [pageSize] = useState(10);

    const fetchAlerts = async () => {
        try {
            setLoading(true);
            const response = await apiClient.get(`/admin/alerts?page=${currentPage}&size=${pageSize}`);
            if (response.success && response.data) {
                setAlerts(response.data.content || []);
                setTotalPages(response.data.totalPages || 1);
                setTotalElements(response.data.totalElements || 0);
            }
        } catch (err: any) {
            console.error('Error fetching alerts:', err);
            toast.error('Failed to load alerts');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAlerts();
    }, [currentPage]);

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'CRITICAL': return 'bg-red-200 text-red-900 border-red-300';
            case 'HIGH': return 'bg-orange-200 text-orange-900 border-orange-300';
            case 'MEDIUM': return 'bg-yellow-100 text-yellow-900 border-yellow-200';
            case 'LOW': return 'bg-blue-100 text-blue-900 border-blue-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'ACTIVE': return 'bg-red-600 text-white';
            case 'RESOLVED': return 'bg-emerald-600 text-white';
            case 'ACKNOWLEDGED': return 'bg-amber-500 text-white';
            default: return 'bg-slate-500 text-white';
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
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
                                <h1 className="text-4xl font-bold text-slate-800">System Alerts</h1>
                                <p className="text-slate-600 mt-2">{totalElements} active and historical alerts</p>
                            </div>
                        </div>
                    </div>

                    {/* List */}
                    <div className="glass-card overflow-hidden">
                        {loading ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader className="w-10 h-10 animate-spin text-red-600" />
                            </div>
                        ) : alerts.length > 0 ? (
                            <>
                                <div className="grid divide-y divide-slate-200">
                                    {alerts.map((alert) => (
                                        <div key={alert._id} className="p-6 hover:bg-white/30 transition flex flex-col md:flex-row gap-6">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${getStatusBadge(alert.status)}`}>
                                                        {alert.status}
                                                    </span>
                                                    <span className={`px-2 py-0.5 border rounded text-[10px] font-black uppercase tracking-wider ${getSeverityColor(alert.severity)}`}>
                                                        {alert.severity} SEVERITY
                                                    </span>
                                                </div>
                                                <h3 className="text-lg font-bold text-slate-800 mb-1">{alert.title}</h3>
                                                <p className="text-slate-600 text-sm mb-4">{alert.message}</p>

                                                <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                                                    <div className="flex items-center gap-1">
                                                        <Calendar className="w-3.5 h-3.5" />
                                                        <span>{formatDate(alert.created_at)}</span>
                                                    </div>
                                                    {alert.patient_id && (
                                                        <div className="flex items-center gap-1">
                                                            <User className="w-3.5 h-3.5 text-emerald-600" />
                                                            <span className="font-medium text-slate-700">Patient: {alert.patient_id.user_id.name}</span>
                                                        </div>
                                                    )}
                                                    {alert.doctor_id && (
                                                        <div className="flex items-center gap-1">
                                                            <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                                                            <span className="font-medium text-slate-700">Doctor: {alert.doctor_id.user_id.name}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex md:flex-col gap-2 justify-center">
                                                <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
                                                    View Details
                                                </button>
                                                {alert.status === 'ACTIVE' && (
                                                    <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition">
                                                        Resolve
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
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
                                <ShieldAlert className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-slate-800 mb-2">No alerts found</h3>
                                <p className="text-slate-500">System is currently running smoothly with no active alerts.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </ProtectedLayout>
    );
}
