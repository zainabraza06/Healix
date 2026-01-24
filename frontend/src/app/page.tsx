'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/authStore';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';

// Dynamically import Scene to avoid SSR issues with Canvas (often safer with R3F)
const Scene = dynamic(() => import('@/components/canvas/Scene'), { ssr: false });
const FloatingIcons = dynamic(() => import('@/components/canvas/FloatingIcons').then(mod => mod.FloatingIcons), { ssr: false });

export default function Home() {
  const router = useRouter();
  const { user } = useAuthStore();

  if (user) {
    if (user.role === 'PATIENT') router.push('/patient/dashboard');
    else if (user.role === 'DOCTOR') router.push('/doctor/dashboard');
    else if (user.role === 'ADMIN') router.push('/admin/dashboard');
    if (user) return null;
  }

  const fadeIn = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, ease: "easeOut" }
  };

  const stagger = {
    animate: {
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-50 selection:bg-emerald-200 selection:text-emerald-900">

      {/* 3D Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <Scene className="h-full w-full">
          <FloatingIcons />
        </Scene>
      </div>

      {/* Glass Gradient Overlay for text readability */}
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-white/0 via-transparent to-white/60 pointer-events-none" />

      {/* Navigation */}
      <nav className="container-main py-6 relative z-10">
        <div className="flex justify-between items-center glass-card px-6 py-3">
          <h1 className="text-2xl font-bold tracking-tight text-emerald-800 flex items-center gap-2">
            <span className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white font-bold">H</span>
            Healix
          </h1>
          <Link href="/login" className="px-5 py-2.5 rounded-xl font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors">
            Login
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="container-main pt-16 pb-20 relative z-10">
        <motion.div
          className="max-w-4xl mx-auto text-center"
          initial="initial"
          animate="animate"
          variants={stagger}
        >
          <motion.div variants={fadeIn}>
            <span className="inline-block px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-700 font-medium text-sm mb-6 border border-emerald-200">
              Future of Healthcare Management
            </span>
          </motion.div>

          <motion.h2 variants={fadeIn} className="text-6xl md:text-7xl font-bold text-slate-900 mb-6 tracking-tight leading-tight">
            Connect. Care. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">
              Heal Together.
            </span>
          </motion.h2>

          <motion.p variants={fadeIn} className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            Experience the next generation of healthcare management. Secure, efficient, and beautifully designed for patients, doctors, and administrators.
          </motion.p>

          <motion.div variants={fadeIn} className="flex gap-4 justify-center items-center">
            <Link href="/login" className="btn-primary px-8 py-4 text-lg shadow-emerald-500/25">
              Login
            </Link>
            <Link href="/register" className="btn-secondary px-8 py-4 text-lg">
              Create Account
            </Link>
          </motion.div>
        </motion.div>

        {/* Features Preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mt-32"
        >
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: 'Smart Dashboard', desc: 'Real-time monitoring of vital signs and appointments.', color: 'from-blue-400/20 to-blue-600/20' },
              { title: 'Doctor Portal', desc: 'Seamless patient management and prescription tools.', color: 'from-emerald-400/20 to-emerald-600/20' },
              { title: 'Admin Control', desc: 'Comprehensive system logs and user analytics.', color: 'from-purple-400/20 to-purple-600/20' }
            ].map((feature, i) => (
              <div key={i} className="glass-card p-8 hover:scale-[1.02] transition-transform duration-300 relative overflow-hidden group">
                <div className={`absolute -right-10 -top-10 w-40 h-40 bg-gradient-to-br ${feature.color} rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                <h3 className="text-xl font-bold text-slate-800 mb-3 relative z-10">{feature.title}</h3>
                <p className="text-slate-600 relative z-10 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
