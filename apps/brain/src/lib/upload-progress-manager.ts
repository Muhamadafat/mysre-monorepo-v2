// src/lib/upload-progress-manager.ts (File Baru)

// Map ini akan menjadi "singleton" di sisi server, menyimpan semua koneksi aktif.
export const activeUploads = new Map<string, (data: any) => void>();

// Fungsi ini sekarang bisa diimpor dan dipanggil dari mana saja di sisi server.
export function sendProgress(uploadId: string, progress: any) {
  const sendEvent = activeUploads.get(uploadId);
  if (sendEvent) {
    sendEvent(progress);
  }
}