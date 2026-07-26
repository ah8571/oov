## Promo code workflow for influencers

[ ] add promo code for monthly 
[ ] verify promo insertion works
[ ] test promo code creation
[ ] email automation


## Start reaching out to influencers 



## perhaps just take a day to create dancing cat/ animal videos....



## Appflyer integration w privacy (SKAN and android privacy box)

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

