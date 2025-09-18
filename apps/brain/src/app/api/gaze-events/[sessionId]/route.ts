import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@sre-monorepo/lib";
import { createServerSupabaseClient } from "@sre-monorepo/lib";

export async function GET(req: NextRequest, { params } : { params: Promise<{ sessionId: string }>}){
    try {
        const { sessionId } = await params;

        if (!sessionId){
            return NextResponse.json(
                {message: 'sessionId is required'},
                {status: 400}
            );
        }

        const gazeEvents = await prisma.gazeEvent.findMany({
            where: {
                sessionId: sessionId
            },
            orderBy: {
                createdAt: 'asc'
            }
        });

        if (!gazeEvents || gazeEvents.length === 0){
            return NextResponse.json(
                {message: 'No gaze events found for this session'},
                {status: 404}
            );
        }

        // ✅ FIXED: Handle array of gaze points in each event
        const heatmapData: any[] = [];
        let totalPointsProcessed = 0;
        let validPointsCount = 0;

        gazeEvents.forEach((event, eventIndex) => {
            const gazeDataArray = event.gazeData as any[];
            
            // Debug first event structure
            if (eventIndex === 0) {
                console.log(`[API DEBUG] First event gazeData:`, {
                    type: Array.isArray(gazeDataArray) ? 'array' : typeof gazeDataArray,
                    length: Array.isArray(gazeDataArray) ? gazeDataArray.length : 'not array',
                    sample: Array.isArray(gazeDataArray) ? gazeDataArray[0] : gazeDataArray
                });
            }
            
            if (Array.isArray(gazeDataArray)) {
                gazeDataArray.forEach((gazePoint, pointIndex) => {
                    totalPointsProcessed++;
                    
                    // Debug first few points
                    if (eventIndex === 0 && pointIndex < 3) {
                        console.log(`[API DEBUG] Event ${eventIndex}, Point ${pointIndex}:`, {
                            x: gazePoint?.x,
                            y: gazePoint?.y,
                            timestamp: gazePoint?.timestamp,
                            xType: typeof gazePoint?.x,
                            yType: typeof gazePoint?.y
                        });
                    }

                    // Validate and add point
                    if (
                        gazePoint &&
                        typeof gazePoint.x === 'number' && 
                        typeof gazePoint.y === 'number' &&
                        !isNaN(gazePoint.x) && 
                        !isNaN(gazePoint.y) &&
                        gazePoint.x >= 0 && 
                        gazePoint.y >= 0
                    ) {
                        heatmapData.push({
                            id: `${event.id}-${pointIndex}`,
                            x: Math.round(gazePoint.x), // Round to avoid sub-pixel issues
                            y: Math.round(gazePoint.y),
                            value: 1, // Could use intensity or duration if available
                            timestamp: gazePoint.timestamp || event.createdAt,
                            eventId: event.id
                        });
                        validPointsCount++;
                    } else {
                        // Log why point was invalid (only for first event)
                        if (eventIndex === 0 && pointIndex < 5) {
                            console.log(`[API DEBUG] Invalid point ${eventIndex}-${pointIndex}:`, {
                                point: gazePoint,
                                reason: !gazePoint ? 'null/undefined point' :
                                       typeof gazePoint.x !== 'number' ? 'x not number' :
                                       typeof gazePoint.y !== 'number' ? 'y not number' :
                                       isNaN(gazePoint.x) ? 'x is NaN' :
                                       isNaN(gazePoint.y) ? 'y is NaN' :
                                       gazePoint.x < 0 ? 'x negative' :
                                       gazePoint.y < 0 ? 'y negative' : 'unknown'
                            });
                        }
                    }
                });
            } else {
                console.log(`[API DEBUG] Event ${eventIndex} gazeData is not an array:`, typeof gazeDataArray);
            }
        });

        // Find screenshot from any event that has one
        const screenshotPath = gazeEvents.find(event => event.screenshotPath)?.screenshotPath || null;

        let publicScreenshotUrl: string | null = null;
        if (screenshotPath){
            try {
                const supabase = await createServerSupabaseClient();
                const { data: signedUrlData } = await supabase.storage.from('screenshots').createSignedUrl(screenshotPath, 3600);

                if (signedUrlData?.signedUrl){
                    publicScreenshotUrl = signedUrlData.signedUrl;
                }
            } catch (error) {
                console.error('Error generating signed URL:', error);
            }
        }

        // Calculate statistics
        const startTime = gazeEvents[0]?.createdAt;
        const endTime = gazeEvents[gazeEvents.length - 1]?.createdAt;
        const duration = startTime && endTime ? new Date(endTime).getTime() - new Date(startTime).getTime() : 0;

        const stats = {
            totalPoints: heatmapData.length,
            timeRange: {
                start: startTime,
                end: endTime,
            },
            avgIntensity: heatmapData.length > 0 ? heatmapData.reduce((sum, point) => sum + point.value, 0) / heatmapData.length : 0,
            duration: duration,
            processingStats: {
                totalEventsProcessed: gazeEvents.length,
                totalPointsProcessed: totalPointsProcessed,
                validPointsExtracted: validPointsCount,
                conversionRate: totalPointsProcessed > 0 ? (validPointsCount / totalPointsProcessed * 100).toFixed(1) + '%' : '0%'
            }
        };

        const metadata = {
            totalEvents: gazeEvents.length,
            hasScreenshots: !!publicScreenshotUrl,
            dataQuality: totalPointsProcessed > 0 ? validPointsCount / totalPointsProcessed : 0,
            screenshotPath: screenshotPath,
            avgPointsPerEvent: gazeEvents.length > 0 ? (totalPointsProcessed / gazeEvents.length).toFixed(1) : 0
        };

        console.log(`[API] Retrieved ${gazeEvents.length} gaze events for session ${sessionId}`);
        console.log(`[API] Processed ${totalPointsProcessed} total gaze points`);
        console.log(`[API] Generated ${heatmapData.length} valid heatmap points`);
        console.log(`[API] Data quality: ${(metadata.dataQuality * 100).toFixed(1)}%`);
        console.log(`[API] Average points per event: ${metadata.avgPointsPerEvent}`);
        console.log(`[API] Using screenshot: ${publicScreenshotUrl}`);

        // Return appropriate response
        if (heatmapData.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'No heatmap data available for this session',
                message: `Found ${gazeEvents.length} events with ${totalPointsProcessed} total points, but none had valid coordinates`,
                sessionId,
                screenshot: publicScreenshotUrl,
                stats,
                metadata
            }, { status: 200 });
        }

        return NextResponse.json(
            {
                success: true,
                sessionId,
                heatmapData,
                screenshot: publicScreenshotUrl,
                stats,
                metadata
            },
            {
                status: 200,
                headers: {
                    'Cache-Control': 'public, max-age=300, s-maxage=600'
                }
            }
        );
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error('[API ERROR]:', errorMessage);

        return NextResponse.json(
            {success: false, message: 'Internal Server Error', error: errorMessage},
            {status: 500}
        );
    }
}