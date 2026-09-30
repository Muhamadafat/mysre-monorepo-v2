"use client";

import {
  Box,
  Button,
  Checkbox,
  Group,
  Image,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
  Alert,
  Modal,
  Anchor,
} from "@mantine/core";
import { useState, useEffect } from "react";
import NextImage from "next/image";
import Link from "next/link";
import { IconEye, IconEyeOff, IconAlertCircle, IconCheck } from "@tabler/icons-react";
import { useRouter, useSearchParams } from "next/navigation";

import { signIn, resetPassword } from "../actions";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // 🆕 Forgot Password Modal States
  const [forgotPasswordOpened, setForgotPasswordOpened] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");
  
  const router = useRouter();
  const searchParams = useSearchParams();

  // 🆕 Check for error from auth callback
  useEffect(() => {
    const errorFromCallback = searchParams.get('error');
    if (errorFromCallback) {
      setError(decodeURIComponent(errorFromCallback));
    }
  }, [searchParams]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await signIn({
        email: email,
        password: password,
      });

      if (result?.error) {
        setError(result.error);
        setLoading(false);
      } else if (result?.success) {
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Dynamic profile URL untuk production
        const profileUrl = process.env.NEXT_PUBLIC_PROFILE_APP_URL || 
                          (typeof window !== 'undefined' && window.location.hostname.includes('riset.web.id')
                            ? 'https://profile.riset.web.id/dashboard'
                            : 'http://profile.lvh.me:3002/dashboard');
        
        console.log('Redirecting to:', profileUrl);
        
        window.location.href = profileUrl;
      } else {
        setError("Unexpected response from server");
        setLoading(false);
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  // 🆕 Handle Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setResetError("");
    setResetSuccess("");

    try {
      const result = await resetPassword(resetEmail);

      if (result?.error) {
        setResetError(result.error);
      } else if (result?.success) {
        setResetSuccess("Link reset password telah dikirim!");
        setResetEmail("");
        
        // Close modal after 3 seconds
        setTimeout(() => {
          setForgotPasswordOpened(false);
          setResetSuccess("");
        }, 3000);
      }
    } catch (error: any) {
      setResetError("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <>
      <Box
        style={{
          minHeight: "100vh",
          backgroundImage: `url('/images/background-login-new.png')`,
          backgroundSize: "100% 100%",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundAttachment: "fixed",
          backgroundColor: "#1A237E",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <Box
          style={{
            width: "100%",
            maxWidth: 1000,
            minHeight: "600px",
            display: "flex",
            boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
            borderRadius: 16,
            overflow: "hidden",
            backgroundColor: "white",
          }}
        >
          {/* Panel Kiri - Form Login */}
          <Box
            style={{
              width: "50%",
              backgroundColor: "white",
              padding: "40px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              overflowY: "auto",
            }}
          >
            <Box mb="md" style={{ display: "flex", justifyContent: "center" }}>
              <Image
                component={NextImage}
                src='/webp/logoSRE.webp'
                alt="My-SRE Logo"
                width={140}
                height={50}
                fit="contain"
              />
            </Box>
            <Box style={{ textAlign: "center", marginBottom: 32 }}>
              <Title order={1} fw={900} style={{ color: "#111827", fontSize: "2rem", letterSpacing: "1px" }}>
                MASUK
              </Title>
              <Text size="sm" mt={8} style={{ color: "#6B7280" }}>
                Masukkan email Anda untuk login ke akun Anda
              </Text>
            </Box>

            <form onSubmit={handleSignIn} style={{ width: "100%", maxWidth: "360px", margin: "0 auto" }}>
              <Stack gap="md">
                {error && (
                  <Alert icon={<IconAlertCircle size="1rem" />} color="red" variant="filled">
                    {error}
                  </Alert>
                )}

                <Box>
                  <Text fw={600} size="sm" mb={8} style={{ color: "#111827" }} suppressHydrationWarning>Email</Text>
                  <TextInput
                    placeholder="email@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.currentTarget.value)}
                    required
                    type="email"
                    disabled={loading}
                    size="md"
                    radius="md"
                    styles={{
                      input: {
                        backgroundColor: "#F3F4F6",
                        borderColor: "#D1D5DB",
                        color: "#111827",
                        '&:focus': { borderColor: "#228BE6" }
                      }
                    }}
                  />
                </Box>

                <Box>
                  <Text fw={600} size="sm" mb={8} style={{ color: "#111827" }}>Kata Sandi</Text>
                  <PasswordInput
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.currentTarget.value)}
                    visible={showPassword}
                    onVisibilityChange={setShowPassword}
                    visibilityToggleIcon={({ reveal }) =>
                      reveal ? <IconEyeOff size={18} color="#9CA3AF" /> : <IconEye size={18} color="#9CA3AF" />
                    }
                    required
                    disabled={loading}
                    size="md"
                    radius="md"
                    styles={{
                      input: {
                        backgroundColor: "#F3F4F6",
                        borderColor: "#D1D5DB",
                        color: "#111827",
                        '&:focus': { borderColor: "#228BE6" }
                      }
                    }}
                  />
                </Box>

                <Group justify="space-between" mt={4}>
                  <Checkbox
                    label="Ingat saya"
                    checked={remember}
                    onChange={(e) => setRemember(e.currentTarget.checked)}
                    disabled={loading}
                    color="blue"
                    styles={{ label: { color: "#4B5563", fontSize: "0.875rem" } }}
                  />
                  <Anchor
                    size="sm"
                    style={{ color: "#228BE6", textDecoration: "none", fontWeight: 400 }}
                    onClick={(e) => { e.preventDefault(); setForgotPasswordOpened(true); }}
                  >
                    Lupa kata sandi?
                  </Anchor>
                </Group>

                <Button
                  fullWidth
                  mt="md"
                  size="md"
                  radius="md"
                  type="submit"
                  loading={loading}
                  disabled={loading}
                  style={{ backgroundColor: "#1D8AE6", fontWeight: 600 }}
                >
                  Masuk
                </Button>

                <Text ta="center" size="sm" mt="md" style={{ color: "#111827" }}>
                  Belum punya akun?{" "}
                  <Anchor
                    component={Link}
                    href="/signup"
                    style={{ color: "#1D8AE6", fontWeight: 400, textDecoration: "none" }}
                  >
                    Daftar di sini
                  </Anchor>
                </Text>
              </Stack>
            </form>
          </Box>

          {/* Panel Kanan - Ilustrasi */}
          <Box
            style={{
              width: "50%",
              position: "relative",
            }}
          >
            <img
              src="/images/pengganti-tampilan-orang-login.png"
              alt="Login Illustration"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block"
              }}
            />
          </Box>
        </Box>
      </Box>

      {/* 🆕 Forgot Password Modal */}
      <Modal
        opened={forgotPasswordOpened}
        onClose={() => {
          setForgotPasswordOpened(false);
          setResetError("");
          setResetSuccess("");
          setResetEmail("");
        }}
        title={<Text fw={700} size="lg">Reset Password</Text>}
        centered
      >
        <form onSubmit={handleResetPassword}>
          <Stack>
            <Text size="sm" c="dimmed">
              Masukkan email Anda dan kami akan mengirimkan link untuk reset password.
            </Text>

            {resetError && (
              <Alert icon={<IconAlertCircle size="1rem" />} color="red" variant="light">
                {resetError}
              </Alert>
            )}

            {resetSuccess && (
              <Alert icon={<IconCheck size="1rem" />} color="green" variant="light">
                {resetSuccess}
              </Alert>
            )}

            <TextInput
              label="Email"
              placeholder="email@example.com"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.currentTarget.value)}
              required
              type="email"
              disabled={resetLoading || !!resetSuccess}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="subtle" color="gray" onClick={() => setForgotPasswordOpened(false)} disabled={resetLoading}>
                Batal
              </Button>
              <Button type="submit" loading={resetLoading} disabled={resetLoading || !!resetSuccess} color="blue">
                Kirim Link Reset
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}