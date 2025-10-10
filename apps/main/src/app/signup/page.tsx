"use client";

import {
  Box,
  Button,
  Group,
  Image,
  PasswordInput,
  Radio,
  Stack,
  Text,
  TextInput,
  Title,
  Divider,
  Alert,
} from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import React, { useState } from "react";
import NextImage from "next/image";

import { signUp } from "../actions";
import { useRouter } from "next/navigation";

export default function SignUpPage() {
  const [form, setForm] = useState({
    fullName: "",
    sid: "",
    email: "",
    group: "",
    password: "",
    confirmPassword: "",
  });
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Validasi manual untuk field yang wajib diisi
    if (!form.fullName.trim()) {
      setError("Nama Lengkap wajib diisi");
      setLoading(false);
      return;
    }

    if (!form.sid.trim()) {
      setError("SID atau NIM wajib diisi");
      setLoading(false);
      return;
    }

    if (!form.email.trim()) {
      setError("Email wajib diisi");
      setLoading(false);
      return;
    }

    if (!form.group) {
      setError("Silakan pilih grup terlebih dahulu");
      setLoading(false);
      return;
    }

    if (!form.password.trim()) {
      setError("Kata Sandi wajib diisi");
      setLoading(false);
      return;
    }

    try {      
      const result = await signUp({
        fullName: form.fullName,
        sid: form.sid,
        email: form.email,
        group: form.group,
        password: form.password,
      });

      if (result?.error){
        setError(result.error);
        setLoading(false);
      } else if (result?.success){
        await new Promise(resolve => setTimeout(resolve, 200));

        const brainUrl = `${process.env.NEXT_PUBLIC_PROFILE_APP_URL || 'http://brain.lvh.me:3001'}/`;
        window.location.href = brainUrl;
      } else {
        setError("Unexpected response from server");
        setLoading(false);
      }
    } catch (error) {
      console.error('Sign up error:', error);
      setError('An unexpected error occured.Please try again');
      setLoading(false);
    }
  }

  // Handler untuk SID/NIM - hanya menerima angka
  const handleSidChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.currentTarget.value;
    // Hanya izinkan angka
    if (value === '' || /^\d+$/.test(value)) {
      setForm({ ...form, sid: value });
    }
  };

  const inputStyles = {
    input: {
      backgroundColor: "light-dark(white, var(--mantine-color-dark-7))",
      borderColor: "light-dark(var(--mantine-color-gray-4), var(--mantine-color-dark-4))",
      color: "light-dark(var(--mantine-color-dark-9), var(--mantine-color-gray-0))",
      '&::placeholder': {
        color: "light-dark(var(--mantine-color-gray-6), var(--mantine-color-dark-2))",
      }
    }
  };

  return (
    <Box
      style={{
        minHeight: "100vh",
        backgroundImage: `url('/webp/login-background.webp')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <Box
        style={{
          width: "100%",
          maxWidth: 1100,
          minHeight: "600px",
          maxHeight: "90vh",
          display: "flex",
          boxShadow: "0 0 20px rgba(0,0,0,0.2)",
          borderRadius: 16,
          overflow: "hidden",
          backgroundColor: "light-dark(white, var(--mantine-color-dark-6))",
        }}
      >
        {/* Panel Kiri - Ilustrasi dan Logo */}
        <Box
          style={{
            width: "45%",
            backgroundColor: "#0057b7",
            padding: "32px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            color: "white",
          }}
        >
          <Image
            component={NextImage}
            src='/webp/logoSRE.webp'
            alt="My-SRE Logo"
            width={170}
            height={50}
            fit="contain"
            style={{ alignSelf: "flex-start" }}
          />

          <Box style={{ textAlign: "center" }}>
            <Image
              component={NextImage}
              src='/images/signin-illustration.png'
              alt="Illustration"
              width={350}
              height={350}
              fit="contain"
              style={{ margin: "0 auto" }}
            />
          </Box>

          <Text size="xs" style={{ textAlign: "center" }}>
            My-SRE © 2025
          </Text>
        </Box>

        {/* Panel Kanan - Form */}
        <Box
          style={{
            width: "55%",
            paddingTop: "32px",
            paddingBottom: "32px",
            paddingInline: "40px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            overflowY: "auto",
            backgroundColor: "light-dark(white, var(--mantine-color-dark-6))",
          }}
        >
          <Title order={1} mb={0} fw={700} style={{ color: "light-dark(var(--mantine-color-dark-9), var(--mantine-color-gray-0))" }}>
            Daftar Akun
          </Title>
          <Text mb="sm" c="dimmed">
            Masukkan informasi Anda untuk membuat akun
          </Text>

          <form onSubmit={handleSignUp}
          style={{ flexGrow: 1 }}
          >
            <Stack gap={6}>
              {error && (
                <Alert 
                  icon={<IconAlertCircle size="1rem" />} 
                  color="red" 
                  variant="filled"
                  mb="md"
                >
                  {error}
                </Alert>
              )}
              <Text fw={600}>Nama Lengkap</Text>
              <TextInput
                placeholder="Masukkan nama lengkap Anda..."
                value={form.fullName}
                onChange={(e) =>
                  setForm({ ...form, fullName: e.currentTarget.value })
                }
                required
                disabled={loading}
                styles={inputStyles}
              />

              <Text fw={600}>SID atau NIM</Text>
              <TextInput
                placeholder="Masukkan SID atau NIM Anda..."
                value={form.sid}
                onChange={handleSidChange}
                type="text"
                inputMode="numeric"
                pattern="\d*"
                required
                disabled={loading}
                styles={inputStyles}
              />

              <Text fw={600}>Email</Text>
              <TextInput
                placeholder="Masukkan email Anda..."
                value={form.email}
                onChange={(e) =>
                  setForm({ ...form, email: e.currentTarget.value })
                }
                type="email"
                required
                disabled={loading}
                styles={inputStyles}
              />

              <Text fw={600}>Grup</Text>
              <Radio.Group
                value={form.group}
                onChange={(value) => setForm({ ...form, group: value })}
                required
              >
                <Group>
                  <Radio value="A" label="Group A" disabled={loading} />
                  <Radio value="B" label="Group B" disabled={loading} />
                </Group>
              </Radio.Group>

              <Text fw={600}>Kata Sandi</Text>
              <PasswordInput
                placeholder="Masukkan kata sandi Anda..."
                value={form.password}
                onChange={(e) =>
                  setForm({ ...form, password: e.currentTarget.value })
                }
                required
                disabled={loading}
                styles={inputStyles}
              />

              <Button fullWidth mt="xs" color="blue" type="submit" loading={loading} disabled={loading}>
                {loading ? "Daftar..." : "Daftar"}
              </Button>
              
              <Text ta="center" size="sm" mt="md">
                Sudah punya akun?{" "}
                <Text 
                  component="span" 
                  c="blue" 
                  fw={600}
                  style={{ cursor: "pointer" }}
                  onClick={() => router.push('/signin')}
                >
                  Masuk di sini
                </Text>
              </Text>
            </Stack>
          </form>
        </Box>
      </Box>
    </Box>
  );
}