# Sentry Setup

## Recommended Order

1. Mobile first
2. Backend second
3. Website third if you want web frontend visibility too

## Mobile Status In This Repo

The mobile Sentry wiring is now in place:

1. `@sentry/react-native` is installed in [mobile/package.json](../mobile/package.json)
2. Expo build config is wrapped with Sentry in [mobile/app.config.js](../mobile/app.config.js)
3. Metro is using the Sentry serializer in [mobile/metro.config.js](../mobile/metro.config.js)
4. Sentry initializes at app startup in [mobile/src/App.js](../mobile/src/App.js)
5. Authenticated user context is attached in [mobile/src/navigation/AppNavigator.js](../mobile/src/navigation/AppNavigator.js)

That means the remaining work is account setup, secrets, and verification.

## Mobile Setup Checklist

### 1. Create The Mobile Project In Sentry

In Sentry:

1. Create a new React Native project for the mobile app
2. Copy these values:
	- DSN
	- organization slug
	- project slug

Use a dedicated mobile project. Do not reuse the backend project.

### 2. Create A Sentry Auth Token

Create a personal auth token in Sentry so EAS builds can upload source maps.

You need a token with release upload access for the selected org/project. Store it securely and do not commit it.

### 3. Add Mobile Secrets To EAS

Add these environment variables in Expo EAS for the build environments you use:

- `EXPO_PUBLIC_SENTRY_DSN`
- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

Recommended values:

- `EXPO_PUBLIC_SENTRY_DSN`: the DSN from the Sentry mobile project
- `SENTRY_ORG`: your Sentry organization slug
- `SENTRY_PROJECT`: your Sentry mobile project slug

Notes:

1. `EXPO_PUBLIC_SENTRY_DSN` is intentionally public to the app runtime
2. `SENTRY_AUTH_TOKEN` must be stored as a secret
3. `SENTRY_ORG` and `SENTRY_PROJECT` are used by the Expo Sentry plugin during build time for source map upload

### 4. Optional Local Build Env

If you ever want to build locally instead of only through EAS, create a local env file in [mobile](../mobile) containing:

```bash
EXPO_PUBLIC_SENTRY_DSN=your-mobile-dsn
SENTRY_AUTH_TOKEN=your-sentry-auth-token
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=your-mobile-project-slug
```

Do not commit that file.

### 5. Rebuild The Mobile App

After the env vars exist, run a fresh Android or iOS build. The Sentry Expo plugin should upload source maps automatically during the native build.

### 6. Verify Event Delivery

Once the app is installed with a DSN configured:

1. Open the app
2. Log in so user context is attached
3. Trigger a controlled test error from a temporary code path or debug action
4. Confirm the error appears in the Sentry mobile project

Expected useful context from current wiring:

- user ID when available
- email when available
- call-related error tags for live call start failures
- call-related error tags for Listen Mode processing failures

## Why The Mobile Setup Matters

With the current mobile wiring:

1. JavaScript exceptions can be captured from app startup and runtime
2. Authenticated sessions can be tied to a specific user
3. EAS builds can upload source maps so production stack traces are readable

## Backend Setup

Backend is still pending.

When you move to backend next, install Sentry in [backend/src/index.js](../backend/src/index.js) before routes and capture:

- uncaught exceptions
- unhandled promise rejections
- Express request errors
- useful tags like user ID, call mode, and Twilio SID when available

## Website Setup

Website is still pending.

If you want browser and server-render visibility for the Next.js app, add the official Sentry Next.js integration to [website](../website).

## Secrets Summary

Mobile:

- `EXPO_PUBLIC_SENTRY_DSN`
- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

Later for backend:

- `SENTRY_DSN_BACKEND`

If website coverage is added later, keep the web DSN and release config in deployment secrets too.

## Smoke Test Checklist

1. Trigger a handled mobile test error
2. Confirm the event arrives in Sentry with symbolicated stack traces
3. Confirm the event includes user context after login
4. Trigger a backend test error once backend Sentry is added
