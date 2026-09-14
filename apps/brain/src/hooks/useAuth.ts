'use client';

import { useState, useEffect, useRef } from 'react';
import { sharedSignOut, getSession } from '@sre-monorepo/lib';
import { createClient } from '@sre-monorepo/lib';

interface User {
  id: string;
  email: string;
  name: string;
}

// TAMBAH COUNTER UNTUK DEBUG
let hookInstanceCounter = 0;
const SESSION_CLOCK_SKEW_SECONDS = 30;

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const logoutInProgressRef = useRef(false);

  // TAMBAH INSTANCE ID
  const [instanceId] = useState(() => {
    hookInstanceCounter++;
    return hookInstanceCounter;
  });

  console.log(`useAuth instance #${instanceId} initialized`);

  const getSigninUrl = () =>
    `${process.env.NEXT_PUBLIC_MAIN_APP_URL || 'http://main.localhost:3000'}/signin`;

  const redirectToSignin = () => {
    if (typeof window !== 'undefined') {
      window.location.href = getSigninUrl();
    }
  };

  const signOutAndRedirect = async (reason: string) => {
    if (logoutInProgressRef.current) {
      return;
    }

    logoutInProgressRef.current = true;

    try {
      await sharedSignOut(supabase);
    } catch (error) {
      console.error(
        `[Instance #${instanceId}] Sign out failed (${reason}):`,
        error
      );
    } finally {
      setUser(null);
      setLoading(false);
      redirectToSignin();
    }
  };

  const isSessionExpired = (expiresAt?: number | null) => {
    if (!expiresAt) {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);
    return expiresAt <= now - SESSION_CLOCK_SKEW_SECONDS;
  };

  const fetchUser = async () => {
    console.log(`[Instance #${instanceId}] fetchUser called`);
    setLoading(true);

    try {
      const session = await getSession(supabase);
      console.log(`[Instance #${instanceId}] Session exists:`, !!session);

      if (!session?.user) {
        console.log(
          `[Instance #${instanceId}] No session, setting user to null`
        );
        await signOutAndRedirect('session missing');
        return;
      }

      if (isSessionExpired(session.expires_at)) {
        console.warn(
          `[Instance #${instanceId}] Session expired at ${
            session.expires_at
          }, forcing logout`
        );
        await signOutAndRedirect('session expired');
        return;
      }

      console.log(`=== [Instance #${instanceId}] USER AUTH DEBUG ===`);
      console.log('User ID:', session.user.id);
      console.log('User email:', session.user.email);

      let userName = session.user.email?.split('@')[0] || 'Unknown';

      try {
        console.log(`[Instance #${instanceId}] Fetching from /api/user/profile...`);

        const response = await fetch('/api/user/profile', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        console.log(
          `[Instance #${instanceId}] Response status:`,
          response.status
        );

        if (response.ok) {
          const data = await response.json();
          console.log(`[Instance #${instanceId}] API Response:`, data);

          if (data.user?.name) {
            userName = data.user.name;
            console.log(`[Instance #${instanceId}] Got name from API:`, userName);
          }
        }
      } catch (apiError) {
        console.log(`[Instance #${instanceId}] API Error:`, apiError);
      }

      const userData: User = {
        id: session.user.id,
        email: session.user.email || '',
        name: userName,
      };

      logoutInProgressRef.current = false;
      console.log(`[Instance #${instanceId}] Setting user data:`, userData);
      setUser(userData);
      console.log('========================');
    } catch (error) {
      console.error(`[Instance #${instanceId}] Error:`, error);
      await signOutAndRedirect('session retrieval failed');
    } finally {
      console.log(`[Instance #${instanceId}] Setting loading to false`);
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await sharedSignOut(supabase);
      setUser(null);
      redirectToSignin();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  useEffect(() => {
    console.log(`[Instance #${instanceId}] useEffect triggered`);
    fetchUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[Instance #${instanceId}] Auth state changed:`, event);

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        logoutInProgressRef.current = false;
        setTimeout(() => {
          fetchUser();
        }, 100);
      } else if (event === 'SIGNED_OUT') {
        logoutInProgressRef.current = true;
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      console.log(`[Instance #${instanceId}] Cleaning up`);
      subscription.unsubscribe();
    };
  }, []);

  // Debug state changes
  useEffect(() => {
    console.log(
      `[Instance #${instanceId}] State update - User:`,
      user?.name,
      'Loading:',
      loading
    );
  }, [user, loading]);

  return {
    user,
    loading,
    signOut,
    refreshUser: fetchUser,
    isAuthenticated: !!user,
  };
}
