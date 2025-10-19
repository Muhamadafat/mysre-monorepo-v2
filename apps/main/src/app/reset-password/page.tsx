// app/reset-password/page.tsx
import { Suspense } from 'react';
import ResetPasswordForm from './ResetPasswordForm';
import { Loader, Center, Box, Text, Stack } from '@mantine/core';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordLoading />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordLoading() {
  return (
    <Box
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-7))",
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