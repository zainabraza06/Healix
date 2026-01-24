'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import ProtectedLayout from '@/components/ProtectedLayout';
import toast from 'react-hot-toast';
import { AlertTriangle, CheckCircle, Bell, Clock } from 'lucide-react';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.getPatientAlerts();
      if (response.success) {
        setAlerts(response.data || []);
      } else {
        setError(response.message || 'Failed to load alerts');
      }
    } catch (err) {
      setError('An error occurred while fetching alerts');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmergencyAlert = async () => {
    try {
      const response = await apiClient.createEmergencyAlert({
        description: 'Emergency assistance needed',
      });
      if (response.success) {
        toast.success('Emergency alert sent to your doctor');
        fetchAlerts();
      } else {
        toast.error(response.message || 'Failed to send alert');
      }
    } catch (err) {
      toast.error('An error occurred while sending alert');
    }
  };

  const filteredAlerts = selectedSeverity === 'ALL'
    ? alerts
    : alerts.filter((a) => a.severity === selectedSeverity);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-100 border-red-300 text-red-800';
      case 'WARNING':
        return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'INFO':
        return 'bg-blue-100 border-blue-300 text-blue-800';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return <AlertTriangle className="text-red-600" size={20} />;
      case 'WARNING':
        return <AlertTriangle className="text-yellow-600" size={20} />;
      case 'INFO':
        return <Bell className="text-blue-600" size={20} />;
      default:
        return <CheckCircle className="text-gray-600" size={20} />;
    }
  };

  return (
    <ProtectedLayout allowedRoles={['PATIENT']}>
      <div className="container-main py-8">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-4xl font-bold text-slate-800 mb-2">Health Alerts</h1>
              <p className="text-slate-600">Stay informed about your health status</p>
            </div>

            {/* Emergency Alert Button */}
            <div className="mb-8">
              <button
                onClick={handleEmergencyAlert}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-xl transition flex items-center gap-2 shadow-lg hover:shadow-red-500/30"
              >
                <AlertTriangle size={20} />
                Send Emergency Alert
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-8 flex-wrap">
              {['ALL', 'CRITICAL', 'WARNING', 'INFO'].map((severity) => (
                <button
                  key={severity}
                  onClick={() => setSelectedSeverity(severity)}
                  className={`px-4 py-2 rounded-xl font-semibold transition ${selectedSeverity === severity
                      ? 'bg-emerald-600 text-white shadow-lg'
                      : 'bg-white/50 text-slate-700 border border-slate-200 hover:border-emerald-500 backdrop-blur-sm'
                    }`}
                >
                  {severity}
                </button>
              ))}
            </div>

            {/* Loading State */}
            {isLoading ? (
              <div className="glass-panel p-8 text-center">
                <Spinner size="lg" message="Loading alerts..." />
              </div>
            ) : error ? (
              <div className="p-4 bg-red-50/90 backdrop-blur border border-red-200 rounded-xl">
                <p className="text-red-700">{error}</p>
              </div>
            ) : filteredAlerts.length === 0 ? (
              <EmptyState
                icon={CheckCircle}
                title="No alerts at this time"
                message="Keep monitoring your vital signs"
              />
            ) : (
              <div className="space-y-4">
                {filteredAlerts.map((alert, idx) => (
                  <div
                    key={idx}
                    className={`rounded-xl border-l-4 p-6 backdrop-blur-sm transition-all hover:shadow-md ${getSeverityColor(alert.severity)}`}
                  >
                    <div className="flex items-start gap-4">
                      {getSeverityIcon(alert.severity)}
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-1">{alert.title}</h3>
                        <p className="mb-2">{alert.message}</p>
                        <div className="flex items-center gap-2 text-sm opacity-75">
                          <Clock size={16} />
                          {new Date(alert.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/50 backdrop-blur-sm">
                        {alert.severity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
    </ProtectedLayout>
  );
}
