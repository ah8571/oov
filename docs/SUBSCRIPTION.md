Phase 1: Build The Shell
Do this before any store submission.

In RevenueCat, create the app entries for iOS and Android.
Copy the RevenueCat public SDK keys into your app env.
In RevenueCat, create:
entitlement: pro
offering: default
In Apple and Google, create the subscription products with the exact product IDs you want.
In RevenueCat, add those store products and attach them to the default offering and pro entitlement.
In the app, make sure these flows exist:
fetch offerings
show package/product
purchase
restore purchases
check entitlement state
Treat the paywall as “shell architecture” until the store products are usable. That means the app code is real, but the product catalog and store verification are still being proven.
At that point, RevenueCat is structurally set up even if nothing has been reviewed by Apple yet.

Phase 2: Unblock Android First
This is the fastest practical verification path.

Build a Play-compatible Android AAB, not the preview APK.
Upload that AAB to a closed testing track in Google Play.
Add test users in Play Console license testing / closed test.
Activate the subscription product in Google Play.
Wait for Play product propagation.
Install the closed-test build from Play, not by sideloading.
Test:
offerings load from RevenueCat
purchase sheet appears
test purchase succeeds
pro entitlement becomes active
restore works
Important point: the closed test does not generate a new “entitlement key.” What it gives you is a real Play Billing environment where RevenueCat can finally verify the subscription end to end.

Phase 3: Stabilize Before Apple Review
Do not submit to Apple review yet if login is still questionable.

Finish auth/login fixes in TestFlight or local device testing.
Keep RevenueCat wired to the real iOS product IDs.
Make sure the paywall and restore flow work at the app level.
Confirm the app is stable enough that a reviewer can create/sign in and reach subscription screens without getting stuck.
Phase 4: Apple First Subscription Submission
Apple is the annoying one.

Create the iOS subscription in App Store Connect.
Attach that subscription to the app version you plan to submit.
Submit the app build and first subscription together.
After approval, test again through TestFlight / sandbox as needed.