import { useEffect } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';

import { forget, identify, onCustomerInfoChange, syncSubscription } from './purchases';
import { useEntitlements } from './useTier';

/**
 * Connects the signed-in member to RevenueCat and keeps the server mirror fresh when
 * their purchases change (renewals, refunds, family sharing) while the app is open.
 */
export function PurchasesSync() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const { refresh } = useEntitlements();

  useEffect(() => {
    if (!uid) {
      void forget();
      return;
    }
    let unsubscribe = () => {};
    void identify(uid)
      .then(() => {
        unsubscribe = onCustomerInfoChange(() => {
          void syncSubscription()
            .then(() => refresh())
            .catch(() => {
              // The webhook will catch up.
            });
        });
      })
      .catch(() => {
        // Purchases are unavailable (e.g. no store account); free features still work.
      });
    return () => unsubscribe();
  }, [uid, refresh]);

  return null;
}
