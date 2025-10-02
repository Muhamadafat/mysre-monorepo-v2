// src/app/api/xapi/export/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {prisma} from "@sre-monorepo/lib"  // Sesuaikan path import sesuai struktur monorepo Anda

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      startDate, 
      endDate, 
      format, 
      columns,
      activityType,
      userId,
      search,
      exportType, // 'raw' | 'quantitative'
      quantitativeColumns
    } = body;

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

    // Fetch all matching logs
    const logs = await prisma.xapiStatement.findMany({
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

    // Transform logs
    let transformedLogs = logs.map((log: any) => {
      const actor = typeof log.actor === 'string' ? JSON.parse(log.actor) : log.actor;
      const verb = typeof log.verb === 'string' ? JSON.parse(log.verb) : log.verb;
      const object = typeof log.object === 'string' ? JSON.parse(log.object) : log.object;
      const context = typeof log.context === 'string' ? JSON.parse(log.context) : log.context;
      const result = typeof log.result === 'string' ? JSON.parse(log.result) : log.result;

      return {
        id: log.id,
        timestamp: log.timestamp.toISOString(),
        actorName: actor?.name || log.user?.email || log.user?.name || 'Unknown',
        actorEmail: actor?.mbox?.replace('mailto:', '') || log.user?.email || '',
        verb: verb?.display?.['en-US'] || 'interacted',
        verbId: verb?.id || '',
        objectName: object?.definition?.name?.['en-US'] || 'Unknown Object',
        objectDescription: object?.definition?.description?.['en-US'] || '',
        objectId: object?.id || '',
        interactionType: context?.extensions?.interactionType || 'unknown',
        projectId: context?.extensions?.projectId || '',
        sessionId: log.sessionId || '',
        sequence: log.sequence || 0,
        success: result?.success || false,
        completion: result?.completion || false,
        userAgent: context?.extensions?.userAgent || ''
      };
    });

    // Apply filters for RAW export
    if (exportType !== 'quantitative') {
      if (activityType && activityType !== 'all') {
        transformedLogs = transformedLogs.filter(log => 
          log.interactionType === activityType
        );
      }

      if (search && search.trim() !== '') {
        const searchLower = search.toLowerCase().trim();
        transformedLogs = transformedLogs.filter(log => 
          log.actorName.toLowerCase().includes(searchLower) ||
          log.actorEmail.toLowerCase().includes(searchLower) ||
          log.verb.toLowerCase().includes(searchLower) ||
          log.objectName.toLowerCase().includes(searchLower)
        );
      }
    }

    let exportData: any[];

    // QUANTITATIVE EXPORT - Aggregate per student
    if (exportType === 'quantitative') {
      const studentMap = new Map<string, any>();

      transformedLogs.forEach(log => {
        const key = log.actorEmail || log.actorName;
        
        if (!studentMap.has(key)) {
          studentMap.set(key, {
            actorName: log.actorName,
            actorEmail: log.actorEmail,
            totalPdfUpload: 0,
            totalNodeClick: 0,
            totalEdgeClick: 0,
            totalChatInteraction: 0,
            totalAnnotation: 0,
            totalTextSelection: 0,
            totalPdfView: 0,
            totalActivities: 0
          });
        }

        const student = studentMap.get(key);
        student.totalActivities++;

        // Count by interaction type
        switch (log.interactionType) {
          case 'pdf-upload':
            student.totalPdfUpload++;
            break;
          case 'node-click':
            student.totalNodeClick++;
            break;
          case 'edge-click':
            student.totalEdgeClick++;
            break;
          case 'chat-interaction':
            student.totalChatInteraction++;
            break;
          case 'annotation-save':
            student.totalAnnotation++;
            break;
          case 'text-selection':
            student.totalTextSelection++;
            break;
          case 'pdf-view':
            student.totalPdfView++;
            break;
        }
      });

      // Convert map to array
      const allStudentData = Array.from(studentMap.values());

      // Filter by selected columns
      const selectedQuantCols = quantitativeColumns || [
        'actorName', 'totalPdfUpload', 'totalNodeClick', 'totalEdgeClick',
        'totalChatInteraction', 'totalAnnotation', 'totalActivities'
      ];

      exportData = allStudentData.map(student => {
        const filtered: any = {};
        selectedQuantCols.forEach((col: string) => {
          filtered[col] = student[col];
        });
        return filtered;
      });

    } else {
      // RAW EXPORT
      const selectedColumns = columns || [
        'timestamp', 'actorName', 'verb', 'objectName', 'interactionType'
      ];

      exportData = transformedLogs.map(log => {
        const filtered: any = {};
        selectedColumns.forEach((col: string) => {
          filtered[col] = log[col as keyof typeof log];
        });
        return filtered;
      });
    }

    // Generate export based on format
    if (format === 'csv') {
      const columnNames = exportType === 'quantitative' 
        ? (quantitativeColumns || [])
        : (columns || []);
      const csv = convertToCSV(exportData, columnNames);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="xapi-export-${exportType}-${Date.now()}.csv"`
        }
      });
    } 
    else if (format === 'json') {
      return new NextResponse(JSON.stringify(exportData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="xapi-export-${exportType}-${Date.now()}.json"`
        }
      });
    }
    else if (format === 'xlsx') {
      return NextResponse.json({
        success: true,
        message: 'XLSX format requires client-side processing',
        data: exportData
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid format specified' },
      { status: 400 }
    );

  } catch (error) {
    console.error('❌ Error exporting data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to export data' },
      { status: 500 }
    );
  }
}

// Helper function to convert JSON to CSV
function convertToCSV(data: any[], columns: string[]): string {
  if (data.length === 0) return '';

  // Header row
  const header = columns.join(',');
  
  // Data rows
  const rows = data.map(item => {
    return columns.map(col => {
      const value = item[col];
      // Escape commas and quotes in CSV
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value ?? '';
    }).join(',');
  });

  return [header, ...rows].join('\n');
}