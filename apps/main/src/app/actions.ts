// apps/main/actions.ts
'use server';

import { redirect } from 'next/navigation';
import {
  registerUser,
  authenticateUser,
  signOutUser,
  requestPasswordReset,
  resetPasswordWithToken,
  AuthError,
} from '@sre-monorepo/lib/server';
import { sendXapiStatementServer } from '@sre-monorepo/lib/server';
import { revalidatePath } from 'next/cache';

interface AuthResult {
  error?: string;
  success?: boolean;
}

function buildSession(user: { id: string; email: string; name: string | null; role: string }) {
  const expires_at = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
  return { user: { id: user.id, email: user.email, name: user.name, role: user.role }, expires_at };
}

export async function signIn(formData: { email: string; password: string }): Promise<AuthResult> {
  try {
    const user = await authenticateUser(formData);
    console.log('Sign in successful for user:', user.email);

    const session = buildSession(user);
    const sessionId = `${user.id}_${Math.floor(session.expires_at / 1000)}`;

    try {
      await sendXapiStatementServer(
        {
          verb: { id: 'http://adlnet.gov/expapi/verbs/logged-in', display: { 'en-US': 'logged in' } },
          object: {
            id: 'main/signin',
            definition: { name: { 'en-US': 'Sign In to Main App' }, type: 'http://adlnet.gov/expapi/activities/interaction' },
          },
          result: { completion: true, success: true },
          context: {
            extensions: {
              sessionId,
              flowStep: 'session-start',
              loginSource: 'main',
              authMethod: 'email-password',
              userEmail: user.email,
              loginTimestamp: new Date().toISOString(),
            },
          },
        },
        session,
        'main'
      );
    } catch (xapiError) {
      console.error('Failed to send xAPI login tracking:', xapiError);
    }

    revalidatePath('/', 'layout');
    revalidatePath('/brain', 'layout');
    revalidatePath('/signin');

    return { success: true };
  } catch (error: any) {
    console.error('Sign in failed:', error.message);
    return { error: error instanceof AuthError ? error.message : 'Sign in failed' };
  }
}

export async function signUp(formData: {
  fullName: string;
  sid: string;
  email: string;
  group: string;
  password: string;
}): Promise<AuthResult> {
  try {
    const user = await registerUser({
      email: formData.email,
      password: formData.password,
      name: formData.fullName,
      group: formData.group,
      nim: formData.sid,
    });

    console.log('Sign up successful for user:', user.email);

    const session = buildSession(user);
    const sessionId = `${user.id}_${Math.floor(session.expires_at / 1000)}`;

    try {
      await sendXapiStatementServer(
        {
          verb: { id: 'http://adlnet.gov/expapi/verbs/registered', display: { 'en-US': 'registered' } },
          object: {
            id: 'main/signup',
            definition: { name: { 'en-US': 'Sign Up to Main App' }, type: 'http://adlnet.gov/expapi/activities/interaction' },
          },
          result: { completion: true, success: true },
          context: {
            extensions: {
              sessionId,
              flowStep: 'registration',
              registrationSource: 'main',
              userGroup: formData.group,
              userNim: formData.sid,
              userEmail: user.email,
              registrationTimestamp: new Date().toISOString(),
            },
          },
        },
        session,
        'main'
      );

      await sendXapiStatementServer(
        {
          verb: { id: 'http://adlnet.gov/expapi/verbs/logged-in', display: { 'en-US': 'logged in' } },
          object: {
            id: 'main/auto-signin-after-signup',
            definition: {
              name: { 'en-US': 'Auto Sign In After Registration' },
              type: 'http://adlnet.gov/expapi/activities/interaction',
            },
          },
          result: { completion: true, success: true },
          context: {
            extensions: {
              sessionId,
              flowStep: 'session-start',
              loginSource: 'main',
              authMethod: 'auto-after-signup',
              userEmail: user.email,
              autoLoginTimestamp: new Date().toISOString(),
            },
          },
        },
        session,
        'main'
      );
    } catch (xapiError) {
      console.error('Failed to send xAPI signup tracking:', xapiError);
    }

    revalidatePath('/', 'layout');
    revalidatePath('/brain', 'layout');

    return { success: true };
  } catch (error: any) {
    console.error('Sign up failed:', error.message);
    return { error: error instanceof AuthError ? error.message : 'Sign up failed' };
  }
}

export async function signOut() {
  try {
    await signOutUser();
    console.log('Sign out successful');
  } catch (error) {
    console.error('Sign out error:', error);
  }

  revalidatePath('/', 'layout');

  const loginUrl = `${process.env.NEXT_PUBLIC_MAIN_APP_URL || 'http://main.lvh.me:3000'}/signin`;
  redirect(loginUrl);
}

export async function resetPassword(email: string): Promise<AuthResult> {
  try {
    await requestPasswordReset(email);
    return { success: true };
  } catch (error: any) {
    console.error('Reset password failed:', error);
    return { error: 'Gagal mengirim email reset password. Silakan coba lagi.' };
  }
}

export async function updatePassword(token: string, newPassword: string): Promise<AuthResult> {
  try {
    await resetPasswordWithToken(token, newPassword);
    return { success: true };
  } catch (error: any) {
    console.error('Update password failed:', error);
    return { error: error instanceof AuthError ? error.message : 'Gagal memperbarui password. Silakan coba lagi.' };
  }
}
