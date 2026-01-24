'use client';

import { useAuthStore } from '@/lib/authStore';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Menu,
  X,
  LogOut,
  Home,
  Users,
  Calendar,
  AlertCircle,
  Activity,
  BarChart3,
  User,
} from 'lucide-react';
import { useState } from 'react';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (!user) return null;

  const getNavItems = () => {
    switch (user.role) {
      case 'PATIENT':
        return [
          { href: '/patient/dashboard', label: 'Dashboard', icon: Home },
          { href: '/patient/vitals', label: 'Vitals', icon: Activity },
          { href: '/patient/appointments', label: 'Appointments', icon: Calendar },
          { href: '/patient/medical-records', label: 'Medical Records', icon: BarChart3 },
          { href: '/patient/alerts', label: 'Alerts', icon: AlertCircle },
        ];
      case 'DOCTOR':
        return [
          { href: '/doctor/dashboard', label: 'Dashboard', icon: Home },
          { href: '/doctor/patients', label: 'Patients', icon: Users },
          { href: '/doctor/appointments', label: 'Appointments', icon: Calendar },
          { href: '/doctor/alerts', label: 'Alerts', icon: AlertCircle },
        ];
      case 'ADMIN':
        return [
          { href: '/admin/dashboard', label: 'Dashboard', icon: Home },
          { href: '/admin/patients', label: 'Patients', icon: Users },
          { href: '/admin/doctors', label: 'Doctors', icon: Users },
          { href: '/admin/logs', label: 'Audit', icon: BarChart3 },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  return (
    <>
      <nav className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-[100] transition-all duration-300">
        <div className="container-main">
          <div className="h-16 md:h-20 flex items-center justify-between">

            {/* Logo Area */}
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-500 rounded-xl blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
                <div className="relative p-2 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-xl shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform duration-300">
                  <Activity className="w-5 h-5 text-white" />
                </div>
              </div>
              <span className="font-extrabold text-xl bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600 tracking-tight">Healix</span>
            </Link>

            {/* Desktop Nav Items */}
            <div className="hidden md:flex items-center gap-1 p-1.5 bg-slate-50/50 rounded-2xl border border-slate-200/50">
              {navItems.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`
                                    flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200
                                    ${isActive
                        ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200/50'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                      }
                                `}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-500' : 'text-slate-400'}`} />
                    {label}
                  </Link>
                );
              })}
            </div>

            {/* Right Area (User & Mobile Toggle) */}
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-4 pl-6 border-l border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-800 leading-none mb-1">{user.firstName} {user.lastName}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none bg-slate-100 px-1.5 py-0.5 rounded-full inline-block">{user.role}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-100 to-white border border-slate-200 shadow-sm flex items-center justify-center ring-2 ring-transparent group-hover:ring-emerald-500/50 transition-all">
                    <User className="w-5 h-5 text-slate-400" />
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>

              {/* Mobile Toggle */}
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="md:hidden p-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
              >
                {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-[90] bg-slate-900/20 backdrop-blur-sm md:hidden p-4 pt-24 animate-in fade-in">
          <div
            className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-4 border-t border-t-emerald-500/20 animate-in slide-in-from-top-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-1">
              {navItems.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-5 py-4 rounded-2xl font-bold transition-all ${pathname === href
                    ? 'bg-emerald-50 text-emerald-700 shadow-sm ring-1 ring-emerald-100'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                  onClick={() => setIsOpen(false)}
                >
                  <Icon className={`w-5 h-5 ${pathname === href ? 'text-emerald-500' : 'text-current'}`} />
                  {label}
                </Link>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-2">
              <div className="flex items-center gap-4 px-4 py-2">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                  <User className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <p className="font-black text-sm text-slate-800">{user.firstName} {user.lastName}</p>
                  <p className="text-xs font-medium text-slate-500">{user.email}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-2xl transition-colors mt-2"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>

          {/* Close on background click */}
          <div className="absolute inset-0 -z-10" onClick={() => setIsOpen(false)} />
        </div>
      )}
    </>
  );
}
