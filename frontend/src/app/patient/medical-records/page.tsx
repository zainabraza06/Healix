'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/authStore';
import { apiClient } from '@/lib/apiClient';
import ProtectedLayout from '@/components/ProtectedLayout';
import {
    Loader, Activity, Calendar, AlertCircle,
    Plus, History, Shield, Info, Clipboard,
    User, Building2, Download,
    Heart, ChevronLeft, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { MedicalRecord } from '@/types';

const Scene = dynamic(() => import('@/components/canvas/Scene'), { ssr: false });
const FloatingIcons = dynamic(() => import('@/components/canvas/FloatingIcons').then(mod => mod.FloatingIcons), { ssr: false });

type TabType = 'overview' | 'immunizations' | 'allergies' | 'operations' | 'labResults' | 'history';

export default function MedicalRecordsPage() {
    const { user } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [records, setRecords] = useState<MedicalRecord | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState<TabType | ''>('');
    const [formData, setFormData] = useState<any>({});
    const [isDownloading, setIsDownloading] = useState(false);

    useEffect(() => {
        fetchRecords();
    }, []);

    useEffect(() => {
        const handleOpenModal = (e: Event) => {
            const event = e as CustomEvent;
            setModalType(event.detail.type);
            setIsModalOpen(true);
        };
        document.addEventListener('openModal', handleOpenModal);
        return () => document.removeEventListener('openModal', handleOpenModal);
    }, []);

    const fetchRecords = async () => {
        try {
            setLoading(true);
            const response = await apiClient.getMedicalRecords();
            if (response.success) {
                setRecords(response.data);
            }
        } catch (err) {
            toast.error('Failed to load medical records');
        } finally {
            setLoading(false);
        }
    };

    const handleAddEntry = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!modalType) return;

        try {
            const response = await apiClient.addMedicalRecordEntry(modalType, formData);
            if (response.success) {
                toast.success(`${modalType} added successfully`);
                setIsModalOpen(false);
                fetchRecords();
            }
        } catch (err) {
            toast.error('Failed to add record');
        }
    };

    const handleDownloadMedicalRecord = async () => {
        if (!records?.patient_id) {
            toast.error('Medical record not loaded yet');
            return;
        }
        try {
            setIsDownloading(true);
            const blob = await apiClient.downloadPatientMedicalRecord(records.patient_id);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `medical-record-${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            toast.success('Medical record downloaded successfully');
        } catch (err) {
            toast.error('Failed to download medical record');
        } finally {
            setIsDownloading(false);
        }
    };

    const tabs = [
        { id: 'overview', label: 'Overview', icon: Clipboard },
        { id: 'immunizations', label: 'Immunizations', icon: Shield },
        { id: 'allergies', label: 'Allergies', icon: AlertCircle },
        { id: 'operations', label: 'Operations', icon: Activity },
        { id: 'labResults', label: 'Lab Results', icon: Info },
        { id: 'history', label: 'System History', icon: History },
    ];

    if (loading && !records) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <Loader className="w-12 h-12 text-emerald-600 animate-spin mx-auto mb-4" />
                    <p className="text-slate-600 font-bold">Loading Medical Records Hub...</p>
                </div>
            </div>
        );
    }

    return (
        <ProtectedLayout allowedRoles={['PATIENT']}>
            <div className="min-h-screen relative overflow-hidden bg-slate-50">
                <div className="fixed inset-0 z-0 pointer-events-none">
                    <Scene className="h-full w-full">
                        <FloatingIcons />
                    </Scene>
                </div>

                <div className="relative z-10 container-main py-8 md:py-12">
                    {/* Header */}
                    <div className="mb-10 animate-fade-in flex items-start justify-between">
                        <div>
                            <h1 className="text-5xl font-black text-slate-800 mb-3 tracking-tight">
                                Medical <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500">Records</span>
                            </h1>
                            <p className="text-slate-500 text-lg font-medium">Manage your health profile and history</p>
                        </div>
                        <button
                            onClick={handleDownloadMedicalRecord}
                            disabled={isDownloading || !records?.patient_id}
                            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105"
                        >
                            <Download className="w-5 h-5" />
                            {isDownloading ? 'Downloading...' : 'Download PDF'}
                        </button>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex flex-wrap gap-2 mb-10 p-1.5 bg-slate-100/50 rounded-3xl border border-slate-200/60 backdrop-blur-md">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as TabType)}
                                className={`
                  flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-black transition-all duration-300
                  ${activeTab === tab.id
                                        ? 'bg-white text-emerald-700 shadow-xl shadow-emerald-500/10 scale-[1.02] ring-1 ring-emerald-500/10'
                                        : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                                    }
                `}
                            >
                                <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-emerald-500' : 'text-slate-400'}`} />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="grid lg:grid-cols-4 gap-8">
                        {/* Left Info Panel */}
                        <div className="lg:col-span-1 space-y-6">
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="glass-card p-6 border-emerald-500/20"
                            >
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center">
                                        <User className="w-6 h-6 text-emerald-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-800 leading-none mb-1">{user?.firstName} {user?.lastName}</h3>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Medical Profile</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Blood Type</p>
                                        <p className="text-lg font-black text-slate-800 flex items-center gap-2">
                                            <Heart className="w-4 h-4 text-rose-500" /> {(user as any)?.bloodType || 'Not Set'}
                                        </p>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Total Records</p>
                                        <p className="text-lg font-black text-slate-800">
                                            {((records?.immunizations?.length || 0) + (records?.allergies?.length || 0) + (records?.operations?.length || 0) + (records?.labResults?.length || 0))} Entry
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        </div>

                        {/* Main Records Area */}
                        <div className="lg:col-span-3">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeTab}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    {activeTab === 'overview' && records && <Overview records={records} />}
                                    {activeTab === 'immunizations' && <SimpleList title="Immunizations" data={records?.immunizations || []} />}
                                    {activeTab === 'allergies' && <AllergyList data={records?.allergies || []} />}
                                    {activeTab === 'operations' && <SurgeryList data={records?.operations || []} />}
                                    {activeTab === 'labResults' && <LabList data={records?.labResults || []} />}
                                    {activeTab === 'history' && records?.history && <HistoryView history={records.history} />}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                {/* Modal Placeholders and Components logic would continue here... */}
                {isModalOpen && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className={`bg-white rounded-3xl shadow-2xl relative ${
                                modalType === 'labResults' ? 'p-6 max-w-md' : 'p-8 max-w-lg'
                            } w-full`}
                        >
                            <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-2">
                                <Plus className="w-6 h-6 text-emerald-500" />
                                Add {modalType}
                            </h2>
                            <form onSubmit={handleAddEntry} className="space-y-4">
                                {/* Name / Test Field */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                        {modalType === 'labResults' ? 'Test Name' : 'Name'}
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-emerald-500"
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value, testName: e.target.value })}
                                        required
                                    />
                                </div>

                                {/* Date Field - Not for allergies */}
                                {modalType !== 'allergies' && (
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Date</label>
                                        <input
                                            type="date"
                                            className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-emerald-500"
                                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                            required
                                        />
                                    </div>
                                )}

                                {/* Severity - For allergies */}
                                {modalType === 'allergies' && (
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Severity</label>
                                        <select
                                            className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-emerald-500"
                                            onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                                            defaultValue="MEDIUM"
                                        >
                                            <option value="LOW">Low</option>
                                            <option value="MEDIUM">Medium</option>
                                            <option value="HIGH">High</option>
                                            <option value="CRITICAL">Critical</option>
                                        </select>
                                    </div>
                                )}

                                {/* Hospital - For operations */}
                                {modalType === 'operations' && (
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Hospital / Facility</label>
                                        <input
                                            type="text"
                                            className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-emerald-500"
                                            onChange={(e) => setFormData({ ...formData, hospital: e.target.value })}
                                        />
                                    </div>
                                )}

                                {/* Surgeon - For operations */}
                                {modalType === 'operations' && (
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Surgeon Name</label>
                                        <input
                                            type="text"
                                            className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-emerald-500"
                                            onChange={(e) => setFormData({ ...formData, surgeon: e.target.value })}
                                        />
                                    </div>
                                )}

                                {/* Result - For lab results */}
                                {modalType === 'labResults' && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">Result / Value</label>
                                            <input
                                                type="text"
                                                className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-emerald-500"
                                                onChange={(e) => setFormData({ ...formData, result: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">Unit (mg/dL, etc.)</label>
                                            <input
                                                type="text"
                                                className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-emerald-500"
                                                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                            />
                                        </div>
                                    </>
                                )}

                                {/* Notes - For all types */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Notes (Optional)</label>
                                    <textarea
                                        className={`w-full px-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 resize-none ${
                                            modalType === 'labResults' ? 'h-16' : 'h-24'
                                        }`}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        placeholder="Add any additional information..."
                                    />
                                </div>

                                <div className="flex gap-4 mt-8">
                                    <button type="submit" className="flex-1 btn-primary py-3 rounded-xl font-bold">Save Entry</button>
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 bg-slate-100 text-slate-500 py-3 rounded-xl font-bold">Cancel</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </div>
        </ProtectedLayout>
    );
}

// Sub-components
function Overview({ records }: { records: MedicalRecord }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <StatsCard title="Immunizations" count={records.immunizations.length} color="emerald" icon={Shield} />
            <StatsCard title="Active Allergies" count={records.allergies.length} color="rose" icon={AlertCircle} />
            <StatsCard title="Major Operations" count={records.operations.length} color="amber" icon={Activity} />
            <StatsCard title="Lab Results" count={records.labResults.length} color="blue" icon={Info} />
        </div>
    );
}

