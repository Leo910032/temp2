# Analytics Click Tracking - Testing & Debugging Guide

## Overview
This guide will help you test and debug the new analytics tracking system, specifically for click tracking on buttons.

---

## 🧪 How to Test Click Tracking

### Step 1: Open Your Profile Page
1. Start your development server: `npm run dev`
2. Navigate to a public profile page (e.g., `http://localhost:3000/yourUsername`)
3. **Important:** Make sure you're NOT in preview mode (URL should NOT have `?preview=true`)

### Step 2: Open Browser Developer Tools
1. Press `F12` or right-click → "Inspect"
2. Go to the **Console** tab
3. Go to the **Network** tab (keep both visible if possible)

### Step 3: Click a Button
Click any button on your profile page and watch the console logs.

---

## ✅ Expected Console Logs (In Order)

When you click a button, you should see these logs in the browser console:

```
🔍 Button: handleLinkClick fired {userId: "abc123", linkId: "link_xyz", url: "https://..."}
🔍 Button: Calling TrackAnalyticsService.trackClick
📊 Analytics: Tracking click on "My Portfolio"
✅ Analytics: Click tracked via sendBeacon
🔍 Button: TrackAnalyticsService.trackClick called with {linkId: "link_xyz", linkTitle: "My Portfolio", linkUrl: "https://..."}
```

### What Each Log Means:

| Log | Meaning |
|-----|---------|
| `handleLinkClick fired` | The button's onClick handler was triggered |
| `Calling TrackAnalyticsService.trackClick` | About to call the analytics service |
| `Tracking click on "..."` | Analytics service received the data |
| `Click tracked via sendBeacon` | Request sent successfully using sendBeacon API |
| `TrackAnalyticsService.trackClick called with` | Summary of what was tracked |

---

## 🌐 Expected Network Activity

### In Browser Network Tab:
1. Filter by "track-event" or "analytics"
2. Look for: `POST /api/user/analytics/track-event`
3. **Note:** `sendBeacon` requests may not always appear in the Network tab, but they ARE sent!

### Expected Response:
```json
{
  "success": true,
  "message": "Click tracked",
  "eventType": "click",
  "timestamp": "2025-10-12T19:30:00.000Z"
}
```

---

## 🖥️ Expected Server Logs

In your terminal where `npm run dev` is running, you should see:

```
📊 Analytics API: POST request received
📊 Analytics API: Body parsed: {"eventType":"click","userId":"abc123",...}
📊 Analytics API: Received click event for user abc123 {hasLinkData: true, linkId: "link_xyz", hasSessionData: true}
📊 TrackAnalyticsService: Processing click on "My Portfolio"
✅ TrackAnalyticsService: Click tracked successfully
✅ Analytics API: Successfully tracked click event
```

---

## 🔍 Common Issues & Solutions

### Issue 1: "⚠️ Button: Missing data for tracking"

**Symptom:**
```
⚠️ Button: Missing data for tracking {hasUserId: false, hasLinkId: true, ...}
```

**Possible Causes:**
- You're in preview mode (`?preview=true` in URL)
- `userData.uid` is not available
- Link doesn't have an `id` field

**Solutions:**
1. Remove `?preview=true` from the URL
2. Check that the profile page loaded properly
3. Verify your links have IDs in the database

---

### Issue 2: No Console Logs Appear

**Symptom:** Nothing appears in console when you click

**Possible Causes:**
- JavaScript not loading
- Console is filtered
- onClick handler not attached

**Solutions:**
1. Refresh the page (hard refresh: `Ctrl+Shift+R` or `Cmd+Shift+R`)
2. Clear console filters (check the filter dropdown)
3. Make sure you're clicking an actual button, not a header or other element

---

### Issue 3: "Click tracked via sendBeacon" but Not in Database

**Symptom:** Console shows success but database doesn't update

**Possible Causes:**
- API route has an error
- Firestore permissions issue
- Rate limiting

**Solutions:**

1. **Check Server Logs** - Look for errors after "POST request received"

