'use client';

import { useEffect, useState } from 'react';
import { useUser, SignIn } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';

export default function CLIAuthPage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'authenticating' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  const callback = searchParams.get('callback');

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      setStatus('authenticating');
      return;
    }

    // User is signed in, generate token and redirect
    async function generateTokenAndRedirect() {
      try {
        const response = await fetch('/api/cli/auth/token', {
          method: 'POST',
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to generate token');
        }

        const data = await response.json();

        if (callback) {
          // Redirect to CLI callback
          const callbackUrl = new URL(callback);
          callbackUrl.searchParams.set('token', data.token);
          callbackUrl.searchParams.set('userId', data.userId);
          callbackUrl.searchParams.set('username', data.username);

          setStatus('success');

          // Small delay to show success message
          setTimeout(() => {
            window.location.href = callbackUrl.toString();
          }, 1000);
        } else {
          setStatus('error');
          setError('No callback URL provided');
        }
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Unknown error');

        if (callback) {
          const callbackUrl = new URL(callback);
          callbackUrl.searchParams.set('error', err instanceof Error ? err.message : 'Unknown error');
          setTimeout(() => {
            window.location.href = callbackUrl.toString();
          }, 2000);
        }
      }
    }

    generateTokenAndRedirect();
  }, [isLoaded, isSignedIn, callback, user]);

  // Show sign in if not authenticated
  if (status === 'authenticating' || (!isLoaded && status === 'loading')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="max-w-md w-full mx-4">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
              CCgather CLI Authentication
            </h1>
            <p className="text-[var(--color-text-muted)]">
              Sign in with GitHub to connect your CLI
            </p>
          </div>
          <SignIn
            appearance={{
              elements: {
                rootBox: 'mx-auto',
                card: 'bg-[var(--color-bg-secondary)] border border-white/10',
              },
            }}
            redirectUrl={`/cli/auth?callback=${encodeURIComponent(callback || '')}`}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
      <div className="text-center">
        {status === 'loading' && (
          <>
            <div className="w-12 h-12 border-4 border-[var(--color-claude-coral)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-[var(--color-text-muted)]">Preparing authentication...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-6xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-green-400 mb-2">Authentication Successful!</h1>
            <p className="text-[var(--color-text-muted)]">Redirecting to CLI...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-6xl mb-4">❌</div>
            <h1 className="text-2xl font-bold text-red-400 mb-2">Authentication Failed</h1>
            <p className="text-[var(--color-text-muted)]">{error}</p>
            {callback && (
              <p className="text-sm text-[var(--color-text-muted)] mt-4">Redirecting...</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
