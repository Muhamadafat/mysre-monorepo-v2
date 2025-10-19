"use client";

import {
  Box,
  Button,
  PasswordInput,
  Stack,
  Text,
  Title,
  Alert,
  Paper,
  Loader,
  Center,
} from "@mantine/core";
import { useState, useEffect } from "react";
import { IconEye, IconEyeOff, IconAlertCircle, IconCheck } from "@tabler/icons-react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from '@supabase/ssr';
import { updatePassword } from "../actions";

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isValidToken, setIsValidToken] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);
  
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const verifySession = async () => {
      setCheckingToken(true);
      
      try {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        
        console.log('🔍 Checking session for password reset...');
        
        // 🔑 WORKAROUND: Cek access_token dari URL
        const accessToken = searchParams.get('access_token');
        const refreshToken = searchParams.get('refresh_token');
        
        if (accessToken && refreshToken) {
          console.log('🔑 Tokens found in URL, setting session...');
          
          // Set session dari tokens
          const { data, error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          
          if (setSessionError) {
            console.error('❌ Failed to set session:', setSessionError);
            setError("Gagal mengatur session: " + setSessionError.message);
            setIsValidToken(false);
          } else if (data.session) {
            console.log('✅ Session set successfully:', data.session.user.email);
            setIsValidToken(true);
            
            // Clean URL (remove tokens from URL for security)
            const cleanUrl = new URL(window.location.href);
            cleanUrl.searchParams.delete('access_token');
            cleanUrl.searchParams.delete('refresh_token');
            window.history.replaceState({}, '', cleanUrl.toString());
          } else {
            setError("Gagal mendapatkan session.");
            setIsValidToken(false);
          }
        } else {
          // Fallback: Cek session normal dari cookies
          console.log('⚠️ No tokens in URL, checking cookies...');
          
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError) {
            console.error('❌ Session error:', sessionError);
            setError("Terjadi kesalahan saat memeriksa session.");
            setIsValidToken(false);
          } else if (session) {
            console.log('✅ Valid session found in cookies:', session.user.email);
            setIsValidToken(true);
          } else {
            console.log('❌ No session found');
            console.log('🍪 Cookies:', document.cookie);
            setError("Session tidak ditemukan. Link mungkin sudah kadaluarsa. Silakan request reset password baru.");
            setIsValidToken(false);
          }
        }
      } catch (err: any) {
        console.error('❌ Unexpected error:', err);
        setError("Terjadi kesalahan: " + err.message);
        setIsValidToken(false);
      }
      
      setCheckingToken(false);
    };
    
    verifySession();
  }, [searchParams]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setError("Password tidak cocok!");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password harus minimal 6 karakter!");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      console.log('🔄 Updating password...');
      const result = await updatePassword(newPassword);

      if (result?.error) {
        console.error('❌ Update password failed:', result.error);
        setError(result.error);
      } else if (result?.success) {
        console.log('✅ Password updated successfully');
        setSuccess("Password berhasil diperbarui!");
        
        setTimeout(() => {
          router.push('/signin');
        }, 2000);
      }
    } catch (error: any) {
      console.error('❌ Update password error:', error);
      setError("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  if (checkingToken) {
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
            <Text c="dimmed">Memverifikasi session...</Text>
          </Stack>
        </Center>
      </Box>
    );
  }

  return (
    <Box
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-7))",
        padding: "20px",
      }}
    >
      <Paper
        shadow="md"
        p="xl"
        radius="md"
        style={{
          width: "100%",
          maxWidth: 450,
        }}
      >
        <Stack gap="md">
          <Box style={{ textAlign: "center", marginBottom: 16 }}>
            <Title order={2} fw={700} mb={8}>
              Reset Password
            </Title>
            <Text c="dimmed" size="sm">
              Masukkan password baru Anda
            </Text>
          </Box>

          {!isValidToken && error ? (
            <Alert 
              icon={<IconAlertCircle size="1rem" />} 
              color="red"
              title="Session Tidak Valid"
            >
              {error}
              <Button 
                variant="subtle" 
                size="sm" 
                mt="md"
                fullWidth
                onClick={() => router.push('/signin')}
              >
                Kembali ke Halaman Login
              </Button>
            </Alert>
          ) : (
            <form onSubmit={handleUpdatePassword}>
              <Stack gap="md">
                {error && (
                  <Alert 
                    icon={<IconAlertCircle size="1rem" />} 
                    color="red"
                  >
                    {error}
                  </Alert>
                )}

                {success && (
                  <Alert 
                    icon={<IconCheck size="1rem" />} 
                    color="green"
                    title="Berhasil!"
                  >
                    {success}
                    <Text size="sm" mt="xs">Redirecting to login...</Text>
                  </Alert>
                )}

                <PasswordInput
                  label="Password Baru"
                  placeholder="Masukkan password baru..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.currentTarget.value)}
                  visible={showPassword}
                  onVisibilityChange={setShowPassword}
                  visibilityToggleIcon={({ reveal }) =>
                    reveal ? <IconEyeOff size="1rem" /> : <IconEye size="1rem" />
                  }
                  required
                  disabled={loading || !!success}
                  description="Minimal 6 karakter"
                />

                <PasswordInput
                  label="Konfirmasi Password"
                  placeholder="Masukkan ulang password baru..."
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.currentTarget.value)}
                  visible={showConfirmPassword}
                  onVisibilityChange={setShowConfirmPassword}
                  visibilityToggleIcon={({ reveal }) =>
                    reveal ? <IconEyeOff size="1rem" /> : <IconEye size="1rem" />
                  }
                  required
                  disabled={loading || !!success}
                  error={
                    confirmPassword && newPassword !== confirmPassword
                      ? "Password tidak cocok"
                      : undefined
                  }
                />

                <Button 
                  fullWidth 
                  mt="md" 
                  size="md" 
                  color="blue" 
                  radius="md" 
                  type="submit"
                  loading={loading}
                  disabled={loading || !!success || !newPassword || !confirmPassword}
                >
                  {loading ? "Memperbarui..." : "Perbarui Password"}
                </Button>

                <Text ta="center" size="sm" mt="md">
                  <Text 
                    component="span" 
                    c="blue" 
                    fw={600}
                    style={{ cursor: "pointer" }}
                    onClick={() => router.push('/signin')}
                  >
                    Kembali ke Login
                  </Text>
                </Text>
              </Stack>
            </form>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}