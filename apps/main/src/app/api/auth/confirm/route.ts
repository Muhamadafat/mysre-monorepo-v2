// app/api/auth/confirm/route.ts
import { type EmailOtpType } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@sre-monorepo/lib';

export async function GET(request: NextRequest) {
  console.log('🔵 API /api/auth/confirm called');
  
  const { searchParams } = new URL(request.url);
  
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/';

  console.log('📋 Params:', { 
    hasCode: !!code,
    hasTokenHash: !!token_hash, 
    type, 
    next 
  });

  const baseUrl = process.env.NEXT_PUBLIC_MAIN_APP_URL || 'http://main.lvh.me:3000';
  const supabase = await createServerSupabaseClient();

  // Flow 1: PKCE dengan code parameter
  if (code) {
    console.log('🔄 Using PKCE flow (exchangeCodeForSession)');
    
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      console.log('✅ PKCE session created:', data.session.user.email);
      
      const isPasswordReset = next.includes('reset-password');
      
      if (isPasswordReset) {
        const resetUrl = new URL('/reset-password', baseUrl);
        resetUrl.searchParams.set('verified', 'true');
        
        // 🔑 WORKAROUND: Pass tokens via URL (temporary untuk bypass cookie issue)
        resetUrl.searchParams.set('access_token', data.session.access_token);
        resetUrl.searchParams.set('refresh_token', data.session.refresh_token);
        
        console.log('🎯 Password reset: Redirecting to:', resetUrl.toString());
        return NextResponse.redirect(resetUrl);
      } else {
        const redirectUrl = new URL(next, baseUrl);
        redirectUrl.searchParams.set('verified', 'true');
        
        console.log('🎯 Email verification: Redirecting to:', redirectUrl.toString());
        return NextResponse.redirect(redirectUrl);
      }
    } else {
      console.error('❌ PKCE exchange failed:', error);
      const errorUrl = new URL('/signin', baseUrl);
      errorUrl.searchParams.set('error', 'Could not verify code');
      return NextResponse.redirect(errorUrl);
    }
  }

  // Flow 2: Magic Link dengan token_hash + type
  if (token_hash && type) {
    console.log('🔄 Using Magic Link flow (verifyOtp)');
    
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error) {
      console.log('✅ Magic Link verified');
      
      if (type === 'recovery' || type === 'email_change') {
        const resetUrl = new URL('/reset-password', baseUrl);
        resetUrl.searchParams.set('verified', 'true');
        
        console.log('🎯 Password reset: Redirecting to:', resetUrl.toString());
        return NextResponse.redirect(resetUrl);
      } else {
        const redirectUrl = new URL(next, baseUrl);
        redirectUrl.searchParams.set('verified', 'true');
        
        console.log('🎯 Email verification: Redirecting to:', redirectUrl.toString());
        return NextResponse.redirect(redirectUrl);
      }
    } else {
      console.error('❌ Magic Link verification failed:', error);
    }
  }

  console.log('⚠️ Missing both code and token_hash');
  console.log('🔴 Redirecting to signin with error');
  
  const errorUrl = new URL('/signin', baseUrl);
  errorUrl.searchParams.set('error', 'Could not verify token');
  return NextResponse.redirect(errorUrl);
}