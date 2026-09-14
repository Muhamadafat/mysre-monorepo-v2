// apps/main/actions.ts
'use server';

import { redirect } from 'next/navigation';
import {
  createServerSupabaseClient,
  sharedSignIn,
  sharedSignUp,
  sharedSignOut,
} from '@sre-monorepo/lib';
import { prisma } from '@sre-monorepo/lib';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { sendXapiStatementServer } from '@sre-monorepo/lib';

interface AuthResult {
  error?: string;
  success?: boolean;
}

export async function signIn(formData: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  const supabase = await createServerSupabaseClient();
  const cookieDomain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;
  const shouldSetCookieDomain =
    !!cookieDomain && !cookieDomain.includes('localhost');

  try {
    const { user } = await sharedSignIn(supabase, formData);

    if (user) {
      console.log('Sign in successful for user:', user.email);

      // Verifikasi session tersimpan dengan benar
      const {
        data: { session },
      } = await supabase.auth.getSession();
      console.log('Session after sign in:', !!session);

      if (session) {
        // 🚀 ADD: Track login event dengan xAPI
        const projectId = `${session.user.id}_${Math.floor(session.expires_at! / 1000)}`;

        try {
          await sendXapiStatementServer(
            {
              verb: {
                id: 'http://adlnet.gov/expapi/verbs/logged-in',
                display: { 'en-US': 'logged in' },
              },
              object: {
                id: 'main/signin',
                definition: {
                  name: { 'en-US': 'Sign In to Main App' },
                  type: 'http://adlnet.gov/expapi/activities/interaction',
                },
              },
              result: {
                completion: true,
                success: true,
              },
              context: {
                extensions: {
                  projectId: projectId,
                  flowStep: 'session-start',
                  loginSource: 'main',
                  authMethod: 'email-password',
                  userEmail: session.user.email,
                  loginTimestamp: new Date().toISOString(),
                },
              },
            },
            session,
            'main'
          );

          console.log('xAPI login tracking sent successfully');
        } catch (xapiError) {
          console.error('Failed to send xAPI login tracking:', xapiError);
          // Don't fail the login if xAPI fails
        }

        // Set additional cookie untuk debugging
        const cookieStore = await cookies();
        cookieStore.set('auth-debug', 'authenticated', {
          ...(shouldSetCookieDomain ? { domain: cookieDomain } : {}),
          path: '/',
          httpOnly: false,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24, // 24 hours
        });

        // Tunggu sebentar agar cookie ter-set dengan benar
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Revalidate cache - lebih spesifik
        revalidatePath('/', 'layout');
        revalidatePath('/brain', 'layout');
        revalidatePath('/signin');

        // Force refresh session di cookies
        const refreshToken = session.refresh_token;
        const accessToken = session.access_token;

        if (refreshToken && accessToken) {
          // Set tokens secara eksplisit
          cookieStore.set(
            `sb-${process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF}-auth-token`,
            JSON.stringify({
              access_token: accessToken,
              refresh_token: refreshToken,
              expires_at: session.expires_at,
              token_type: 'bearer',
              user: session.user,
            }),
            {
              ...(shouldSetCookieDomain ? { domain: cookieDomain } : {}),
              path: '/',
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              maxAge: 60 * 60 * 24 * 7, // 7 days
            }
          );
        }
      } else {
        return { error: 'Session not created properly' };
      }
    } else {
      return { error: 'Sign in failed: No user data returned.' };
    }

    // Return success without redirect - let client handle redirect
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Sign in failed:', msg);
    return { error: msg };
  }
}

