# Affiliate Payout Options

Commissions tracked in `commission_ledger`, aggregated by `monthly_commission_report`.

## Comparison

| | Wise (manual) | Wise API | Stripe Connect | PayPal Payouts |
|---|---|---|---|---|
| **FX fee** | 0.4–0.6% | 0.4–0.6% | 1% + 1% conversion | ~3–4% hidden in rate |
| **Int'l fee** | None | None | 1% + 1% conversion | 2% |
| **Collect from influencer** | Email | Email | Tax ID, bank account, identity verification | Email or phone |
| **To send** | Log into Wise, enter email + amount | `POST /v1/transfers` | Stripe Dashboard → Connect → pay out | Log into PayPal, enter email + amount |
| **Effort** | None | Medium | Low (already in stack) | None |

## Recommended: manual Wise → Wise API when scaling

**Now (1–10 affiliates):** Manual Wise transfers. Collect their email, pay from Wise dashboard.

**Later (10+):** Wise API script. Query `monthly_commission_report`, call `POST /v1/transfers`, mark paid on webhook.

### What to ask the influencer

> What email should I send your monthly commission to? If you don't have Wise, it's free at wise.com — you'll get a link to claim the payment.

### Wise API reference

```
Base:  https://api.wise.com
Sandbox: https://api.sandbox.transferwise.tech
Auth: Bearer token from Wise dashboard

POST /v1/accounts          — Register recipient (email-only)
POST /v1/quotes            — Get fee + rate quote
POST /v1/transfers         — Send payment
GET  /v1/transfers/{id}    — Check status
```

Webhook: `transferStateChange` → auto-mark `commission_ledger.status = 'paid'`.

### Why not Stripe Connect?

Connect's 1% + 1% international fee and identity verification requirement makes it worse for small, international payouts.

### Why not an affiliate platform?

Impact, PartnerStack, Rewardful charge 15–30% of commissions. Only worth it at 50+ affiliates.

### Marking paid

```sql
UPDATE commission_ledger SET status = 'paid', paid_at = NOW()
WHERE promo_code = 'X' AND status = 'pending';
```

## Contract language

> Commissions are [X%] of net subscription revenue from referred users. Payouts monthly in USD via Wise. Payee responsible for currency conversion/transfer fees.

(Replace [X%] with rate — typically 10–20%.)
