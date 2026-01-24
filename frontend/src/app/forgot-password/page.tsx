'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/apiClient';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import { ArrowLeft, Loader, Mail, CheckCircle } from 'lucide-react';

const Scene = dynamic(() => import('@/components/canvas/Scene'), { ssr: false });
const FloatingIcons = dynamic(() => import('@/components/canvas/FloatingIcons').then(mod => mod.FloatingIcons), { ssr: false });

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error('Please enter your email address');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiClient.forgotPassword(email);

      if (response.success) {
        setEmailSent(true);
        toast.success('Password reset email sent! Please check your inbox.');
      } else {
        toast.error(response.message || 'Failed to send password reset email');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'An error occurred');
    } finally {
      setIsLoading(false);
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
        <Link href="/login" className="inline-flex items-center text-sm font-medium text-emerald-700 mb-6 hover:text-emerald-800 transition">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Login
        </Link>
        
        <div className="glass-card p-8 sm:p-10">
          {!emailSent ? (
            <>
              <div className="text-center mb-8">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center">
                    <Mail className="w-8 h-8 text-emerald-600" />
                  </div>
                </div>
                <h1 className="text-3xl font-bold text-slate-800 mb-2">Forgot Password?</h1>
                <p className="text-slate-600">
                  No worries, we'll send you reset instructions.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    className="w-full px-4 py-3 bg-white/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="w-5 h-5" />
                      Send Reset Link
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <CheckCircle className="w-16 h-16 text-emerald-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-800 mb-2">Check Your Email</h1>
              <p className="text-slate-600 mb-6">
                We've sent a password reset link to <strong>{email}</strong>
              </p>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 text-left">
                <p className="text-sm text-slate-700">
                  <strong>Didn't receive the email?</strong>
                </p>
                <ul className="text-sm text-slate-600 mt-2 space-y-1 list-disc list-inside">
                  <li>Check your spam or junk folder</li>
                  <li>Make sure you entered the correct email</li>
                  <li>Wait a few minutes and try again</li>
                </ul>
              </div>
              <button
                onClick={() => setEmailSent(false)}
                className="text-emerald-600 hover:text-emerald-700 font-semibold transition"
              >
                Try another email address
              </button>
            </div>
          )}

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
