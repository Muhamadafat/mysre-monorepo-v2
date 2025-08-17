import { NextRequest, NextResponse } from 'next/server';

const activeUploads = new Map<string, (data: any) => void>();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const uploadId = searchParams.get('uploadId');

  if (!uploadId) {
    return new NextResponse('Missing uploadId', { status: 400 });
  }

  const encoder = new TextEncoder();

  const customReadable = new ReadableStream({
    start(controller) {
      const sendEvent = (data: any) => {
        const message = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      activeUploads.set(uploadId, sendEvent);

      // Send initial connection confirmation
      sendEvent({ type: 'connected', uploadId });
    },
    cancel() {
      activeUploads.delete(uploadId);
    }
  });

  return new NextResponse(customReadable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// Function to send progress updates
export function sendProgress(uploadId: string, progress: any) {
  const sendEvent = activeUploads.get(uploadId);
  if (sendEvent) {
    sendEvent(progress);
  }
}