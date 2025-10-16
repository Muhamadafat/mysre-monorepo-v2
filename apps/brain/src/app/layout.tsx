// apps/brain/app/layout.tsx
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { MantineProvider, ColorSchemeScript } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@sre-monorepo/lib';
import { prisma } from '@sre-monorepo/lib';

export const metadata = {
  title: "My-SRE IDE - AI-Powered Research Platform",
  description:
    "Transform your research workflow with intelligent writing assistance and visual knowledge mapping. Design better research drafts with AI-powered tools.",
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Check authentication and group
  const supabase = await createServerSupabaseClient();
  const { data: { session }, error } = await supabase.auth.getSession();

  console.log('=== BRAIN LAYOUT AUTH CHECK ===');
  console.log('Session exists:', !!session);
  console.log('User:', session?.user?.email);

  // Jika tidak ada session, redirect ke main app signin
  if (!session || error) {
    console.log('Brain Layout: No session, redirecting to signin');
    const mainAppUrl = process.env.NEXT_PUBLIC_MAIN_APP_URL || 'http://main.lvh.me:3000';
    redirect(`${mainAppUrl}/signin?redirectedFrom=brain`);
  }

  // Check user group dari database
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      group: true,
      name: true,
    },
  });

  console.log('Brain Layout: User data:', {
    found: !!dbUser,
    group: dbUser?.group,
    email: dbUser?.email
  });

  // Jika user tidak ditemukan di database
  if (!dbUser) {
    console.error('Brain Layout: User not found in database');
    const mainAppUrl = process.env.NEXT_PUBLIC_MAIN_APP_URL || 'http://main.lvh.me:3000';
    redirect(`${mainAppUrl}/signin?error=user_not_found`);
  }

  // Jika user bukan Group A, redirect dengan error message
  if (dbUser.group !== 'A') {
    console.log('Brain Layout: Access denied - User is not Group A:', {
      userId: dbUser.id,
      email: dbUser.email,
      group: dbUser.group
    });
    
    const mainAppUrl = process.env.NEXT_PUBLIC_MAIN_APP_URL || 'http://main.lvh.me:3000';
    redirect(`${mainAppUrl}/?error=access_denied&message=${encodeURIComponent('Brain app hanya tersedia untuk Group A')}`);
  }

  console.log('Brain Layout: Access granted for Group A user');
  console.log('================================');

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body>
        <MantineProvider defaultColorScheme="light" theme={{primaryColor: 'blue'}}>
          <ModalsProvider>
            <Notifications />
            {children}
          </ModalsProvider>
        </MantineProvider>
      </body>
    </html>
  );
}