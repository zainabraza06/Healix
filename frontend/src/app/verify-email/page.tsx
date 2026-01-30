'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import { CheckCircle, XCircle, Loader, Mail } from 'lucide-react';
import Link from 'next/link';

const Scene = dynamic(() => import('@/components/canvas/Scene'), { ssr: false });
const FloatingIcons = dynamic(() => import('@/components/canvas/FloatingIcons'), { ssr: false });

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [isResending, setIsResending] = useState(false);

  // Use a ref to ensure the API call only happens once, even in React Strict Mode
  const verificationAttempted = useRef(false);

  useEffect(() => {
    // Only proceed if we haven't attempted verification in this mount cycle
    if (verificationAttempted.current) return;

    const token = searchParams.get('token');

    if (!token) {
      setVerificationStatus('error');
      setMessage('No verification token found in URL.');
      return;
    }

    // Mark as attempted synchronously before the async call
    verificationAttempted.current = true;
    verifyEmail(token);
  }, [searchParams]);

  const verifyEmail = async (token: string) => {
    try {
      const response = await apiClient.verifyEmail(token);

      if (response.success) {
        setVerificationStatus('success');
        setMessage(response.message || 'Email verified successfully! You can now login.');
        toast.success('Email verified successfully!');

        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      } else {
        setVerificationStatus('error');
        setMessage(response.message || 'Verification failed. The token may be invalid or expired.');
      }
    } catch (error: any) {
      // If the verification was actually successful (token might have been deleted by first concurrent request)
      // but the UI is showing error, we check if the user is already verified?
      // Actually, if it failed here, it's likely a 400 Bad Request from backend.

      setVerificationStatus('error');
      setMessage(error.response?.data?.message || 'An error occurred during verification.');
      toast.error('Verification failed');
    }
  };

  const handleResendVerification = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error('Please enter your email address');
      return;
    }

    setIsResending(true);
    try {
      const response = await apiClient.renewVerificationToken(email);

      if (response.success) {
        toast.success('Verification email sent! Please check your inbox.');
        setEmail('');
      } else {
        toast.error(response.message || 'Failed to resend verification email');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'An error occurred');
    } finally {
      setIsResending(false);
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
        <div className="glass-card p-8 sm:p-10 text-center">

          {verificationStatus === 'loading' && (
            <>
              <div className="flex justify-center mb-6">
                <Loader className="w-16 h-16 text-emerald-600 animate-spin" />
              </div>
              <h1 className="text-2xl font-bold text-slate-800 mb-2">Verifying Your Email</h1>
              <p className="text-slate-600">Please wait while we verify your email address...</p>
            </>
          )}

          {verificationStatus === 'success' && (
            <>
              <div className="flex justify-center mb-6">
                <CheckCircle className="w-16 h-16 text-emerald-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-800 mb-2">Email Verified!</h1>
              <p className="text-slate-600 mb-6">{message}</p>
              <p className="text-sm text-slate-500 mb-4">Redirecting to login page...</p>
              <Link
                href="/login"
                className="inline-block px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition"
              >
                Go to Login
              </Link>
            </>
          )}

          {verificationStatus === 'error' && (
            <>
              <div className="flex justify-center mb-6">
                <XCircle className="w-16 h-16 text-red-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-800 mb-2">Verification Failed</h1>
              <p className="text-slate-600 mb-8">{message}</p>

              {/* Resend Verification Form */}
              <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <Mail className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-lg font-semibold text-slate-800">Resend Verification Email</h2>
                </div>
                <form onSubmit={handleResendVerification} className="space-y-4">
                  <div className="text-left">
                    <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isResending}
                    className="w-full px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isResending ? (
                      <>
                        <Loader className="w-5 h-5 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="w-5 h-5" />
                        Resend Verification Email
                      </>
                    )}
                  </button>
                </form>
              </div>

              <div className="mt-6">
                <Link
                  href="/login"
                  className="text-emerald-600 hover:text-emerald-700 font-semibold transition"
                >
                  Back to Login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
