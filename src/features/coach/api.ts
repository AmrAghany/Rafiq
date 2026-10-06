import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import { streamCoach } from '@/features/ai/api';
import { AiError } from '@/features/ai/errors';
import { useAuth } from '@/features/auth/AuthProvider';
import { localDateKey } from '@/features/today/timeline';
import { supabase } from '@/lib/supabase';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export const chatKey = (uid: string | undefined) => ['chat', uid] as const;

/** The most recent messages, oldest first. */
export function useChatHistory({ enabled = true, limit = 50 } = {}) {
  const { session } = useAuth();
  const uid = session?.user.id;
  return useQuery({
    queryKey: chatKey(uid),
    enabled: !!uid && enabled,
    queryFn: async (): Promise<ChatMessage[]> => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, role, content')
        .eq('user_id', uid!)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return ((data ?? []) as ChatMessage[]).reverse();
    },
  });
}

/** Sends a message and exposes the streaming reply. */
export function useCoachChat() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<{ question: string; reply: string } | null>(null);
  const [error, setError] = useState<AiError | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (message: string) => {
      const text = message.trim();
      if (!text || pending) return;
      setError(null);
      setPending({ question: text, reply: '' });
      const controller = new AbortController();
      abortRef.current = controller;
      const now = new Date();
      try {
        await streamCoach(
          {
            message: text,
            localDate: localDateKey(now),
            localTime: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
          },
          (delta) => setPending((p) => (p ? { ...p, reply: p.reply + delta } : p)),
          controller.signal,
        );
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof AiError ? e : new AiError('network'));
      } finally {
        abortRef.current = null;
        await queryClient.invalidateQueries({ queryKey: chatKey(session?.user.id) });
        setPending(null);
      }
    },
    [pending, queryClient, session?.user.id],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  return { send, stop, pending, error, clearError: () => setError(null) };
}
