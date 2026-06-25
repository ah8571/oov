# App Store Publishing

- [x] Enroll in the Apple Developer Program/ Google Play's
- [x] If publishing as an organization, obtain a D-U-N-S number and complete organization enrollment
- [x] confirm each of the accounts with Apple and Google 
- [x] Confirm whether the Play Console account is a personal account created after November 13, 2023
- [x] If the new Google personal-account testing gate applies, plan for at least 12 opted-in testers over 14 continuous days before requesting production access
- [x] Any sensitive capture of behavior or info is explained clearly in-product and in policy text
- [x] Confirm the Privacy Policy accurately explains:
   - native phone functions that track private info
   - AI processing and third-party service involvement
   - account data collected and retained
   - deletion and support contact path
   - COPPA compliance if targeting kids
- [ ] Confirm any required-reason API usage is declared with an allowed Apple reason
- [ still need to set up billing ] Reviewers will not encounter placeholder content, unfinished flows, dead buttons, or confusing states
- [ ] Confirm the support email address works with a support page (H. Tomar)
- [ ] Publish a stable Privacy Policy URL
- [ ] Publish a stable Terms of Use URL
- [ ] Confirm both legal pages are reachable without logging in
- [x] Confirm the Terms of Use align with the current product behavior and billing model
- [ ] If using subscriptions now or soon, prepare subscription terms, restore flow, and account-management language
- [x] Confirm all sensitive behaviors are user-consented and clearly explained with a user prompt agreement in app
- [x] Confirm users can initiate account deletion inside the app or through a clearly documented in-app path
- [x] Confirm export or account-data access planning is at least minimally defined if referenced in policy text
- [ ] Confirm no internal-only switches, debug menus, or developer tools are exposed in release builds
- [ ] Confirm crash reporting and error telemetry are enabled for release builds
- [ need to set up email verification when initially creating for spare emails ] Confirm auth works in release builds
- [ ] Test the main user flows end to end on a physical iPhone and Android, not just on a desktop simulator
- [ ] "Check localizations (if supporting multiple languages)" @Hartdrawss
- [n/a] Test on multiple device sizes where possible
- [ ] Verify there are no crashes in the core flows
- [x] Confirm logout works in release builds
- [ ] Confirm deep links or universal/app links work if the app uses them
- [ ] Confirm Android target API level satisfies the current Google Play requirement
- [ ] Verify permission-denied flows behave gracefully
- [ need to remove developer language ] Verify network failure states behave gracefully ie with airplane mode
- [ ] Run a smoke test on the exact build intended for store submission
- [ ] App icon for Apple at 1024x1024
- [ ] App icon for Google Play at 512x512
- [ ] minimum of two screenshots showing, though recommended 3+ for reviewers: iPhone / Android screenshots for required sizes; iPhone (Mandatory Base): 6.9-inch (e.g., iPhone 16 Pro Max): 1320 x 2868 px (Portrait); Android: General Rule (Phones): Minimum Dimension: 320 px; Maximum Dimension: 3840 px; Aspect Ratio: Must not exceed 2:1 (e.g., 9:16 portrait or 16:9 landscape)
- [ ] iPhone / Android screenshots for required sizes; screenshot specifications:
   1. "Apple App Store (App Store Connect) Apple requires you to submit specific mandatory device sizes. The store will automatically scale these to fit other compatible devices if exact sizes are not uploaded. You can upload up to 10 screenshots per device category.
   - iPhone (Mandatory Base):6.9-inch (e.g., iPhone 16 Pro Max): 1320 x 2868 px (Portrait) or 2868 x 1320 px (Landscape)
   - iPad (Mandatory Base):13-inch (e.g., iPad Pro M4/M5): 2064 x 2752 px (Portrait) or 2752 x 2064 px (Landscape)
   - Apple Watch: Series 10/Ultra: 422 x 514 px
   - Apple TV: 1920 x 1080 px or 3840 x 2160 px
   - macOS: Minimum of 1280 x 800 px (must maintain a 16:10 aspect ratio).
   - [More here https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/]
   2. Google Play Store (Play Console)Google Play requires a minimum of 2 and a maximum of 8 screenshots per device category.
   - General Rule (Phones): Minimum Dimension: 320 px; Maximum Dimension: 3840 px; Aspect Ratio: Must not exceed 2:1 (e.g., 9:16 portrait or 16:9 landscape).
   - Tablets (7–10 inch) & Chromebooks: Minimum Dimension: 1080 px; Maximum Dimension: 7680 px
   - Wear OS: 384 x 384 px minimum
   - Android TV: 1280 x 720 px landscape" (Gemini citing Google Help, Choicely, Screenshotwhale and MobileAction)
