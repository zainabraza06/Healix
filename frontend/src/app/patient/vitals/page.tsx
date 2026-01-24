'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/authStore';
import { apiClient } from '@/lib/apiClient';
import ProtectedLayout from '@/components/ProtectedLayout';
import toast from 'react-hot-toast';
import { AlertCircle, Upload, Download, TrendingUp } from 'lucide-react';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';

export default function VitalsPage() {
  const { user } = useAuthStore();
  const [vitals, setVitals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);

  useEffect(() => {
    fetchVitals();
  }, []);

  const fetchVitals = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.getVitalsHistory(90);
      if (response.success) {
        setVitals(response.data || []);
      } else {
        setError(response.message || 'Failed to load vitals');
      }
    } catch (err) {
      setError('An error occurred while fetching vitals');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await apiClient.downloadCSVTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vitals_template.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Template downloaded successfully');
    } catch (err) {
      toast.error('Failed to download template');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleUploadCSV = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!file) {
      toast.error('Please select a file');
      return;
    }

    setIsUploading(true);
    try {
      const response = await apiClient.uploadVitalsCSV(file);
      if (response.success) {
        toast.success('Vitals uploaded successfully!');
        setFile(null);
        setShowUploadForm(false);
        fetchVitals();
      } else {
        toast.error(response.message || 'Upload failed');
      }
    } catch (err) {
      toast.error('An error occurred during upload');
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <ProtectedLayout allowedRoles={['PATIENT']}>
      <div className="container-main py-8">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-4xl font-bold text-slate-800 mb-2">Vital Signs</h1>
              <p className="text-slate-600">Monitor and manage your health metrics</p>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <button
                onClick={handleDownloadTemplate}
                className="flex items-center justify-center gap-2 bg-white/50 border border-emerald-500 text-emerald-600 py-3 px-4 rounded-xl hover:bg-emerald-50 transition font-semibold backdrop-blur-sm"
              >
                <Download size={20} />
                Download Template
              </button>
              <button
                onClick={() => setShowUploadForm(!showUploadForm)}
                className="flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 px-4 rounded-xl hover:bg-emerald-700 transition font-semibold shadow-lg hover:shadow-emerald-500/30"
              >
                <Upload size={20} />
                {showUploadForm ? 'Close' : 'Upload CSV'}
              </button>
              <button
                onClick={fetchVitals}
                className="flex items-center justify-center gap-2 bg-slate-600 text-white py-3 px-4 rounded-xl hover:bg-slate-700 transition font-semibold"
              >
                <TrendingUp size={20} />
                Refresh
              </button>
            </div>

            {/* Upload Form */}
            {showUploadForm && (
              <div className="glass-card mb-8 p-8 animate-float-delayed">
                <form onSubmit={handleUploadCSV} className="space-y-4">
                  <h3 className="text-xl font-bold text-slate-800 mb-4">Upload Vital Signs CSV</h3>

                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">
                      Select File
                    </label>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      className="w-full px-4 py-2 bg-white/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 backdrop-blur-sm file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-100 file:text-emerald-600"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      disabled={isUploading}
                      className="bg-emerald-600 text-white py-2 px-6 rounded-xl hover:bg-emerald-700 transition disabled:opacity-50 shadow-lg hover:shadow-emerald-500/20"
                    >
                      {isUploading ? 'Uploading...' : 'Upload'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowUploadForm(false)}
                      className="bg-slate-200 text-slate-700 py-2 px-6 rounded-xl hover:bg-slate-300 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="p-4 bg-red-50/90 backdrop-blur border border-red-200 rounded-xl flex items-center gap-3 mb-8">
                <AlertCircle className="text-red-600" size={24} />
                <p className="text-red-700">{error}</p>
              </div>
            )}

            {/* Loading State */}
            {isLoading ? (
              <div className="glass-panel p-8 text-center">
                <Spinner size="lg" message="Loading vitals..." />
              </div>
            ) : vitals.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="No vital signs recorded yet"
                message="Upload a CSV file to get started"
              />
            ) : (
              <div className="glass-panel overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50/50 border-b border-slate-200/50">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Date & Time</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Heart Rate</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Blood Pressure</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Oxygen Level</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Temperature</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Respiratory Rate</th>
                                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Status</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/50">
                      {vitals.map((vital, idx) => (
                        <tr key={idx} className="hover:bg-white/40 transition-colors">
                          <td className="px-6 py-4 text-sm text-slate-700">
                            {new Date(vital.recorded_at || vital.timestamp).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">{vital.heartRate} bpm</td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {vital.systolicBP}/{vital.diastolicBP}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">{vital.oxygenLevel}%</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{vital.temperature}°F</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{vital.respiratoryRate} /min</td>
                                                    <td className="px-6 py-4">
                                                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                                        vital.status === 'CRITICAL' 
                                                          ? 'bg-red-100 text-red-700 border border-red-300' 
                                                          : 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                                                      }`}>
                                                        {vital.status || 'NORMAL'}
                                                      </span>
                                                    </td>
                          <td className="px-6 py-4 text-sm text-slate-500 italic">
                            {vital.notes || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
    </ProtectedLayout>
  );
}
