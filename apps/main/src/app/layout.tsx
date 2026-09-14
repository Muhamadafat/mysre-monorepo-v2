// src/app/layout.tsx
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { MantineProvider, ColorSchemeScript } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { CursorBlink } from '@/components/CursorBlink';
import type { ReactNode } from 'react';

export const metadata = {
  title: "My-SRE - AI-Powered Research Platform",
  description:
    "Transform your research workflow with intelligent writing assistance and visual knowledge mapping. Design better research drafts with AI-powered tools.",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ColorSchemeScript forceColorScheme="light" />
      </head>
      <body>
        <CursorBlink />
        <MantineProvider defaultColorScheme="light" forceColorScheme="light" theme={{primaryColor: 'blue'}}>
          <ModalsProvider>
            <Notifications />
            {children}
          </ModalsProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
