'use client';

import { useAuthStore } from '@/lib/authStore';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import { connectSocket, joinRooms, onAlertAssigned, offAlertAssigned, onAlertResolved, offAlertResolved, onCriticalVitals, offCriticalVitals } from '@/lib/socket';
import ChatModal, { FloatingChatButton } from './ChatModal';

interface ProtectedLayoutProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export default function ProtectedLayout({
  children,
  allowedRoles,
}: ProtectedLayoutProps) {
  const router = useRouter();
  const { user, isCheckAuthLoading } = useAuthStore();
  const [showChatModal, setShowChatModal] = useState(false);

  // Global socket join + lightweight notifications so users see alerts regardless of page
  useEffect(() => {
    if (!user) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') || undefined : undefined;
    const socket = connectSocket(token);
    joinRooms({ role: user.role as any, userId: user.id });

    // Doctor: notify when a new alert is assigned/created for them
    const handleAssigned = (data: any) => {
      toast.custom((t) => (
        <div className="glass-card p-4 border-2 border-emerald-500 shadow-2xl max-w-md" onClick={() => toast.dismiss(t.id)}>
          <p className="text-[11px] uppercase font-black text-emerald-700">New alert assigned</p>
          <p className="text-slate-800 font-bold mt-1">{data.patientName || 'Patient alert'}</p>
          <p className="text-slate-600 text-sm mt-1">{data.message?.split('\n')[0] || 'Critical vitals detected'}</p>
        </div>
      ), { duration: 8000 });
    };

    // Patient: notify when their alert is resolved
    const handleResolved = (data: any) => {
      console.log('Alert resolved received on frontend:', data);
      toast.success('Your alert has been resolved!', { duration: 6000, icon: '✓' });
    };

    // Doctor: also bubble criticalVitals globally (fallback)
    const handleCritical = (data: any) => {
      toast.custom((t) => (
        <div className="glass-card p-4 border-2 border-red-500 shadow-2xl max-w-md" onClick={() => toast.dismiss(t.id)}>
          <p className="text-[11px] uppercase font-black text-red-700">Critical vitals</p>
          <p className="text-slate-800 font-bold mt-1">{data.patient?.name || 'Patient alert'}</p>
          <p className="text-slate-600 text-sm mt-1">{data.alert?.message?.split('\n')[0] || 'Critical alert received'}</p>
        </div>
      ), { duration: 8000 });
    };

    if (user.role === 'DOCTOR') {
      onAlertAssigned(handleAssigned);
      onCriticalVitals(handleCritical);
    }
    if (user.role === 'PATIENT') {
      onAlertResolved(handleResolved);
    }

    return () => {
      if (user.role === 'DOCTOR') {
        offAlertAssigned(handleAssigned);
        offCriticalVitals(handleCritical);
      }
      if (user.role === 'PATIENT') {
        offAlertResolved(handleResolved);
      }
    };
  }, [user]);

  useEffect(() => {
    if (!isCheckAuthLoading) {
      if (!user) {
        router.push('/login');
      } else if (allowedRoles && !allowedRoles.includes(user.role)) {
        router.push('/login');
      }
    }
  }, [user, isCheckAuthLoading, router, allowedRoles]);

  if (isCheckAuthLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader className="animate-spin w-8 h-8 text-emerald-600" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
      {children}
      
      {/* Unified Floating Chat Button for all roles */}
      {(user.role === 'PATIENT' || user.role === 'DOCTOR') && (
        <>
          <FloatingChatButton onClick={() => setShowChatModal(true)} />
          <ChatModal
            isOpen={showChatModal}
            onClose={() => setShowChatModal(false)}
          />
        </>
      )}
    </>
  );
}
