'use client';

import { useAuthStore } from '@/lib/authStore';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader } from 'lucide-react';

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

  return <>{children}</>;
}
