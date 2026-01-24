'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/authStore';
import { apiClient } from '@/lib/apiClient';
import ProtectedLayout from '@/components/ProtectedLayout';
import toast from 'react-hot-toast';
import { User, Edit2, Save, AlertCircle } from 'lucide-react';

export default function PatientProfilePage() {
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
    dateOfBirth: '',
    gender: '',
    address: '',
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.getPatientProfile();
      if (response.success && response.data) {
        setProfile(response.data);
        setFormData({
          firstName: response.data.firstName || '',
          lastName: response.data.lastName || '',
          email: response.data.email || '',
          phoneNumber: response.data.phoneNumber || '',
          dateOfBirth: response.data.dateOfBirth || '',
          gender: response.data.gender || '',
          address: response.data.address || '',
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
      const response = await apiClient.updatePatientProfile(formData);
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
    <ProtectedLayout allowedRoles={['PATIENT']}>
      <div className="container-main py-8">
          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-4xl font-bold text-slate-800 mb-2">My Profile</h1>
              <p className="text-slate-600">View and manage your profile information</p>
            </div>

            {isLoading ? (
              <div className="glass-panel text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
                <p className="text-slate-600 mt-4">Loading profile...</p>
              </div>
            ) : error ? (
              <div className="p-4 bg-red-50/90 backdrop-blur border border-red-200 rounded-xl flex items-center gap-3">
                <AlertCircle className="text-red-600" size={24} />
                <p className="text-red-700">{error}</p>
              </div>
            ) : (
              <div className="glass-card p-8 animate-float-delayed">
                {/* Header with Edit Button */}
                <div className="flex justify-between items-center mb-8 pb-6 border-b border-slate-200/50">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-full flex items-center justify-center shadow-inner">
                      <User className="text-emerald-600" size={32} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-800">
                        {profile?.firstName} {profile?.lastName}
                      </h2>
                      <p className="text-slate-500">{profile?.email}</p>
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
                          dateOfBirth: profile?.dateOfBirth || '',
                          gender: profile?.gender || '',
                          address: profile?.address || '',
                        });
                      }
                      setIsEditing(!isEditing);
                    }}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition flex items-center gap-2 font-semibold shadow-lg hover:shadow-emerald-500/20"
                  >
                    <Edit2 size={18} />
                    {isEditing ? 'Cancel' : 'Edit Profile'}
                  </button>
                </div>

                {/* Profile Information */}
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-2">
                        First Name
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2 bg-white/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 backdrop-blur-sm"
                        />
                      ) : (
                        <p className="text-slate-800 font-semibold text-lg">{profile?.firstName}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-2">
                        Last Name
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2 bg-white/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 backdrop-blur-sm"
                        />
                      ) : (
                        <p className="text-slate-800 font-semibold text-lg">{profile?.lastName}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-2">
                        Phone Number
                      </label>
                      {isEditing ? (
                        <input
                          type="tel"
                          name="phoneNumber"
                          value={formData.phoneNumber}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2 bg-white/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 backdrop-blur-sm"
                        />
                      ) : (
                        <p className="text-slate-800 font-semibold text-lg">{profile?.phoneNumber}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-2">
                        Gender
                      </label>
                      {isEditing ? (
                        <select
                          name="gender"
                          value={formData.gender}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2 bg-white/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 backdrop-blur-sm"
                        >
                          <option value="">Select</option>
                          <option value="MALE">Male</option>
                          <option value="FEMALE">Female</option>
                          <option value="OTHER">Other</option>
                        </select>
                      ) : (
                        <p className="text-slate-800 font-semibold text-lg">{profile?.gender}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-2">
                        Date of Birth
                      </label>
                      {isEditing ? (
                        <input
                          type="date"
                          name="dateOfBirth"
                          value={formData.dateOfBirth}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2 bg-white/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 backdrop-blur-sm"
                        />
                      ) : (
                        <p className="text-slate-800 font-semibold text-lg">
                          {profile?.dateOfBirth
                            ? new Date(profile.dateOfBirth).toLocaleDateString()
                            : '-'}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-2">Email</label>
                      <p className="text-slate-800 font-semibold text-lg">{profile?.email}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">Address</label>
                    {isEditing ? (
                      <textarea
                        name="address"
                        value={formData.address}
                        onChange={handleInputChange}
                        rows={3}
                        className="w-full px-4 py-2 bg-white/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 backdrop-blur-sm"
                      />
                    ) : (
                      <p className="text-slate-800 font-semibold text-lg">{profile?.address}</p>
                    )}
                  </div>

                  {isEditing && (
                    <div className="flex gap-3 pt-6 border-t border-slate-200/50">
                      <button
                        onClick={handleSaveProfile}
                        disabled={isSaving}
                        className="flex-1 bg-emerald-600 text-white py-3 px-4 rounded-xl hover:bg-emerald-700 transition font-semibold flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg hover:shadow-emerald-500/20"
                      >
                        <Save size={20} />
                        {isSaving ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        onClick={() => setIsEditing(false)}
                        className="flex-1 bg-slate-200 text-slate-700 py-3 px-4 rounded-xl hover:bg-slate-300 transition font-semibold"
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
