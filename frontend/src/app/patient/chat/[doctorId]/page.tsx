'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedLayout from '@/components/ProtectedLayout';

export default function PatientChatPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to dashboard - chat is now handled via modal
    router.replace('/patient/dashboard');
  }, [router]);

  return (
    <ProtectedLayout allowedRoles={['PATIENT']}>
      <div className="container-main py-6">
        <div className="glass-card p-8 text-center">
          <p className="text-slate-600 font-medium">Redirecting to dashboard...</p>
          <p className="text-sm text-slate-500 mt-2">Chat is now available via the Messages button</p>
        </div>
      </div>
    </ProtectedLayout>
  );
}