- [ ] Google Play feature graphic ("a mandatory 1024x500 pixel banner image required to publish an app or game on the Google Play Store. Think of it as a digital billboard or movie poster for your app that conveys its core value at a glance' gemini citing screehshotwhale)
- [ ] Screenshots show the real, current product. Screenshots do not contain placeholder content, unfinished UI, or fake data that looks deceptive and no transparency
- [ ] Text overlays are readable
- [ ] Optional app preview video if you decide it is worth the effort
- [x] Confirm third-party api sdks and infrastructure answers include real behavior from services such as Twilio, OpenAI, Supabase
- [ ] "All third-party SDKs approved versions" or "latest versions" @Hartdrawss


## Reviewer

reviewer credentials:
test@emmaline.app
testerlogin123!?

- [ ] Ensure reviewers have credentials if required, can sign in, understand the product, and reach the main flow without confusion
- [ ] Confirm the reviewer account has enough seeded data or permissions to exercise the core experience
- [ ] Write reviewer notes that include:
   - one-sentence product explanation
   - login method
   - demo email and password if needed
   - shortest path to the core user flow
   - where account deletion, privacy policy, and terms can be found
   - any non-obvious behavior such as browser-based authentication returning to the app
   - confirm any privacy oriented tracking or AI-generated output can be explained in reviewer notes in one or two sentences
   - screenshot features for reviewers @Hartdrawss
   - support contact details if login fails
- [ ] Ship one release-ready build for iOS and one for Android

## Apple App Store Submission Checklist

- [ ] Create or confirm the app record in App Store Connect
- [ ] Generate a signed Android App Bundle (AAB)
- [ ] Confirm production bundle identifier for iOS is final
- [ ] Confirm production environment variables and backend URLs are correct
- [ ] Confirm release builds work outside development mode
- [ ] Confirm the bundle ID matches the shipping iOS app ("App ID registered with correct bundle identifier" by H. Tomar)
- [ ] Confirm code signing and provisioning are working for iOS; Confirm signing configuration is correct ("Build number incremented from last submission; All entitlements configured correctly" @Hartdrawss)
- [ ] Complete App Privacy nutrition labels
- [ ] Map all collected data types to what Apple asks for 
- [ ] Apple privacy labels match real data collection, linkage, sharing, and tracking behavior. Prepare the Apple App Privacy responses from the actual implementation, not from assumptions
- [ ] Confirm required PrivacyInfo.xcprivacy manifests are present for the app and bundled SDKs
- [ ] Decide which data is linked to user identity, used for analytics, used for app functionality, or used for support. Confirm whether any data is used for tracking under Apple's definitions
- [ ] Build the production iOS archive with the intended release profile
- [ ] Upload the build to App Store Connect
- [ ] Wait for processing to complete in TestFlight/App Store Connect
- [ ] Add internal testers and verify install on a physical iPhone
- [ ] Complete App Store metadata:
   - app name
   - subtitle
   - description
   - keywords
   - support URL
   - marketing URL if used
   - privacy policy URL
   - screenshots for required device sizes
   - category
   - copyright?
- [ ] Answer export compliance questions accurately
- [ ] Answer content rights or encryption prompts accurately
- [ ] Confirm all store copy is specific, accurate, and non-misleading. Explain what makes app different without promising unsupported outcomes. Avoid vague claims like "best" or implied capabilities that are not consistently true; Confirm the app's value proposition
- [ ] Complete App Review Information
- [ ] Add reviewer notes and demo credentials
- [ ] Select the processed build for the release
- [ ] Confirm version number and build number strategy is consistent
- [ ] Submit for App Review

## Google Play Submission Checklist

- [ ] Confirm Play App Signing setup for Android
- [ ] Create or confirm the app record in Play Console
- [ ] Confirm production package name for Android is final
- [ ] Confirm the package name matches the shipping Android app
- [ ] Complete Play App Signing setup
- [ ] Upload the signed AAB
- [ ] Start with internal testing or closed testing before production rollout
- [ ] Complete the store listing:
   - app name
   - short description
   - full description
   - screenshots
   - feature graphic
   - privacy policy URL
   - contact details
- [ ] Complete the App content declarations:
   - Privacy policy
   - Ads
   - App access
   - Target audience and content
   - Content rating
   - Data safety
- [ ] Complete the Google Play Data safety form accurately
- [ ] Confirm whether data is encrypted in transit
- [ ] Declare permissions and any sensitive behaviors accurately
- [ ] Review all release errors and warnings in Play Console
- [ ] If the account is subject to the closed-testing gate, complete that requirement before requesting production access
- [ ] If production access is available, create the production release and roll out
- [ ] The app name, screenshots, description, and reviewer notes all describe the same actual product
- [ ] Privacy Policy, App Privacy labels, Google Data safety answers, and in-app behavior all match each other
- [ ] Confirm version number and build number strategy is consistent

## Common Rejection Triggers To Explicitly Avoid

- [ ] Crashes in the first-time user flow
- [ ] Unclear consents for privacy related actions
- [ ] Missing explanation of AI processing by third parties
- [ ] Inaccurate privacy labels or Data safety answers
- [ ] Missing account deletion path for authenticated users
- [ ] Missing demo credentials when login is required
- [ ] Misleading screenshots or placeholder visuals
- [ ] Metadata that overpromises or does not match the app
- [ ] Reviewer confusion about how to reach the main feature
- [ ] "Missing support email" H. Tomar
- [ ] "Wrong privacy policy = 2 week delay" H. Tomar
- [ ] "Expired certificates = build fails at 3am" H. Tomar
- [ ] "No error tracking = debugging blind" H. Tomar

## Reference Links

- Apple App Store Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines
- Google Play publishing preparation: https://developer.android.com/studio/publish/preparing
- Google Play core app quality guidelines: https://developer.android.com/docs/quality-guidelines/core-app-quality
- General iOS submission walkthrough: https://tridenstechnology.com/how-to-publish-to-app-store
- General Google Play submission walkthrough: https://tridenstechnology.com/how-to-publish-to-google-play-store/
- Additional submission overview: https://www.luciq.ai/blog/how-to-submit-app-to-app-store
- Tweets by Harshil Tomar https://x.com/Hartdrawss/status/2055143702499061794, https://x.com/Hartdrawss/status/2055506094982566064
- 