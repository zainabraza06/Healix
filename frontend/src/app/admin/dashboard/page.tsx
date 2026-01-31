'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/authStore';
import { apiClient } from '@/lib/apiClient';
import ProtectedLayout from '@/components/ProtectedLayout';
import { Loader, AlertCircle, Users, CheckCircle, Clock, Activity, Stethoscope, AlertTriangle, FileText, Lock, XCircle, X, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import ChangePasswordModal from '@/components/ChangePasswordModal';
// Import chart wrapper components
import { PieChartWrapper, BarChartWrapper } from '@/components/charts/ChartWrappers';

// 3D Background
const Scene = dynamic(() => import('@/components/canvas/Scene'), { ssr: false });
const FloatingIcons = dynamic(() => import('@/components/canvas/FloatingIcons'), { ssr: false });

// Helper function to format status names
const formatStatus = (status: string): string => {
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// Helper function to format date
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

// Utility to generate a random password
const generateRandomPassword = (length = 12) => {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedDoctorForReject, setSelectedDoctorForReject] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedAlert, setSelectedAlert] = useState<any>(null);

  // Sample data for charts


  const userDistribution = [
    { name: 'Patients', value: dashboardData?.stats?.totalPatients || 0, color: '#06b6d4' },
    { name: 'Doctors', value: dashboardData?.stats?.totalDoctors || 0, color: '#ec4899' },
  ];

  const appointmentStatus = (dashboardData?.appointmentStats || []).map((item: any) => ({
    status: formatStatus(item.status || item._id),
    count: item.count,
  }));

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all dashboard data in parallel
      const [statsRes, alertsRes, logsRes, alertStatsRes, appointmentStatsRes, pendingDocsRes] = await Promise.all([
        apiClient.get('/admin/dashboard/stats'),
        apiClient.get('/admin/dashboard/alerts?limit=10'),
        apiClient.get('/admin/dashboard/logs?limit=10'),
        apiClient.get('/admin/dashboard/alert-stats'),
        apiClient.get('/admin/dashboard/appointment-stats'),
        apiClient.get('/admin/applications?status=PENDING&limit=10'),
      ]);

      if (statsRes.success) {
        // Process appointment stats to format correctly
        const appointmentData = appointmentStatsRes.data || [];
        const formattedAppointmentStats = appointmentData.map((item: any) => ({
          status: item._id,
          count: item.count,
        }));

        setDashboardData({
          stats: statsRes.data,
          recentAlerts: alertsRes.data || [],
          recentLogs: logsRes.data || [],
          alertStats: alertStatsRes.data,
          appointmentStats: formattedAppointmentStats,
          pendingDoctors: pendingDocsRes.data?.content || [],
          pendingApplicationsCount: pendingDocsRes.data?.totalElements || 0,
          // Filter out ADMIN from distribution chart
          userDistribution: statsRes.data.userDistribution
            ? statsRes.data.userDistribution.filter((item: any) => item._id !== 'ADMIN')
            : [
              { _id: 'PATIENT', count: statsRes.data.totalPatients || 0 },
              { _id: 'DOCTOR', count: statsRes.data.totalDoctors || 0 },
            ],
          recentActivities: (logsRes.data || []).map((log: any) => ({
            id: log._id,
            action: log.action,
            timestamp: log.created_at,
            severity: log.status === 'SUCCESS' ? 'INFO' : 'WARNING',
          })),
        });
      } else {
        setError(statsRes.message || 'Failed to fetch dashboard data');
        toast.error(statsRes.message || 'Failed to load dashboard');
      }
    } catch (err: any) {
      console.error('Dashboard fetch error:', err);
      setError(err.message || 'Failed to fetch dashboard');
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchDashboardStats();
    }
  }, [user]);

  const handleApprove = async (doctor: any) => {
    try {
      setActionLoading(doctor._id);
      const password = generateRandomPassword();
      const response = await apiClient.approveDoctor({
        doctorId: doctor._id,
        password: password,
        doctorEmail: doctor.user_id.email
      });

      if (response.success) {
        toast.success(`Application approved! Credentials sent to ${doctor.user_id.email}`);
        fetchDashboardStats();
      } else {
        toast.error(response.message || 'Failed to approve');
      }
    } catch (error: any) {
      toast.error(error.message || 'Error occurred during approval');
    } finally {
      setActionLoading(null);
    }
  };

  const openRejectModal = (doctor: any) => {
    setSelectedDoctorForReject(doctor);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const handleReject = async () => {
    if (!selectedDoctorForReject || !rejectionReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    try {
      setActionLoading(selectedDoctorForReject._id);
      const response = await apiClient.rejectDoctor({
        doctorId: selectedDoctorForReject._id,
        reason: rejectionReason,
        doctorEmail: selectedDoctorForReject.user_id.email
      });

      if (response.success) {
        toast.success(`Application rejected and email sent.`);
        setShowRejectModal(false);
        fetchDashboardStats();
      } else {
        toast.error(response.message || 'Failed to reject');
      }
    } catch (error: any) {
      toast.error(error.message || 'Error occurred during rejection');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <ProtectedLayout allowedRoles={['ADMIN']}>
        <div className="flex items-center justify-center h-96">
          <Loader className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout allowedRoles={['ADMIN']}>
      <div className="min-h-screen relative overflow-hidden bg-slate-50">
        {/* 3D Background */}
        <div className="fixed inset-0 z-0 pointer-events-none opacity-50">
          <Scene className="h-full w-full">
            <FloatingIcons />
          </Scene>
        </div>

        {/* Gradient Overlay */}
        <div className="fixed inset-0 z-0 bg-gradient-to-b from-white/20 via-transparent to-white/80 pointer-events-none" />

        <div className="relative z-10 container-main py-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600">
                Administrator Dashboard
              </h1>
              <p className="text-slate-500 font-medium mt-1">
                System-wide oversight & management
              </p>
            </div>
            <button
              onClick={() => setShowPasswordModal(true)}
              className="px-4 py-2 bg-white/50 backdrop-blur-sm border border-slate-200 rounded-xl text-slate-700 font-semibold hover:bg-white transition flex items-center gap-2 w-fit shadow-sm"
            >
              <Lock className="w-4 h-4" />
              Change Password
            </button>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-red-50/90 backdrop-blur border border-red-200 rounded-xl flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {dashboardData && (
            <>
              {/* Stats Cards - Enhanced */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                <Link href="/admin/patients" className="glass-card p-6 hover:shadow-xl transition-shadow cursor-pointer block">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-slate-500 text-sm font-medium">Total Patients</p>
                      <p className="text-3xl font-bold text-slate-800">{dashboardData.stats?.totalPatients || 0}</p>
                    </div>
                  </div>
                </Link>

                <Link href="/admin/doctors" className="glass-card p-6 hover:shadow-xl transition-shadow cursor-pointer block">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-teal-400 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                      <Stethoscope className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-slate-500 text-sm font-medium">Total Doctors</p>
                      <p className="text-3xl font-bold text-slate-800">{dashboardData.stats?.totalDoctors || 0}</p>
                    </div>
                  </div>
                </Link>

                <Link href="/admin/appointments" className="glass-card p-6 hover:shadow-xl transition-shadow cursor-pointer block">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                      <Clock className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-slate-500 text-sm font-medium">Confirmed Apts</p>
                      <p className="text-3xl font-bold text-slate-800">
                        {dashboardData.appointmentStats?.find((s: any) => s.status === 'CONFIRMED' || s.status === 'confirmed')?._id ?
                          dashboardData.appointmentStats.find((s: any) => s._id === 'CONFIRMED' || s._id === 'confirmed')?.count || 0 :
                          dashboardData.appointmentStats?.find((s: any) => s.status === 'CONFIRMED' || s.status === 'confirmed')?.count || 0}
                      </p>
                    </div>
                  </div>
                </Link>

               

                <Link href="/admin/alerts" className="glass-card p-6 hover:shadow-xl transition-shadow cursor-pointer block">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-red-400 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                      <AlertTriangle className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-slate-500 text-sm font-medium">Active Alerts</p>
                      <p className="text-3xl font-bold text-slate-800">{dashboardData.stats?.activeAlerts || 0}</p>
                    </div>
                  </div>
                </Link>

                <Link href="/admin/pending-doctors" className="glass-card p-6 hover:shadow-xl transition-shadow cursor-pointer block">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center shadow-lg">
                      <Activity className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-slate-500 text-sm font-medium">Pending Apps</p>
                      <p className="text-3xl font-bold text-slate-800">{dashboardData.stats?.pendingApprovals || 0}</p>
                    </div>
                  </div>
                </Link>
              </div>

              {/* Charts Row */}
              <div className="grid lg:grid-cols-2 gap-6 mb-8">
                {/* User Distribution Pie Chart */}
                <div className="glass-card p-6">
                  <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-teal-600" />
                    User Distribution
                  </h3>
                  <div className="h-64 flex items-center justify-center">
                    <PieChartWrapper data={userDistribution} />
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-6">
                    {userDistribution.map((item) => (
                      <div key={item.name} className="p-3 bg-white/40 rounded-lg text-center">
                        <div className="w-3 h-3 rounded-full mx-auto mb-2" style={{ backgroundColor: item.color }} />
                        <p className="text-sm font-medium text-slate-700">{item.name}</p>
                        <p className="text-2xl font-bold text-slate-800">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Appointment Status Bar Chart */}
                <div className="glass-card p-6">
                  <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-600" />
                    Appointment Status Breakdown
                  </h3>
                  {appointmentStatus.length > 0 ? (
                    <>
                      <div className="h-48 mb-4">
                        <BarChartWrapper
                          data={appointmentStatus}
                          dataKey="count"
                          categoryKey="status"
                          layout="vertical"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-4">
                        {appointmentStatus.map((item: { status: string; count: number }, index: number) => (
                          <div key={index} className="p-3 bg-white/40 rounded-lg">
                            <p className="text-xs text-slate-600 font-medium">{item.status}</p>
                            <p className="text-2xl font-bold text-slate-800">{item.count}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="h-48 flex items-center justify-center">
                      <p className="text-slate-500">No appointment data available</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Pending Doctor Applications */}
              <div className="glass-card p-6 mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-purple-600" />
                    Pending Doctor Applications ({dashboardData.pendingApplicationsCount || dashboardData.pendingDoctors?.length || 0})
                  </h2>
                  {(dashboardData.pendingDoctors?.length > 5 || (dashboardData.pendingApplicationsCount && dashboardData.pendingApplicationsCount > 5)) && (
                    <Link
                      href="/admin/pending-doctors"
                      className="text-emerald-600 hover:text-emerald-700 text-sm font-semibold flex items-center gap-1"
                    >
                      View All <ArrowLeft className="w-4 h-4 rotate-180" />
                    </Link>
                  )}
                </div>
                {dashboardData.pendingDoctors && dashboardData.pendingDoctors.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 font-semibold text-slate-700">Doctor Name</th>
                          <th className="text-left py-3 px-4 font-semibold text-slate-700">License Number</th>
                          <th className="text-left py-3 px-4 font-semibold text-slate-700">Specialization</th>
                          <th className="text-left py-3 px-4 font-semibold text-slate-700">Applied Date</th>
                          <th className="text-center py-3 px-4 font-semibold text-slate-700">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboardData.pendingDoctors.slice(0, 5).map((doctor: any) => (
                          <tr key={doctor._id} className="border-b border-slate-100 hover:bg-white/40 transition">
                            <td className="py-3 px-4">
                              <p className="font-medium text-slate-800">{doctor.user_id?.full_name || 'N/A'}</p>
                              <p className="text-xs text-slate-500">{doctor.user_id?.email || 'N/A'}</p>
                            </td>
                            <td className="py-3 px-4 text-slate-600">{doctor.license_number}</td>
                            <td className="py-3 px-4">
                              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                                {formatStatus(doctor.specialization)}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-600 text-xs">
                              {formatDate(doctor.created_at)}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleApprove(doctor)}
                                  disabled={actionLoading === doctor._id}
                                  className="p-1 px-2.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-200 transition flex items-center gap-1"
                                  title="Approve"
                                >
                                  {actionLoading === doctor._id ? <Loader className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                                  Accept
                                </button>
                                <button
                                  onClick={() => openRejectModal(doctor)}
                                  disabled={actionLoading === doctor._id}
                                  className="p-1 px-2.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold hover:bg-red-200 transition flex items-center gap-1"
                                  title="Reject"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-slate-500">No pending doctor applications</p>
                  </div>
                )}
              </div>

              {/* Bottom Row - Activities and Alerts */}
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Recent Alerts */}
                <div className="glass-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                      Recent Alerts ({dashboardData.recentAlerts?.length || 0})
                    </h2>
                    {dashboardData.recentAlerts?.length > 5 && (
                      <Link href="/admin/alerts" className="text-emerald-600 hover:text-emerald-700 text-sm font-semibold">
                        View All
                      </Link>
                    )}
                  </div>
                  {dashboardData.recentAlerts && dashboardData.recentAlerts.length > 0 ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {dashboardData.recentAlerts.slice(0, 5).map((alert: any) => (
                        <div
                          key={alert._id}
                          onClick={() => setSelectedAlert(alert)}
                          className={`p-3 rounded-lg border backdrop-blur-sm transition cursor-pointer hover:shadow-md ${alert.severity === 'CRITICAL'
                            ? 'bg-red-50 border-red-200 hover:bg-red-100'
                            : alert.severity === 'HIGH'
                              ? 'bg-orange-50 border-orange-200 hover:bg-orange-100'
                              : alert.severity === 'MEDIUM'
                                ? 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100'
                                : 'bg-blue-50 border-blue-200 hover:bg-blue-100'
                            }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-800 text-sm truncate">{alert.title}</p>
                              <p className="text-xs text-slate-600 mt-1 font-semibold">
                                Patient: {alert.patient_name || 'N/A'}
                              </p>
                              {alert.doctor_name && (
                                <p className="text-xs text-emerald-600 font-semibold">
                                  Doctor: Dr. {alert.doctor_name}
                                </p>
                              )}
                              <p className="text-xs text-slate-500 mt-1">
                                {formatDate(alert.created_at)}
                              </p>
                              <p className="text-xs text-slate-400 mt-1">Click to view full details</p>
                            </div>
                            <span
                              className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${alert.severity === 'CRITICAL'
                                ? 'bg-red-200 text-red-800'
                                : alert.severity === 'HIGH'
                                  ? 'bg-orange-200 text-orange-800'
                                  : alert.severity === 'MEDIUM'
                                    ? 'bg-yellow-200 text-yellow-800'
                                    : 'bg-blue-200 text-blue-800'
                                }`}
                            >
                              {alert.severity}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-slate-500">No active alerts</p>
                    </div>
                  )}
                </div>

                {/* Recent Activities */}
                <div className="glass-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-emerald-600" />
                      Recent Activities ({dashboardData.recentActivities?.length || 0})
                    </h2>
                    {dashboardData.recentActivities?.length > 5 && (
                      <Link href="/admin/logs" className="text-emerald-600 hover:text-emerald-700 text-sm font-semibold">
                        View All
                      </Link>
                    )}
                  </div>
                  {dashboardData.recentActivities && dashboardData.recentActivities.length > 0 ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {dashboardData.recentActivities.slice(0, 5).map((activity: any) => (
                        <div key={activity.id} className="p-3 bg-white/40 rounded-lg border border-white/50 backdrop-blur-sm hover:bg-white/60 transition">
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-800 text-sm truncate">{activity.action}</p>
                              <p className="text-xs text-slate-500 mt-1">
                                {formatDate(activity.timestamp)}
                              </p>
                            </div>
                            <span
                              className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${activity.severity === 'ERROR'
                                ? 'bg-red-100 text-red-700'
                                : activity.severity === 'WARNING'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-emerald-100 text-emerald-700'
                                }`}
                            >
                              {activity.severity}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-slate-500">No recent activities</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <ChangePasswordModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} />

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">Reject Application</h3>
              <button onClick={() => setShowRejectModal(false)} className="text-slate-400 hover:text-slate-600 transition">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-slate-600 mb-4 text-sm">
                Provide a reason for rejecting <strong>Dr. {selectedDoctorForReject?.user_id?.full_name}</strong>'s application. This will be sent to them via email.
              </p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Missing medical license verification..."
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition min-h-[120px] text-sm"
              />
            </div>
            <div className="p-6 bg-slate-50 flex gap-3">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 py-2.5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectionReason.trim() || actionLoading === selectedDoctorForReject?._id}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition flex items-center justify-center gap-2"
              >
                {actionLoading === selectedDoctorForReject?._id ? <Loader className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Send Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Details Modal */}
      {selectedAlert && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          onClick={() => setSelectedAlert(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200"
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
                const lines = selectedAlert.message.split('\n').filter((l: string) => l.trim());

                // Extract Issues (line starting with "Issues:")
                let issuesText = '';
                let recsText = '';
                let snapshotText = '';

                for (const line of lines) {
                  if (line.startsWith('Issues:')) {
                    issuesText = line.replace('Issues:', '').trim();
                  } else if (line.startsWith('Recommendations:')) {
                    recsText = line.replace('Recommendations:', '').trim();
                  } else if (line.startsWith('Snapshot:')) {
                    snapshotText = line.replace('Snapshot:', '').trim();
                  }
                }

                // Parse issues (separated by semicolon)
                const issues = issuesText
                  .split(';')
                  .map((i: string) => i.trim())
                  .filter((i: string) => i.length > 0);

                // Parse recommendations (separated by pipe)
                const recs = recsText
                  .split('|')
                  .map((r: string) => r.trim())
                  .filter((r: string) => r.length > 0);

                return (
                  <>
                    {/* Resolved Alert - Instructions and Prescription */}
                    {selectedAlert?.status === 'RESOLVED' && (selectedAlert?.instructions || selectedAlert?.prescription) && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="w-6 h-6 text-emerald-600" />
                          <h4 className="text-xl font-bold text-emerald-800">Alert Resolved</h4>
                        </div>

                        {selectedAlert?.instructions && (
                          <div className="bg-emerald-50 p-6 rounded-2xl border-2 border-emerald-200">
                            <div className="flex items-center gap-2 mb-3">
                              <Stethoscope className="w-5 h-5 text-emerald-700" />
                              <h5 className="text-sm font-bold text-emerald-900 uppercase tracking-wider">Doctor's Instructions</h5>
                            </div>
                            <p className="text-sm text-emerald-900 leading-relaxed whitespace-pre-wrap font-medium">
                              {selectedAlert.instructions}
                            </p>
                          </div>
                        )}

                        {selectedAlert?.prescription && (
                          <div className="bg-emerald-50 p-6 rounded-2xl border-2 border-emerald-200">
                            <div className="flex items-center gap-2 mb-3">
                              <Activity className="w-5 h-5 text-emerald-700" />
                              <h5 className="text-sm font-bold text-emerald-900 uppercase tracking-wider">Prescription</h5>
                            </div>
                            <p className="text-sm text-emerald-900 leading-relaxed whitespace-pre-wrap font-medium">
                              {selectedAlert.prescription}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Patient Info */}
                    {(selectedAlert.patient_name || selectedAlert.patient_id) && (
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="flex items-center gap-3 mb-1">
                          <Users className="w-4 h-4 text-slate-500" />
                          <p className="text-sm font-semibold text-slate-700">Patient</p>
                        </div>
                        <p className="text-sm text-slate-800 font-bold">
                          {selectedAlert.patient_name || selectedAlert.patient_id?.user_id?.full_name || selectedAlert.patient_id?.user_id?.name || 'Unknown Patient'}
                        </p>
                        <p className="text-[11px] text-slate-500 font-semibold mt-1">ID: {selectedAlert.patient_id?._id || selectedAlert.patient_id?.id || 'N/A'}</p>
                      </div>
                    )}

                    {/* Doctor Consultation Status */}
                    {selectedAlert.doctor_id && (
                      <div className="p-4 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl text-white shadow-lg">
                        <div className="flex items-center gap-3 mb-2">
                          <Stethoscope className="w-5 h-5" />
                          <p className="text-sm font-bold">Consultation Active</p>
                        </div>
                        <p className="text-xs font-semibold opacity-90">
                          Being reviewed by Dr. {selectedAlert.doctor_name}
                        </p>
                        {selectedAlert.doctor_id?._id && (
                          <p className="text-[10px] text-white/80 font-semibold mt-1">ID: {selectedAlert.doctor_id._id}</p>
                        )}
                        <div className="mt-3 pt-3 border-t border-white/20 text-[10px] font-bold uppercase tracking-widest opacity-80">
                          {selectedAlert.resolved_at
                            ? `Resolved: ${new Date(selectedAlert.resolved_at).toLocaleDateString()}`
                            : 'Status: In Assessment'}
                        </div>
                      </div>
                    )}

                    {/* Critical Issues Section */}
                    {issues.length > 0 && (
                      <div>
                        <h4 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                          <AlertCircle className="w-5 h-5 text-red-600" />
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

                    {/* Recommendations Section */}
                    {recs.length > 0 && (
                      <div>
                        <h4 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-emerald-600" />
                          Recommendations
                        </h4>
                        <div className="space-y-2 bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                          {recs.map((rec: string, idx: number) => (
                            <p key={idx} className="text-sm text-emerald-900 leading-relaxed">
                              ✓ {rec}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Snapshot Section */}
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
    </ProtectedLayout>
  );
}
