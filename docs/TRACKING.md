
Mobile install attribution for ads: an MMP like Tenjin, AppsFlyer, Adjust, Branch, or Singular

For Emmaline’s current stage, the simplest sensible stack would be:

GTM + GA4 + pixels on the website
Sentry in app/backend
PostHog or Firebase for in-app events
Tenjin or Branch for mobile install attribution

Promo/referral codes
This is the easiest MVP path.
Each creator gets a code like EMMA-SARA.
User enters it during signup, onboarding, or upgrade.
You credit the creator in your backend.

Creator-specific landing pages or links
Creators send users to a landing page first, not directly to the app store.
That page captures UTMs and creator IDs, then routes to the store.
Better for attribution, but still imperfect once the user crosses into the store unless paired with an MMP or deferred deep linking.

Deep-link attribution via Branch / AppsFlyer / Tenjin
This is the more “real” mobile-growth setup.
It helps you tie campaign/creator clicks to installs and early opens.
More powerful, more setup.

The clean architecture is:

Branch link carries creator/campaign identity
app receives referral/deep-link data on first open
backend stores attribution against the user record
subscription purchase event is linked to that user
creator payout logic is computed from your backend records
That way:

Branch helps with attribution capture
your backend remains the payout source of truth
For Emmaline, I would recommend this model:

Attribution model

each creator gets a unique Branch link
Branch link contains creator ID / campaign ID
app captures attribution on install/open
backend stores:
creator_id
campaign_id
attributed_at
source_platform
deep_link_id or external attribution ID
when the user subscribes, backend links that subscription to the attributed creator
optional promo code exists as a manual fallback

You want the external tool to help capture attribution.
You want your backend to decide credit.

That means storing things like:

attributed creator ID
campaign ID
deep link ID
first-touch timestamp
last-touch timestamp if you care
install/open attribution source
subscription event linked to the user
payout status / commission ledger

## AppFlyer

What Features You Need from AppsFlyerTo successfully run and price this setup, you must configure three specific features:AppsFlyer Smart Script: This is a free developer tool included in AppsFlyer's package. It is critical for passing affiliate data from your web landing page into the app store link.OneLink (Deferred Deep Linking): AppsFlyer's core deep-linking engine. It ensures that the user is routed to the correct app store based on their device while carrying the affiliate payload.ROI360 Add-on: As mentioned previously, you will need this add-on to accurately track the lifetime subscription events, renewals, and cancellations that occur downstream from that original TikTok click. [Gemini]

AppsFlyer includes their deep linking engine (OneLink) and their web-to-app routing mechanism (Smart Script) right in their "Zero" (Free) and "Growth" plans. [Gemini]

Structuring Your Test URLWhen you configure your OneLink deep links in the dashboard to pass to your TikTok affiliates, ensure your URL looks similar to this template to capture the right data:https://onelink.mepid: The media source (e.g., TikTok Affiliate Network).af_sub1: The specific ID of your partner so you know exactly who to credit for the percentage payout. [Gemini citing AppsFlyer]

## Subscription System

RevenueCat vs. Superwall: The DistinctionRevenueCat: This is your backend subscription engine. It handles StoreKit/Google Play billing, tracks renewals, calculates lifetime value (LTV), and tells your app if a user is premium.Superwall: This is your frontend remote paywall manager. It handles the UI layout of your pricing page, triggers A/B testing on different subscription offers, and forces the user to see a paywall right after they download the app.

How It Connects to AppsFlyer (No Enterprise Plan Needed)To bypass AppsFlyer's expensive ROI360 enterprise add-on while you are testing, your subscription engine can bridge the gap using standard client-side SDK code:Capture Affiliate ID: The user clicks the TikTok link, hits your landing page, and downloads the app. AppsFlyer's SDK catches the af_sub1 affiliate parameter via deferred deep linking.Pass to the Subscription Tool: You grab that affiliate ID directly from AppsFlyer's SDK client-side and save it as a "Customer Attribute" / "User Property" inside RevenueCat or Superwall.Painless Revenue Export: When it’s time to pay out your affiliate partners their revenue percentage, you don't need AppsFlyer to tell you the math. You simply log into your RevenueCat dashboard, export a CSV of your active subscribers sorted by that custom Affiliate ID attribute, and calculate the revenue share directly from the exact dollars processed. [Gemini]