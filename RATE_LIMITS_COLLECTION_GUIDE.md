# RateLimits Collection - Monitoring & Analysis Guide

## 📋 Overview

The `RateLimits` collection logs **abnormal rate limit activity** to help you:
- **Detect bot attacks** before they impact your service
- **Understand burst patterns** from legitimate users (conventions, events)
- **Monitor abuse patterns** and adjust rate limits accordingly
- **Maintain security** without creating false positives

**Important:** Normal usage is NOT logged here - that's tracked in the `Analytics` collection. This collection ONLY logs when rate limits are triggered.

---

## 🗄️ Collection Structure

### Firestore Path
```
RateLimits/
  {documentId}/
    ├─ scenario: string          ← 'convention_burst' | 'rate_limit_exceeded' | 'bot_attack'
    ├─ fingerprint: string        ← Hashed identifier (for privacy)
    ├─ eventType: string          ← 'view' | 'click' | 'time_on_profile'
    ├─ userId: string | null      ← Profile owner's ID (if known)
    ├─ ip: string                 ← IP address (may be shared at events)
    ├─ userAgent: string          ← Browser/device info
    ├─ requestCount: number       ← How many requests in window
    ├─ effectiveLimit: number     ← Limit that was reached
    ├─ windowMs: number           ← Time window in milliseconds
    ├─ requestsInLastSecond: number  ← Requests in last 1 second
    ├─ requestRate: string        ← Requests/second (formatted, e.g., "7.49")
    ├─ requestsInLast500ms: number   ← Requests in last 500ms (for burst detection)
    ├─ timeSpanMs: number         ← Time span from first to last request
    ├─ burstUsed: number          ← How much burst allowance was used
    ├─ timeSinceFirstRequest: number ← Time since first request in window
    ├─ severity: string           ← 'LOW' | 'MEDIUM' | 'HIGH'
    ├─ note: string | undefined   ← Additional context
    ├─ timestamp: Timestamp       ← When this happened
    └─ createdAt: string          ← ISO 8601 timestamp
```

---

## 🎯 Scenario Types

### 1. **Convention Burst** (Severity: LOW)
**What it means:** A legitimate user is showing their profile to multiple people in quick succession.

**Example:**
```javascript
{
  scenario: 'convention_burst',
  fingerprint: 'a3f4b2c1d5e6...',
  eventType: 'click',
  userId: 'user_abc123',
  ip: '192.168.1.100',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0...)',
  requestCount: 11,
  maxRequests: 10,
  burstAllowance: 3,
  burstUsed: 1,
  windowMs: 10000,
  timeSinceFirstRequest: 2500,
  severity: 'LOW',
  note: 'Legitimate burst usage detected - likely convention/event scenario',
  timestamp: Timestamp(2025-10-12T19:45:23.456Z)
}
```

**Characteristics:**
- Requests slightly over normal limit (10-13 requests)
- Spread over 2-5 seconds
- Burst allowance is being used
- Likely at networking events, conferences, meetups

**Action:** ✅ No action needed - this is expected and allowed behavior

---

### 2. **Rate Limit Exceeded** (Severity: MEDIUM)
**What it means:** A user exceeded the effective limit (normal + burst), but it's not aggressive enough to be classified as a bot.

**Example:**
```javascript
{
  scenario: 'rate_limit_exceeded',
  fingerprint: 'b2c3d4e5f6a7...',
  eventType: 'view',
  userId: 'user_xyz789',
  ip: '10.0.0.50',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...',
  requestCount: 15,
  effectiveLimit: 13,
  windowMs: 10000,
  requestsInLastSecond: 3,
  burstUsed: 3,
  timeSinceFirstRequest: 8000,
  severity: 'MEDIUM',
  timestamp: Timestamp(2025-10-12T20:15:10.789Z)
}
```

**Characteristics:**
- Exceeded limit but not rapidly (< 5 requests/second)
- Could be enthusiastic user or browser pre-fetching
- May be legitimate or borderline abuse

