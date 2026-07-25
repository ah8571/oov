/**
 * One-off: fix billing state + grant credits for a Stripe subscription
 * that was processed before the webhook fix was deployed.
 *
 * Usage:
 *   set SUPABASE_SERVICE_KEY=sk_...
 *   node scripts/fix-stripe-billing.mjs softeng356@gmail.com
 */
const EMAIL = process.argv[2];
if (!EMAIL) {
  console.error('Usage: node fix-stripe-billing.mjs <email>');
  process.exit(1);
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://<project>.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_KEY) {
  console.error('Set SUPABASE_SERVICE_KEY env var (Supabase service_role key)');
  process.exit(1);
}

const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 1. Find user
const { data: user, error: userErr } = await supabase
  .from('users')
  .select('id, email, credit_balance')
  .eq('email', EMAIL)
  .maybeSingle();

if (userErr || !user) {
  console.error('User not found:', userErr?.message || EMAIL);
  process.exit(1);
}
console.log('Found user:', user.id, user.email);

// 2. Update billing entitlements (stripe_status + is_pro_active)
const { error: billingErr } = await supabase
  .from('user_billing_entitlements')
  .upsert({
    user_id: user.id,
    stripe_status: 'active',
    stripe_tier: 'weekly',
    is_pro_active: true,
    stripe_updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' });

if (billingErr) {
  console.error('Billing upsert failed:', billingErr.message);
  process.exit(1);
}
console.log('Billing state set to pro_stripe (weekly)');

// 3. Grant 100 credits
const CREDITS = 100;
const newBalance = (user.credit_balance || 0) + CREDITS;

const { error: creditErr } = await supabase
  .from('users')
  .update({ credit_balance: newBalance, updated_at: new Date().toISOString() })
  .eq('id', user.id);

if (creditErr) {
  console.error('Credit update failed:', creditErr.message);
  process.exit(1);
}

// 4. Record transaction
const { error: txErr } = await supabase
  .from('credit_transactions')
  .insert({
    user_id: user.id,
    type: 'purchase',
    credits: CREDITS,
    balance_after: newBalance,
    source: 'purchase',
    metadata: { reason: 'manual_stripe_backfill', email: EMAIL }
  });

if (txErr) {
  console.error('Transaction record failed:', txErr.message);
}

console.log(`Done — ${CREDITS} credits granted. Balance: ${user.credit_balance} → ${newBalance}`);
