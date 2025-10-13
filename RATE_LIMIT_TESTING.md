# Rate Limit Testing Guide

## 🎯 Overview

Two automated testing tools to verify your rate limiting system works correctly:

1. **Node.js Script** (`test-rate-limit.js`) - Command-line testing
2. **HTML Page** (`test-rate-limit.html`) - Browser-based visual testing

---

## 🖥️ Method 1: Node.js Script (Recommended)

### Setup

1. **Update configuration** in `test-rate-limit.js`:
   ```javascript
   const TEST_CONFIG = {
     SERVER_URL: 'http://localhost:3000',
     USER_ID: 'YOUR_USER_ID_HERE',  // ← Update this
     USERNAME: 'YOUR_USERNAME_HERE'  // ← Update this
   };
   ```

2. **Make sure your dev server is running:**
   ```bash
   npm run dev
   ```

### Run Tests

**View help:**
```bash
node test-rate-limit.js help
```

**Run specific test:**
```bash
node test-rate-limit.js normal    # Normal usage (should succeed)
node test-rate-limit.js burst     # Convention burst (uses burst allowance)
node test-rate-limit.js spam      # Spam scenario (triggers rate limit)
node test-rate-limit.js bot       # Bot attack (HIGH severity)
```

**Run all tests:**
```bash
node test-rate-limit.js all
```
⚠️ This takes ~5 minutes (waits for rate limits to reset between tests)

### Expected Output

```
🧪 Testing: Convention Burst
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 Should use burst allowance, then rate limit
📊 Requests: 5
⏱️  Delay: 500ms between requests
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1/5] Sending request...
  ✅ Success (45ms) - Remaining: 2
[2/5] Sending request...
  ✅ Success (32ms) - Remaining: 1
[3/5] Sending request...
  ✅ Success (28ms) - Remaining: 0
[4/5] Sending request...
  ✅ Success (31ms) - Remaining: 0  ← Used burst allowance
[5/5] Sending request...
  🚫 Rate Limited (24ms) - Retry after: 56s

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Test Results
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Successful: 4/5
🚫 Rate Limited: 1/5
❌ Errors: 0/5
⏱️  Total Duration: 2.13s
📈 Requests/sec: 2.35

🎉 Test PASSED! Rate limiting is working as expected.
```

---

## 🌐 Method 2: HTML Browser Test

### Setup

1. **Start your dev server:**
   ```bash
   npm run dev
   ```

2. **Open the test page in your browser:**
   ```bash
   # Option 1: Copy to public folder
   cp test-rate-limit.html public/
   # Then visit: http://localhost:3000/test-rate-limit.html

   # Option 2: Open directly
   open test-rate-limit.html  # macOS
   xdg-open test-rate-limit.html  # Linux
   start test-rate-limit.html  # Windows
   ```

### Usage

1. **Enter your credentials:**
   - User ID: `rfGX8GX9Y3gv3SKbkiERPFym72r1`
   - Username: `leozul`

2. **Click a test scenario:**
   - 🟢 **Normal** - 3 requests, should all succeed
   - 🟡 **Burst** - 5 requests, tests burst allowance
   - 🟠 **Spam** - 15 requests, triggers rate limit
   - 🔴 **Bot Attack** - 20 rapid requests, triggers HIGH severity

3. **Watch real-time results:**
   - Progress bar shows completion
   - Logs show each request result
   - Summary shows totals

---

## 📊 Test Scenarios Explained

### 🟢 Normal Usage
- **Requests:** 3
- **Delay:** 2 seconds between requests
- **Expected:** All succeed (within limit)
- **Result:** No rate limiting

### 🟡 Convention Burst
- **Requests:** 5
- **Delay:** 500ms between requests
- **Expected:** 4 succeed (3 normal + 1 burst), 1 rate limited
- **Result:** Logs `convention_burst` scenario (LOW severity)

### 🟠 Spam Scenario
- **Requests:** 15
- **Delay:** 500ms between requests
- **Expected:** 4 succeed, 11 rate limited
- **Result:** Logs `rate_limit_exceeded` scenario (MEDIUM severity)

### 🔴 Bot Attack
- **Requests:** 20
- **Delay:** 50ms between requests (VERY FAST!)
- **Expected:** 4 succeed, 16 rate limited
- **Result:** Logs `bot_attack` scenario (HIGH severity)
  - Triggers because ≥5 requests/second

---

## 🔍 Verifying Results

### 1. Check Server Logs

You should see:
```
📊 Analytics API: POST request received
📊 Analytics API: Received view event for user...
🚨 Analytics API: Rate limit exceeded for view
📊 Rate limit event logged: view - rate_limit_exceeded
```

### 2. Check Firestore `RateLimits` Collection

Query the collection:
```javascript
// In Firebase Console or via script
db.collection('RateLimits')
  .orderBy('timestamp', 'desc')
  .limit(10)
  .get()
```

Look for:
- **scenario**: `convention_burst`, `rate_limit_exceeded`, or `bot_attack`
- **severity**: `LOW`, `MEDIUM`, or `HIGH`
- **fingerprint**: Hashed identifier
- **requestsInLastSecond**: For bot attacks, this should be ≥5

### 3. Check Browser Network Tab

- Open DevTools → Network tab
- Filter by "track-event"
- Look for:
  - **200 OK** - Successful tracking
  - **429 Too Many Requests** - Rate limited

---

## 🎯 Rate Limit Configuration

