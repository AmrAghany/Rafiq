-- Phase 5: RevenueCat mirror. Rows are written only by the revenuecat-webhook and
-- sync-subscription Edge Functions (service role), from RevenueCat's subscriber API.

alter table public.subscriptions
  add column will_renew boolean not null default false,
  add column management_url text,
  add column synced_at timestamptz;

comment on column public.subscriptions.status is
  'none | trial | active | cancelled (active until period end, will not renew) | billing_issue | expired';

alter table public.subscriptions
  add constraint subscriptions_status_check
  check (status in ('none', 'trial', 'active', 'cancelled', 'billing_issue', 'expired'));
