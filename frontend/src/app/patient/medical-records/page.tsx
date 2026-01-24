'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/authStore';
import { apiClient } from '@/lib/apiClient';
import ProtectedLayout from '@/components/ProtectedLayout';
import {
    Loader, Activity, Calendar, AlertCircle,
    Plus, History, Shield, Info, Clipboard,
    Heart, Thermometer, User, Building2
} from 'lucide-react';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { MedicalRecord, MedicalRecordEntry } from '@/types';

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

    useEffect(() => {
        fetchRecords();
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
                    <div className="mb-10 animate-fade-in">
                        <h1 className="text-5xl font-black text-slate-800 mb-3 tracking-tight">
                            Medical <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500">Records</span>
                        </h1>
                        <p className="text-slate-500 text-lg font-medium">Manage your health profile and history</p>
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

                            <button
                                onClick={() => { setModalType(activeTab === 'overview' || activeTab === 'history' ? 'immunizations' : activeTab); setIsModalOpen(true); }}
                                className="w-full btn-primary py-4 rounded-2xl shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                            >
                                <Plus className="w-5 h-5" />
                                Add New Record
                            </button>
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
                                    {activeTab === 'overview' && <Overview records={records!} />}
                                    {activeTab === 'immunizations' && <SimpleList title="Immunizations" data={records?.immunizations || []} />}
                                    {activeTab === 'allergies' && <AllergyList data={records?.allergies || []} />}
                                    {activeTab === 'operations' && <SurgeryList data={records?.operations || []} />}
                                    {activeTab === 'labResults' && <LabList data={records?.labResults || []} />}
                                    {activeTab === 'history' && <HistoryView history={records?.history!} />}
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
                            className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl relative"
                        >
                            <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-2">
                                <Plus className="w-6 h-6 text-emerald-500" />
                                Add {modalType}
                            </h2>
                            <form onSubmit={handleAddEntry} className="space-y-4">
                                {/* Simplified generic form for brevity, usually custom per type */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Name / Test</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-emerald-500"
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value, testName: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Date</label>
                                    <input
                                        type="date"
                                        className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-emerald-500"
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        required
                                    />
                                </div>
                                {modalType === 'allergies' && (
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Severity</label>
                                        <select
                                            className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-emerald-500"
                                            onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                                        >
                                            <option value="LOW">Low</option>
                                            <option value="MEDIUM">Medium</option>
                                            <option value="HIGH">High</option>
                                            <option value="CRITICAL">Critical</option>
                                        </select>
                                    </div>
                                )}
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
    return (
        <div className="glass-card p-8 border-white/40 min-h-[400px]">
            <h2 className="text-2xl font-black text-slate-800 mb-8 border-b pb-4 border-slate-100">{title}</h2>
            {data.length === 0 ? <NoData text={`No ${title.toLowerCase()} recorded yet.`} /> : (
                <div className="space-y-4">
                    {data.map((item, idx) => (
                        <div key={idx} className="p-5 bg-white/60 rounded-3xl border border-slate-200/50 flex justify-between items-center group hover:border-emerald-200 transition-colors">
                            <div>
                                <p className="font-black text-slate-800 text-lg">{item.name || item.testName}</p>
                                <p className="text-sm text-slate-400 font-bold uppercase tracking-wider">{new Date(item.date).toLocaleDateString()}</p>
                            </div>
                            <Activity className="w-5 h-5 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function AllergyList({ data }: { data: any[] }) {
    return (
        <div className="glass-card p-8 border-white/40 min-h-[400px]">
            <h2 className="text-2xl font-black text-slate-800 mb-8 border-b pb-4 border-slate-100 uppercase tracking-tight">Active Allergies</h2>
            {data.length === 0 ? <NoData text="No allergies recorded." /> : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.map((item, idx) => (
                        <div key={idx} className="p-6 bg-white rounded-3xl border-2 border-slate-50 relative overflow-hidden group">
                            <div className={`absolute top-0 left-0 w-2 h-full ${item.severity === 'CRITICAL' ? 'bg-red-500' : 'bg-amber-400'}`} />
                            <p className="font-black text-slate-800 text-xl mb-1">{item.name}</p>
                            <span className="text-[10px] font-black uppercase bg-slate-100 px-2 py-0.5 rounded-full text-slate-500 tracking-widest">{item.severity} SEVERITY</span>
                            <p className="mt-3 text-sm text-slate-500 font-medium italic">"{item.notes || 'No specific notes provided'}"</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function SurgeryList({ data }: { data: any[] }) {
    return (
        <div className="glass-card p-8 border-white/40 min-h-[400px]">
            <h2 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-2">
                <Building2 className="w-6 h-6 text-emerald-500" /> Surgical History
            </h2>
            {data.length === 0 ? <NoData text="No operations recorded." /> : (
                <div className="space-y-4">
                    {data.map((item, idx) => (
                        <div key={idx} className="p-6 bg-slate-50/50 rounded-3xl border border-slate-200/50 flex items-start gap-5">
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
            )}
        </div>
    );
}

function LabList({ data }: { data: any[] }) {
    return (
        <div className="glass-card p-8 border-white/40 min-h-[400px]">
            <h2 className="text-2xl font-black text-slate-800 mb-8">Lab & Diagnostics</h2>
            {data.length === 0 ? <NoData text="No lab results found." /> : (
                <div className="grid grid-cols-1 gap-4">
                    {data.map((item, idx) => (
                        <div key={idx} className="p-6 bg-emerald-50/20 rounded-3xl border border-emerald-100/50 flex flex-col md:flex-row justify-between md:items-center gap-4">
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
            )}
        </div>
    );
}

function HistoryView({ history }: { history: any }) {
    return (
        <div className="space-y-8">
            <div className="glass-card p-8 border-white/40">
                <h2 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-2">
                    <Calendar className="w-6 h-6 text-emerald-500" /> Completed Appointments
                </h2>
                {history.completedAppointments.length === 0 ? <NoData text="No completed appointments." /> : (
                    <div className="space-y-4">
                        {history.completedAppointments.map((apt: any) => (
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
                )}
            </div>

            <div className="glass-card p-8 border-white/40 border-rose-100 mt-8">
                <h2 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-2">
                    <AlertCircle className="w-6 h-6 text-rose-500" /> Security & Health Alerts
                </h2>
                {history.alerts.length === 0 ? <NoData text="No history of alerts." /> : (
                    <div className="space-y-4">
                        {history.alerts.map((alert: any) => (
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
