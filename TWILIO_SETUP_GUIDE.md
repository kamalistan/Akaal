# Twilio Configuration Guide

## Current Issue

You're getting the error: **"Twilio not configured. Enable Demo Mode in Settings to test without Twilio."**

This happens because the required Twilio environment variables are missing from your Supabase Edge Functions configuration.

## Option 1: Enable Demo Mode (Quick Test)

If you want to test the dialer immediately without setting up Twilio:

1. Open the app and go to **Settings**
2. Scroll to **Dialer Settings**
3. Toggle **Demo Mode** ON
4. Try dialing again - it will now simulate calls without requiring Twilio

Demo Mode features:
- Simulates realistic call flow with status transitions
- No Twilio account required
- All features work as they would in production
- Perfect for testing and development

## Option 2: Configure Real Twilio Integration

To use real Twilio calling, you need to configure the following environment variables in Supabase:

### Required Environment Variables

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_KEY_SID=SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_KEY_SECRET=your_api_key_secret_here
TWILIO_TWIML_APP_SID=APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Step-by-Step Setup

#### 1. Get Your Twilio Account SID
- Go to [Twilio Console](https://console.twilio.com/)
- Copy your **Account SID** from the dashboard

#### 2. Create API Key and Secret
- Go to [API Keys](https://console.twilio.com/us1/account/keys-credentials/api-keys)
- Click "Create API Key"
- Give it a name (e.g., "Base44 Dialer")
- Copy the **SID** and **Secret** (you won't be able to see the secret again!)

#### 3. Create a TwiML Application
- Go to [TwiML Apps](https://console.twilio.com/us1/develop/voice/manage/twiml-apps)
- Click "Create new TwiML App"
- Give it a name (e.g., "Base44 Voice")
- Set **Voice URL** to: `https://amtxxigpbfsbvalnwpml.supabase.co/functions/v1/twilioVoiceHandler`
- Set **Voice Method** to: `POST`
- Copy the **Application SID** (starts with AP...)

#### 4. Configure Supabase Secrets

You need to add these secrets to your Supabase project. Since the Supabase CLI is not available in this environment, you'll need to:

**Option A: Use Supabase Dashboard**
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Edge Functions** → **Secrets**
4. Add each of the four environment variables

**Option B: Use Supabase CLI (if available)**
```bash
supabase secrets set TWILIO_ACCOUNT_SID=your_account_sid_here
supabase secrets set TWILIO_API_KEY_SID=your_api_key_sid_here
supabase secrets set TWILIO_API_KEY_SECRET=your_api_key_secret_here
supabase secrets set TWILIO_TWIML_APP_SID=your_twiml_app_sid_here
```

#### 5. Buy a Twilio Phone Number (if you haven't already)
- Go to [Phone Numbers](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming)
- Click "Buy a number"
- Search for a number with Voice capabilities
- Purchase the number

#### 6. Configure Your Twilio Number
- Go to your phone number settings
- Under **Voice Configuration**:
  - Set **Configure with** to: `TwiML App`
  - Select your TwiML App from the dropdown

### Testing the Configuration

After configuring Twilio:

1. Make sure **Demo Mode is OFF** in Settings
2. Try making a call
3. Check the browser console for detailed error messages if it still doesn't work

### Troubleshooting

**If you still get errors:**

1. Check browser console for specific error messages
2. The app now shows which configuration variables are missing
3. Verify all four environment variables are set correctly in Supabase
4. Make sure your TwiML App Voice URL is correctly pointing to your edge function
5. Verify your Twilio account has sufficient balance

**Common Issues:**

- **"Missing accountSid, apiKeySid, apiKeySecret, twimlAppSid"** - Environment variables not set in Supabase
- **"Invalid Access Token"** - API Key or Secret is incorrect
- **"Call failed immediately"** - TwiML App Voice URL might be incorrect
- **"No answer"** - Normal behavior, the call went through but wasn't answered

## What Changed

The app now provides better error diagnostics:

- Shows exactly which Twilio configuration variables are missing
- Displays detailed error messages in the console
- Provides clear guidance on enabling Demo Mode as an alternative
- Logs configuration status for easier troubleshooting

## Need Help?

If you're still having issues, check:
1. Browser console for detailed error messages
2. Supabase Edge Functions logs
3. Twilio Console logs at [Twilio Monitor](https://console.twilio.com/us1/monitor/logs/calls)
