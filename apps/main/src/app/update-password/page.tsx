// app/update-password/page.tsx
// Canonical password recovery page used by the email-confirmation flow.
import { Suspense } from 'react';
import ResetPasswordForm from '../reset-password/ResetPasswordForm';
import { Loader, Center, Box, Text, Stack } from '@mantine/core';

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={<UpdatePasswordLoading />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function UpdatePasswordLoading() {
  return (
    <Box
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor:
          'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-7))',
      }}
    >
      <Center>
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text c="dimmed">Memuat...</Text>
        </Stack>
      </Center>
    </Box>
  );
}
