import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@sre-monorepo/lib/server";
import { saveScreenshot } from "@/lib/storage";

export async function POST(req: NextRequest){

    try {
        const body = await req.json();
        const { sessionId, gazeData, screenshot } = body;

        let screenshotPath: string | null = null;

        if (screenshot){
            const base64Data = screenshot.replace(/^data:image\/jpeg;base64,/, "");
            const buffer = Buffer.from(base64Data, 'base64');
            const filename = `${Date.now()}.jpg`;

            try {
                const saved = await saveScreenshot(buffer, sessionId, filename);
                screenshotPath = saved.path;
                console.log(`[API] screenshot saved to local storage: ${screenshotPath}`);
            } catch (uploadError: any) {
                throw new Error(`Local storage error: ${uploadError.message}`);
            }
        }

        await prisma.gazeEvent.create({
            data: {
                sessionId: sessionId,
                gazeData: gazeData,
                screenshotPath: screenshotPath,
            },
        });

        console.log(`[API] Gaze data for session ${sessionId} saved to database via prisma.`);
        return NextResponse.json(
            {message: 'Data and screenshot saved successfully'},
            {status: 200}
        );   
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occured';
        console.error('[API ERROR]:', errorMessage);
        return NextResponse.json(
            {message: 'Internal Server Error:', error: errorMessage},
            {status: 500},
        );
    }
}