2. **Check Rate Limiting:**
   - Wait 10 seconds between clicks
   - Rate limit: 10 clicks per 10 seconds

3. **Check Firestore Rules:**
   - Make sure your server can write to the `Analytics` collection
   - Check Firebase Admin SDK is configured correctly

4. **Test API Directly:**
```bash
curl -X POST http://localhost:3000/api/user/analytics/track-event \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "click",
    "userId": "YOUR_USER_ID",
    "linkData": {
      "linkId": "test_link",
      "linkTitle": "Test Link",
      "linkUrl": "https://example.com",
      "linkType": "custom"
    },
    "sessionData": {
      "sessionId": "test_session",
      "trafficSource": {
        "source": "direct",
        "medium": "none",
        "type": "direct"
      }
    }
  }'
```

---

### Issue 4: 429 Rate Limit Error

**Symptom:**
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 5
}
```

**Cause:** Too many clicks in a short time

**Solution:**
- Wait 10 seconds and try again
- This is normal behavior at conventions/events
- Rate limits: 10 clicks per 10 seconds (with 3-click burst allowance)

---

### Issue 5: CORS or Network Error

**Symptom:**
```
❌ Analytics: Fetch failed: TypeError: Failed to fetch
```

**Possible Causes:**
- Dev server not running
- Port mismatch
- Network issue

**Solutions:**
1. Verify dev server is running: `npm run dev`
2. Check the URL in browser matches server port
3. Try hard refresh: `Ctrl+Shift+R`

---

## 🎯 Debugging Checklist

Use this checklist to systematically debug issues:

### Browser Console Checks:
- [ ] Console shows `🔍 Button: handleLinkClick fired`?
- [ ] Console shows `🔍 Button: Calling TrackAnalyticsService.trackClick`?
- [ ] Console shows `📊 Analytics: Tracking click on ...`?
- [ ] Console shows `✅ Analytics: Click tracked via sendBeacon`?
- [ ] No errors or warnings in console?

### Network Tab Checks:
- [ ] Request to `/api/user/analytics/track-event` appears?
- [ ] Request returns `200 OK` status?
- [ ] Response body shows `"success": true`?

### Server Logs Checks:
- [ ] Server logs show `📊 Analytics API: POST request received`?
- [ ] Server logs show `📊 Analytics API: Body parsed: ...`?
- [ ] Server logs show `✅ TrackAnalyticsService: Click tracked successfully`?
- [ ] No errors in server logs?

### Database Checks:
- [ ] Open Firebase Console
- [ ] Navigate to Firestore → `Analytics` collection
- [ ] Find document with your userId
- [ ] Check if `totalClicks` increased?
- [ ] Check if `linkClicks.[yourLinkId].totalClicks` increased?
- [ ] Check if `dailyClicks.[today's date]` increased?

---

## 🗄️ Database Structure

After a successful click, your Firestore `Analytics/{userId}` document should look like:

```javascript
{
  username: "yourUsername",
  totalClicks: 5,
  totalViews: 12,
  lastUpdated: Timestamp,
  lastClickAt: Timestamp,

  // Daily aggregations
  dailyClicks: {
    "2025-10-12": 3,
    "2025-10-13": 2
  },

  // Weekly aggregations
  weeklyClicks: {
    "2025-W41": 5
  },

  // Monthly aggregations
  monthlyClicks: {
    "2025-10": 5
  },

  // Per-link statistics
  linkClicks: {
    "link_abc123": {
      totalClicks: 3,
      title: "My Portfolio",
      url: "https://example.com",
      type: "custom",
      lastClicked: Timestamp,
      dailyClicks: {
        "2025-10-12": 3
      },
      deviceStats: {
        "mobile": 2,
        "desktop": 1
      }
    }
  },

  // Traffic sources
  trafficSources: {
    "direct": {
      clicks: 2,
      views: 5,
      lastClick: Timestamp
    },
    "google": {
      clicks: 1,
      views: 3,
      lastClick: Timestamp
    }
  },

  // Device statistics
  deviceStats: {
    "mobile": {
      clicks: 2,
      views: 7
    },
    "desktop": {
      clicks: 3,
      views: 5
    }
  }
}
```

---

## 🔬 Advanced Debugging

### Enable Verbose Logging

The code already has extensive logging. If you need MORE details, you can:

1. **Check sendBeacon return value:**

Edit `lib/services/serviceUser/client/services/TrackAnalyticsService.js` line ~330:

```javascript
const sent = navigator.sendBeacon('/api/user/analytics/track-event', blob);
console.log('🔍 sendBeacon result:', sent); // Add this line
```

2. **Log the full request body:**

In the same file, before sendBeacon:

```javascript
console.log('🔍 Full payload:', JSON.stringify(payload, null, 2));
const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
```

3. **Check session data:**

```javascript
const sessionData = SessionManager.getOrCreateSession();
console.log('🔍 Session data:', sessionData);
```

### Test Without sendBeacon

To test if sendBeacon is the issue, force fetch instead:

In `TrackAnalyticsService.trackClick()`, comment out sendBeacon:

```javascript
// if (navigator.sendBeacon) {
//     const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
//     const sent = navigator.sendBeacon('/api/user/analytics/track-event', blob);
//     ...
// } else {
    await this.sendViaFetch(payload);
// }
```

---

## 📊 Monitoring in Production

Once everything works in development:

### Remove Debug Logs
Before deploying, remove these debug console.logs:
- `app/[userId]/elements/Button.jsx` (lines 309, 312, 325, 331)
- `app/api/user/analytics/track-event/route.js` (lines 23, 28, 40)

Keep only the `📊` and `✅` logs for monitoring.

### Monitor Rate Limits

Check rate limit stats:

```javascript
import { getRateLimitStats } from '@/lib/rateLimiter';
console.log(getRateLimitStats());
```

### Analytics Dashboard

You can query your analytics:

```javascript
import { TrackAnalyticsService } from '@/lib/services/serviceUser/server/services/trackAnalyticsService';

// Get analytics
const analytics = await TrackAnalyticsService.getAnalytics(userId);

// Get top links
const topLinks = await TrackAnalyticsService.getTopLinks(userId, 10);

// Calculate retention
const retention = await TrackAnalyticsService.calculateRetentionRate(userId, 'weekly');
```

---

## 🆘 Still Not Working?

If you've tried everything above and clicks still aren't tracking:

1. **Check the old API endpoint** - Make sure it's not interfering:
   - Look at `app/api/user/analytics/track/route.js`
   - The old endpoint should still work as fallback

2. **Verify file imports:**
```bash
grep -r "TrackAnalyticsService" app/[userId]/
# Should show Button.jsx and House.jsx
```

3. **Check build errors:**
```bash
npm run build
# Look for any compilation errors
```

4. **Test in incognito mode:**
   - Rules out browser extension interference
   - Rules out cached files

5. **Check browser compatibility:**
   - `sendBeacon` is supported in all modern browsers
   - Check: `console.log('sendBeacon available:', !!navigator.sendBeacon)`

---

## 📞 Getting Help

If you're still stuck, gather this information:

1. **Browser console logs** (copy all output)
2. **Server terminal logs** (copy all output)
3. **Network tab** (screenshot of the request/response)
4. **Firestore document** (screenshot of Analytics/{userId})
5. **Your browser** (Chrome/Firefox/Safari + version)
6. **Environment** (development/production)

---

## ✨ Success!

If everything works, you should see:
- ✅ Console logs showing successful tracking
- ✅ Server logs confirming receipt
- ✅ Database updating with each click
- ✅ Click counts incrementing properly

Your analytics system is now tracking:
- Profile views
- Link clicks
- Traffic sources
- Device types
- Time-based aggregations
- Per-link statistics

Ready for future enhancements like:
- Time on profile tracking
- Retention rate calculations
- Advanced metrics and dashboards