export async function signUp(formData: {
  fullName: string;
  sid: string;
  email: string;
  group: string;
  password: string;
}): Promise<AuthResult> {
  const supabase = await createServerSupabaseClient();
  const cookieDomain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;
  const shouldSetCookieDomain =
    !!cookieDomain && !cookieDomain.includes('localhost');

  try {
    const { user } = await sharedSignUp(supabase, formData);

    if (user) {
      // Simpan data tambahan ke database
      await prisma.user.upsert({
        where: { id: user.id },
        update: {
          email: formData.email,
          name: formData.fullName,
          group: formData.group,
          nim: formData.sid,
        },
        create: {
          id: user.id,
          email: formData.email,
          name: formData.fullName,
          role: 'USER',
          group: formData.group,
          password: '',
          isEmailVerified: true, // Auto-verified (Supabase email confirmation disabled)
          nim: formData.sid,
        },
      });

      console.log('Sign up successful for user:', user.email);

      // Verifikasi session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        // 🚀 ADD: Track registration + login event dengan xAPI
        const projectId = `${session.user.id}_${Math.floor(session.expires_at! / 1000)}`;

        try {
          // Track sign up event
          await sendXapiStatementServer(
            {
              verb: {
                id: 'http://adlnet.gov/expapi/verbs/registered',
                display: { 'en-US': 'registered' },
              },
              object: {
                id: 'main/signup',
                definition: {
                  name: { 'en-US': 'Sign Up to Main App' },
                  type: 'http://adlnet.gov/expapi/activities/interaction',
                },
              },
              result: {
                completion: true,
                success: true,
              },
              context: {
                extensions: {
                  projectId: projectId,
                  flowStep: 'registration',
                  registrationSource: 'main',
                  userGroup: formData.group,
                  userNim: formData.sid,
                  userEmail: session.user.email,
                  registrationTimestamp: new Date().toISOString(),
                },
              },
            },
            session,
            'main'
          );

          // Track automatic login after signup
          await sendXapiStatementServer(
            {
              verb: {
                id: 'http://adlnet.gov/expapi/verbs/logged-in',
                display: { 'en-US': 'logged in' },
              },
              object: {
                id: 'main/auto-signin-after-signup',
                definition: {
                  name: { 'en-US': 'Auto Sign In After Registration' },
                  type: 'http://adlnet.gov/expapi/activities/interaction',
                },
              },
              result: {
                completion: true,
                success: true,
              },
              context: {
                extensions: {
                  projectId: projectId,
                  flowStep: 'session-start',
                  loginSource: 'main',
                  authMethod: 'auto-after-signup',
                  userEmail: session.user.email,
                  autoLoginTimestamp: new Date().toISOString(),
                },
              },
            },
            session,
            'main'
          );

          console.log('xAPI signup and login tracking sent successfully');
        } catch (xapiError) {
          console.error('Failed to send xAPI signup tracking:', xapiError);
          // Don't fail the signup if xAPI fails
        }
        // Set debug cookie
        const cookieStore = await cookies();
        cookieStore.set('auth-debug', 'authenticated', {
          ...(shouldSetCookieDomain ? { domain: cookieDomain } : {}),
          path: '/',
          httpOnly: false,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24,
        });

        // Tunggu sebentar
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Revalidate cache
        revalidatePath('/', 'layout');
        revalidatePath('/brain', 'layout');

        // Set session tokens
        const refreshToken = session.refresh_token;
        const accessToken = session.access_token;

        if (refreshToken && accessToken) {
          cookieStore.set(
            `sb-${process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF}-auth-token`,
            JSON.stringify({
              access_token: accessToken,
              refresh_token: refreshToken,
              expires_at: session.expires_at,
              token_type: 'bearer',
              user: session.user,
            }),
            {
              ...(shouldSetCookieDomain ? { domain: cookieDomain } : {}),
              path: '/',
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              maxAge: 60 * 60 * 24 * 7,
            }
          );
        }
      }
    } else {
      return { error: 'Sign up failed: No user data returned from Supabase.' };
    }

    // Return success without redirect
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Sign up failed:', msg);
    return { error: msg };
  }
}

export async function signOut() {
  const supabase = await createServerSupabaseClient();

  try {
    await sharedSignOut(supabase);

    // Clear debug cookie
    const cookieStore = await cookies();
    cookieStore.delete('auth-debug');

    console.log('Sign out successful');
  } catch (error) {
    console.error('Sign out error:', error);
  }

  // Revalidate dan redirect
  revalidatePath('/', 'layout');

  // Redirect ke halaman signin
  const loginUrl = `${process.env.NEXT_PUBLIC_MAIN_APP_URL || 'http://main.localhost:3000'}/signin`;
  redirect(loginUrl);
}

export async function resetPassword(email: string): Promise<AuthResult> {
  const supabase = await createServerSupabaseClient();

  try {
    // Auto-detect environment berdasarkan NEXT_PUBLIC_MAIN_APP_URL
    let baseUrl: string;

    if (process.env.NEXT_PUBLIC_MAIN_APP_URL) {
      baseUrl = process.env.NEXT_PUBLIC_MAIN_APP_URL;
    } else if (process.env.NODE_ENV === 'production') {
      baseUrl = 'https://riset.web.id';
    } else {
      baseUrl = 'http://main.localhost:3000';
    }

    // Canonical recovery target is /update-password; Supabase appends token_hash & type automatically.
    const redirectUrl = `${baseUrl}/api/auth/confirm?next=/update-password`;

    console.log('Reset password redirect URL:', redirectUrl);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    if (error) {
      console.error('Reset password error:', error);
      return { error: error.message };
    }

    return {
      success: true,
      // message: 'Link reset password telah dikirim ke email Anda. Silakan cek inbox atau spam folder.'
    };
  } catch (error) {
    console.error('Reset password failed:', error);
    return { error: 'Gagal mengirim email reset password. Silakan coba lagi.' };
  }
}

// 🆕 NEW: Update Password Function (dipanggil setelah user klik link di email)
export async function updatePassword(newPassword: string): Promise<AuthResult> {
  const supabase = await createServerSupabaseClient();

  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      console.error('Update password error:', error);
      return { error: error.message };
    }

    return {
      success: true,
      // message: 'Password berhasil diperbarui. Silakan login dengan password baru Anda.'
    };
  } catch (error) {
    console.error('Update password failed:', error);
    return { error: 'Gagal memperbarui password. Silakan coba lagi.' };
  }
}
