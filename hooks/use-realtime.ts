'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface RealtimeUpdate {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: Record<string, unknown>;
  oldRecord?: Record<string, unknown>;
}

interface UseRealtimeOptions {
  table: string;
  filter?: string;
  onInsert?: (record: Record<string, unknown>) => void;
  onUpdate?: (record: Record<string, unknown>, oldRecord: Record<string, unknown>) => void;
  onDelete?: (record: Record<string, unknown>) => void;
  enabled?: boolean;
}

interface UseRealtimeReturn {
  isConnected: boolean;
  lastUpdate: RealtimeUpdate | null;
  error: string | null;
  subscribe: () => void;
  unsubscribe: () => void;
}

export function useRealtime(options: UseRealtimeOptions): UseRealtimeReturn {
  const {
    table,
    filter,
    onInsert,
    onUpdate,
    onDelete,
    enabled = true,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<RealtimeUpdate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const subscribe = useCallback(() => {
    if (!enabled) return;

    const supabase = createClient();
    const channelName = `${table}:${filter || 'all'}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter,
        },
        (payload) => {
          const update: RealtimeUpdate = {
            type: payload.eventType as RealtimeUpdate['type'],
            table,
            record: payload.new as Record<string, unknown>,
            oldRecord: payload.old as Record<string, unknown>,
          };

          setLastUpdate(update);

          switch (payload.eventType) {
            case 'INSERT':
              onInsert?.(payload.new as Record<string, unknown>);
              break;
            case 'UPDATE':
              onUpdate?.(
                payload.new as Record<string, unknown>,
                payload.old as Record<string, unknown>
              );
              break;
            case 'DELETE':
              onDelete?.(payload.old as Record<string, unknown>);
              break;
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setError(null);
        } else if (status === 'CHANNEL_ERROR') {
          setIsConnected(false);
          setError('Failed to connect to realtime channel');
        }
      });

    channelRef.current = channel;
  }, [table, filter, enabled, onInsert, onUpdate, onDelete]);

  const unsubscribe = useCallback(() => {
    if (channelRef.current) {
      const supabase = createClient();
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    subscribe();
    return () => unsubscribe();
  }, [subscribe, unsubscribe]);

  return {
    isConnected,
    lastUpdate,
    error,
    subscribe,
    unsubscribe,
  };
}

// Specialized hook for leaderboard updates
export function useLeaderboardRealtime(onRankChange?: (userId: string, newRank: number) => void) {
  return useRealtime({
    table: 'users',
    onUpdate: (record) => {
      if (record.id && record.rank) {
        onRankChange?.(record.id as string, record.rank as number);
      }
    },
  });
}

// Specialized hook for profile updates
export function useProfileRealtime(
  userId: string,
  onUpdate?: (profile: Record<string, unknown>) => void
) {
  return useRealtime({
    table: 'users',
    filter: `id=eq.${userId}`,
    onUpdate,
    enabled: !!userId,
  });
}

export default useRealtime;
