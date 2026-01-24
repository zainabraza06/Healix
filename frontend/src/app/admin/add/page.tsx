'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';
import toast from 'react-hot-toast';
import { User, Mail, Phone, MapPin, Calendar, Shield, Heart } from 'lucide-react';
import { validateRegistration } from '@/lib/validation';
import dynamic from 'next/dynamic';

// Dynamically import 3D components to avoid SSR issues
const Scene = dynamic(() => import('@/components/canvas/Scene'), { ssr: false });
const FloatingIcons = dynamic(() => import('@/components/canvas/FloatingIcons').then(mod => mod.FloatingIcons), { ssr: false });

export default function AddAdminPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phoneNumber: '',
    dateOfBirth: '',
    gender: '',
    bloodType: '',
    address: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactEmail: '',
    emergencyContactRelationship: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Validate form
    const validationErrors = validateRegistration(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast.error('Please fix the form errors');
      return;
    }

    setIsSubmitting(true);

    try {
      const adminData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        phoneNumber: formData.phoneNumber,
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender,
        bloodType: formData.bloodType,
        address: formData.address,
        emergencyContactName: formData.emergencyContactName,
        emergencyContactPhone: formData.emergencyContactPhone,
        emergencyContactEmail: formData.emergencyContactEmail,
        emergencyContactRelationship: formData.emergencyContactRelationship,
      };

      console.log("adminData", adminData);

      const response = await apiClient.registerAdmin(adminData);

      if (response.success) {
        toast.success('Admin created successfully! This is the only admin account allowed.');
        router.push('/admin/dashboard');
      } else {
        toast.error(response.message || 'Failed to create admin');
      }
    } catch (err: any) {
      const apiMessage = err.response?.data?.message || err.response?.data?.error;
      const errorMessage = apiMessage || err.message || 'An error occurred while creating admin';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-50">
      {/* 3D Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <Scene className="h-full w-full">
          <FloatingIcons />
        </Scene>
      </div>

      {/* Glass Gradient Overlay for text readability */}
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-white/0 via-transparent to-white/60 pointer-events-none" />

      <div className="relative z-10 container-main py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-slate-800 mb-2">Create System Admin</h1>
            <p className="text-slate-600">
              Create the system administrator account. <strong>Note:</strong> Only one admin account is allowed.
            </p>
          </div>

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="glass-card p-8">
            {/* Personal Information */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-600" />
                Personal Information
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2 bg-white/50 border ${errors.firstName ? 'border-red-500' : 'border-slate-200'
                      } rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                    required
                  />
                  {errors.firstName && (
                    <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2 bg-white/50 border ${errors.lastName ? 'border-red-500' : 'border-slate-200'
                      } rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                    required
                  />
                  {errors.lastName && (
                    <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Date of Birth <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-white/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Gender <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-white/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    <Heart className="w-4 h-4 inline mr-1" />
                    Blood Type
                  </label>
                  <select
                    name="bloodType"
                    value={formData.bloodType}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-white/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select Blood Type</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Mail className="w-5 h-5 text-emerald-600" />
                Contact Information
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2 bg-white/50 border ${errors.email ? 'border-red-500' : 'border-slate-200'
                      } rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                    required
                  />
                  {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    <Phone className="w-4 h-4 inline mr-1" />
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-white/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-white/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    rows={3}
                    required
                  ></textarea>
                </div>
              </div>
            </div>

            {/* Security */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-600" />
                Security
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2 bg-white/50 border ${errors.password ? 'border-red-500' : 'border-slate-200'
                      } rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                    required
                  />
                  {errors.password && (
                    <p className="text-red-500 text-sm mt-1">{errors.password}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2 bg-white/50 border ${errors.confirmPassword ? 'border-red-500' : 'border-slate-200'
                      } rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                    required
                  />
                  {errors.confirmPassword && (
                    <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-slate-800 mb-4">Emergency Contact</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Contact Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="emergencyContactName"
                    value={formData.emergencyContactName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-white/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Contact Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="emergencyContactPhone"
                    value={formData.emergencyContactPhone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-white/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    name="emergencyContactEmail"
                    value={formData.emergencyContactEmail}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-white/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Relationship <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="emergencyContactRelationship"
                    value={formData.emergencyContactRelationship}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-white/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 btn-primary"
              >
                {isSubmitting ? 'Creating Admin...' : 'Create Admin'}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
