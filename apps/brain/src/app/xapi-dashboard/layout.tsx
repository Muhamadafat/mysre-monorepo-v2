// src/app/xapi-dashboard/layout.tsx
import React from 'react';

export const metadata = {
  title: 'xAPI Dashboard - Platform Riset',
  description: 'Dashboard analitik pembelajaran menggunakan xAPI',
};

export default function XapiDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  );
}