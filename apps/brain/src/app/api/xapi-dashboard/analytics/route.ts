// src/app/api/xapi/analytics/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@sre-monorepo/lib";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const projectId = searchParams.get('projectId');

    // Build where clause
    const whereClause: any = {};
    
    if (startDate && endDate) {
      whereClause.timestamp = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    if (projectId) {
      whereClause.context = {
        path: ['extensions', 'projectId'],
        equals: projectId
      };
    }

    // 1. Total Statistics
    const totalStudents = await prisma.xapiStatement.findMany({
      where: whereClause,
      select: { userId: true },
      distinct: ['userId']
    });

    const totalActivities = await prisma.xapiStatement.count({
      where: whereClause
    });

    // 2. Most Common Activity
    const allStatements = await prisma.xapiStatement.findMany({
      where: whereClause,
      select: { context: true }
    });

    const activityCount: Record<string, number> = {};
    allStatements.forEach((stmt: any) => {
      const context = typeof stmt.context === 'string' ? JSON.parse(stmt.context) : stmt.context;
      const interactionType = context?.extensions?.interactionType;
      if (interactionType) {
        activityCount[interactionType] = (activityCount[interactionType] || 0) + 1;
      }
    });

    const mostCommonActivity = Object.entries(activityCount)
      .sort(([, a], [, b]) => b - a)[0];

    // 3. Average Interaction Time (simplified - count per session)
    const sessions = await prisma.xapiStatement.findMany({
      where: whereClause,
      select: { sessionId: true },
      distinct: ['sessionId']
    });

    const avgInteractionTime = sessions.length > 0 
      ? Math.round(totalActivities / sessions.length) 
      : 0;

    // 4. Activity Distribution (for bar chart)
    const activityDistribution = Object.entries(activityCount)
      .map(([name, count]) => ({
        name: name.replace(/-/g, ' ').replace(/_/g, ' '),
        count
      }))
      .sort((a, b) => b.count - a.count);

    // 5. Activity Over Time (for line chart) - FIXED
    let timelineData: Array<{date: Date, count: bigint}> = [];
    
    if (whereClause.timestamp?.gte && whereClause.timestamp?.lte) {
      timelineData = await prisma.$queryRaw`
        SELECT 
          DATE("timestamp") as date,
          COUNT(*) as count
        FROM "XapiStatement"
        WHERE "timestamp" >= ${whereClause.timestamp.gte}::timestamp 
          AND "timestamp" <= ${whereClause.timestamp.lte}::timestamp
        GROUP BY DATE("timestamp")
        ORDER BY date ASC
      `;
    } else {
      timelineData = await prisma.$queryRaw`
        SELECT 
          DATE("timestamp") as date,
          COUNT(*) as count
        FROM "XapiStatement"
        GROUP BY DATE("timestamp")
        ORDER BY date ASC
      `;
    }

    const activityTimeline = timelineData.map((item: any) => ({
      date: item.date.toISOString().split('T')[0],
      count: Number(item.count)
    }));

    // Response
    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalStudents: totalStudents.length,
          totalActivities,
          mostCommonActivity: mostCommonActivity 
            ? { name: mostCommonActivity[0], count: mostCommonActivity[1] }
            : { name: 'N/A', count: 0 },
          avgInteractionTime
        },
        activityDistribution,
        activityTimeline
      }
    });

  } catch (error) {
    console.error('❌ Error fetching analytics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
}