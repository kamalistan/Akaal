# Twilio Configuration Debugging Guide

## Current Issue

Your Edge Functions return: **"Twilio not configured. Enable Demo Mode in Settings to test without Twilio."**

This means environment variables are undefined at runtime in your Supabase Edge Functions.

---

## Required Secrets

Your app needs **TWO SETS** of Twilio credentials:

### Set 1: For JWT Token Generation (`twilioGenerateToken`)
```
TWILIO_ACCOUNT_SID       → Your main Account SID (starts with AC)
TWILIO_API_KEY_SID       → API Key SID (starts with SK)
TWILIO_API_KEY_SECRET    → API Key Secret (long alphanumeric string)
TWILIO_TWIML_APP_SID     → TwiML App SID (starts with AP)
```

### Set 2: For Making Calls (`twilioInitiateCall`)
```
TWILIO_ACCOUNT_SID       → Same as above
TWILIO_AUTH_TOKEN        → Your Auth Token (NOT API Key Secret)
TWILIO_NUMBER            → Your Twilio phone number (format: +1234567890)
```

### Set 3: For Voice Handling (`twilioVoiceHandler`)
```
TWILIO_NUMBER            → Your Twilio phone number
```

---

## Step-by-Step Fix

### Step 1: Verify Current Secrets

Run this command to see what secrets currently exist:

```bash
supabase secrets list --project-ref amtxxigpbfsbvalnwpml
```

**Expected output should include ALL of these:**
```
TWILIO_ACCOUNT_SID
TWILIO_API_KEY_SID
TWILIO_API_KEY_SECRET
TWILIO_TWIML_APP_SID
TWILIO_AUTH_TOKEN
TWILIO_NUMBER
```

**If any are missing, proceed to Step 2.**

---

### Step 2: Set Missing Secrets

Replace the placeholder values with your actual Twilio credentials:

```bash
# Core credentials (ALL required)
supabase secrets set TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" --project-ref amtxxigpbfsbvalnwpml
supabase secrets set TWILIO_AUTH_TOKEN="your_auth_token_here" --project-ref amtxxigpbfsbvalnwpml
supabase secrets set TWILIO_NUMBER="+15551234567" --project-ref amtxxigpbfsbvalnwpml

# API Key credentials (for JWT generation)
supabase secrets set TWILIO_API_KEY_SID="SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" --project-ref amtxxigpbfsbvalnwpml
supabase secrets set TWILIO_API_KEY_SECRET="your_api_key_secret_here" --project-ref amtxxigpbfsbvalnwpml

# TwiML App (for voice SDK)
supabase secrets set TWILIO_TWIML_APP_SID="APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" --project-ref amtxxigpbfsbvalnwpml
```

---

### Step 3: Redeploy Functions

**CRITICAL:** Functions must be redeployed to pick up new secrets.

```bash
# Redeploy all Twilio functions
supabase functions deploy twilioGenerateToken --project-ref amtxxigpbfsbvalnwpml
supabase functions deploy twilioInitiateCall --project-ref amtxxigpbfsbvalnwpml
supabase functions deploy twilioVoiceHandler --project-ref amtxxigpbfsbvalnwpml
```

---

### Step 4: Test and Check Logs

After redeploying, test by making a call. Then check logs:

```bash
# Watch logs in real-time
supabase functions logs twilioGenerateToken --project-ref amtxxigpbfsbvalnwpml --tail
```

**Look for this output:**
```json
[twilioGenerateToken] Environment check: {"accountSid":true,"apiKeySid":true,"apiKeySecret":true,"twimlAppSid":true}
```

**If any show `false`, that secret is still missing!**

---

## Frontend Debugging

The error response now includes a `debug` object. Check browser console for:

```javascript
{
  success: false,
  error: "Twilio not configured...",
  debug: {
    accountSid: false,  // ← Which ones are false?
    apiKeySid: false,
    apiKeySecret: true,
    twimlAppSid: true
  }
}
```

This shows **exactly** which secrets are missing from the function's perspective.

---

## Common Issues

### Issue 1: Secret Name Typo
**Problem:** `TWILIO_ACOUNT_SID` (missing 'C')
**Fix:** Delete typo secret, recreate with correct name
```bash
supabase secrets unset TWILIO_ACOUNT_SID --project-ref amtxxigpbfsbvalnwpml
supabase secrets set TWILIO_ACCOUNT_SID="ACxxxxxx" --project-ref amtxxigpbfsbvalnwpml
```

### Issue 2: Wrong Project
**Problem:** Secrets set in different Supabase project
**Fix:** Verify project ref in browser URL matches `amtxxigpbfsbvalnwpml`

### Issue 3: Didn't Redeploy
**Problem:** Set secrets but function still uses old environment
**Fix:** Always redeploy after setting secrets (see Step 3)

### Issue 4: Using TWILIO_AUTH_TOKEN Instead of TWILIO_API_KEY_SECRET
**Problem:** `twilioGenerateToken` needs API Key Secret, not Auth Token
**Fix:** You need BOTH - Auth Token for REST API, API Key Secret for JWT generation

---

## Where to Get Twilio Credentials

### Account SID & Auth Token
1. Go to https://console.twilio.com
2. Dashboard shows Account SID and Auth Token

### API Key & Secret
1. Go to https://console.twilio.com/us1/account/keys-credentials/api-keys
2. Click "Create API Key"
3. Name it (e.g., "Supabase Edge Functions")
4. Copy both SID (starts with SK) and Secret immediately (can't view Secret later)

### TwiML App SID
1. Go to https://console.twilio.com/us1/develop/voice/manage/twiml-apps
2. Create new TwiML App
3. Set Voice Configuration URL to: `https://amtxxigpbfsbvalnwpml.supabase.co/functions/v1/twilioVoiceHandler`
4. Copy the App SID (starts with AP)

### Phone Number
1. Go to https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
2. Copy your number in E.164 format (e.g., +15551234567)

---

## Verify Everything Works

After completing all steps, test by:

1. Opening your app
2. Opening browser console
3. Clicking the dialer
4. Attempting to make a call
5. Check console for the `debug` object in the response
6. All values should be `true`

If still showing `false`, check Supabase function logs:

```bash
supabase functions logs twilioGenerateToken --project-ref amtxxigpbfsbvalnwpml
```

Look for `[twilioGenerateToken] Environment check:` to see runtime values.
