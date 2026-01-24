'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/authStore';
import Link from 'next/link';
import { Loader, LogIn, AlertCircle, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';

const Scene = dynamic(() => import('@/components/canvas/Scene'), { ssr: false });
const FloatingIcons = dynamic(() => import('@/components/canvas/FloatingIcons').then(mod => mod.FloatingIcons), { ssr: false });

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, error, user } = useAuthStore();
  const [formData, setFormData] = useState({ email: '', password: '' });

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      const redirectMap: Record<string, string> = {
        ADMIN: '/admin/dashboard',
        DOCTOR: '/doctor/dashboard',
        PATIENT: '/patient/dashboard',
      };
      router.push(redirectMap[user.role] || '/');
    }
  }, [user, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      const user = await login(formData.email, formData.password);
      toast.success('Login successful!');

      const role = user?.role;
      const redirectMap: Record<string, string> = {
        ADMIN: '/admin/dashboard',
        DOCTOR: '/doctor/dashboard',
        PATIENT: '/patient/dashboard',
      };

      const target = redirectMap[role] || '/';
      router.push(target);
    } catch (err: any) {
      toast.error(err.message || 'Login failed');
    }
  };

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
        <Link href="/" className="inline-flex items-center text-sm font-medium text-emerald-700 mb-6 hover:text-emerald-800 transition">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Home
        </Link>

        {/* Login Card */}
        <div className="glass-card p-8 sm:p-10">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-800 mb-2">Welcome Back</h1>
            <p className="text-slate-600">Sign in to your Healix account</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50/80 border border-red-200 rounded-xl flex gap-3 text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="your@email.com"
                className="w-full px-4 py-3 bg-white/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition shadow-sm"
                required
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                >
                  Forgot Password?
                </Link>
              </div>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-white/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition shadow-sm"
                required
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary py-3.5 text-lg flex items-center justify-center gap-2 mt-4"
            >
              {isLoading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Logging in...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Log In
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-8 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-white/0 text-slate-400 font-medium bg-slate-50 rounded-full">New to Healix?</span>
            </div>
          </div>

          <Link
            href="/register"
            className="w-full block text-center btn-secondary py-3 text-emerald-700"
          >
            Create New Account
          </Link>
        </div>

        {/* Demo Credentials */}
        <div className="mt-8 p-6 glass-panel">
          <p className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Demo Credentials</p>
          <div className="space-y-2 text-sm text-slate-600 font-mono bg-white/50 p-3 rounded-lg border border-slate-100 table w-full">
            <div className="table-row">
              <span className="table-cell font-semibold pr-4 text-emerald-700">Patient:</span>
              <span className="table-cell">patient@example.com</span>
              <span className="table-cell text-slate-400">/</span>
              <span className="table-cell">password123</span>
            </div>
            <div className="table-row">
              <span className="table-cell font-semibold pr-4 text-emerald-700">Doctor:</span>
              <span className="table-cell">doctor@example.com</span>
              <span className="table-cell text-slate-400">/</span>
              <span className="table-cell">password123</span>
            </div>
            <div className="table-row">
              <span className="table-cell font-semibold pr-4 text-emerald-700">Admin:</span>
              <span className="table-cell">admin@example.com</span>
              <span className="table-cell text-slate-400">/</span>
              <span className="table-cell">password123</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
