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
} from "@mantine/core";
import { useState } from "react";
import { IconEye, IconEyeOff, IconAlertCircle, IconCheck } from "@tabler/icons-react";
import { useRouter, useSearchParams } from "next/navigation";
import { updatePassword } from "../actions";

export default function ResetPasswordForm() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

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

    if (!token) {
      setError("Link reset password tidak valid.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await updatePassword(token, newPassword);

      if (result?.error) {
        setError(result.error);
      } else if (result?.success) {
        setSuccess("Password berhasil diperbarui!");

        setTimeout(() => {
          router.push("/signin");
        }, 2000);
      }
    } catch (error: any) {
      setError("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

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

          {!token ? (
            <Alert icon={<IconAlertCircle size="1rem" />} color="red" title="Link Tidak Valid">
              Link reset password tidak valid atau sudah kadaluarsa. Silakan request reset password baru.
              <Button variant="subtle" size="sm" mt="md" fullWidth onClick={() => router.push("/signin")}>
                Kembali ke Halaman Login
              </Button>
            </Alert>
          ) : (
            <form onSubmit={handleUpdatePassword}>
              <Stack gap="md">
                {error && (
                  <Alert icon={<IconAlertCircle size="1rem" />} color="red">
                    {error}
                  </Alert>
                )}

                {success && (
                  <Alert icon={<IconCheck size="1rem" />} color="green" title="Berhasil!">
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
                    onClick={() => router.push("/signin")}
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
