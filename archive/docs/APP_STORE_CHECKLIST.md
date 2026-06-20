# App Store Submission Notes

## Table of Contents

1. [Basic Technical Steps](#basic-technical-steps)
2. [Key Features and Requirements](#key-features-and-requirements)
3. [iOS Build and Submission Process](#ios-build-and-submission-process)
4. [Google Play Delta](#google-play-delta)
5. [Store Guidelines](#store-guidelines)

---

## Basic Technical Steps

A good write up here, also potentially useful for testing? https://www.luciq.ai/blog/how-to-submit-app-to-app-store

Submitting to stores: "For iOS, generate your build via Xcode ... and upload to App Store Connect. Select your build, answer export compliance and content rights questions, then click Submit for Review. For Android, upload your signed App Bundle to Google Play Console, configure release details, and start rollout." (passion.io)

- The Apple process: https://tridenstechnology.com/how-to-publish-to-app-store
- Google Play process: https://tridenstechnology.com/how-to-publish-to-google-play-store/

## Google Play Delta

**Tonight reality check:**

- Google Play submission is often easier than Apple at the binary-upload level, but it can be stricter at the console policy-declaration level.
- If this Play Console account is a newer personal developer account created after November 13, 2023, Google requires a closed test with at least 12 opted-in testers for 14 continuous days before production access can be granted.
- If that account-level testing gate applies, the app can still be uploaded and prepared tonight, but it cannot go straight to public production tonight.
- If that gate does not apply, the main path to launch is: upload signed AAB, finish Play Console app content declarations, complete store listing, resolve any release errors, then roll out.

**Google Play items that matter more than Apple for first submission:**

- App content declarations in Play Console are a major gating step. Google explicitly requires completion of Privacy policy, Ads, App access, Target audience and content, Content rating, and Data safety declarations before review.
- Data safety is mandatory even if the app does not collect user data. The form still must be completed and tied to a privacy policy URL.
- If the app requires login or any restricted access, Google requires explicit app access instructions for reviewers in Play Console.
- First Android release should use a signed App Bundle (AAB) and configure Play App Signing during release setup.
- Google flags release blocking errors directly in the release flow. Warnings may not block publication, but errors do.
- Google Play also requires current target API compliance, which should be checked before submission.

**High-level Apple vs Google differences:**

- Apple is more binary-review and reviewer-notes driven; Google is more declaration and Play Console configuration driven.
- Apple leans heavily on App Review, TestFlight validation, screenshots, privacy labels, and reviewer credentials.
- Google leans heavily on App content declarations, Data safety, content rating, app access, country rollout, and release-track controls.
- Apple review typically hinges on product quality and reviewer experience; Google can block release earlier if console setup or declarations are incomplete.

**Recommended same-evening Google Play order:**

1. Confirm whether the Play developer account is a new personal account subject to the 12-testers-for-14-days rule.
2. Generate the Android production AAB.
3. Create or verify the Play Console app record and store listing.
4. Complete App content declarations: Privacy policy, Ads, App access, Target audience, Content rating, Data safety.
5. Upload the AAB and configure Play App Signing.
6. Review release errors and warnings.
7. If production access is available, submit rollout. If not, start or continue the required closed test.

**Current status snapshot (2026-05-04):**

- [x] Apple App ID / provisioning fixed for `io.cashmarket.mobileapp`
- [x] App Store Connect app record created
- [x] Xcode 26-compliant iOS production build generated through EAS
- [x] Build uploaded to App Store Connect / TestFlight
- [ ] Wait for Apple processing to finish in TestFlight
- [ ] Add testers in TestFlight and verify install on a real iPhone
- [ ] Finish App Store metadata, screenshots, privacy labels, reviewer notes, and reviewer login
- [ ] Submit the processed build for App Review when everything above is ready

**Creating and validating the archive:**

"Create the Archive: In Xcode's device dropdown menu at the top, select 'Any iOS Device (arm64)'. This ensures you're creating a generic, distributable build. Then, from the top menu, choose Product > Archive. This will compile your app and open the Organizer window with your new build.

The Critical Validation Step: In the Organizer, with your new archive selected, click 'Validate App.' This is a free pre-check that runs your app against many of the same automated checks that Apple's review team uses. Do not skip this step. It can catch signing issues, entitlement problems, and other configuration errors that would cause an instant rejection.

Distribute the App: Once validation passes, click 'Distribute App.' Choose 'App Store Connect' as the distribution method and follow the prompts. Xcode will then package and upload your binary to App Store Connect. The build will appear under your app's 'TestFlight' tab once processing is complete, which can take anywhere from 15 minutes to over an hour."

**Signing:**

The most direct and reliable method is using Xcode's "Automatically manage signing" feature. For over 99% of developers, this is the correct choice.

1. Define Your App ID: In the Apple Developer Portal, under Certificates, Identifiers & Profiles, create an App ID. This is a unique, reverse-domain style string (e.g., com.yourcompany.yourapp) that must exactly match the "Bundle Identifier" in your Xcode project settings.
2. Enable Automatic Signing: In your Xcode project's target settings, navigate to Signing & Capabilities.

**Metadata and reviewer notes:**

"Fill out all remaining metadata. Pay close attention to the 'App Review Information' section. If your app requires a login, you must provide a valid demo account (username and password). Include clear notes for the reviewer explaining any complex features or non-obvious functionality. Your goal is to make the reviewer's job as easy as possible." (K. Rajan, Medium)

For this app, "demo account" means a working test login the reviewer can actually use. If review requires authentication, do not give Apple your personal account. Create a stable test account with credentials that will not expire during review.

For this app, reviewer notes should include:

- what the app is for in one sentence
- which login method the reviewer should use
- demo email and password, if required for access
- the shortest path to the core seller flow
- where to find account deletion, privacy policy, and terms inside the app
- any known non-obvious behavior, such as social sign-in opening a browser and then returning to the app

---

## Key Features and Requirements


- [x] Logical flow of buttons
- [x] Privacy policy: "Apple's requirements: Your privacy policy must detail what data you collect, why you collect it, how you use it, and with whom you share it. The App Privacy section in App Store Connect generates user-facing privacy labels, which must be accurate and complete." (passion.io); should be easy to delete user data upon request (contacthasbeenmade on reddit)
- [x] "Terms of use"
- [x] "No hidden functionality" [reddit No_Lawyer1947]
- Avoid crashes / bugs
- [x] Originality; the description [and comment box?] an opportunity to explain why this app is unique
- [x] Delete user option
- [x] Non-misleading info in name / description
- [ ] Metadata
- [ ] Screenshots / icons: "Provide high-resolution screenshots (5-10 for Apple, device-specific for Google) showing your app in action. No placeholder content or unedited mockups. Your app icon must be 1024 x 1024 pixels for Apple and 512 x 512 for Google." (passion.io)
  - "Do not just show random screens. Craft a visual narrative. Your first 1-3 screenshots are the most important. Each should highlight a key benefit or feature, using clear, concise text overlays to explain the value."
  - App Preview (Video): "A well-made video can dramatically increase conversions. Research from Rovio, creators of Angry Birds, showed that an app preview video 'improved conversion by 60 percent' and that users from video ads had 'about 20 percent higher retention.'" (K Rajan, Medium)
- [ ] XCTest / device testing coverage: https://developer.apple.com/documentation/xctest
- [ ] Google Play Data safety form completed accurately, including third-party SDK behavior
- [ ] Google Play App content declarations completed: Privacy policy, Ads, App access, Target audience and content, Content rating
- [ ] Confirm whether the Play account is subject to the 12-testers-for-14-days personal-account testing requirement
- [ ] Confirm Android target API level satisfies current Play requirement before upload
- Typical reasons for rejections: "Common reasons include crashes, incomplete metadata, misleading screenshots, missing demo credentials, or placeholder content." (passion.io)

---

## Store Guidelines

**Apple:**
- https://developer.apple.com/app-store/review/guidelines/
- https://developer.apple.com/design/human-interface-guidelines

**Android:**
- https://developer.android.com/studio/publish/preparing
- https://developer.android.com/docs/quality-guidelines/core-app-quality

### Research and Reference Links

- [ ] Review Apple App Store Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- [ ] Review Apple Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines
- [ ] Review Google Play publishing checklist: https://developer.android.com/studio/publish/preparing
- [ ] Review Google Play core app quality guidelines: https://developer.android.com/docs/quality-guidelines/core-app-quality
- [ ] Read full iOS submission walkthrough: https://tridenstechnology.com/how-to-publish-to-app-store
- [ ] Read full Android submission walkthrough: https://tridenstechnology.com/how-to-publish-to-google-play-store/
- [ ] Read general submission best practices: https://www.luciq.ai/blog/how-to-submit-app-to-app-store

### App Quality and Stability

- [ ] Test for crashes across all main user flows (property type selection, funnel steps, results, consent, submission)
- [ ] Test on multiple device types and screen sizes
- [ ] Test on both iOS and Android
- [X] Verify all buttons follow a logical flow with no dead ends or unexpected states
- [ ] Verify no placeholder content or unfinished UI is reachable
- [X] Research and decide on a crash reporting tool (e.g., Sentry, Firebase Crashlytics) to catch errors proactively without requiring user reports
- [X] Research how to incorporate crash and error telemetry so issues surface automatically — not just when users report them
- [X] Wire Sentry into the mobile app in a no-DSN-safe way so the app still runs before credentials are added
- [ ] Review XCTest documentation for iOS testing approach: https://developer.apple.com/documentation/xctest

### Metadata and Store Listing

- [ ] Finalize public app name in App Store Connect — current app record exists, but the final customer-facing name can still be refined
- [ ] Write short description and long description — explain what makes this app unique and who it is for
- [ ] Confirm description does not include misleading claims
- [X] Ensure no hidden or undisclosed functionality exists in the app
- [ ] Prepare a stable demo account (email + password) for app reviewers if review requires login
- [ ] Write reviewer notes with login steps, core seller flow steps, and where deletion/privacy/legal pages live
- [ ] Write Google Play app access instructions if reviewer login or restricted access is required

### Screenshots and App Icon

- [ ] Prepare app icon at 1024x1024 pixels for Apple
- [ ] Prepare app icon at 512x512 pixels for Google
- [ ] Prepare 5–10 high-resolution screenshots for Apple (device-specific sizes required)
- [ ] Prepare device-specific screenshots for Google Play
- [ ] Screenshots must show the real app in action — no mockups, placeholder content, or unedited screens
- [ ] Design screenshots as a visual narrative: first 1–3 screenshots should highlight the key benefit with clear, concise text overlays
- [ ] Consider an app preview video — research from Rovio showed a preview video improved conversion by 60% and user retention by ~20%
- [ ] Research screenshot resizing tools if multiple device size variants are needed

### Privacy Policy and Legal

- [X] Confirm privacy policy is live and publicly accessible at a stable URL
- [X] Privacy policy must detail: what data is collected, why it is collected, how it is used, and who it is shared with
- [ ] Complete the App Privacy section in App Store Connect with accurate privacy labels (data types collected, purposes, linked to user identity)
- [ ] Complete Google Play Data safety form, including third-party SDKs and whether data is encrypted in transit / deletable
- [X] Confirm the app includes a clear account/data deletion option or path — Apple and Google both require this
- [X] Confirm terms of use are accessible from within the app
- [X] Confirm privacy policy is accessible from within the app

### iOS-Specific Submission Status

- [X] Define App ID / bundle identifier in Apple Developer Portal to match the live iOS bundle ID `io.cashmarket.mobileapp`
- [X] Create the App Store Connect app record
- [X] Build an iOS production binary with the Xcode 26 EAS profile
- [X] Upload the iOS build to App Store Connect / TestFlight
- [ ] Wait for Apple processing to finish in TestFlight
- [ ] Add internal testers and verify installation through the TestFlight app
- [ ] Complete App Review Information in App Store Connect (contact info, reviewer notes, demo credentials if needed)
- [ ] Answer export compliance / content rights prompts in App Store Connect
- [ ] Select the processed build and submit it for App Review when screenshots and metadata are ready

### Android-Specific Build Steps (Google Play)

- [ ] Generate signed App Bundle (AAB format) for Google Play
- [ ] Confirm Play App Signing setup during first release
- [ ] Upload signed App Bundle to Google Play Console
- [ ] Configure release details (release name, release notes)
- [ ] Complete Play Console App content page before review: Privacy policy, Ads, App access, Target audience and content, Content rating, Data safety
- [ ] Confirm target API level meets current Google Play requirement
- [ ] Start rollout from Google Play Console

### Google Play Account Gate

- [ ] Confirm whether this is a personal Play developer account created after November 13, 2023
- [ ] If yes: run a closed test with at least 12 opted-in testers for 14 continuous days
- [ ] If yes: apply for production access after the closed-test requirement is met

### Android Test Distribution

- [ ] Wait for the latest Expo Android preview build to finish
- [ ] Install the latest Android preview build and run a fresh smoke test
- [ ] If production is blocked by account type, use internal or closed testing track tonight instead of production

### Common Rejection Reasons to Avoid

- [ ] Crashes or instability in main flows
- [ ] Incomplete or missing metadata
- [ ] Misleading screenshots or app preview content
- [ ] Missing demo credentials when login is required
- [ ] Placeholder content reachable in the app
- [ ] Inaccurate or missing privacy labels
- [X] No account deletion option