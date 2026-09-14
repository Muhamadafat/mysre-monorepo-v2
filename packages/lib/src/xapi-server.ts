import { prisma } from './prisma';
import type { Session } from '@supabase/supabase-js';

interface XapiStatementPayload {
  actor: {
    mbox?: string;
    name?: string;
    [key: string]: any;
  };
  verb: {
    id: string;
    display: { [lang: string]: string };
    [key: string]: any;
  };
  object: {
    id: string;
    definition?: {
      name?: { [lang: string]: string };
      description?: { [lang: string]: string };
      type?: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
  result?: {
    duration?: string;
    completion?: boolean;
    success?: boolean;
    [key: string]: any;
  };
  context?: {
    extensions?: { [key: string]: any };
    [key: string]: any;
  };
  userId?: string;
  projectId?: string;
}

export async function sendXapiStatementServer(
  statement: Omit<XapiStatementPayload, 'actor' | 'userId'>,
  session: Session | null,
  subdomain: string
) {
  if (!session?.user?.id) {
    console.warn(
      'No active session found for xAPI statement (server-side). Statement not recorded.'
    );
    return;
  }

  const projectId = `${session.user.id}_${Math.floor(session.expires_at! / 1000)}`;

  const fullStatement: XapiStatementPayload = {
    actor: {
      mbox: `mailto:${session.user.email}`,
      name: session.user.user_metadata?.name || session.user.email,
    },
    userId: session.user.id,
    projectId: projectId,
    context: {
      ...statement.context,
      extensions: {
        'https://example.com/extensions/subdomain': subdomain,
        projectId: projectId,
        ...(statement.context?.extensions || {}),
      },
    },
    ...statement,
  };

  try {
    let sequence = 1;
    if (projectId && session.user.id) {
      const lastStatement = await prisma.xapiStatement.findFirst({
        where: {
          userId: session.user.id,
          projectId: projectId,
        },
        orderBy: { sequence: 'desc' },
      });
      sequence = (lastStatement?.sequence || 0) + 1;
    }

    // ✅ DEBUG: Log untuk tracking
    console.log('=== xAPI SERVER SAVE DEBUG ===');
    console.log('UserId:', session.user.id);
    console.log('SessionId:', projectId);
    console.log('Sequence:', sequence);
    console.log('Verb:', fullStatement.verb.display['en-US']);
    console.log('Object ID:', fullStatement.object.id);
    console.log('=============================');

    // ✅ SAVE: With sequence and projectId
    await prisma.xapiStatement.create({
      data: {
        actor: fullStatement.actor,
        verb: fullStatement.verb,
        object: fullStatement.object,
        result: fullStatement.result || '',
        context: fullStatement.context || '',
        userId: fullStatement.userId || null,
        projectId: projectId,
        sequence: sequence,
      },
    });

    console.log(
      'xAPI statement recorded (server-side):',
      fullStatement.verb.display['en-US'],
      fullStatement.object.id
    );
  } catch (error) {
    console.error('Failed to record xAPI statement (server-side):', error);
  }
}