function StatsCard({ title, count, color, icon: Icon }: any) {
    return (
        <div className="glass-card p-8 border-white/40 group hover:scale-[1.02] transition-transform cursor-pointer">
            <div className={`w-14 h-14 rounded-2xl bg-${color}-100 flex items-center justify-center mb-6`}>
                <Icon className={`w-7 h-7 text-${color}-600`} />
            </div>
            <h3 className="text-4xl font-black text-slate-800 mb-1">{count}</h3>
            <p className="text-slate-500 font-bold">{title}</p>
        </div>
    );
}

function SimpleList({ title, data }: { title: string, data: any[] }) {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;
    const totalPages = Math.ceil(data.length / itemsPerPage);
    const startIdx = (currentPage - 1) * itemsPerPage;
    const paginatedData = data.slice(startIdx, startIdx + itemsPerPage);

    return (
        <div className="glass-card p-8 border-white/40 min-h-[400px]">
            <div className="flex items-center justify-between mb-8 border-b pb-4 border-slate-100">
                <h2 className="text-2xl font-black text-slate-800">{title}</h2>
                <button
                    onClick={() => document.dispatchEvent(new CustomEvent('openModal', { detail: { type: 'immunizations' } }))}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all"
                >
                    <Plus className="w-4 h-4" />
                    Add
                </button>
            </div>
            {data.length === 0 ? <NoData text={`No ${title.toLowerCase()} recorded yet.`} /> : (
                <>
                    <div className="space-y-2 mb-6">
                        <div className="hidden md:flex text-[12px] font-black text-slate-500 uppercase tracking-wider px-3 gap-4">
                            <span className="w-5/12">Vaccine Name</span>
                            <span className="w-3/12">Date</span>
                            <span className="w-4/12">Notes</span>
                        </div>
                        {paginatedData.map((item, idx) => (
                            <div
                                key={idx}
                                className="p-4 bg-white rounded-3xl border border-slate-200/70 hover:border-emerald-200 transition-colors break-words flex flex-col md:flex-row md:items-start md:gap-4"
                            >
                                <div className="md:w-5/12 font-black text-slate-800 leading-snug">{item.name || item.testName}</div>
                                <div className="md:w-3/12 text-sm text-slate-600 font-semibold">
                                    {item.date ? new Date(item.date).toLocaleDateString() : '-'}
                                </div>
                                <div className="md:w-4/12 text-sm text-slate-600 leading-relaxed">{item.notes || '-'}</div>
                            </div>
                        ))}
                    </div>
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-6 border-t border-slate-200/50">
                            <p className="text-xs font-bold text-slate-500">Page {currentPage} of {totalPages}</p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    Previous
                                </button>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    Next
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function AllergyList({ data }: { data: any[] }) {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;
    const totalPages = Math.ceil(data.length / itemsPerPage);
    const startIdx = (currentPage - 1) * itemsPerPage;
    const paginatedData = data.slice(startIdx, startIdx + itemsPerPage);

    return (
        <div className="glass-card p-8 border-white/40 min-h-[400px]">
            <div className="flex items-center justify-between mb-8 border-b pb-4 border-slate-100">
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                    <AlertCircle className="w-6 h-6 text-emerald-500" /> Active Allergies
                </h2>
                <button
                    onClick={() => document.dispatchEvent(new CustomEvent('openModal', { detail: { type: 'allergies' } }))}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all"
                >
                    <Plus className="w-4 h-4" />
                    Add
                </button>
            </div>
            {data.length === 0 ? <NoData text="No allergies recorded." /> : (
                <>
                    <div className="space-y-2 mb-6">
                        <div className="hidden md:flex text-[12px] font-black text-slate-500 uppercase tracking-wider px-3 gap-4">
                            <span className="w-5/12">Allergen</span>
                            <span className="w-3/12">Severity</span>
                            <span className="w-4/12">Reaction</span>
                        </div>
                        {paginatedData.map((item, idx) => (
                            <div
                                key={idx}
                                className="p-5 bg-white rounded-3xl border-2 border-slate-50 relative overflow-hidden group break-words flex flex-col md:flex-row md:items-start md:gap-4"
                            >
                                <div className={`absolute top-0 left-0 w-2 h-full ${item.severity === 'CRITICAL' ? 'bg-red-500' : 'bg-amber-400'}`} />
                                <div className="md:w-5/12 font-black text-slate-800 leading-snug">{item.name}</div>
                                <div className="md:w-3/12 text-sm font-black text-slate-600 uppercase tracking-wide">{item.severity}</div>
                                <div className="md:w-4/12 text-sm text-slate-600 leading-relaxed">{item.notes || 'No specific notes provided'}</div>
                            </div>
                        ))}
                    </div>
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-6 border-t border-slate-200/50">
                            <p className="text-xs font-bold text-slate-500">Page {currentPage} of {totalPages}</p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    Previous
                                </button>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    Next
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function SurgeryList({ data }: { data: any[] }) {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 4;
    const totalPages = Math.ceil(data.length / itemsPerPage);
    const startIdx = (currentPage - 1) * itemsPerPage;
    const paginatedData = data.slice(startIdx, startIdx + itemsPerPage);

    return (
        <div className="glass-card p-8 border-white/40 min-h-[400px]">
            <div className="flex items-center justify-between mb-8 border-b pb-4 border-slate-100">
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                    <Building2 className="w-6 h-6 text-emerald-500" /> Surgical History
                </h2>
                <button
                    onClick={() => document.dispatchEvent(new CustomEvent('openModal', { detail: { type: 'operations' } }))}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all"
                >
                    <Plus className="w-4 h-4" />
                    Add
                </button>
            </div>
            {data.length === 0 ? <NoData text="No operations recorded." /> : (
                <>
                    <div className="space-y-4 mb-6">
                        {paginatedData.map((item, idx) => (
                            <div key={idx} className="p-6 bg-slate-50/50 rounded-3xl border border-slate-200/50 flex items-start gap-5 break-words">
                                <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center shrink-0 border border-slate-100">
                                    <Activity className="w-6 h-6 text-emerald-500" />
                                </div>
                                <div>
                                    <h4 className="font-black text-slate-800 text-xl">{item.name}</h4>
                                    <p className="text-sm text-slate-400 font-bold mb-3">{new Date(item.date).toLocaleDateString()}</p>
                                    <p className="text-sm text-slate-600 bg-white/50 px-4 py-2 rounded-xl border border-slate-100 font-medium">Performed by {item.surgeon || 'Medical Team'} at {item.hospital || 'Specialty Center'}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-6 border-t border-slate-200/50">
                            <p className="text-xs font-bold text-slate-500">Page {currentPage} of {totalPages}</p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    Previous
                                </button>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    Next
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function LabList({ data }: { data: any[] }) {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;
    const totalPages = Math.ceil(data.length / itemsPerPage);
    const startIdx = (currentPage - 1) * itemsPerPage;
    const paginatedData = data.slice(startIdx, startIdx + itemsPerPage);

    return (
        <div className="glass-card p-8 border-white/40 min-h-[400px]">
            <div className="flex items-center justify-between mb-8 border-b pb-4 border-slate-100">
                <h2 className="text-2xl font-black text-slate-800">Lab & Diagnostics</h2>
                <button
                    onClick={() => document.dispatchEvent(new CustomEvent('openModal', { detail: { type: 'labResults' } }))}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all"
                >
                    <Plus className="w-4 h-4" />
                    Add
                </button>
            </div>
            {data.length === 0 ? <NoData text="No lab results found." /> : (
                <>
                    <div className="grid grid-cols-1 gap-4 mb-6">
                        {paginatedData.map((item, idx) => (
                            <div key={idx} className="p-6 bg-emerald-50/20 rounded-3xl border border-emerald-100/50 flex flex-col md:flex-row justify-between md:items-center gap-4 break-words">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center">
                                        <History className="w-6 h-6 text-emerald-500" />
                                    </div>
                                    <div>
                                        <p className="font-black text-slate-800">{item.testName}</p>
                                        <p className="text-xs text-slate-400 font-bold uppercase">{new Date(item.date).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <div className="text-emerald-700 font-black text-2xl bg-white px-6 py-2 rounded-2xl shadow-sm border border-emerald-50">
                                    {item.result} <span className="text-xs text-emerald-500 uppercase tracking-widest">{item.unit}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-6 border-t border-slate-200/50">
                            <p className="text-xs font-bold text-slate-500">Page {currentPage} of {totalPages}</p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    Previous
                                </button>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    Next
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function HistoryView({ history }: { history: any }) {
    const [apptPage, setApptPage] = useState(1);
    const [alertPage, setAlertPage] = useState(1);
    const itemsPerPage = 5;

    const apptTotalPages = Math.ceil(history.completedAppointments.length / itemsPerPage);
    const apptStartIdx = (apptPage - 1) * itemsPerPage;
    const paginatedAppointments = history.completedAppointments.slice(apptStartIdx, apptStartIdx + itemsPerPage);

    const alertTotalPages = Math.ceil(history.alerts.length / itemsPerPage);
    const alertStartIdx = (alertPage - 1) * itemsPerPage;
    const paginatedAlerts = history.alerts.slice(alertStartIdx, alertStartIdx + itemsPerPage);

    return (
        <div className="space-y-8">
            <div className="glass-card p-8 border-white/40">
                <h2 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-2">
                    <Calendar className="w-6 h-6 text-emerald-500" /> Completed Appointments
                </h2>
                {history.completedAppointments.length === 0 ? <NoData text="No completed appointments." /> : (
                    <>
                        <div className="space-y-4 mb-6">
                            {paginatedAppointments.map((apt: any) => (
                                <div key={apt.id} className="p-5 bg-white/50 rounded-3xl border border-slate-200/50 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                                            <User className="w-5 h-5 text-slate-400" />
                                        </div>
                                        <div>
                                            <p className="font-black text-slate-800">{apt.doctorName}</p>
                                            <p className="text-xs text-emerald-600 font-black uppercase tracking-widest">{apt.type}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-slate-500">{new Date(apt.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                        <p className="text-xs font-black text-slate-400">{new Date(apt.date).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {apptTotalPages > 1 && (
                            <div className="flex items-center justify-between pt-6 border-t border-slate-200/50">
                                <p className="text-xs font-bold text-slate-500">Page {apptPage} of {apptTotalPages}</p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setApptPage(p => Math.max(1, p - 1))}
                                        disabled={apptPage === 1}
                                        className="flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                        Previous
                                    </button>
                                    <button
                                        onClick={() => setApptPage(p => Math.min(apptTotalPages, p + 1))}
                                        disabled={apptPage === apptTotalPages}
                                        className="flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        Next
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="glass-card p-8 border-white/40 border-rose-100 mt-8">
                <h2 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-2">
                    <AlertCircle className="w-6 h-6 text-rose-500" /> Security & Health Alerts
                </h2>
                {history.alerts.length === 0 ? <NoData text="No history of alerts." /> : (
                    <>
                        <div className="space-y-4 mb-6">
                            {paginatedAlerts.map((alert: any) => (
                                <div key={alert.id} className="p-5 bg-rose-50/30 rounded-3xl border border-rose-100/50 flex items-center gap-4">
                                    <div className={`w-3 h-3 rounded-full ${alert.severity === 'CRITICAL' ? 'bg-red-500 animate-pulse' : 'bg-amber-400'}`} />
                                    <div className="flex-1">
                                        <p className="font-black text-slate-800">{alert.message}</p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{new Date(alert.date).toLocaleString()}</p>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase ${alert.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                                        {alert.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                        {alertTotalPages > 1 && (
                            <div className="flex items-center justify-between pt-6 border-t border-slate-200/50">
                                <p className="text-xs font-bold text-slate-500">Page {alertPage} of {alertTotalPages}</p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setAlertPage(p => Math.max(1, p - 1))}
                                        disabled={alertPage === 1}
                                        className="flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                        Previous
                                    </button>
                                    <button
                                        onClick={() => setAlertPage(p => Math.min(alertTotalPages, p + 1))}
                                        disabled={alertPage === alertTotalPages}
                                        className="flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        Next
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

function NoData({ text }: { text: string }) {
    return (
        <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="bg-slate-50 w-20 h-20 rounded-3xl flex items-center justify-center mb-6 border border-slate-100">
                <History className="w-10 h-10 text-slate-200" />
            </div>
            <h4 className="text-xl font-black text-slate-400">{text}</h4>
            <p className="text-sm text-slate-300 font-bold mt-2">Use the "Add New Record" button to populate this list.</p>
        </div>
    );
}
