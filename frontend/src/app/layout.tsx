import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import '@/globals.css';
import RootLayout from '@/components/RootLayout';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });

export const metadata: Metadata = {
  title: 'Healix - Healthcare Management Platform',
  description: 'Modern healthcare management platform connecting patients, doctors, and administrators',
};

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${jakarta.className} antialiased bg-emerald-50 text-slate-900`}>
        <div className="relative min-h-screen overflow-hidden">
          <div className="pointer-events-none absolute inset-0">
          </div>

          <div className="relative z-10">
            <RootLayout>
              {children}
            </RootLayout>
          </div>
        </div>
      </body>
    </html>
  );
}
