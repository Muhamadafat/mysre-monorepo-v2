// app/signin/page.tsx
import { Suspense } from 'react';
import LoginForm from './LoginForm';
import { Loader, Center, Box, Text, Stack } from '@mantine/core';

export default function SignInPage() {
  return (
    <Suspense fallback={<SignInLoading />}>
      <LoginForm />
    </Suspense>
  );
}

function SignInLoading() {
  return (
    <Box
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundImage: `url('/images/background-login-new.png')`,
        backgroundSize: "100% 100%",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
      }}
    >
      <Center>
        <Stack align="center" gap="md">
          <Loader size="lg" color="white" />
          <Text c="white" fw={600}>Memuat...</Text>
        </Stack>
      </Center>
    </Box>
  );
}