/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

/**
 * WebViewerDynamic — SSR-safe wrapper untuk WebViewer.
 *
 * react-pdf-highlighter mem-bundle pdfjs-dist secara internal.
 * Di Next.js 15 App Router, chunk pdfjs yang dihasilkan Webpack
 * memiliki nama yang sangat panjang dan gagal di-load (ChunkLoadError).
 *
 * Solusinya: lazy-load seluruh WebViewer dengan `next/dynamic` + `ssr: false`
 * sehingga chunk pdfjs hanya dimuat di browser, bukan saat SSR.
 */

import dynamic from 'next/dynamic';
import { Loader, Center } from '@mantine/core';

// Props harus diduplikasi di sini agar bisa digunakan sebelum module dimuat
interface WebViewerProps {
  fileUrl: string;
  onAnalytics?: (data: any) => void;
  session?: any;
  articleId?: string;
  onSave?: () => void;
  hideInternalToolbar?: boolean;
}

const WebViewerDynamic = dynamic<WebViewerProps>(
  () => import('@/components/WebViewer'),
  {
    ssr: false,
    loading: () => (
      <Center style={{ height: '100%', width: '100%' }}>
        <Loader size="sm" color="blue" />
      </Center>
    ),
  }
);

export default WebViewerDynamic;
