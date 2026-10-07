// Thin wrapper around RevenueCat's SDK. Members are identified to RevenueCat by their
// Supabase user id, which is how the webhook and sync functions find them.

import { Platform } from 'react-native';
import Purchases, { PURCHASES_ERROR_CODE, type PurchasesPackage } from 'react-native-purchases';

import { callFunction } from '@/features/ai/api';
import { env } from '@/lib/env';

import type { SubscriptionRow } from './entitlements';
import { orderPlans } from './plans';

const apiKey =
  Platform.select({ ios: env.revenueCatIosKey, android: env.revenueCatAndroidKey }) ?? '';

/** False in builds without a RevenueCat key (local development). */
export const purchasesAvailable = () => apiKey.length > 0;

let configured = false;

export async function identify(userId: string): Promise<void> {
  if (!purchasesAvailable()) return;
  if (!configured) {
    Purchases.configure({ apiKey, appUserID: userId });
    configured = true;
  } else {
    await Purchases.logIn(userId);
  }
}

export async function forget(): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.logOut();
  } catch {
    // Already anonymous: nothing to do.
  }
}

export function onCustomerInfoChange(listener: () => void): () => void {
  if (!configured) return () => {};
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}

/** Asks the server to mirror the latest RevenueCat state into public.subscriptions. */
export function syncSubscription() {
  return callFunction<{ subscription: SubscriptionRow }>('sync-subscription', {});
}

export async function loadPlans() {
  const offerings = await Purchases.getOfferings();
  return orderPlans(offerings.current?.availablePackages ?? []);
}

export type PurchaseOutcome = 'purchased' | 'cancelled' | 'pending';

export class PurchaseError extends Error {
  constructor(public code: 'network' | 'not_allowed' | 'store') {
    super(code);
  }
}

function toPurchaseError(e: unknown): PurchaseError {
  const code = (e as { code?: string }).code;
  if (code === PURCHASES_ERROR_CODE.NETWORK_ERROR) return new PurchaseError('network');
  if (code === PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR)
    return new PurchaseError('not_allowed');
  return new PurchaseError('store');
}

export async function buy(pkg: PurchasesPackage): Promise<PurchaseOutcome> {
  try {
    await Purchases.purchasePackage(pkg);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return 'cancelled';
    if (code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) return 'pending';
    throw toPurchaseError(e);
  }
  await syncSubscription();
  return 'purchased';
}

export async function restore(): Promise<void> {
  try {
    await Purchases.restorePurchases();
  } catch (e) {
    throw toPurchaseError(e);
  }
  await syncSubscription();
}

export function manageSubscriptions(): Promise<void> {
  return Purchases.showManageSubscriptions();
}
