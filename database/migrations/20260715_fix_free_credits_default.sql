-- Fix: ensure free_credits_granted and credit_balance both default to 20.
-- The grantFreeCredits() function skips if free_credits_granted > 0,
-- so the defaults must include the actual balance, not just the flag.

ALTER TABLE public.users ALTER COLUMN free_credits_granted SET DEFAULT 20;
ALTER TABLE public.users ALTER COLUMN credit_balance SET DEFAULT 20;

-- Fix existing users who have the flag set to 20 but balance at 0.
UPDATE public.users
SET credit_balance = 20
WHERE free_credits_granted = 20
  AND credit_balance = 0;
