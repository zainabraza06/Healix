'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import ProtectedLayout from '@/components/ProtectedLayout';
import { Loader, ArrowLeft, User, Stethoscope, Calendar, ShieldAlert, X, CheckCircle, Activity, Download, FileText, Database, Code } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface Alert {
    _id: string;
    title: string;
    message: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    status: 'ACTIVE' | 'RESOLVED' | 'ACKNOWLEDGED';
    created_at: string;
    resolved_at?: string;
    patient_id?: string;
    patient_name?: string;
    doctor_id?: string;
    doctor_name?: string;
}

export default function AdminAlertsPage() {
    const router = useRouter();
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [totalElements, setTotalElements] = useState(0);
    const [pageSize] = useState(10);
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'RESOLVED'>('ALL');
    const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

    const fetchAlerts = async () => {
        try {
            setLoading(true);
            const statusQuery = statusFilter === 'ALL' ? '' : `&status=${statusFilter}`;
            const response = await apiClient.get(`/admin/alerts?page=${currentPage}&size=${pageSize}${statusQuery}`);
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

    const handleExport = async (format: 'pdf' | 'csv' | 'json') => {
        try {
            const blob = await apiClient.downloadAlerts(format);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `system_alerts_${new Date().toISOString().split('T')[0]}.${format}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            toast.success(`Alerts data exported as ${format.toUpperCase()}`);
        } catch (err) {
            console.error(err);
            toast.error('Export failed');
        }
    };

    useEffect(() => {
        fetchAlerts();
    }, [currentPage, statusFilter]);

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
                        
                        {/* Export Button */}
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
                    </div>

                    {/* Status Filters */}
                    <div className="mb-6 flex flex-wrap gap-3">
                        {['ALL', 'ACTIVE', 'RESOLVED'].map((status) => {
                            const isActive = statusFilter === status;
                            const label = status === 'ALL' ? 'All' : status === 'ACTIVE' ? 'Unresolved' : 'Resolved';
                            return (
                                <button
                                    key={status}
                                    onClick={() => { setCurrentPage(0); setStatusFilter(status as any); }}
                                    className={`px-4 py-2 rounded-full text-sm font-semibold border transition ${isActive ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'}`}
                                >
                                    {label}
                                </button>
                            );
                        })}
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
                                        <div
                                            key={alert._id}
                                            onClick={() => setSelectedAlert(alert)}
                                            className="p-6 hover:bg-white/50 transition cursor-pointer flex flex-col gap-3"
                                        >
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${getStatusBadge(alert.status)}`}>
                                                    {alert.status}
                                                </span>
                                                <span className={`px-2 py-0.5 border rounded text-[10px] font-black uppercase tracking-wider ${getSeverityColor(alert.severity)}`}>
                                                    {alert.severity} SEVERITY
                                                </span>
                                            </div>
                                            <h3 className="text-lg font-bold text-slate-800">{alert.title}</h3>

                                            {/* Patient & Doctor Info */}
                                            <div className="flex flex-wrap gap-4 text-xs">
                                                <div className="flex items-center gap-1.5">
                                                    <User className="w-4 h-4 text-emerald-600" />
                                                    <span className="font-semibold text-slate-700">Patient: {alert.patient_name || 'N/A'}</span>
                                                </div>
                                                {alert.doctor_name && (
                                                    <div className="flex items-center gap-1.5">
                                                        <Stethoscope className="w-4 h-4 text-blue-600" />
                                                        <span className="font-semibold text-slate-700">Dr. {alert.doctor_name}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Date */}
                                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                <Calendar className="w-4 h-4" />
                                                <span>{formatDate(alert.created_at)}</span>
                                            </div>

                                            <p className="text-xs text-slate-400 italic">Click to view full details</p>
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

                {/* Alert Details Modal */}
                {selectedAlert && (
                    <div 
                        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
                        onClick={() => setSelectedAlert(null)}
                    >
                        <div 
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6 border-b border-slate-100 flex justify-between items-start sticky top-0 bg-white">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-2xl font-bold text-slate-800">{selectedAlert.title}</h3>
                                        <span
                                            className={`px-3 py-1 rounded-full text-sm font-semibold whitespace-nowrap ${selectedAlert.severity === 'CRITICAL'
                                                ? 'bg-red-200 text-red-800'
                                                : selectedAlert.severity === 'HIGH'
                                                    ? 'bg-orange-200 text-orange-800'
                                                    : selectedAlert.severity === 'MEDIUM'
                                                        ? 'bg-yellow-200 text-yellow-800'
                                                        : 'bg-blue-200 text-blue-800'
                                                }`}
                                        >
                                            {selectedAlert.severity}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-500 mt-2">{formatDate(selectedAlert.created_at)}</p>
                                </div>
                                <button
                                    onClick={() => setSelectedAlert(null)}
                                    className="text-slate-400 hover:text-slate-600 transition ml-4"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="p-6 space-y-6">
                                {(() => {
                                    const lines = (selectedAlert.message || '').split('\n').filter((l: string) => l.trim());
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
                                    const recommendations = recsText.split('|').map((r: string) => r.trim()).filter((r: string) => r.length > 0);
                                    
                                    // Extract IDs safely (handle both string and nested object formats)
                                    const getPatientId = () => {
                                        if (typeof selectedAlert.patient_id === 'string') return selectedAlert.patient_id;
                                        if (selectedAlert.patient_id && typeof selectedAlert.patient_id === 'object' && '_id' in selectedAlert.patient_id) {
                                            return (selectedAlert.patient_id as any)._id;
                                        }
                                        return null;
                                    };
                                    
                                    const getDoctorId = () => {
                                        if (typeof selectedAlert.doctor_id === 'string') return selectedAlert.doctor_id;
                                        if (selectedAlert.doctor_id && typeof selectedAlert.doctor_id === 'object' && '_id' in selectedAlert.doctor_id) {
                                            return (selectedAlert.doctor_id as any)._id;
                                        }
                                        return null;
                                    };
                                    
                                    const patientId = getPatientId();
                                    const doctorId = getDoctorId();

                                    return (
                                        <>
                                            {/* Patient Info */}
                                            {selectedAlert.patient_name && (
                                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <User className="w-4 h-4 text-slate-500" />
                                                        <p className="text-sm font-semibold text-slate-700">Patient</p>
                                                    </div>
                                                    <p className="text-sm text-slate-800 font-bold">{selectedAlert.patient_name}</p>
                                                    {patientId && (
                                                        <p className="text-[11px] text-slate-500 font-semibold mt-1">ID: {patientId}</p>
                                                    )}
                                                </div>
                                            )}

                                            {/* Doctor Consultation Status */}
                                            {selectedAlert.doctor_name && (
                                                <div className="p-4 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl text-white shadow-lg">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <Stethoscope className="w-5 h-5" />
                                                        <p className="text-sm font-bold">Consultation Active</p>
                                                    </div>
                                                    <p className="text-xs font-semibold opacity-90">
                                                        Being reviewed by Dr. {selectedAlert.doctor_name}
                                                    </p>
                                                    {doctorId && (
                                                        <p className="text-[10px] text-white/80 font-semibold mt-1">ID: {doctorId}</p>
                                                    )}
                                                    <div className="mt-3 pt-3 border-t border-white/20 text-[10px] font-bold uppercase tracking-widest opacity-80">
                                                        {selectedAlert.resolved_at 
                                                            ? `Resolved: ${new Date(selectedAlert.resolved_at).toLocaleDateString()}`
                                                            : 'Status: In Assessment'}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Critical Issues */}
                                            {issues.length > 0 && (
                                                <div>
                                                    <h4 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                                                        <ShieldAlert className="w-5 h-5 text-red-600" />
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

                                            {/* Recommendations */}
                                            {recommendations.length > 0 && (
                                                <div>
                                                    <h4 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                                                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                                                        Recommendations
                                                    </h4>
                                                    <div className="space-y-2 bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                                                        {recommendations.map((rec: string, idx: number) => (
                                                            <p key={idx} className="text-sm text-emerald-900 leading-relaxed">
                                                                ✓ {rec}
                                                            </p>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Vitals Snapshot */}
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
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </ProtectedLayout>
    );
}
