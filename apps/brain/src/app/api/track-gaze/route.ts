import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@sre-monorepo/lib";
import { createServerSupabaseClient } from "@sre-monorepo/lib";

export async function POST(req: NextRequest){

    try {   
        const body = await req.json();
        const { sessionId, gazeData, screenshot } = body;

        let screenshotPath: string | null = null;

        if (screenshot){
            const base64Data = screenshot.replace(/^data:image\/jpeg;base64,/, "");
            const buffer = Buffer.from(base64Data, 'base64');
            const filePath = `public/${sessionId}/${Date.now()}.jpg`;

            const supabase = await createServerSupabaseClient();
            const { data: uploadData, error: uploadError } = await supabase.storage.from('screenshots').upload(filePath, buffer, {
                contentType: 'image/jpeg',
                upsert: false,
            });

            if (uploadError){
                throw new Error(`Supabase Storage Error: ${uploadError.message}`);
            };
            screenshotPath = uploadData.path;
            console.log(`[API] screenshot uploaded to supabase storage: ${screenshotPath}`);
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