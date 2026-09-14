/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { DashboardLayout } from './dashboard-layout';

export function DashboardWrapper({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  // Jangan tampilkan sidebar di halaman signin/auth
  const isAuthPage = pathname?.startsWith('/auth');

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch('/api/auth/signin');
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
      } catch (e) {
        console.error('Failed to load user', e);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, []);

  if (isAuthPage || loading) {
    return <>{children}</>;
  }

  return <DashboardLayout user={user}>{children}</DashboardLayout>;
}