Current limits (from `analyticsConstants.js`):

| Event Type | Window | Max Requests | Burst | Total |
|------------|--------|--------------|-------|-------|
| **VIEW** | 60s | 3 | 1 | 4 |
| **CLICK** | 10s | 10 | 3 | 13 |
| **TIME_ON_PROFILE** | 60s | 60 | 10 | 70 |

**Effective Limit** = Max Requests + Burst Allowance

---

## 🐛 Troubleshooting

### "Failed to fetch" Error

**Problem:** Can't connect to API

**Solutions:**
1. Make sure dev server is running: `npm run dev`
2. Check the URL in test-rate-limit.js matches your server
3. Check for CORS issues (should work on localhost)

### All Requests Succeed (No Rate Limiting)

**Problem:** Rate limiting not working

**Solutions:**
1. Check that `applyAnalyticsRateLimit()` is called in API route
2. Verify rate limit configuration in `analyticsConstants.js`
3. Check server logs for rate limit messages
4. Make sure requests use same fingerprint (same browser session)

### "Request timed out" Error

**Problem:** Server not responding

**Solutions:**
1. Check server logs for errors
2. Verify Firestore connection
3. Check if logging function is blocking (it shouldn't be)

### No Logs in RateLimits Collection

**Problem:** Logging not working

**Solutions:**
1. Check Firestore rules allow writes to RateLimits
2. Verify `logRateLimitEvent()` function in `rateLimiter.js`
3. Check server logs for "Rate limit event logged" messages
4. Verify firebase admin SDK is initialized

---

## 📈 Analyzing Results

### Good Signs ✅

- Normal test: All succeed
- Burst test: 4 succeed, rest rate limited
- Spam test: 4 succeed, rest rate limited
- Bot test: 4 succeed, rest rate limited with HIGH severity
- RateLimits collection has entries
- Server logs show rate limit events

### Bad Signs ❌

- All requests succeed (rate limiting not working)
- All requests fail (server error)
- No entries in RateLimits collection (logging broken)
- Wrong severity levels (classification broken)

### Adjusting Rate Limits

If you need to adjust limits, edit:
```javascript
// lib/services/serviceUser/constants/analyticsConstants.js

export const RATE_LIMIT_CONFIG = {
  VIEW: {
    windowMs: 60 * 1000,    // ← Change this
    maxRequests: 3,          // ← Change this
    burstAllowance: 1        // ← Change this
  },
  // ...
};
```

Then restart your server and re-run tests.

---

## 🚀 Advanced Testing

### Test Custom Scenarios

Edit `test-rate-limit.js`:

```javascript
scenarios: {
  // Add your custom scenario
  custom: {
    name: 'My Custom Test',
    requests: 10,
    delayMs: 200,
    description: 'Custom test scenario',
    expectedSuccess: 4,
    expectedRateLimit: 6
  }
}
```

Run it:
```bash
node test-rate-limit.js custom
```

### Test Different Event Types

Modify the `sendAnalyticsRequest()` function to test clicks:

```javascript
async function sendAnalyticsRequest(eventType = 'click') {  // ← Change this
  const payload = {
    eventType,
    userId: TEST_CONFIG.USER_ID,
    linkData: {  // ← Add this for clicks
      linkId: 'test_link_123',
      linkTitle: 'Test Link',
      linkUrl: 'https://example.com',
      linkType: 'custom'
    },
    // ...
  };
}
```

### Monitor in Real-Time

Open two terminal windows:

**Terminal 1:** Run test
```bash
node test-rate-limit.js bot
```

**Terminal 2:** Monitor RateLimits collection
```bash
# Use Firebase CLI or your own script
firebase firestore:query RateLimits --order-by timestamp --limit 10
```

---

## 📝 Best Practices

1. **Test Regularly** - Run tests after making changes to rate limiting
2. **Test All Scenarios** - Don't just test one scenario
3. **Monitor Production** - Use the RateLimits collection to detect real attacks
4. **Adjust as Needed** - If you see too many false positives, increase limits
5. **Clean Up Logs** - Regularly delete old test logs from RateLimits collection

---

## 🎓 What You're Testing

### Rate Limiter Features

✅ **Fingerprinting** - Combines IP + User Agent + Session Cookie
✅ **Sliding Window** - Requests expire after window duration
✅ **Burst Allowance** - Legitimate rapid interactions allowed
✅ **Event Classification** - Bot attacks vs. legitimate use
✅ **Logging** - Abnormal activity logged to Firestore
✅ **Non-Blocking** - Rate limiting doesn't break on logging failures

### Security

✅ **Bot Detection** - Rapid requests (≥5/sec) flagged as HIGH severity
✅ **Convention-Friendly** - Burst allowance prevents false positives
✅ **Privacy** - Fingerprints are hashed (SHA-256)
✅ **Performance** - Fire-and-forget logging doesn't block requests

---

## 🎉 Success Criteria

Your rate limiting is working correctly if:

1. ✅ Normal test: All requests succeed
2. ✅ Burst test: Burst allowance is used, then rate limited
3. ✅ Spam test: Rate limited with MEDIUM severity
4. ✅ Bot test: Rate limited with HIGH severity
5. ✅ RateLimits collection has entries for each scenario
6. ✅ Server logs show rate limit events
7. ✅ Fingerprints are properly hashed
8. ✅ No errors or crashes

**If all criteria are met, your system is production-ready!** 🚀
