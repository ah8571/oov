# Social OAuth Setup — Google, Apple, Facebook

This doc covers creating OAuth credentials for each provider and wiring them into Supabase. Once done, Supabase handles the full OAuth flow — no custom callback code needed in the app.

All three providers follow the same pattern:

1. Create an OAuth app on the provider's developer console
2. Add the Supabase callback URL as an allowed redirect URI
3. Paste the Client ID + Secret into Supabase

---

## Supabase Callback URL (needed for all three)

Every provider needs this as an allowed redirect:

```
https://<your-supabase-project-ref>.supabase.co/auth/v1/callback
```

Find it in: Supabase Dashboard → Authentication → Providers → (any provider) — it's shown at the top of each provider's config panel.

---

## 1. Google

### Create credentials

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Select your project (or create one for Emmaline)
3. Left menu → **APIs & Services → Credentials**
4. **+ Create Credentials → OAuth client ID**
5. Application type: **Web application**
6. Name: `Emmaline Web`
7. **Authorized redirect URIs** → Add:
   ```
   https://<your-supabase-project-ref>.supabase.co/auth/v1/callback
   ```
8. Click **Create** → copy the **Client ID** and **Client Secret**

### Configure OAuth consent screen (if prompted)

- User type: **External**
- App name: `Emmaline`
- Support email: your email
- Scopes: add `email` and `profile`
- Test users: add your email for testing before going to production
- Submit for verification only needed if you want the "Google-verified" badge (optional for internal use)

### Add to Supabase

- Supabase Dashboard → Authentication → Providers → **Google**
- Toggle **Enable**
- Paste **Client ID** and **Client Secret**
- Save

What To Do In Google
Go to Google Cloud Console and open Google Auth Platform or the older APIs & Services -> OAuth consent screen.

Set up these fields on the consent screen:

App name: Emmaline
User support email: your support email
App logo: optional but useful
App home page: your real Emmaline website
Privacy policy URL: your real privacy page
Terms of service URL: your real terms page
Authorized domains: add your real site domain
Then configure scopes:

email
profile
openid

---

## 2. Apple

> Apple Sign In requires an Apple Developer account ($99/year) and is the most involved of the three.

### Prerequisites

- [ ] Active Apple Developer account at [developer.apple.com](https://developer.apple.com)

### Create an App ID

1. Developer Portal → **Certificates, Identifiers & Profiles → Identifiers**
2. **+** → **App IDs** → **App**
3. Description: `Emmaline`
4. Bundle ID (Explicit): use your real Emmaline app bundle ID
5. Capabilities: check **Sign In with Apple**
6. Continue → Register

### Create a Services ID (this is the OAuth client)

1. Identifiers → **+** → **Services IDs**
2. Description: `Emmaline Web`
3. Identifier: use a Services ID for Emmaline (must be different from the App ID)
4. Continue → Register
5. Click the Services ID you just created → enable **Sign In with Apple** → **Configure**
6. Primary App ID: select the Emmaline App ID
7. **Domains and Subdomains**: use your real web domain
8. **Return URLs** (redirect URI):
   ```
   https://<your-supabase-project-ref>.supabase.co/auth/v1/callback
   ```
9. Save → Continue → Register

### Create a Key

1. Keys → **+**
2. Name: `Emmaline Sign In with Apple`
3. Check **Sign In with Apple** → Configure → Primary App ID: select the Emmaline App ID
4. Continue → Register
5. **Download the `.p8` key file** (you can only download it once)
6. Note the **Key ID**

### Gather your values

- **Services ID** (Client ID): your Emmaline Services ID
- **Team ID**: top-right of your developer account (10-char string like `AB12CD34EF`)
- **Key ID**: shown on the key detail page
- **Private Key**: contents of the `.p8` file

### Add to Supabase

- Supabase Dashboard → Authentication → Providers → **Apple**
- Toggle **Enable**
- Client ID (Services ID): your Emmaline Services ID
- Team ID: your 10-char Team ID
- Key ID: your Key ID
- Private Key: paste the full contents of the `.p8` file (including `-----BEGIN PRIVATE KEY-----`)
- Save

---

## 3. Facebook / Meta

### Create a Meta App

1. Go to [developers.facebook.com](https://developers.facebook.com) → **My Apps → Create App**
2. Use case: **Authenticate and request data from users with Facebook Login**
3. App name: `Emmaline`
4. Contact email: your email
5. Create

### Configure Facebook Login

1. In your app dashboard → **Add Product → Facebook Login → Set Up (Web)**
2. Site URL: your live Emmaline website URL
3. Left menu → **Facebook Login → Settings**
4. **Valid OAuth Redirect URIs** → Add:
   ```
   https://<your-supabase-project-ref>.supabase.co/auth/v1/callback
   ```
5. Save Changes

### Get credentials

- Left menu → **App Settings → Basic**
- Copy **App ID** and **App Secret** (click "Show" next to secret)

### Go Live

- By default the app is in Development mode (only you can log in)
- Top of dashboard → toggle from **In development** to **Live**
- Required: add a Privacy Policy URL using your real Emmaline privacy page

### Add to Supabase

- Supabase Dashboard → Authentication → Providers → **Facebook**
- Toggle **Enable**
- Paste **App ID** (as Client ID) and **App Secret** (as Client Secret)
- Save

---

## Wiring into the app

Once all three are enabled in Supabase, add buttons to `web/src/Auth.tsx` using the Supabase browser client:

```ts
const client = getSupabaseBrowserClient();

// Google
await client.auth.signInWithOAuth({
  provider: "google",
  options: { redirectTo: window.location.origin },
});

// Apple
await client.auth.signInWithOAuth({
  provider: "apple",
  options: { redirectTo: window.location.origin },
});

// Facebook
await client.auth.signInWithOAuth({
  provider: "facebook",
  options: { redirectTo: window.location.origin },
});
```

Supabase redirects the user to the provider, handles the token exchange, creates/links the user in `auth.users`, and redirects back to your `redirectTo` URL with a session. The existing `onAuthStateChange` listener in `App.tsx` picks it up automatically — no extra routing needed.

---

## Testing checklist

- [ ] Google: sign in with a Google account → lands on dashboard
- [ ] Apple: sign in with Apple ID → lands on dashboard
- [ ] Facebook: sign in with Facebook → lands on dashboard
- [ ] Existing email user signs in with Google (same email) → Supabase links accounts automatically
- [ ] Check Supabase Dashboard → Authentication → Users → confirm provider column shows correctly
