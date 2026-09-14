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
  title: 'My-SRE IDE - AI-Powered Research Platform',
  description:
    'Transform your research workflow with intelligent writing assistance and visual knowledge mapping. Design better research drafts with AI-powered tools.',
};

function AppProviders({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning translate="no">
      <head>
        <meta name="google" content="notranslate" />
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body>
        <MantineProvider
          defaultColorScheme="light"
          theme={{
            primaryColor: 'blue',
            colors: {
              dark: [
                '#C9C9CC',
                '#ADADB1',
                '#929296',
                '#76767B',
                '#5B5B61',
                '#3E3E46',
                '#27272e',
                '#1c1c24',
                '#12131c',
                '#0d0e16',
              ],
            },
          }}
        >
          <ModalsProvider>
            <Notifications />
            {children}
          </ModalsProvider>
        </MantineProvider>
      </body>
    </html>
  );
}

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  // === DEV BYPASS ===
  // Set SKIP_AUTH=true di .env.local untuk melewati semua pengecekan auth saat development
  const isDev = process.env.NODE_ENV === 'development';
  const skipAuth = process.env.SKIP_AUTH === 'true';

  if (isDev && skipAuth) {
    console.log(
      '[Brain Layout] DEV MODE: Auth check bypassed (SKIP_AUTH=true)'
    );
    return <AppProviders>{children}</AppProviders>;
  }
  // === END DEV BYPASS ===

  // Check authentication
  const supabase = await createServerSupabaseClient();
  let {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  console.log('=== BRAIN LAYOUT AUTH CHECK ===');
  console.log('Session exists:', !!session);
  console.log('User:', session?.user?.email);

  // Jika tidak ada session, redirect ke main app signin
  if (!session || error) {
    console.log('Brain Layout: No session, redirecting to signin');
    const mainAppUrl =
      process.env.NEXT_PUBLIC_MAIN_APP_URL || 'https://mysrepanel.web.id';
    redirect(`${mainAppUrl}/signin?redirectedFrom=brain`);
  }

  // Check user group dari database (dengan fallback jika DB tidak tersedia)
  let dbUser: {
    id: string;
    email: string;
    group: string | null;
    name: string | null;
  } | null = null;
  let dbAvailable = true;

  try {
    dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        group: true,
        name: true,
      },
    });
  } catch (dbError) {
    dbAvailable = false;
    console.error(
      'Brain Layout: Database unreachable, falling back to session metadata:',
      dbError
    );
  }

  if (dbAvailable) {
    console.log('Brain Layout: User data from DB:', {
      found: !!dbUser,
      group: dbUser?.group,
      email: dbUser?.email,
    });

    // Jika user tidak ditemukan di database
    if (!dbUser) {
      try {
        dbUser =
          (session.user.email
            ? await prisma.user.findUnique({
                where: { email: session.user.email },
                select: {
                  id: true,
                  email: true,
                  group: true,
                  name: true,
                },
              })
            : null) ?? null;

        if (dbUser) {
          console.warn(
            'Brain Layout: Found user row by email, but auth session id differs:',
            {
              sessionUserId: session.user.id,
              dbUserId: dbUser.id,
              email: dbUser.email,
            }
          );
        }

        if (!dbUser) {
          const sessionName =
            session.user.user_metadata?.name ??
            session.user.user_metadata?.full_name ??
            session.user.email ??
            'User';
          const sessionGroup =
            session.user.user_metadata?.group ??
            session.user.app_metadata?.group ??
            null;

          dbUser = await prisma.user.create({
            data: {
              id: session.user.id,
              email: session.user.email ?? sessionName,
              name: sessionName,
              password: '',
              role: 'USER',
              isEmailVerified: true,
              group: sessionGroup,
            },
            select: {
              id: true,
              email: true,
              group: true,
              name: true,
            },
          });

          console.log('Brain Layout: Auto-synced missing user into database');
        }
      } catch (syncError) {
        console.error(
          'Brain Layout: Failed to auto-sync missing user; continuing with session-only access:',
          syncError
        );
      }
    }

    console.log('Brain Layout: Access granted for authenticated user (DB check)');
  } else {
    // Fallback: cek group dari session metadata jika DB tidak tersedia
    const metaGroup =
      session.user.user_metadata?.group ?? session.user.app_metadata?.group;
    console.warn(
      'Brain Layout: DB unavailable, using session metadata group:',
      metaGroup
    );

    // Jika metadata tidak ada group atau DB offline, tetap izinkan masuk
    // selama user sudah terautentikasi.
    console.warn('Brain Layout: Allowing authenticated user (DB offline)');
  }

  console.log('================================');

  return <AppProviders>{children}</AppProviders>;
}
