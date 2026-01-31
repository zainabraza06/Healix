'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import ProtectedLayout from '@/components/ProtectedLayout';
import { AlertCircle, LogIn, LogOut, User, Clock, Download, Search, Filter, Activity, PieChart, Info, AlertTriangle, ShieldCheck, X, FileText, Database, Code } from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import Pagination from '@/components/Pagination';
import dynamic from 'next/dynamic';

// Import chart wrapper components
import { PieChartWrapper } from '@/components/charts/ChartWrappers';

// 3D Background
const Scene = dynamic(() => import('@/components/canvas/Scene'), { ssr: false });
const FloatingIcons = dynamic(() => import('@/components/canvas/FloatingIcons'), { ssr: false });

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedLog, setSelectedLog] = useState<any>(null);

  // Filtering state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState('ALL');

  useEffect(() => {
    fetchLogs();
  }, [currentPage, pageSize]);

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiClient.getLogs(currentPage, pageSize);
      if (response.success && response.data) {
        const logsData = response.data.content || response.data || [];
        setLogs(logsData);
        setTotalPages(response.data.totalPages || 1);

        // Auto-select first log if none selected
        if (logsData.length > 0 && !selectedLog) {
          setSelectedLog(logsData[0]);
        }
      } else {
        setError(response.message || 'Failed to load logs');
      }
    } catch (err) {
      setError('An error occurred while fetching logs');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (format: 'csv' | 'json' | 'pdf') => {
    try {
      const blob = await apiClient.downloadLogs(format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = format === 'csv' ? 'system_logs.csv' : format === 'json' ? 'system_logs.json' : 'system_logs.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError('Failed to download logs');
    }
  };

  // Client-side filtering
  const filteredLogs = logs.filter(log => {
    const matchesSearch = searchTerm === '' ||
      log.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userEmail?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesLevel = filterLevel === 'ALL' || log.level === filterLevel;

    return matchesSearch && matchesLevel;
  });

  // Data for charts (using currently loaded logs)
  const logLevelDistribution = [
    { name: 'INFO', value: logs.filter(l => l.level === 'INFO').length, color: '#10b981' },
    { name: 'WARNING', value: logs.filter(l => l.level === 'WARNING' || l.level === 'WARN').length, color: '#f59e0b' },
    { name: 'ERROR', value: logs.filter(l => l.level === 'ERROR').length, color: '#ef4444' },
    { name: 'DEBUG', value: logs.filter(l => l.level === 'DEBUG').length, color: '#6366f1' },
  ].filter(item => item.value > 0);

  const getActivityIcon = (level: string, action: string) => {
    switch (level?.toUpperCase()) {
      case 'ERROR': return <AlertCircle className="text-red-500" size={20} />;
      case 'WARNING':
      case 'WARN': return <AlertTriangle className="text-amber-500" size={20} />;
    }

    switch (action?.toUpperCase()) {
      case 'LOGIN': return <LogIn className="text-emerald-500" size={20} />;
      case 'LOGOUT': return <LogOut className="text-slate-500" size={20} />;
      case 'PASSWORD_CHANGE': return <ShieldCheck className="text-blue-500" size={20} />;
      default: return <Clock className="text-slate-400" size={20} />;
    }
  };

  const getLogColor = (level: string) => {
    switch (level?.toUpperCase()) {
      case 'ERROR': return 'border-red-500 bg-red-50/60';
      case 'WARNING':
      case 'WARN': return 'border-amber-500 bg-amber-50/60';
      case 'INFO': return 'border-emerald-500 bg-emerald-50/60';
      case 'DEBUG': return 'border-indigo-500 bg-indigo-50/60';
      default: return 'border-slate-200 bg-white/60';
    }
  };

  const getReadableAction = (action: string) => {
    return action?.replace(/_/g, ' ').toUpperCase() || 'UNKNOWN';
  };

  return (
    <ProtectedLayout allowedRoles={['ADMIN']}>
      <div className="relative min-h-screen">
        {/* 3D Background */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          <Scene className="h-full w-full">
            <FloatingIcons />
          </Scene>
        </div>

        <div className="relative z-10 container-main py-8">
          <div className="max-w-[1600px] mx-auto">
            {/* Header Area */}
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 mb-10">
              <div className="animate-fade-in">
                <h1 className="text-5xl font-black text-slate-800 tracking-tight leading-tight">
                  Audit <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">System Logs</span>
                </h1>
                <p className="text-slate-600 mt-3 text-lg font-medium max-w-2xl">
                  Monitor system integrity and administrative activities with high-fidelity tracking.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative group/export">
                  <button
                    className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                  >
                    <Download className="w-4 h-4" /> Export System Logs
                  </button>
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 opacity-0 invisible group-hover/export:opacity-100 group-hover/export:visible transition-all z-50">
                    <button onClick={() => handleDownload('pdf')} className="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition flex items-center gap-2">
                      <FileText className="w-4 h-4" /> Landscape PDF
                    </button>
                    <button onClick={() => handleDownload('csv')} className="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition flex items-center gap-2">
                      <Database className="w-4 h-4" /> CSV Spreadsheet
                    </button>
                    <button onClick={() => handleDownload('json')} className="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition flex items-center gap-2">
                      <Code className="w-4 h-4" /> raw JSON Data
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Dashboard Controls & Visualization */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-8">
              {/* Analytics Summary */}
              <div className="lg:col-span-1 glass-card p-6 border-white/40 flex flex-col">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                  <PieChart className="w-4 h-4" />
                  Severity Distribution
                </h3>
                <div className="h-[260px] flex-1">
                  {logs.length > 0 ? (
                    <PieChartWrapper data={logLevelDistribution} />
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400">
                      <p className="text-xs italic">Awaiting data...</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Filtering Controls */}
              <div className="lg:col-span-3 glass-card p-8 border-white/40">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Search Activities</label>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Search by user, action or description..."
                        className="w-full pl-11 pr-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm font-medium"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Filter by Level</label>
                    <div className="relative">
                      <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <select
                        className="w-full pl-11 pr-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm font-bold appearance-none cursor-pointer"
                        value={filterLevel}
                        onChange={(e) => setFilterLevel(e.target.value)}
                      >
                        <option value="ALL">All Levels</option>
                        <option value="INFO">Info</option>
                        <option value="WARNING">Warning</option>
                        <option value="ERROR">Error</option>
                        <option value="DEBUG">Debug</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Page Size:</span>
                    <div className="flex gap-2">
                      {[10, 20, 50, 100].map((size) => (
                        <button
                          key={size}
                          onClick={() => {
                            setCurrentPage(0);
                            setPageSize(size);
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition ${pageSize === size
                            ? 'bg-slate-800 text-white'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs font-medium text-slate-400">Showing {filteredLogs.length} of {logs.length} loaded events</p>
                </div>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Log Detail Panel - Now on the left with sticky viewport behavior */}
              <div className="lg:col-span-5 xl:col-span-4 sticky top-24 self-start order-2 lg:order-1">
                {selectedLog ? (
                  <div className="glass-card overflow-hidden border-white/50 shadow-2xl animate-fade-in-up">
                    <div className="p-6 bg-slate-800 text-white flex justify-between items-center shrink-0">
                      <div>
                        <h2 className="text-xl font-black uppercase tracking-tight">Event Detail</h2>
                        <p className="text-[10px] text-slate-400 font-black tracking-widest uppercase">Trace ID: {selectedLog.id?.slice(-12) || 'N/A'}</p>
                      </div>
                      <div className={`p-3 rounded-2xl ${selectedLog.level === 'ERROR' ? 'bg-red-500' : 'bg-emerald-500'}`}>
                        {getActivityIcon(selectedLog.level, selectedLog.action)}
                      </div>
                    </div>

                    <div className="p-8 space-y-6">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Contextual Message</label>
                        <p className="text-lg font-bold text-slate-800 leading-snug">{selectedLog.description}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${selectedLog.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {selectedLog.status || 'REPORTED'}
                          </span>
                        </div>
                        <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">IP Address</p>
                          <p className="text-xs font-black text-slate-700 font-mono tracking-tighter">{selectedLog.ipAddress || 'Internal'}</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        {[
                          { label: 'Originator', value: selectedLog.userEmail || selectedLog.adminEmail, icon: User, color: 'blue' },
                          { label: 'Execution Path', value: selectedLog.action, icon: ShieldCheck, color: 'indigo' },
                          { label: 'Temporal Marker', value: new Date(selectedLog.timestamp).toLocaleString(), icon: Clock, color: 'emerald' },
                        ].map((item, i) => (
                          <div key={i} className="flex items-center gap-4 p-4 bg-white/40 rounded-2xl border border-white/60">
                            <div className={`p-2.5 bg-${item.color}-50 text-${item.color}-600 rounded-xl`}>
                              <item.icon size={18} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{item.label}</p>
                              <p className="text-sm font-bold text-slate-700 truncate">{item.value || 'System'}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {selectedLog.additionalInfo && (
                        <div className="space-y-3 pt-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                            <Activity className="w-3 h-3 text-indigo-500" /> Advanced Telemetry
                          </label>
                          <div className="relative group">
                            <pre className="bg-slate-900 text-emerald-400 p-5 rounded-3xl text-sm font-mono overflow-auto max-h-60 custom-scrollbar shadow-inner">
                              {(() => {
                                try {
                                  return JSON.stringify(JSON.parse(selectedLog.additionalInfo), null, 2);
                                } catch {
                                  return selectedLog.additionalInfo;
                                }
                              })()}
                            </pre>
                            <div className="absolute top-4 right-4 bg-slate-800 text-[8px] font-black text-slate-100 px-2 py-1 rounded tracking-widest uppercase opacity-40">JSON-X</div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="p-6 bg-slate-50/50 border-t border-slate-100">
                      <button
                        onClick={() => setSelectedLog(null)}
                        className="w-full py-3 rounded-2xl bg-white border border-slate-200 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-all flex items-center justify-center gap-2"
                      >
                        <X size={14} /> Close Inspector
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="glass-card p-16 text-center border-white/50 bg-white/10 mt-10 shadow-xl">
                    <div className="w-20 h-20 bg-slate-100/50 backdrop-blur rounded-3xl flex items-center justify-center mx-auto mb-6 border border-white/50">
                      <ShieldCheck size={40} className="text-slate-400" />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">Ready to Inspect</h3>
                    <p className="text-slate-500 text-sm font-medium leading-relaxed">
                      Select any event from the stream to verify its metadata and execution path.
                    </p>
                  </div>
                )}
              </div>

              {/* Logs Stream - Now on the right */}
              <div className="lg:col-span-7 xl:col-span-8 order-1 lg:order-2">
                {isLoading ? (
                  <div className="glass-panel p-20 text-center flex flex-col items-center">
                    <div className="relative mb-6">
                      <div className="w-16 h-16 border-4 border-emerald-100 rounded-full animate-pulse"></div>
                      <div className="absolute inset-0 w-16 h-16 border-t-4 border-emerald-600 rounded-full animate-spin"></div>
                    </div>
                    <p className="text-slate-500 font-black tracking-widest uppercase text-xs">Decrypting system stream...</p>
                  </div>
                ) : error ? (
                  <div className="p-8 bg-red-50/90 backdrop-blur border border-red-200 rounded-3xl flex items-start gap-4">
                    <div className="p-3 bg-red-100 rounded-2xl">
                      <AlertCircle className="text-red-600" size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-red-900 mb-1">Retrieval Failed</h3>
                      <p className="text-red-700">{error}</p>
                      <button onClick={() => fetchLogs()} className="mt-4 text-sm font-black uppercase text-red-600 hover:text-red-800 transition">Try Again</button>
                    </div>
                  </div>
                ) : filteredLogs.length === 0 ? (
                  <div className="glass-card p-20 border-white/50 bg-white/20">
                    <EmptyState
                      icon={ShieldCheck}
                      title="No matching logs found"
                    />
                    <div className="mt-8 text-center">
                      <button
                        onClick={() => { setSearchTerm(''); setFilterLevel('ALL'); }}
                        className="px-6 py-2.5 bg-emerald-100 text-emerald-700 rounded-xl font-bold hover:bg-emerald-200 transition"
                      >
                        Reset Filters
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredLogs.map((log, idx) => (
                      <div
                        key={log.id || idx}
                        onClick={() => setSelectedLog(log)}
                        className={`group cursor-pointer transition-all duration-300 border-l-8 rounded-3xl p-5 backdrop-blur-md overflow-hidden relative ${getLogColor(log.level)} ${selectedLog?.id === log.id ? 'ring-2 ring-emerald-500 shadow-xl translate-x-1' : 'hover:translate-x-1 hover:shadow-lg'
                          }`}
                      >
                        <div className="flex items-start gap-4 relative z-10">
                          <div className={`p-4 rounded-2xl bg-white/60 shadow-sm group-hover:scale-110 transition-transform`}>
                            {getActivityIcon(log.level, log.action)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <h3 className="font-black text-slate-800 uppercase tracking-wide truncate">
                                {getReadableAction(log.action)}
                              </h3>
                              <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${log.level === 'ERROR' ? 'bg-red-500 text-white' :
                                  log.level === 'WARNING' || log.level === 'WARN' ? 'bg-amber-500 text-white' :
                                    'bg-slate-800 text-white'
                                  }`}>
                                  {log.level}
                                </span>
                              </div>
                            </div>
                            <p className="text-sm font-medium text-slate-600 line-clamp-2 mb-3">{log.description}</p>
                            <div className="flex flex-wrap items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                              <span className="flex items-center gap-1.5 bg-white/40 px-2.5 py-1 rounded-lg">
                                <Clock size={12} className="text-emerald-500" />
                                {new Date(log.timestamp).toLocaleString()}
                              </span>
                              {log.userEmail && (
                                <span className="flex items-center gap-1.5 bg-white/40 px-2.5 py-1 rounded-lg">
                                  <User size={12} className="text-blue-500" />
                                  {log.userEmail}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2 bg-emerald-500 text-white rounded-full self-center">
                            <Info size={16} />
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="mt-8">
                      <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedLayout>
  );
}
