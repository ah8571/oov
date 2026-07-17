## Integrate new grok real time voice

## App Store changes

- Update name to Ali
- Work through key words for people to better find the apps (like STT or TTS or how other apps are phrasing it)
- 30 character new name for apple
Ali: Reader, Learn Languages (28) 

## Create promo code workflows for influencers

## SKAN w/ Apple set up

## Start reaching out to influencers 

## Perhaps start working on viral dance videos... 

## Keep working through app upgrades

how can we make a "Language learning" zone, how could we incorporate flashcards, how can people upload a text for the assistant to read and translate with them in real time


## AppsFlyer:
dev key
iOS app ID confirmation
the SKAdNetwork ID list from AppsFlyer or your ad partners
confirmation that RevenueCat -> AppsFlyer integration is enabled
your first-pass Conversion Studio mapping choice, probably:
subscription = high
trial/paywall conversion = medium

Mapping (suggested): Fine values — 1 = Registration, 2 = FreeTrial (placeholder), 3 = Subscription. Coarse: Low = Session, High = Subscribe. Configure this in AppsFlyer Conversion Studio.

What I changed: registration is logged in api.js; subscribe is logged in revenueCatService.js. Guidance added to .env.example and app.config.js reads EXPO_PUBLIC_IOS_SKADNETWORK_IDS.

SKAN IDs: get canonical IDs from each ad network dashboard or AppsFlyer Settings → SKAdNetwork. For TikTok/Meta use their partner docs (they publish SKAN IDs) or copy the list AppsFlyer shows for those partners.

Next: if you paste TikTok (and optionally Meta) SKAN IDs I will create an EAS secret EXPO_PUBLIC_IOS_SKADNETWORK_IDS and trigger a production TestFlight build for validation.

Note: installs are measured by SKAN postbacks; in-app appsFlyer.logEvent(...) provides the events Conversion Studio maps to conversion values for ROAS later.

## Provider keys:
Gemini live: https://ai.google.dev/gemini-api/docs/live-api

## Affiliate draft inputs:
1 creator slug/name to use as the first real landing page
rough promo code format you want, even if temporary
optional headline/testimonial copy for that creator page

## Testing readiness

one fresh iPhone test build after the AppsFlyer/SKAN values are in

##

Remodeling the subscription method to go to web for payments (ie to get payment for the app asap) along with incorporating privacy oriented skan conventions. 

## Weekly allotments 

Google Play Console → Monetize → Subscriptions → create emmaline_pro_weekly_30min and emmaline_pro_weekly_60min

RevenueCat → Products → the new products should auto-import within a few minutes after step 1

RevenueCat → Offerings → add the two weekly products as packages in your existing offering (alongside the monthly one)

RevenueCat → Entitlements → attach both to the pro entitlement (same as the monthly product)

Then the webhook I added at /api/billing/revenuecat-webhook will detect purchases of those product IDs and grant the corresponding seconds automatically.

Same flow for App Store Connect when you get to iOS, just with different product IDs if you want platform-specific pricing.

Free trial reduced from 300s (5 min) → 120s (2 min) in billingService.js
Migration created to update the database default
Weekly tier config defined: emmaline_pro_weekly_30min → 1800s, emmaline_pro_weekly_60min → 3600s
What you need to do in RevenueCat:

Create two new products: emmaline_pro_weekly_30min ($10) and emmaline_pro_weekly_60min ($15)
Create corresponding Google Play subscription products
Attach them to the pro entitlement
Add them to your offering alongside the monthly product
What I still need to add:
A RevenueCat webhook that grants prepaid_seconds_balance when a purchase is confirmed. Without this, RevenueCat manages the entitlement but the backend doesn't know to add minutes to the user's balance. Let me add that now.

Summary of what's done:

Free trial: 300s → 120s (2 min) — both in code and migration ready to apply.

Weekly tiers defined:

Product ID	Price	Minutes
emmaline_pro_weekly_30min	$10/week	30 min
emmaline_pro_weekly_60min	$15/week	60 min
RevenueCat webhook: POST /api/billing/revenuecat-webhook — when RevenueCat sends an INITIAL_PURCHASE or RENEWAL event for one of the weekly products, the backend auto-grants the corresponding prepaid seconds.

What you need to do:

Run the migration: 20260714_reduce_free_trial_seconds.sql against your Supabase DB
In RevenueCat dashboard, create the two weekly products and link them to Google Play subscriptions
In RevenueCat → Integrations → add a webhook pointing to https://api.emmaline.app/api/billing/revenuecat-webhook
Keep the existing emmaline_pro_monthly for the monthly Pro tier

---

