// src/app/components/AnnotationModal.tsx

"use client"

import React, { useState, useEffect } from 'react';
import { Modal, Group, ThemeIcon, Text, Stack, Box, Card, TextInput, Button, useMantineTheme } from '@mantine/core';
import { IconNote, IconCheck } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

interface AnnotationModalProps {
    opened: boolean;
    onClose: () => void;
    highlightedText: string;
    targetUrl: string | null;
    isDark: boolean;
}

const AnnotationModal = ({ opened, onClose, highlightedText, targetUrl, isDark }: AnnotationModalProps) => {
    const theme = useMantineTheme();
    
    // STATE LOKAL: Komentar dan status loading sekarang tinggal di sini.
    const [comment, setComment] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // Reset comment setiap kali modal dibuka dengan teks baru
    useEffect(() => {
        if (opened) {
            setComment("");
        }
    }, [opened, highlightedText]);

    const handleSave = async () => {
        if (!comment.trim() || !targetUrl) {
            notifications.show({
                title: "Error",
                message: "Komentar tidak boleh kosong.",
                color: "red",
            });
            return;
        }

        setIsSaving(true);
        try {
            const response = await fetch("/api/annotation", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    document: targetUrl,
                    metadata: {
                        pageNumber: 1, // Placeholder
                        highlightedText: highlightedText,
                        contents: comment,
                    },
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Gagal menyimpan anotasi.");
            }

            notifications.show({
                title: "Berhasil",
                message: "Anotasi berhasil disimpan!",
                color: "green",
            });
            onClose(); // Tutup modal setelah berhasil
        } catch (error: any) {
            notifications.show({
                title: "Gagal",
                message: error.message || "Terjadi kesalahan saat menyimpan.",
                color: "red",
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title={
                <Group gap="xs">
                    <ThemeIcon variant="gradient" gradient={{ from: "blue", to: "cyan" }} size="md">
                        <IconNote size={16} />
                    </ThemeIcon>
                    <Text fw={600}>Buat Anotasi</Text>
                </Group>
            }
            centered
            overlayProps={{ blur: 3 }}
            radius="lg"
        >
            <Stack gap="md">
                <Box>
                    <Text size="sm" c="dimmed" mb={8} fw={500}>Teks yang dipilih:</Text>
                    <Card p="md" withBorder radius="md" style={{ background: isDark ? theme.colors.dark[7] : theme.colors.gray[1] }}>
                        <Text size="sm" style={{ fontStyle: "italic", lineHeight: 1.5 }}>
                            {highlightedText.length > 150 ? `${highlightedText.substring(0, 150)}...` : highlightedText}
                        </Text>
                    </Card>
                </Box>
                <TextInput
                    label="Komentar Anda"
                    placeholder="Tambahkan komentar untuk anotasi ini..."
                    value={comment}
                    onChange={(event) => setComment(event.currentTarget.value)} // Menggunakan state lokal
                    data-autofocus // Otomatis fokus saat modal terbuka
                />
                <Group justify="flex-end" gap="sm">
                    <Button variant="light" color="gray" onClick={onClose} radius="md">Batal</Button>
                    <Button
                        variant="gradient"
                        gradient={{ from: "blue", to: "cyan" }}
                        onClick={handleSave}
                        loading={isSaving}
                        disabled={!comment.trim()}
                        leftSection={<IconCheck size={16} />}
                        radius="md"
                    >
                        Simpan Anotasi
                    </Button>
                </Group>
            </Stack>
        </Modal>
    );
};

export default AnnotationModal;