**Action:** ⚠️ Monitor - if same fingerprint appears frequently, investigate

---

### 3. **Bot Attack** (Severity: HIGH)
**What it means:** Suspicious rapid-fire requests indicating automated scraping or attack.

**Example:**
```javascript
{
  scenario: 'bot_attack',
  fingerprint: 'c4d5e6f7a8b9...',
  eventType: 'view',
  userId: 'user_def456',
  ip: '203.0.113.42',
  userAgent: 'python-requests/2.28.1',
  requestCount: 50,
  effectiveLimit: 13,
  windowMs: 10000,
  requestsInLastSecond: 15,        ← 🚨 15 requests in 1 second!
  requestRate: '12.50',            ← 🚨 12.5 requests/second average
  requestsInLast500ms: 8,          ← 🚨 8 requests in 500ms
  timeSpanMs: 4000,                ← All requests in 4 seconds
  burstUsed: 3,
  timeSinceFirstRequest: 1200,
  severity: 'HIGH',
  timestamp: Timestamp(2025-10-12T21:00:45.123Z)
}
```

**Bot Detection Criteria** (any one triggers HIGH severity):
1. **5+ requests in last 1 second**
2. **Average rate > 6 requests/second** across the entire burst
3. **4+ requests in last 500ms**

**Characteristics:**
- Meets one or more bot detection thresholds
- Often has suspicious user agent (python, curl, scrapers)
- May come from datacenter IPs
- Far exceeds reasonable usage

**Action:** 🚨 Investigate immediately
1. Check if IP is from known datacenter/VPN
2. Look for patterns (same fingerprint across multiple users)
3. Consider blocking if persistent
4. Review firewall rules

---

## 📊 Monitoring Queries

### Query 1: Find All Bot Attacks (Last 24 Hours)
```javascript
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);

const botAttacks = await adminDb.collection('RateLimits')
  .where('scenario', '==', 'bot_attack')
  .where('timestamp', '>=', yesterday)
  .orderBy('timestamp', 'desc')
  .get();

console.log(`Found ${botAttacks.size} bot attacks in last 24 hours`);
```

### Query 2: Most Frequent Attackers
```javascript
const attacks = await adminDb.collection('RateLimits')
  .where('severity', '==', 'HIGH')
  .where('timestamp', '>=', oneWeekAgo)
  .get();

const fingerprintCounts = {};
attacks.forEach(doc => {
  const fp = doc.data().fingerprint;
  fingerprintCounts[fp] = (fingerprintCounts[fp] || 0) + 1;
});

// Sort by frequency
const sorted = Object.entries(fingerprintCounts)
  .sort(([,a], [,b]) => b - a)
  .slice(0, 10);

console.log('Top 10 attackers:', sorted);
```

### Query 3: Convention Burst Patterns
```javascript
const bursts = await adminDb.collection('RateLimits')
  .where('scenario', '==', 'convention_burst')
  .where('timestamp', '>=', yesterday)
  .get();

console.log(`${bursts.size} legitimate burst events detected`);
// This helps you understand if your burst allowance is appropriate
```

### Query 4: Rate Limits by User Profile
```javascript
const userLimits = await adminDb.collection('RateLimits')
  .where('userId', '==', 'user_abc123')
  .where('timestamp', '>=', oneWeekAgo)
  .orderBy('timestamp', 'desc')
  .get();

userLimits.forEach(doc => {
  const data = doc.data();
  console.log(`${data.scenario} - ${data.eventType} - ${data.severity}`);
});
```

---

## 🔔 Alerting Strategies

### Strategy 1: High-Severity Alerts
Set up alerts for bot attacks (can integrate with Firebase Cloud Functions):

```javascript
// Cloud Function trigger
exports.monitorBotAttacks = functions.firestore
  .document('RateLimits/{docId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();

    if (data.severity === 'HIGH') {
      // Send alert (email, Slack, etc.)
      await sendAlert({
        type: 'BOT_ATTACK',
        fingerprint: data.fingerprint,
        userId: data.userId,
        ip: data.ip,
        requestsInLastSecond: data.requestsInLastSecond
      });
    }
  });
```

