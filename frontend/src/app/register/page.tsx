'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import { ArrowLeft, Loader, User, Stethoscope } from 'lucide-react';

const Scene = dynamic(() => import('@/components/canvas/Scene'), { ssr: false });
const FloatingIcons = dynamic(() => import('@/components/canvas/FloatingIcons').then(mod => mod.FloatingIcons), { ssr: false });

export default function RegisterPage() {
  const router = useRouter();
  const [userType, setUserType] = useState<'patient' | 'doctor'>('patient');
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phoneNumber: '',
    dateOfBirth: '',
    gender: '',
    address: '',
    yearsOfExperience: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactEmail: '',
    emergencyContactRelationship: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    if (!formData.phoneNumber.trim()) newErrors.phoneNumber = 'Phone number is required';
    if (!formData.dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required';
    if (!formData.gender) newErrors.gender = 'Gender is required';
    if (!formData.address.trim()) newErrors.address = 'Address is required';
    if (!formData.emergencyContactName.trim()) newErrors.emergencyContactName = 'Emergency contact name is required';
    if (!formData.emergencyContactPhone.trim()) newErrors.emergencyContactPhone = 'Emergency contact phone is required';
    if (!formData.emergencyContactRelationship.trim()) newErrors.emergencyContactRelationship = 'Relationship is required';

    if (userType === 'doctor') {
      if (!formData.licenseNumber.trim()) newErrors.licenseNumber = 'License number is required';
      if (!formData.specialization) newErrors.specialization = 'Specialization is required';
      if (!formData.qualifications.trim()) newErrors.qualifications = 'Qualifications are required';
      if (!formData.yearsOfExperience) newErrors.yearsOfExperience = 'Years of experience is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
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

    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    setIsLoading(true);
    try {
      const payload = userType === 'patient' ? {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        phoneNumber: formData.phoneNumber,
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender,
        address: formData.address,
        emergencyContactName: formData.emergencyContactName,
        emergencyContactPhone: formData.emergencyContactPhone,
        emergencyContactEmail: formData.emergencyContactEmail,
        emergencyContactRelationship: formData.emergencyContactRelationship,
      } : {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        phoneNumber: formData.phoneNumber,
        licenseNumber: formData.licenseNumber,
        specialization: formData.specialization,
        qualifications: formData.qualifications,
        qualifications: formData.qualifications,
        yearsOfExperience: parseInt(formData.yearsOfExperience),
        emergencyContactName: formData.emergencyContactName,
        emergencyContactPhone: formData.emergencyContactPhone,
        emergencyContactEmail: formData.emergencyContactEmail,
        emergencyContactRelationship: formData.emergencyContactRelationship,
      };

      const response = userType === 'patient'
        ? await apiClient.registerPatient(payload as any)
        : await apiClient.registerDoctor(payload as any);

      if (response.success) {
        if (userType === 'doctor') {
          toast.success('Registration successful! Your application is under review.');
        } else {
          toast.success('Patient registration successful! Please check your email to verify.');
        }
        router.push('/login');
      } else {
        toast.error(response.message || 'Registration failed');
      }
    } catch (error) {
      const message =
        (error as any)?.response?.data?.message ||
        (error as any)?.response?.data?.error ||
        (error as any)?.message ||
        'An error occurred during registration';
      toast.error(message);
      console.error('Registration error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-50 flex items-center justify-center p-4 py-10">

      {/* 3D Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <Scene className="h-full w-full">
          <FloatingIcons />
        </Scene>
      </div>
      <div className="fixed inset-0 z-0 bg-gradient-to-br from-white/10 to-emerald-50/30 backdrop-blur-[1px] pointer-events-none" />

      <div className="w-full max-w-2xl relative z-10 animate-fade-in-up">
        <Link href="/" className="inline-flex items-center text-sm font-medium text-emerald-700 mb-6 hover:text-emerald-800 transition">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Home
        </Link>
        <div className="glass-card p-8 sm:p-10">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-800 mb-2">Create Account</h1>
            <p className="text-slate-600">Join Healix today as a patient or a doctor</p>
          </div>

          {/* User Type Selection */}
          <div className="flex gap-4 mb-8 bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => { setUserType('patient'); setErrors({}); }}
              className={`flex-1 py-3 px-4 rounded-xl font-semibold transition flex items-center justify-center gap-2 ${userType === 'patient'
                ? 'bg-white text-emerald-700 shadow-md'
                : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              <User className="w-4 h-4" />
              Patient
            </button>
            <button
              type="button"
              onClick={() => { setUserType('doctor'); setErrors({}); }}
              className={`flex-1 py-3 px-4 rounded-xl font-semibold transition flex items-center justify-center gap-2 ${userType === 'doctor'
                ? 'bg-white text-emerald-700 shadow-md'
                : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              <Stethoscope className="w-4 h-4" />
              Doctor
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Basic Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">First Name</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  placeholder="John"
                  className={`w-full px-4 py-3 bg-white/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition ${errors.firstName ? 'border-red-500' : 'border-slate-200'
                    }`}
                />
                {errors.firstName && <p className="text-red-500 text-xs mt-1 font-medium">{errors.firstName}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  placeholder="Doe"
                  className={`w-full px-4 py-3 bg-white/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition ${errors.lastName ? 'border-red-500' : 'border-slate-200'
                    }`}
                />
                {errors.lastName && <p className="text-red-500 text-xs mt-1 font-medium">{errors.lastName}</p>}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="john@example.com"
                className={`w-full px-4 py-3 bg-white/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition ${errors.email ? 'border-red-500' : 'border-slate-200'
                  }`}
              />
              {errors.email && <p className="text-red-500 text-xs mt-1 font-medium">{errors.email}</p>}
            </div>

            {/* Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="••••••"
                  className={`w-full px-4 py-3 bg-white/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition ${errors.password ? 'border-red-500' : 'border-slate-200'
                    }`}
                />
                {errors.password && <p className="text-red-500 text-xs mt-1 font-medium">{errors.password}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="••••••"
                  className={`w-full px-4 py-3 bg-white/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition ${errors.confirmPassword ? 'border-red-500' : 'border-slate-200'
                    }`}
                />
                {errors.confirmPassword && (
                  <p className="text-red-500 text-xs mt-1 font-medium">{errors.confirmPassword}</p>
                )}
              </div>
            </div>

            {/* Phone & Gender */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleInputChange}
                  placeholder="+1 234 567 8900"
                  className={`w-full px-4 py-3 bg-white/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition ${errors.phoneNumber ? 'border-red-500' : 'border-slate-200'
                    }`}
                />
                {errors.phoneNumber && <p className="text-red-500 text-xs mt-1 font-medium">{errors.phoneNumber}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Gender</label>
                <div className="relative">
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-3 bg-white/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none transition ${errors.gender ? 'border-red-500' : 'border-slate-200'
                      }`}
                  >
                    <option value="">Select Gender</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                  </div>
                </div>
                {errors.gender && <p className="text-red-500 text-xs mt-1 font-medium">{errors.gender}</p>}
              </div>
            </div>

            {/* Date of Birth */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Date of Birth</label>
              <input
                type="date"
                name="dateOfBirth"
                value={formData.dateOfBirth}
                onChange={handleInputChange}
                className={`w-full px-4 py-3 bg-white/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition ${errors.dateOfBirth ? 'border-red-500' : 'border-slate-200'
                  }`}
              />
              {errors.dateOfBirth && <p className="text-red-500 text-xs mt-1 font-medium">{errors.dateOfBirth}</p>}
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Address</label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="Enter your address"
                rows={2}
                className={`w-full px-4 py-3 bg-white/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition ${errors.address ? 'border-red-500' : 'border-slate-200'
                  }`}
              />
              {errors.address && <p className="text-red-500 text-xs mt-1 font-medium">{errors.address}</p>}
            </div>

            {/* Doctor-specific fields */}
            {userType === 'doctor' && (
              <div className="p-5 bg-blue-50/50 rounded-xl border border-blue-100 space-y-5 animate-fade-in-up">
                <h3 className="font-bold text-blue-900 flex items-center gap-2">
                  <Stethoscope className="w-4 h-4" /> Doctor Credentials
                </h3>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">License Number</label>
                  <input
                    type="text"
                    name="licenseNumber"
                    value={formData.licenseNumber}
                    onChange={handleInputChange}
                    placeholder="LIC123456"
                    className={`w-full px-4 py-3 bg-white/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${errors.licenseNumber ? 'border-red-500' : 'border-slate-200'
                      }`}
                  />
                  {errors.licenseNumber && (
                    <p className="text-red-500 text-xs mt-1 font-medium">{errors.licenseNumber}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Qualifications</label>
                  <input
                    type="text"
                    name="qualifications"
                    value={formData.qualifications}
                    onChange={handleInputChange}
                    placeholder="MBBS, MD, FRCS"
                    className={`w-full px-4 py-3 bg-white/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${errors.qualifications ? 'border-red-500' : 'border-slate-200'
                      }`}
                  />
                  {errors.qualifications && (
                    <p className="text-red-500 text-xs mt-1 font-medium">{errors.qualifications}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Specialization</label>
                    <div className="relative">
                      <select
                        name="specialization"
                        value={formData.specialization}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-3 bg-white/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none transition ${errors.specialization ? 'border-red-500' : 'border-slate-200'
                          }`}
                      >
                        <option value="">Select Specialization</option>
                        <option value="Cardiology">Cardiology</option>
                        <option value="Dermatology">Dermatology</option>
                        <option value="Neurology">Neurology</option>
                        <option value="Orthopedics">Orthopedics</option>
                        <option value="Pediatrics">Pediatrics</option>
                        <option value="General Practice">General Practice</option>
                        <option value="Psychology">Psychology</option>
                        <option value="Oncology">Oncology</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                      </div>
                    </div>
                    {errors.specialization && (
                      <p className="text-red-500 text-xs mt-1 font-medium">{errors.specialization}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Years of Experience</label>
                    <input
                      type="number"
                      name="yearsOfExperience"
                      value={formData.yearsOfExperience}
                      onChange={handleInputChange}
                      placeholder="5"
                      min="0"
                      className={`w-full px-4 py-3 bg-white/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${errors.yearsOfExperience ? 'border-red-500' : 'border-slate-200'
                        }`}
                    />
                    {errors.yearsOfExperience && (
                      <p className="text-red-500 text-xs mt-1 font-medium">{errors.yearsOfExperience}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Emergency Contact */}
            <div className="p-5 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-5 animate-fade-in-up">
              <h3 className="font-bold text-emerald-900 flex items-center gap-2">
                <Users className="w-4 h-4" /> Emergency Contact Info
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Contact Name</label>
                  <input
                    type="text"
                    name="emergencyContactName"
                    value={formData.emergencyContactName}
                    onChange={handleInputChange}
                    placeholder="Jane Doe"
                    className={`w-full px-4 py-3 bg-white/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition ${errors.emergencyContactName ? 'border-red-500' : 'border-slate-200'}`}
                  />
                  {errors.emergencyContactName && <p className="text-red-500 text-xs mt-1">{errors.emergencyContactName}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Contact Phone</label>
                  <input
                    type="tel"
                    name="emergencyContactPhone"
                    value={formData.emergencyContactPhone}
                    onChange={handleInputChange}
                    placeholder="+1 (555) 000-0000"
                    className={`w-full px-4 py-3 bg-white/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition ${errors.emergencyContactPhone ? 'border-red-500' : 'border-slate-200'}`}
                  />
                  {errors.emergencyContactPhone && <p className="text-red-500 text-xs mt-1">{errors.emergencyContactPhone}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Contact Email</label>
                  <input
                    type="email"
                    name="emergencyContactEmail"
                    value={formData.emergencyContactEmail}
                    onChange={handleInputChange}
                    placeholder="jane@example.com"
                    className="w-full px-4 py-3 bg-white/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Relationship</label>
                  <input
                    type="text"
                    name="emergencyContactRelationship"
                    value={formData.emergencyContactRelationship}
                    onChange={handleInputChange}
                    placeholder="Spouse, Parent, etc."
                    className={`w-full px-4 py-3 bg-white/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition ${errors.emergencyContactRelationship ? 'border-red-500' : 'border-slate-200'}`}
                  />
                  {errors.emergencyContactRelationship && <p className="text-red-500 text-xs mt-1">{errors.emergencyContactRelationship}</p>}
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary py-4 text-lg font-bold shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/40 disabled:opacity-50 disabled:cursor-not-allowed mt-8 transition-transform active:scale-[0.98]"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader className="w-5 h-5 animate-spin" /> Registering...
                </span>
              ) : 'Create Account'}
            </button>
          </form>

          {/* Login Link */}
          <p className="text-center text-slate-600 mt-6 font-medium">
            Already have an account?{' '}
            <Link href="/login" className="text-emerald-600 hover:text-emerald-700 font-bold hover:underline decoration-2 underline-offset-2">
              Log In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
