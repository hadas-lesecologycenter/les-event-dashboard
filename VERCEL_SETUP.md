# Vercel Serverless Setup - Quick Deploy Guide

This is the **easiest way** to deploy the Eventbrite integration. No server management needed!

## Prerequisites

1. **Vercel Account** (free) - https://vercel.com/
2. **Eventbrite API Key** - From https://www.eventbrite.com/platform/api/
3. **Eventbrite Organization ID** - From your Eventbrite account settings

---

## Deploy in 5 Minutes

### Step 1: Get Eventbrite Credentials

**Get API Key:**
1. Go to https://www.eventbrite.com/platform/api/
2. Sign in → Click your app or "Create App"
3. Copy your **Personal OAuth Token** (format: `xxxxx|xxxxx`)

**Get Organization ID:**
1. In Eventbrite, go to **Account** → **Organization Settings**
2. Look at the URL: `https://www.eventbrite.com/organizations/YOUR_ORG_ID/`
3. Copy the `YOUR_ORG_ID` number

### Step 2: Deploy to Vercel

1. **Go to** https://vercel.com/new
2. **Select "Import Git Repository"**
3. **Find and select** `hadas-lesecologycenter/les-event-dashboard`
4. **Click "Import"**
5. **Vercel scans** and detects the project
6. **Click "Deploy"** - Takes ~30 seconds

### Step 3: Add Environment Variables

After deploy finishes:

1. **Go to** your project on Vercel dashboard
2. **Click "Settings"** tab
3. **Click "Environment Variables"** on left
4. **Add two variables:**
   - Name: `EVENTBRITE_API_KEY`
     Value: Your API key (from Eventbrite)
   - Name: `EVENTBRITE_ORG_ID`
     Value: Your org ID (from Eventbrite)
5. **Click "Save"**
6. **Redeploy** - Click "Deployments" → latest → "Redeploy"

### Step 4: Test It!

1. **Go to your dashboard** (https://your-domain.vercel.app)
2. **Create a PUBLIC PROGRAM event**
3. **Complete "Create event brief"** task
4. **Click "Create Eventbrite page"** task
5. **You should see:**
   - ⏳ "Creating Eventbrite event..."
   - ✅ Success with Eventbrite link!

---

## That's It!

Your Eventbrite integration is now live. Every time you:
- Create an event in the dashboard
- Complete the brief
- Click "Create Eventbrite page"

→ A new Eventbrite event is created automatically! 🎉

---

## Troubleshooting

**"Eventbrite credentials not configured"**
- Check that environment variables are set in Vercel Settings
- Make sure you redeployed after adding them

**"Failed to create Eventbrite event"**
- Verify API key is correct (copy exactly from Eventbrite)
- Verify Org ID is correct
- Check Vercel Logs → Function Logs for detailed error

**Where's my backend URL?**
- Vercel URL = your dashboard domain (e.g., `your-domain.vercel.app`)
- API automatically available at `/api/create-eventbrite-event`
- No extra setup needed!

---

## Key Differences from Node.js Backend

| Feature | Vercel | Node.js |
|---------|--------|---------|
| Setup Time | 5 min | 20 min |
| Server Management | None | Required |
| Cost | Free | Free-$10/mo |
| Scaling | Automatic | Manual |
| Maintenance | None | Required |

Vercel is the way to go! 🚀
