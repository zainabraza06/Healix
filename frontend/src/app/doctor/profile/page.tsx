'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/authStore';
import { apiClient } from '@/lib/apiClient';
import ProtectedLayout from '@/components/ProtectedLayout';
import toast from 'react-hot-toast';
import { User, Edit2, Save, AlertCircle } from 'lucide-react';

export default function DoctorProfilePage() {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    specialization: '',
    licenseNumber: '',
    yearsOfExperience: '',
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.getDoctorProfile();
      if (response.success && response.data) {
        setProfile(response.data);
        setFormData({
          firstName: response.data.firstName || '',
          lastName: response.data.lastName || '',
          email: response.data.email || '',
          phoneNumber: response.data.phoneNumber || '',
          specialization: response.data.specialization || '',
          licenseNumber: response.data.licenseNumber || '',
          yearsOfExperience: response.data.yearsOfExperience?.toString() || '',
        });
      } else {
        setError(response.message || 'Failed to load profile');
      }
    } catch (err) {
      setError('An error occurred while fetching profile');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const response = await apiClient.updateDoctorProfile(formData);
      if (response.success) {
        toast.success('Profile updated successfully');
        setProfile(response.data);
        setIsEditing(false);
      } else {
        toast.error(response.message || 'Failed to update profile');
      }
    } catch (err) {
      toast.error('An error occurred while saving');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ProtectedLayout allowedRoles={['DOCTOR']}>
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-4xl font-bold text-gray-800 mb-2">My Profile</h1>
              <p className="text-gray-600">View and manage your profile information</p>
            </div>

            {isLoading ? (
              <div className="card bg-white text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-4">Loading profile...</p>
              </div>
            ) : error ? (
              <div className="card bg-red-50 border-2 border-red-200 flex items-center gap-3">
                <AlertCircle className="text-red-600" size={24} />
                <p className="text-red-700">{error}</p>
              </div>
            ) : (
              <div className="card bg-white">
                {/* Header with Edit Button */}
                <div className="flex justify-between items-center mb-6 pb-6 border-b-2 border-gray-200">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="text-blue-600" size={32} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-800">
                        Dr. {profile?.firstName} {profile?.lastName}
                      </h2>
                      <p className="text-gray-600">{profile?.specialization}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (isEditing) {
                        setFormData({
                          firstName: profile?.firstName || '',
                          lastName: profile?.lastName || '',
                          email: profile?.email || '',
                          phoneNumber: profile?.phoneNumber || '',
                          specialization: profile?.specialization || '',
                          licenseNumber: profile?.licenseNumber || '',
                          yearsOfExperience: profile?.yearsOfExperience?.toString() || '',
                        });
                      }
                      setIsEditing(!isEditing);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 font-semibold"
                  >
                    <Edit2 size={18} />
                    {isEditing ? 'Cancel' : 'Edit'}
                  </button>
                </div>

                {/* Profile Information */}
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-2">
                        First Name
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <p className="text-gray-800 font-semibold">{profile?.firstName}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-2">
                        Last Name
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <p className="text-gray-800 font-semibold">{profile?.lastName}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-2">
                        Phone Number
                      </label>
                      {isEditing ? (
                        <input
                          type="tel"
                          name="phoneNumber"
                          value={formData.phoneNumber}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <p className="text-gray-800 font-semibold">{profile?.phoneNumber}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-2">
                        License Number
                      </label>
                      <p className="text-gray-800 font-semibold">{profile?.licenseNumber}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-2">
                        Specialization
                      </label>
                      {isEditing ? (
                        <select
                          name="specialization"
                          value={formData.specialization}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select Specialization</option>
                          <option value="Cardiology">Cardiology</option>
                          <option value="Dermatology">Dermatology</option>
                          <option value="Neurology">Neurology</option>
                          <option value="Orthopedics">Orthopedics</option>
                          <option value="Pediatrics">Pediatrics</option>
                          <option value="General Practice">General Practice</option>
                        </select>
                      ) : (
                        <p className="text-gray-800 font-semibold">{profile?.specialization}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-2">
                        Years of Experience
                      </label>
                      {isEditing ? (
                        <input
                          type="number"
                          name="yearsOfExperience"
                          value={formData.yearsOfExperience}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <p className="text-gray-800 font-semibold">{profile?.yearsOfExperience} years</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Email</label>
                    <p className="text-gray-800 font-semibold">{profile?.email}</p>
                  </div>

                  {isEditing && (
                    <div className="flex gap-2 pt-4 border-t-2 border-gray-200">
                      <button
                        onClick={handleSaveProfile}
                        disabled={isSaving}
                        className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <Save size={20} />
                        {isSaving ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        onClick={() => setIsEditing(false)}
                        className="flex-1 bg-gray-300 text-gray-800 py-3 px-4 rounded-lg hover:bg-gray-400 transition font-semibold"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
    </ProtectedLayout>
  );
}
