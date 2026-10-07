import { create } from 'zustand';

import { emptyDraft, type OnboardingDraft } from './validation';

interface OnboardingState {
  draft: OnboardingDraft;
  update: (patch: Partial<OnboardingDraft>) => void;
  reset: () => void;
}

/**
 * In-memory only: the draft holds health answers, so it is never written to device
 * storage. It is saved to Supabase in one call when the member confirms their plan.
 */
export const useOnboarding = create<OnboardingState>()((set) => ({
  draft: emptyDraft,
  update: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
  reset: () => set({ draft: emptyDraft }),
}));
