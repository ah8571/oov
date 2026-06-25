# RevenueCat Setup

## Recommended Order

1. Create store-side products in App Store Connect and Google Play Console.
2. Create the RevenueCat project and mirror those products there.
3. Add the RevenueCat mobile SDK.
4. Gate entitlements in the app.
5. Add webhook handling on the backend if you want server-side subscription awareness.

## Store Products

Create at least:

- Monthly subscription
- Optional annual subscription
- Optional intro trial / promo variant

Keep product IDs aligned across iOS and Android if possible.

## RevenueCat Project Setup

In RevenueCat:

1. Create a project for Emmaline.
2. Add both mobile apps:
	- iOS bundle ID
	- Android package name
3. Create products.
4. Create an entitlement, for example `pro`.
5. Create an offering, for example `default`.

## Mobile SDK Work

The mobile app does not have RevenueCat installed yet. The expected package is:

```bash
npm --prefix mobile install react-native-purchases
```

Initialize RevenueCat near app startup, likely from [mobile/src/App.js](../mobile/src/App.js).

Typical app flow:

1. Configure with iOS or Android public SDK key.
2. Log in with the app user ID after authentication.
3. Fetch customer info.
4. Check whether entitlement `pro` is active.

## App Surfaces To Update

- Replace placeholder billing UI in [mobile/src/screens/UpgradeScreen.js](../mobile/src/screens/UpgradeScreen.js)
- Add purchase button(s)
- Add restore purchases
- Add entitlement-aware gating

## Source Of Truth

Recommended setup for Emmaline:

1. RevenueCat is the source of truth for subscription status.
2. The mobile app checks entitlements locally for UX.
3. The backend optionally syncs billing state for usage limits or server-side gating.

## Webhook Events To Handle

If you sync subscription state to the backend, subscribe to:

- `initial_purchase`
- `renewal`
- `cancellation`
- `expiration`
- `uncancellation`
- `billing_issue`

These can update billing state in the backend user model.

## Secrets Needed

- RevenueCat iOS public SDK key
- RevenueCat Android public SDK key
- Optional RevenueCat webhook secret on backend

## Minimal First Milestone

1. Install SDK
2. Configure SDK
3. Show offerings on Upgrade screen
4. Purchase and restore
5. Gate premium UI off `pro` entitlement

## Another version

For this repo, the store app identifiers are:

iOS bundle ID: com.emmaline.app
Android package name: com.emmaline.app
That lets you keep the setup aligned across stores and RevenueCat.

Fastest viable rollout
Use this minimal plan:

Create one monthly subscription in App Store Connect.
Create the same monthly subscription in Google Play Console.
Create one RevenueCat project with both apps attached.
Mirror that one product into RevenueCat.
Create one entitlement: pro.
Create one offering: default.
Then I can wire the SDK and paywall in the app.
Recommended first product ID:

emmaline_pro_monthly
Optional later:

emmaline_pro_annual
free trial or intro offer inside the store product config, not as a separate core product unless you need a separate promo structure
App Store Connect
Do this first because Apple tends to be the more procedural one.

Open App Store Connect and make sure the Emmaline app record already exists.
Go to Apps -> Emmaline -> Subscriptions.
Create a subscription group, for example Emmaline Pro.
Create a new auto-renewable subscription.
Product ID: emmaline_pro_monthly
Reference name: Emmaline Pro Monthly
Duration: 1 month
Set the price tier.
Add the display name and description.
Fill in the review screenshot / metadata Apple asks for.
Important App Store details:

Make sure Agreements, Tax, and Banking is complete or Apple will block subscription readiness.
If you want to submit quickly, skip annual and skip intro offer for now unless you already know the pricing.
Apple often wants the subscription to be attached and metadata complete before review.
Google Play Console
Then create the matching Android subscription.

Open Play Console and select the Emmaline app.
Go to Monetize -> Products -> Subscriptions.
Create a subscription.
Product ID: emmaline_pro_monthly
Name: Emmaline Pro Monthly
Billing period: monthly
Set base plan and price.
Activate it.
Important Play details:

You need a payments profile set up.
The app record should already exist in Play Console.
Keep the same product ID as iOS to reduce confusion in RevenueCat.

RevenueCat
Once both store products exist, do the RevenueCat pass.

Create a RevenueCat project for Emmaline.
Add the iOS app with bundle ID com.emmaline.app.
Add the Android app with package name com.emmaline.app.
Connect App Store Connect.
Connect Google Play.
Import or add product emmaline_pro_monthly.
Create entitlement pro.
Attach emmaline_pro_monthly to pro.
Create offering default.
Add the monthly package to default.
If you see both stores connected and one entitlement/offering created, the dashboard side is effectively in place.

What matters for submission

both store apps exist
one monthly subscription exists in both stores
RevenueCat project exists
entitlement pro exists
offering default exists
That is enough to unblock app-side integration next.

Current app status
The mobile app still has placeholder billing UI in mobile/src/screens/UpgradeScreen.js, and RevenueCat is not installed yet in mobile/package.json. So after you finish the console setup, the next concrete engineering step is to install react-native-purchases and replace that placeholder screen.

Strong recommendation
For speed, choose these decisions now and stick to them:

entitlement name: pro
offering name: default
first product ID: emmaline_pro_monthly
no annual plan tonight
no trial tonight unless you already want one and know the exact terms