/**
 * Manual credit grant for monthly upgrade (tier change from weekly).
 *
 * Usage:
 *   node scripts/fix-stripe-monthly-upgrade.mjs
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const EMAIL = 'softeng356@gmail.com';
const ADD_CREDITS = 500;

const { data: user, error } = await supabase
  .from('users')
  .select('id, email, credit_balance, stripe_tier')
  .eq('email', EMAIL)
  .maybeSingle();

if (error || !user) { console.error('User not found'); process.exit(1); }

const newBalance = (user.credit_balance || 0) + ADD_CREDITS;

await supabase.from('users').update({
  credit_balance: newBalance,
  updated_at: new Date().toISOString()
}).eq('id', user.id);

await supabase.from('credit_transactions').insert({
  user_id: user.id,
  type: 'purchase',
  credits: ADD_CREDITS,
  balance_after: newBalance,
  source: 'purchase',
  metadata: { reason: 'monthly_upgrade_backfill', tier: user.stripe_tier }
});

console.log(`Granted ${ADD_CREDITS} credits. ${user.credit_balance} → ${newBalance}`);
