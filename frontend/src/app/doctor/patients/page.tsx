'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import ProtectedLayout from '@/components/ProtectedLayout';
import toast from 'react-hot-toast';
import { User, Phone, MapPin, AlertCircle } from 'lucide-react';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';

export default function DoctorPatientsPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.getDoctorPatients();
      if (response.success && response.data) {
        setPatients(response.data.patients || response.data || []);
      } else {
        setError(response.message || 'Failed to load patients');
      }
    } catch (err) {
      setError('An error occurred while fetching patients');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewVitals = async (patientId: string) => {
    try {
      const response = await apiClient.getPatientVitals(patientId);
      if (response.success) {
        toast.success('Vitals loaded');
        setSelectedPatient({
          ...patients.find((p) => p.id === patientId),
          vitals: response.data,
        });
      }
    } catch (err) {
      toast.error('Failed to load vitals');
    }
  };

  const filteredPatients = patients.filter(
    (patient) =>
      patient.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <ProtectedLayout allowedRoles={['DOCTOR']}>
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-4xl font-bold text-gray-800 mb-2">My Patients</h1>
              <p className="text-gray-600">Manage and monitor your patients</p>
            </div>

            {/* Search */}
            <div className="mb-8">
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Patient List */}
              <div className="lg:col-span-2">
                {isLoading ? (
                  <div className="card bg-white">
                    <Spinner size="lg" message="Loading patients..." />
                  </div>
                ) : error ? (
                  <div className="card bg-red-50 border-2 border-red-200 flex items-center gap-3">
                    <AlertCircle className="text-red-600" size={24} />
                    <p className="text-red-700">{error}</p>
                  </div>
                ) : filteredPatients.length === 0 ? (
                  <EmptyState
                    icon={User}
                    title="No patients found"
                  />
                ) : (
                  <div className="space-y-4">
                    {filteredPatients.map((patient) => (
                      <div
                        key={patient.id}
                        onClick={() => setSelectedPatient(patient)}
                        className={`card cursor-pointer transition border-l-4 ${
                          selectedPatient?.id === patient.id
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-300 hover:border-blue-600'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">
                              {patient.firstName} {patient.lastName}
                            </h3>
                            <div className="space-y-1 text-gray-600 text-sm">
                              <p className="flex items-center gap-2">
                                <span className="font-medium">Email:</span> {patient.email}
                              </p>
                              {patient.phoneNumber && (
                                <p className="flex items-center gap-2">
                                  <Phone size={16} />
                                  {patient.phoneNumber}
                                </p>
                              )}
                              {patient.address && (
                                <p className="flex items-center gap-2">
                                  <MapPin size={16} />
                                  {patient.address}
                                </p>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewVitals(patient.id);
                            }}
                            className="px-4 py-2 bg-blue-100 text-blue-600 hover:bg-blue-200 rounded-lg transition font-semibold text-sm"
                          >
                            View Vitals
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Patient Details */}
              <div>
                {selectedPatient ? (
                  <div className="card bg-white sticky top-4">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">
                      {selectedPatient.firstName} {selectedPatient.lastName}
                    </h2>

                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-gray-600">Email</p>
                        <p className="font-semibold text-gray-800">{selectedPatient.email}</p>
                      </div>

                      {selectedPatient.phoneNumber && (
                        <div>
                          <p className="text-sm text-gray-600">Phone</p>
                          <p className="font-semibold text-gray-800">{selectedPatient.phoneNumber}</p>
                        </div>
                      )}

                      {selectedPatient.dateOfBirth && (
                        <div>
                          <p className="text-sm text-gray-600">Date of Birth</p>
                          <p className="font-semibold text-gray-800">
                            {new Date(selectedPatient.dateOfBirth).toLocaleDateString()}
                          </p>
                        </div>
                      )}

                      {selectedPatient.gender && (
                        <div>
                          <p className="text-sm text-gray-600">Gender</p>
                          <p className="font-semibold text-gray-800">{selectedPatient.gender}</p>
                        </div>
                      )}

                      {selectedPatient.address && (
                        <div>
                          <p className="text-sm text-gray-600">Address</p>
                          <p className="font-semibold text-gray-800">{selectedPatient.address}</p>
                        </div>
                      )}

                      {selectedPatient.vitals && (
                        <div className="mt-6 pt-6 border-t-2 border-gray-200">
                          <h3 className="font-semibold text-gray-800 mb-3">Latest Vitals</h3>
                          <div className="space-y-2 text-sm">
                            {selectedPatient.vitals.heartRate && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Heart Rate:</span>
                                <span className="font-semibold">{selectedPatient.vitals.heartRate} bpm</span>
                              </div>
                            )}
                            {selectedPatient.vitals.bloodPressure && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Blood Pressure:</span>
                                <span className="font-semibold">{selectedPatient.vitals.bloodPressure}</span>
                              </div>
                            )}
                            {selectedPatient.vitals.temperature && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Temperature:</span>
                                <span className="font-semibold">{selectedPatient.vitals.temperature}°C</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <button className="w-full mt-6 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition font-semibold">
                        Create Prescription
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="card bg-gray-50 text-center py-12">
                    <User size={48} className="mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600">Select a patient to view details</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
    </ProtectedLayout>
  );
}