### Strategy 2: Threshold Alerts
Alert when same fingerprint triggers rate limits multiple times:

```javascript
const recentEvents = await adminDb.collection('RateLimits')
  .where('fingerprint', '==', suspiciousFingerprint)
  .where('timestamp', '>=', last15Minutes)
  .get();

if (recentEvents.size >= 5) {
  // Same fingerprint triggered 5+ times in 15 minutes
  await sendAlert({
    type: 'PERSISTENT_ABUSE',
    fingerprint: suspiciousFingerprint,
    eventCount: recentEvents.size
  });
}
```

---

## 📈 Analytics & Insights

### Insight 1: Are Burst Limits Appropriate?
```javascript
const bursts = await adminDb.collection('RateLimits')
  .where('scenario', '==', 'convention_burst')
  .where('timestamp', '>=', lastMonth)
  .get();

const rateLimitExceeded = await adminDb.collection('RateLimits')
  .where('scenario', '==', 'rate_limit_exceeded')
  .where('timestamp', '>=', lastMonth)
  .get();

const burstToExceededRatio = bursts.size / rateLimitExceeded.size;

if (burstToExceededRatio > 2) {
  console.log('✅ Burst limits are working well - mostly legitimate bursts');
} else {
  console.log('⚠️ Consider adjusting burst limits - too many exceeded');
}
```

### Insight 2: Peak Attack Times
```javascript
const attacks = await adminDb.collection('RateLimits')
  .where('scenario', '==', 'bot_attack')
  .where('timestamp', '>=', lastWeek)
  .get();

const hourCounts = {};
attacks.forEach(doc => {
  const hour = doc.data().timestamp.toDate().getHours();
  hourCounts[hour] = (hourCounts[hour] || 0) + 1;
});

console.log('Attack distribution by hour:', hourCounts);
// Helps you understand when to be most vigilant
```

### Insight 3: Event Type Patterns
```javascript
const limits = await adminDb.collection('RateLimits')
  .where('timestamp', '>=', lastWeek)
  .get();

const eventTypeCounts = {};
limits.forEach(doc => {
  const type = doc.data().eventType;
  const scenario = doc.data().scenario;
  const key = `${type}_${scenario}`;
  eventTypeCounts[key] = (eventTypeCounts[key] || 0) + 1;
});

console.log('Rate limit patterns:', eventTypeCounts);
// Example output:
// {
//   'view_bot_attack': 25,
//   'click_convention_burst': 15,
//   'click_rate_limit_exceeded': 8
// }
```

---

## 🛡️ Security Best Practices

### 1. Regular Cleanup
Keep the collection manageable:

```javascript
// Delete logs older than 90 days
const ninetyDaysAgo = new Date();
ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

const oldLogs = await adminDb.collection('RateLimits')
  .where('timestamp', '<', ninetyDaysAgo)
  .limit(500)
  .get();

const batch = adminDb.batch();
oldLogs.forEach(doc => batch.delete(doc.ref));
await batch.commit();

console.log(`Deleted ${oldLogs.size} old rate limit logs`);
```

### 2. Privacy Considerations
- Fingerprints are hashed (not reversible to original data)
- IP addresses are stored but can be anonymized
- User agents may contain device info - consider truncating

```javascript
// Optional: Anonymize old records
function anonymizeOldRecords(daysOld = 30) {
  // Keep scenario, severity, counts
  // Remove IP, fingerprint, userAgent
  // Helpful for long-term trend analysis without PII
}
```

### 3. False Positive Review
Regularly review "convention_burst" logs:

```javascript
const recentBursts = await adminDb.collection('RateLimits')
  .where('scenario', '==', 'convention_burst')
  .where('timestamp', '>=', yesterday)
  .get();

// Check if any are actually suspicious
recentBursts.forEach(doc => {
  const data = doc.data();
  if (data.requestCount > 15) {
    console.log('⚠️ High burst count:', data);
  }
});
```

