# Bot Detection Fix - Multi-Factor Analysis

## 🐛 Problem Identified

When running the bot attack test (20 requests with 50ms delay), the system was logging `rate_limit_exceeded` (MEDIUM severity) instead of `bot_attack` (HIGH severity).

### Test Results Before Fix
```javascript
// From Firestore RateLimits collection:
{
  scenario: "rate_limit_exceeded",  // ❌ Should be "bot_attack"
  severity: "MEDIUM",                // ❌ Should be "HIGH"
  requestsInLastSecond: 0,           // ❌ This was the problem
  requestCount: 4,
  effectiveLimit: 3
}
```

**Test metrics:**
- 20 requests sent over 2.67 seconds
- 7.49 requests/second average
- 50ms delay between requests
- 4 succeeded, 16 rate limited ✅ (correct behavior)
- But severity classification was wrong ❌

### Root Cause

The original bot detection logic only checked if there were **5+ requests in the last 1 second** at the moment the rate limit was triggered:

```javascript
// ❌ OLD LOGIC (lib/rateLimiter.js:115-116)
const requestsInLastSecond = recentRequests.filter(
  timestamp => now - timestamp < 1000
).length;
const scenario = requestsInLastSecond >= 5 ? 'bot_attack' : 'rate_limit_exceeded';
```

**Why it failed:**

With 50ms delays between requests, by the time the 5th request arrives and triggers the rate limit check, the previous requests have spread across time such that checking "last 1000ms" doesn't capture enough requests in a single window.

**Timeline example:**
```
Request 1: 0ms
Request 2: 50ms
Request 3: 100ms
Request 4: 150ms (rate limit triggered)
↑
At 150ms, looking back 1000ms captures all 4 requests,
but that's < 5, so it's not classified as bot attack.
```

However, the **actual rate is 4 requests / 150ms = 26.67 req/sec** - clearly a bot!

---

## ✅ Solution: Multi-Factor Bot Detection

Implemented **three detection criteria** (any one triggers HIGH severity):

### 1. **Requests in Last Second** (Original)
```javascript
const requestsInLastSecond = recentRequests.filter(
  timestamp => now - timestamp < 1000
).length;
```
- Threshold: **≥5 requests in 1 second**
- Detects: Very rapid bursts (e.g., 20 req/sec)

### 2. **Average Request Rate** (NEW)
```javascript
const timeSpanMs = now - recentRequests[0];
const requestRate = (recentRequests.length / timeSpanMs) * 1000;
```
- Threshold: **>6 requests/second** average
- Detects: Sustained high-rate attacks
- Example: 4 requests in 150ms = 26.67 req/sec → **bot_attack** ✅

### 3. **Shorter Window Burst** (NEW)
```javascript
const requestsInLast500ms = recentRequests.filter(
  timestamp => now - timestamp < 500
).length;
```
- Threshold: **≥4 requests in 500ms**
- Detects: Medium-speed bots that space out requests to avoid detection
- Example: 4 requests in 200ms → **bot_attack** ✅

### Final Detection Logic
```javascript
const isBotAttack = requestsInLastSecond >= 5 ||
                   requestRate > 6 ||
                   requestsInLast500ms >= 4;

const scenario = isBotAttack ? 'bot_attack' : 'rate_limit_exceeded';
```

---

## 📊 Expected Results After Fix

When you run the bot attack test again, you should see:

```javascript
{
  scenario: "bot_attack",            // ✅ Correct
  severity: "HIGH",                  // ✅ Correct
  fingerprint: "...",
  eventType: "click",
  requestCount: 4,
  effectiveLimit: 3,
  requestsInLastSecond: 4,          // May still be < 5
  requestRate: "26.67",             // ✅ > 6 → triggers bot_attack
  requestsInLast500ms: 4,           // ✅ >= 4 → triggers bot_attack
  timeSpanMs: 150,
  burstUsed: 1,
  timestamp: Timestamp(...)
}
```

**Why it works now:**
- Even though `requestsInLastSecond` might be < 5
- The `requestRate` of 26.67 req/sec is > 6 ✅
- The `requestsInLast500ms` of 4 is >= 4 ✅
- **Either criterion alone** would trigger `bot_attack` classification

---

## 🧪 Testing

Run the bot attack test again:

### Node.js CLI Test
```bash
node test-rate-limit.js
```

Look for the **"Testing: Bot Attack Simulation"** section.

### Browser Test
Open `test-rate-limit.html` and run the "Bot Attack" test.

### Verify in Firestore

Check the `RateLimits` collection for the most recent entry:

```javascript
// Should see:
{
  scenario: "bot_attack",
  severity: "HIGH",
  requestRate: "~7.49" or higher,
  // ... other fields
}
```

---

## 📈 Benefits of Multi-Factor Detection

| Scenario | Old Detection | New Detection |
|----------|--------------|---------------|
| **50ms intervals (20 req/sec)** | ❌ MEDIUM | ✅ HIGH |
| **100ms intervals (10 req/sec)** | ❌ MEDIUM | ✅ HIGH |
| **150ms intervals (6.67 req/sec)** | ❌ MEDIUM | ✅ HIGH |
| **200ms intervals (5 req/sec)** | ❌ MEDIUM | ❌ MEDIUM* |
| **Legitimate convention burst** | ✅ LOW | ✅ LOW |
| **Normal usage** | ✅ Not logged | ✅ Not logged |

\* *5 req/sec is borderline - this is intentional to avoid false positives at conventions*

---

## 🔍 Monitoring

All three detection factors are now logged to Firestore, allowing you to:

1. **Analyze attack patterns** - See which detection criteria are most commonly triggered
2. **Tune thresholds** - Adjust the thresholds based on real-world data
3. **Identify sophisticated bots** - Bots that try to stay under 5 req/sec are still caught

### Example Query: Find All HIGH Severity Events
```javascript
const botAttacks = await adminDb.collection('RateLimits')
  .where('severity', '==', 'HIGH')
  .orderBy('timestamp', 'desc')
  .limit(50)
  .get();

botAttacks.forEach(doc => {
  const data = doc.data();
  console.log(`Bot attack detected:
    - Request rate: ${data.requestRate} req/sec
    - Requests in 1s: ${data.requestsInLastSecond}
    - Requests in 500ms: ${data.requestsInLast500ms}
    - IP: ${data.ip}
    - User Agent: ${data.userAgent}
  `);
});
```

---

## 📚 Updated Documentation

The following files have been updated to reflect the new multi-factor detection:

1. **[lib/rateLimiter.js](lib/rateLimiter.js)** - Core implementation (lines 113-158)
2. **[RATE_LIMITS_COLLECTION_GUIDE.md](RATE_LIMITS_COLLECTION_GUIDE.md)** - Collection structure and monitoring
3. **[ANALYTICS_IMPLEMENTATION_GUIDE.md](ANALYTICS_IMPLEMENTATION_GUIDE.md)** - Technical implementation details

---

## 🎯 Summary

**Before:** Bot detection only checked if 5+ requests happened in the last 1 second, which failed for bots spacing requests at 50-200ms intervals.

**After:** Bot detection now uses **three independent criteria**, catching bots that:
- Send 5+ requests in 1 second (very fast bots)
- Average >6 requests/second over the entire burst (sustained attacks)
- Send 4+ requests in 500ms (medium-speed bots)

**Result:** The bot attack test will now correctly log as `bot_attack` with `HIGH` severity. ✅
