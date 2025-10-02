// src/app/api/xapi/logs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {prisma} from "@sre-monorepo/lib"  // Sesuaikan path import sesuai struktur monorepo Anda

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Filters
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const activityType = searchParams.get('activityType');
    const userId = searchParams.get('userId');
    const search = searchParams.get('search');

    // Build where clause
    const whereClause: any = {};
    
    if (startDate && endDate) {
      whereClause.timestamp = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    if (userId) {
      whereClause.userId = userId;
    }

    // PERBAIKAN: Fetch SEMUA data dulu untuk filter di memory
    // Ini karena context dan actor dalam format JSON
    const allLogs = await prisma.xapiStatement.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      },
      orderBy: { timestamp: 'desc' }
    });

    // Transform ALL logs first
    let transformedLogs = allLogs.map((log: any) => {
      const actor = typeof log.actor === 'string' ? JSON.parse(log.actor) : log.actor;
      const verb = typeof log.verb === 'string' ? JSON.parse(log.verb) : log.verb;
      const object = typeof log.object === 'string' ? JSON.parse(log.object) : log.object;
      const context = typeof log.context === 'string' ? JSON.parse(log.context) : log.context;

      return {
        id: log.id,
        timestamp: log.timestamp,
        actorName: actor?.name || log.user?.email || log.user?.name || 'Unknown',
        actorEmail: actor?.mbox?.replace('mailto:', '') || log.user?.email || '',
        verb: verb?.display?.['en-US'] || 'interacted',
        verbId: verb?.id || '',
        objectName: object?.definition?.name?.['en-US'] || 'Unknown Object',
        objectId: object?.id || '',
        interactionType: context?.extensions?.interactionType || 'unknown',
        sessionId: log.sessionId,
        sequence: log.sequence
      };
    });

    // APPLY FILTERS FIRST before pagination
    
    // Filter by activity type
    if (activityType && activityType !== 'all') {
      transformedLogs = transformedLogs.filter(log => 
        log.interactionType === activityType
      );
    }

    // Filter by search
    if (search && search.trim() !== '') {
      const searchLower = search.toLowerCase().trim();
      transformedLogs = transformedLogs.filter(log => 
        log.actorName.toLowerCase().includes(searchLower) ||
        log.actorEmail.toLowerCase().includes(searchLower) ||
        log.verb.toLowerCase().includes(searchLower) ||
        log.objectName.toLowerCase().includes(searchLower)
      );
    }

    // NOW apply pagination AFTER filtering
    const totalFiltered = transformedLogs.length;
    const paginatedLogs = transformedLogs.slice(skip, skip + limit);

    // Get unique activity types from ALL data (not filtered)
    const allContexts = allLogs.map(log => {
      const context = typeof log.context === 'string' ? JSON.parse(log.context) : log.context;
      return context?.extensions?.interactionType;
    }).filter(Boolean);
    
    const activityTypes = [...new Set(allContexts)];

    return NextResponse.json({
      success: true,
      data: {
        logs: paginatedLogs,
        pagination: {
          total: totalFiltered, // Total AFTER filter
          page,
          limit,
          totalPages: Math.ceil(totalFiltered / limit)
        },
        filters: {
          activityTypes
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching logs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch logs' },
      { status: 500 }
    );
  }
}