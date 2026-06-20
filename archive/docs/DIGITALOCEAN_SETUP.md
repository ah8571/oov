# DigitalOcean App Platform Setup Guide

This guide walks through deploying Emmaline's backend to DigitalOcean App Platform with your domain emmaline.app.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Create App Platform Project](#create-app-platform-project)
3. [Configure Backend Service](#configure-backend-service)
4. [Environment Variables](#environment-variables)
5. [Domain Configuration](#domain-configuration)
6. [Deploy](#deploy)
7. [Monitoring & Logs](#monitoring--logs)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

**Required:**
- DigitalOcean account (with billing method on file)
- GitHub account with `ah8571/emmaline` repository
- Domain emmaline.app (registered and accessible)
- `.env` file with all required variables (see [Environment Variables](#environment-variables))

**Estimated Cost:**
- App Platform starter: $12/month (includes 3 GB RAM, auto-scaling)
- Additional services as needed (database, storage)

---

## Create App Platform Project

### Step 1: Start New Project

1. Log in to [DigitalOcean Dashboard](https://cloud.digitalocean.com/)
2. Click **Create** → **Apps**
3. Select **GitHub** as source
4. Authorize DigitalOcean to access your GitHub account
5. Select repository: `ah8571/emmaline`
6. Branch: `main`
7. Click **Next**

### Step 2: Configure App

1. **App Name:** `emmaline` (or your preference)
2. **Region:** Choose closest to your users (e.g., `nyc` for US East)
3. Click **Next**

---

## Configure Backend Service

### Step 1: Add Service

After repository connection, DigitalOcean will detect your project structure.

**You should see:**
```
emmaline/
├── backend/          ← DigitalOcean will auto-detect this
├── mobile/
└── docs/
```

If not auto-detected, click **Add Resource** → **Service**

### Step 2: Service Settings

**Basic Configuration:**
```
Name: backend
Source Type: GitHub
Repository: ah8571/emmaline
Branch: main
Source Directory: backend/    ← IMPORTANT: Specify this
```

**Build Settings:**
```
Build Command: npm install
Run Command: npm start
HTTP Port: 3000              ← Must match backend/src/index.js port
```

**Resources:**
```
Instance Type: Basic (Starter plan)
Instance Count: 1
```

**Environment:**
```
Node.js 18.x or higher
```

### Step 3: CORS & WebSocket Configuration

**In the Service Settings, under "HTTP Request Routes":**

```
Route: /
Destination: backend
Protocol: HTTP/HTTPS (auto)
Match: All paths
```

**Enable WebSocket support:**
- DigitalOcean App Platform supports WebSocket out of the box
- Verify in your backend that WebSocket upgrade is handled correctly
- The `/ws/media-stream` endpoint should work automatically

---

## Environment Variables

### Step 1: Add Environment Variables

In App Platform dashboard, go to **Settings** → **Environment** → **App-level Environment Variables**

### Step 2: Copy from .env.example

Add all variables from `backend/.env.example`:

```
NODE_ENV=production

# Database
DATABASE_URL=postgresql://[user]:[password]@[host]:[port]/[database]

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
WEBSOCKET_URL=wss://emmaline.app/ws/media-stream

# JWT
JWT_SECRET=your_very_long_random_secret_key_minimum_32_chars
JWT_EXPIRATION=7d

# Google Cloud
GOOGLE_APPLICATION_CREDENTIALS=/app/google-cloud-key.json
GOOGLE_CLOUD_PROJECT_ID=your-project-id

# OpenAI
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Supabase (if using instead of standalone PostgreSQL)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# CORS
CORS_ORIGIN=https://emmaline.app,https://www.emmaline.app
```

**Important:**
- ❌ Never commit `.env` file to GitHub
- ✅ Keep `.env.example` in repo (without secrets)
- ✅ Add actual values only in DigitalOcean dashboard

### Step 3: Google Cloud Credentials

If using Google Cloud Speech-to-Text:

1. Get your `google-cloud-key.json` from Google Cloud Console
2. Upload as secure file in DigitalOcean:
   - In App Platform settings, look for "Buildpack Files" or file mounting
   - OR upload as environment variable (base64 encoded)

**Recommended approach (base64 encoding):**
```bash
# On your local machine, in backend/ directory:
cat google-cloud-key.json | base64

# Copy output, add as env var:
# GOOGLE_CLOUD_KEY_BASE64=<pasted_base64_string>

# Then in backend/src/index.js, decode it:
if (process.env.GOOGLE_CLOUD_KEY_BASE64) {
  const decoded = Buffer.from(process.env.GOOGLE_CLOUD_KEY_BASE64, 'base64').toString();
  fs.writeFileSync('/tmp/google-cloud-key.json', decoded);
  process.env.GOOGLE_APPLICATION_CREDENTIALS = '/tmp/google-cloud-key.json';
}
```

---

## Domain Configuration

### Step 1: Add Domain

1. In App Platform dashboard, go to **Settings** → **Domains**
2. Click **Add Domain**
3. Enter: `emmaline.app`
4. Select type: **Domain** (not subdomain)

### Step 2: Update DNS Records

DigitalOcean will show you DNS records to add to your domain registrar:

```
Type: CNAME
Name: emmaline.app (or @ for root)
Value: [DigitalOcean-provided endpoint]
TTL: 3600
```

**Common registrars:**
- GoDaddy: Go to DNS settings
- Namecheap: Manage DNS
- Google Domains: Custom records
- AWS Route 53: Create record set

### Step 3: Verify DNS

```bash
# Check if DNS is resolving:
nslookup emmaline.app

# Should show DigitalOcean's IP address
```

**Wait time:** DNS propagation can take 15 minutes to 24 hours

### Step 4: SSL Certificate

DigitalOcean automatically provisions Let's Encrypt SSL certificates:
- Auto-renewal enabled
- No action needed from you
- `emmaline.app` will have HTTPS automatically

---

## Deploy

### Step 1: Review Configuration

Before deploying, verify:

```
✓ Repository: ah8571/emmaline
✓ Branch: main
✓ Source directory: backend/
✓ Build command: npm install
✓ Run command: npm start
✓ Port: 3000
✓ Environment variables: All added
✓ Domain: emmaline.app configured
```

### Step 2: Deploy

1. Click **Create App** at the bottom of configuration
2. DigitalOcean will:
   - Clone your repository
   - Run `npm install` in `backend/`
   - Build the application
   - Start the server
   - Configure SSL
   - Point domain to app

**First deployment:** 3-5 minutes

### Step 3: Verify Deployment

Once deployment completes:

```bash
# Test API endpoint
curl https://emmaline.app/api/health

# Should return: {"status": "ok"}
```

---

## Monitoring & Logs

### View Logs

**In App Platform dashboard:**
1. Go to your app
2. Click **Runtime Logs** tab
3. See real-time logs from your backend

**Common issues:**
```
Error: Cannot find module 'express'
→ Check: npm install ran correctly

Error: DATABASE_URL not set
→ Check: Environment variables are all added

Connection refused port 3000
→ Check: Backend is listening on port 3000
```

### Monitor Resource Usage

1. Go to **Metrics** tab
2. View:
   - CPU usage
   - Memory usage
   - Network I/O
   - Response times

**Auto-scaling:**
- If CPU > 80% for 5 min: App Platform adds instances
- If CPU < 20% for 5 min: App Platform removes instances
- Runs 1-3 instances by default (adjust in settings)

---

## Auto-Deployment from GitHub

### Enable Auto-Deploy

**By default:** Every push to `main` branch auto-deploys

**To disable:**
1. Go to **Settings** → **Source**
2. Toggle off **Auto-deploy on push**

**To deploy manually:**
1. Go to **Deployments** tab
2. Click **Deploy** button
3. Select branch to deploy

**Deployment status:**
- Shows live progress in dashboard
- Automatic rollback if build fails
- Previous deployment available to rollback to

---

## Troubleshooting

### Issue: WebSocket Connection Fails

**Symptoms:**
- Mobile app can't connect to WebSocket
- Error: `WebSocket: Connection refused`

**Solutions:**
```
1. Verify domain is pointing to App Platform
2. Check WEBSOCKET_URL environment variable:
   └─ Should be: wss://emmaline.app/ws/media-stream
   
3. Verify backend accepts WebSocket:
   └─ Check backend/src/index.js has ws.Server setup
   
4. Check firewall/SSL:
   └─ DigitalOcean auto-handles SSL for wss://
```

### Issue: Environment Variables Not Working

**Symptoms:**
- Backend crashes with `undefined` variables
- Error: `Cannot read property of undefined`

**Solutions:**
```
1. Redeploy after adding env vars:
   └─ Go to Deployments → Deploy
   
2. Check variable names match code:
   └─ process.env.JWT_SECRET (case-sensitive)
   
3. Restart app:
   └─ Go to Settings → restart app
```

### Issue: Database Connection Fails

**Symptoms:**
- Error: `ECONNREFUSED` or `connect ETIMEDOUT`
- Authentication errors on database

**Solutions:**
```
1. Verify DATABASE_URL format:
   └─ postgresql://user:password@host:port/database
   
2. Check Supabase/PostgreSQL is running:
   └─ Test connection locally first
   
3. If using Supabase:
   └─ Verify IP whitelist allows DigitalOcean IPs
   └─ Supabase → Project Settings → Network → Add IPs
```

### Issue: Deployment Fails

**Symptoms:**
- Build command fails
- `npm install` errors

**Check logs:**
1. Go to **Runtime Logs** tab
2. Look for error message
3. Common issues:
   ```
   missing required package → Check backend/package.json
   node_modules conflicts → Try: rm package-lock.json, git push
   Port already in use → Change BACKEND_PORT in code
   ```

### Issue: Domain Not Resolving

**Symptoms:**
- `ERR_NAME_NOT_RESOLVED` in browser
- Domain points to wrong IP

**Solutions:**
```
1. Wait for DNS propagation (up to 24 hours)

2. Verify DNS records at your registrar:
   └─ CNAME should point to DigitalOcean endpoint
   
3. Flush local DNS cache:
   # Windows:
   ipconfig /flushdns
   
   # Mac:
   sudo dscacheutil -flushcache
```

---

## Rollback Deployment

If something goes wrong after deploying:

1. Go to **Deployments** tab
2. Find previous working deployment
3. Click **Rollback**
4. Select deployment to restore
5. DigitalOcean redeploys previous version

**No data loss** – only code is rolled back

---

## Cost Optimization

**Current setup:**
- App Platform basic: $12/month
- Custom domain: Usually included with registrar
- Database (if using Supabase): Varies by plan

**To save money:**
- Start with 1 instance (auto-scaling off)
- Only enable auto-scaling when you have users
- Use Supabase free tier while testing
- Monitor logs for unnecessary requests

---

## Next Steps

After deployment:

1. **Test mobile app connection:**
   ```
   Update mobile/.env to point to https://emmaline.app
   Run: expo start --web
   Test login/authentication
   ```

2. **Set up Twilio webhooks:**
   ```
   Go to Twilio Console
   Update webhook URL to: https://emmaline.app/api/calls/incoming
   ```

3. **Monitor first week:**
   ```
   Check logs daily for errors
   Monitor resource usage
   Adjust auto-scaling if needed
   ```

4. **Set up alerts (optional):**
   ```
   DigitalOcean Monitoring → Alerts
   Create alert for high CPU/memory
   ```

---

## Support & Resources

- [DigitalOcean App Platform Docs](https://docs.digitalocean.com/products/app-platform/)
- [App Platform Troubleshooting](https://docs.digitalocean.com/products/app-platform/how-to/troubleshoot-apps/)
- [Node.js Deployment Best Practices](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)

---

## Checklist

Before going live:

- [ ] GitHub repository connected
- [ ] Backend source directory: `backend/`
- [ ] All environment variables added
- [ ] Google Cloud credentials configured
- [ ] Domain emmaline.app pointing to App Platform
- [ ] SSL certificate active (HTTPS working)
- [ ] Health check endpoint tested: `https://emmaline.app/api/health`
- [ ] WebSocket connection tested from mobile app
- [ ] Twilio webhook URL updated
- [ ] Logs monitored for errors
- [ ] Auto-scaling configured appropriately
- [ ] Rollback plan understood

✅ You're ready to deploy!
