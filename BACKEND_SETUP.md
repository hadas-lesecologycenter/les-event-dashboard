# Backend Setup Guide - Eventbrite Integration

## Prerequisites

1. **Node.js** installed (v14 or higher) - https://nodejs.org/
2. **Eventbrite Account** with organization access
3. **Eventbrite API Key** and **Organization ID**

---

## Step 1: Get Eventbrite Credentials

### Get API Key:
1. Go to https://www.eventbrite.com/platform/api/
2. Sign in to your Eventbrite account
3. Click "Create App" (or find your existing app)
4. Copy your **Personal OAuth Token** (format: `xxxxx|xxxxx`)

### Get Organization ID:
1. In Eventbrite, go to **Account** → **Organization Settings**
2. Look at the URL: `https://www.eventbrite.com/organizations/YOUR_ORG_ID/`
3. Copy your **ORG_ID** (a long number)

---

## Step 2: Set Up Local Backend (Development)

### 1. Install Dependencies
```bash
cd les-event-dashboard
npm install
```

### 2. Create `.env` file
Create a file named `.env` in the project root:
```
EVENTBRITE_API_KEY=your_api_key_here
EVENTBRITE_ORG_ID=your_org_id_here
PORT=3000
```

### 3. Run Locally
```bash
npm start
```

You should see: `Server running on port 3000`

### 4. Test Backend
Open: http://localhost:3000/health
Should return: `{"status":"ok"}`

---

## Step 3: Deploy Backend (Production)

### Option A: Deploy to Railway (Easiest)

1. **Create Railway Account** - https://railway.app/
2. **Connect GitHub** - Link your GitHub repo
3. **Create New Project** → Select your repository
4. **Add Variables**:
   - Go to Variables tab
   - Add `EVENTBRITE_API_KEY` = your API key
   - Add `EVENTBRITE_ORG_ID` = your org ID
5. **Railway auto-deploys** - Your backend is live!
6. **Get URL** - Copy the deploy URL (e.g., `https://xyz.railway.app`)

### Option B: Deploy to Render

1. **Create Render Account** - https://render.com/
2. **New Web Service** → Connect to GitHub
3. **Configure**:
   - Build Command: `npm install`
   - Start Command: `npm start`
4. **Environment Variables**:
   - Add `EVENTBRITE_API_KEY`
   - Add `EVENTBRITE_ORG_ID`
5. **Deploy** - Render builds and deploys automatically

### Option C: Deploy to Heroku (Legacy Free Tier Removed)

Heroku's free tier is no longer available, but you can use a paid dyno.

---

## Step 4: Update Dashboard with Backend URL

Once your backend is deployed, update the `openEventbriteForm` function in `index.html`:

Find this line:
```javascript
const apiUrl = process.env.NODE_ENV === 'production'
    ? 'https://your-backend-url.com/api/create-eventbrite-event'
    : 'http://localhost:3000/api/create-eventbrite-event';
```

Replace `https://your-backend-url.com` with your actual backend URL (e.g., `https://xyz.railway.app`)

---

## Step 5: Test Integration

1. Go to dashboard
2. Create a PUBLIC PROGRAM event
3. Complete the "Create event brief" task
4. Complete the "Create Eventbrite page" task
5. You should see:
   - ⏳ "Creating Eventbrite event..."
   - ✅ Success with link to your new Eventbrite event

---

## Troubleshooting

### "Eventbrite credentials not configured"
- Check that `.env` file exists with correct API key and org ID
- Make sure environment variables are set in your hosting platform

### "Failed to create Eventbrite event"
- Verify API key is correct (copy from Eventbrite exactly)
- Verify Organization ID is correct
- Check browser console for detailed error message

### Backend not responding
- Is the server running? (`npm start`)
- Is the URL correct in the dashboard?
- Check firewall/network settings

### CORS Error
- Backend includes CORS headers
- Make sure you're using the correct backend URL

---

## Monitoring

### Railway:
- Dashboard → Logs tab shows real-time logs
- Metrics tab shows CPU/Memory usage

### Render:
- Logs section shows deployment and runtime logs
- Check for errors if events fail to create

---

## Next Steps

1. ✅ Get credentials
2. ✅ Test locally
3. ✅ Deploy to production
4. ✅ Update dashboard URL
5. ✅ Test end-to-end

Once deployed, users can create Eventbrite events directly from the dashboard!
