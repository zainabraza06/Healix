'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import ProtectedLayout from '@/components/ProtectedLayout';
import toast from 'react-hot-toast';
import { AlertTriangle, Bell, CheckCircle, Clock } from 'lucide-react';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';

export default function DoctorAlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.getDoctorAlerts();
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

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      const response = await apiClient.acknowledgeAlert(alertId);
      if (response.success) {
        setAcknowledgedAlerts((prev) => new Set([...prev, alertId]));
        toast.success('Alert acknowledged');
      } else {
        toast.error(response.message || 'Failed to acknowledge alert');
      }
    } catch (err) {
      toast.error('An error occurred');
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
    <ProtectedLayout allowedRoles={['DOCTOR']}>
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-4xl font-bold text-gray-800 mb-2">Patient Alerts</h1>
              <p className="text-gray-600">Monitor critical patient alerts and updates</p>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-8 flex-wrap">
              {['ALL', 'CRITICAL', 'WARNING', 'INFO'].map((severity) => (
                <button
                  key={severity}
                  onClick={() => setSelectedSeverity(severity)}
                  className={`px-4 py-2 rounded-lg font-semibold transition ${
                    selectedSeverity === severity
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-blue-600'
                  }`}
                >
                  {severity}
                </button>
              ))}
            </div>

            {/* Content */}
            {isLoading ? (
              <div className="card bg-white">
                <Spinner size="lg" message="Loading alerts..." />
              </div>
            ) : error ? (
              <div className="card bg-red-50 border-2 border-red-200">
                <p className="text-red-700">{error}</p>
              </div>
            ) : filteredAlerts.length === 0 ? (
              <EmptyState
                icon={CheckCircle}
                title="No alerts at this time"
                message="All patients are in good health"
              />
            ) : (
              <div className="space-y-4">
                {filteredAlerts.map((alert, idx) => {
                  const isAcknowledged = acknowledgedAlerts.has(alert.id);
                  return (
                    <div
                      key={idx}
                      className={`card border-2 p-6 ${getSeverityColor(alert.severity)} ${
                        isAcknowledged ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          {getSeverityIcon(alert.severity)}
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-lg">{alert.patientName}</h3>
                              {isAcknowledged && (
                                <span className="px-2 py-1 text-xs font-semibold bg-white bg-opacity-50 rounded">
                                  Acknowledged
                                </span>
                              )}
                            </div>
                            <p className="mb-2">{alert.title}</p>
                            <p className="mb-2 text-sm opacity-75">{alert.message}</p>
                            <div className="flex items-center gap-2 text-sm opacity-75">
                              <Clock size={16} />
                              {new Date(alert.createdAt).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        {!isAcknowledged && (
                          <button
                            onClick={() => handleAcknowledgeAlert(alert.id)}
                            className="px-4 py-2 bg-white bg-opacity-50 hover:bg-opacity-75 rounded-lg font-semibold ml-4 whitespace-nowrap transition"
                          >
                            Acknowledge
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
    </ProtectedLayout>
  );
}