---

## 🎯 Action Matrix

| Scenario | Severity | Frequency | Recommended Action |
|----------|----------|-----------|-------------------|
| Convention Burst | LOW | Any | ✅ No action - expected behavior |
| Rate Limit Exceeded | MEDIUM | < 5/day per fingerprint | ℹ️ Monitor, no action |
| Rate Limit Exceeded | MEDIUM | > 10/day per fingerprint | ⚠️ Investigate user behavior |
| Bot Attack | HIGH | 1 occurrence | 🔍 Investigate IP and fingerprint |
| Bot Attack | HIGH | > 3/day same fingerprint | 🚨 Consider blocking |
| Bot Attack | HIGH | > 10/day different fingerprints | 🔥 Widespread attack - review firewall |

---

## 📝 Example Investigation Workflow

### Step 1: Identify Issue
```javascript
// Find high-severity events from last hour
const lastHour = new Date(Date.now() - 60 * 60 * 1000);

const issues = await adminDb.collection('RateLimits')
  .where('severity', 'in', ['HIGH', 'MEDIUM'])
  .where('timestamp', '>=', lastHour)
  .get();

console.log(`Found ${issues.size} issues in last hour`);
```

### Step 2: Analyze Pattern
```javascript
const data = issues.docs[0].data();

console.log('Issue Details:');
console.log('- Scenario:', data.scenario);
console.log('- IP:', data.ip);
console.log('- User Agent:', data.userAgent);
console.log('- Requests/second:', data.requestsInLastSecond);
console.log('- Affected user:', data.userId);
```

### Step 3: Check for Repeat Offender
```javascript
const sameFingerprint = await adminDb.collection('RateLimits')
  .where('fingerprint', '==', data.fingerprint)
  .where('timestamp', '>=', last24Hours)
  .get();

if (sameFingerprint.size > 5) {
  console.log('🚨 REPEAT OFFENDER - consider blocking');
} else {
  console.log('ℹ️ Isolated incident');
}
```

### Step 4: Take Action
```javascript
if (data.scenario === 'bot_attack' && sameFingerprint.size > 5) {
  // Add to blocklist (implement your blocking mechanism)
  await addToBlocklist({
    fingerprint: data.fingerprint,
    ip: data.ip,
    reason: 'Persistent bot attack',
    blockedAt: new Date()
  });

  console.log('✅ Fingerprint blocked');
}
```

---

## 🚀 Future Enhancements

### 1. Automatic Blocking
Implement automatic temporary blocks for severe abuse:

```javascript
// After 5 bot attacks from same fingerprint in 1 hour
if (botAttackCount >= 5) {
  await blockFingerprintTemporarily(fingerprint, durationMinutes = 60);
}
```

### 2. Geolocation Analysis
Add country-level tracking to identify attack sources:

```javascript
// Requires IP geolocation service
const geoData = await getGeoFromIP(data.ip);
updateDoc({
  ...data,
  country: geoData.country,
  city: geoData.city
});
```

### 3. Machine Learning
Train model to predict if rate limit event is legitimate or abuse:

```javascript
// Features: requestCount, timeSinceFirstRequest, requestsInLastSecond, userAgent
const prediction = await mlModel.predict(features);
// prediction: 'legitimate' | 'suspicious' | 'bot'
```

---

## 📌 Key Takeaways

1. **Convention Burst is Normal** - Don't over-react to LOW severity events
2. **HIGH Severity = Investigate** - Bot attacks require immediate attention
3. **Watch for Patterns** - Same fingerprint repeatedly = problem
4. **Privacy First** - Fingerprints are hashed, consider anonymizing old logs
5. **Regular Cleanup** - Keep collection manageable (< 90 days of data)
6. **Adjust Limits** - Use insights to tune rate limit configuration

---

**The RateLimits collection is your early warning system for abuse while ensuring legitimate users at events aren't blocked. Monitor it regularly, but don't over-react to LOW severity events!**
