'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/apiClient';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import { ArrowLeft, Loader, Lock, Eye, EyeOff } from 'lucide-react';

const Scene = dynamic(() => import('@/components/canvas/Scene'), { ssr: false });
const FloatingIcons = dynamic(() => import('@/components/canvas/FloatingIcons'), { ssr: false });

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (formData.newPassword.length < 6) {
      newErrors.newPassword = 'Password must be at least 6 characters';
    }
    if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    if (!token) {
      toast.error('Invalid reset link. Please request a new password reset.');
      return;
    }

    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiClient.resetPassword(token, formData.newPassword);

      if (response.success) {
        toast.success('Password reset successfully! You can now login.');
        router.push('/login');
      } else {
        toast.error(response.message || 'Password reset failed');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-slate-50 flex items-center justify-center p-4">
        <div className="fixed inset-0 z-0 pointer-events-none">
          <Scene className="h-full w-full">
            <FloatingIcons />
          </Scene>
        </div>
        <div className="fixed inset-0 z-0 bg-gradient-to-br from-white/10 to-emerald-50/30 backdrop-blur-[1px] pointer-events-none" />

        <div className="w-full max-w-md relative z-10 animate-fade-in-up">
          <div className="glass-card p-8 sm:p-10 text-center">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center">
                <Lock className="w-8 h-8 text-red-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Invalid Reset Link</h1>
            <p className="text-slate-600 mb-6">
              This password reset link is invalid or has expired.
            </p>
            <Link
              href="/forgot-password"
              className="inline-block px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition"
            >
              Request New Reset Link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-50 flex items-center justify-center p-4">
      
      {/* 3D Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <Scene className="h-full w-full">
          <FloatingIcons />
        </Scene>
      </div>
      <div className="fixed inset-0 z-0 bg-gradient-to-br from-white/10 to-emerald-50/30 backdrop-blur-[1px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-fade-in-up">
        <Link href="/login" className="inline-flex items-center text-sm font-medium text-emerald-700 mb-6 hover:text-emerald-800 transition">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Login
        </Link>
        
        <div className="glass-card p-8 sm:p-10">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center">
                <Lock className="w-8 h-8 text-emerald-600" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-slate-800 mb-2">Reset Password</h1>
            <p className="text-slate-600">
              Enter your new password below
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* New Password */}
            <div>
              <label htmlFor="newPassword" className="block text-sm font-semibold text-slate-700 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="newPassword"
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleInputChange}
                  placeholder="Enter new password"
                  className={`w-full px-4 py-3 bg-white/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition pr-12 ${
                    errors.newPassword ? 'border-red-500' : 'border-slate-200'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.newPassword && (
                <p className="text-red-500 text-xs mt-1 font-medium">{errors.newPassword}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Confirm new password"
                  className={`w-full px-4 py-3 bg-white/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition pr-12 ${
                    errors.confirmPassword ? 'border-red-500' : 'border-slate-200'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-500 text-xs mt-1 font-medium">{errors.confirmPassword}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Resetting Password...
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  Reset Password
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link 
              href="/login" 
              className="text-sm text-slate-600 hover:text-slate-800 transition"
            >
              Remember your password? <span className="text-emerald-600 font-semibold">Login</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
