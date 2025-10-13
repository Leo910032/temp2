# Analytics System - Implementation Guide

## 📚 Table of Contents
- [Architecture Overview](#architecture-overview)
- [Rate Limiting System](#rate-limiting-system)
- [Rate Limit Logging](#rate-limit-logging)
- [Client-Side Service](#client-side-service)
- [Server-Side Service](#server-side-service)
- [API Route](#api-route)
- [Session Management](#session-management)
- [Data Flow](#data-flow)
- [Database Structure](#database-structure)
- [Future Enhancements](#future-enhancements)

---

## 🏗️ Architecture Overview

The analytics system follows a **clean separation of concerns** pattern:

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT SIDE                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Button.jsx / House.jsx                                    │
│         ↓                                                   │
│  TrackAnalyticsService (Client)                            │
│    - trackView()                                           │
│    - trackClick()                                          │
│    - trackTimeOnProfile()                                  │
│         ↓                                                   │
│  Uses navigator.sendBeacon() or fetch()                    │
│                                                             │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP POST
                       │ /api/user/analytics/track-event
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                        SERVER SIDE                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  API Route (track-event/route.js)                          │
│    1. Rate Limiting (with fingerprinting)                  │
│    2. Validation                                            │
│    3. Event Processing                                      │
│         ↓                                                   │
│  TrackAnalyticsService (Server)                            │
│    - trackView()                                           │
│    - trackClick()                                          │
│    - trackTimeOnProfile()                                  │
│         ↓                                                   │
│  Firebase Firestore                                        │
│    - Analytics collection                                  │
│    - Aggregated data (daily/weekly/monthly)                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔒 Rate Limiting System

### Why Sophisticated Rate Limiting?

**Problem:** Simple IP-based rate limiting causes false positives at conventions/networking events where many people share the same public IP.

**Solution:** Multi-factor fingerprinting with sliding window and burst allowance.

### Fingerprinting Algorithm

Located in: `lib/rateLimiter.js`

```javascript
Fingerprint = SHA256(
  IP_Address +
  UserAgent_Hash +
  Session_Cookie +
  Salt
)
```

#### Why Multi-Factor?

| Factor | Purpose | Example |
|--------|---------|---------|
| **IP Address** | Base identification | `192.168.1.100` |
| **User Agent Hash** | Distinguish devices on same network | `Chrome/118.0` → `a3f4b2c1` |
| **Session Cookie** | Distinguish browser sessions | `sess_abc123...` |
| **Salt** | Event-type specific | `analytics_click` or `analytics_view` |

**Result:** Even at a convention with 100 people on the same WiFi, each person gets their own rate limit bucket.

### Sliding Window with Burst Allowance

```javascript
// Example configuration for CLICKS
{
  windowMs: 10000,        // 10 second window
  maxRequests: 10,        // 10 clicks allowed
  burstAllowance: 3       // Plus 3 burst clicks
}

// Total capacity: 13 clicks per 10 seconds
// After using burst: 10 clicks per 10 seconds until window resets
```

#### How It Works:

```
Time (seconds):  0    1    2    3    4    5    6    7    8    9    10
Regular limit:   [====== 10 requests allowed ======] [= reset =]
Burst:           [+3] (used once, then depleted)
                  ↓
                 Quick succession OK for legitimate use
```

**Scenario 1: Normal Use**
```
User clicks 5 buttons over 10 seconds
→ 5 requests in window
→ ✅ Allowed (under limit)
```

**Scenario 2: Convention Burst**
```
User shows profile to 3 people in quick succession (2 seconds)
→ 3 quick clicks
→ Uses burst allowance
→ ✅ Allowed (burst covers it)
→ Burst depleted, now limited to 10/10s
```

**Scenario 3: Bot Attack**
```
Bot attempts 100 clicks in 1 second
→ First 13 allowed (10 + 3 burst)
→ Next 87 rejected
→ ❌ Rate limited
```

### Rate Limit Configuration by Event Type

Located in: `lib/services/serviceUser/constants/analyticsConstants.js`

```javascript
// VIEWS - Stricter (prevent bot crawling)
VIEW: {
  windowMs: 60 * 1000,    // 1 minute
  maxRequests: 3,          // Only 3 views per minute
  burstAllowance: 1        // Plus 1 burst
}

// CLICKS - Lenient (allow legitimate rapid interaction)
CLICK: {
  windowMs: 10 * 1000,    // 10 seconds
  maxRequests: 10,         // 10 clicks per 10 seconds
  burstAllowance: 3        // Plus 3 burst
}

// TIME_ON_PROFILE - Very lenient (heartbeats every 15s)
TIME_ON_PROFILE: {
  windowMs: 60 * 1000,
  maxRequests: 60,
  burstAllowance: 10
}
```

### Cleanup Mechanism

```javascript
// Runs every 15 minutes
setInterval(() => {
  cleanupRateLimitMap();
}, 15 * 60 * 1000);

// Removes entries older than 1 hour
function cleanupRateLimitMap(maxAge = 60 * 60 * 1000) {
  // Iterate through Map
  // Delete old entries
  // Prevent memory leaks
}
```

**Memory Management:**
- Automatically cleans old records
- Prevents Map from growing indefinitely
- No database writes needed (in-memory only)

---

## 📊 Rate Limit Logging

### Why Log Abnormal Activity?

**Normal usage** (within rate limits) is tracked in the `Analytics` collection. **Abnormal activity** (rate limit triggers) is logged to the `RateLimits` collection for security monitoring.

### Three Scenarios Logged

#### 1. Convention Burst (Severity: LOW)
**Triggered when:** User exceeds normal limit but uses burst allowance

```javascript
{
  scenario: 'convention_burst',
  fingerprint: 'hashed_identifier',
  eventType: 'click',
  userId: 'user_123',
  requestCount: 11,        // Just over limit
  maxRequests: 10,
  burstUsed: 1,
  windowMs: 10000,
  severity: 'LOW',
  note: 'Legitimate burst usage - likely convention/event'
}
```

**What it means:** Someone showing their profile to multiple people quickly (normal at events)

**Action needed:** None - this is expected behavior

#### 2. Rate Limit Exceeded (Severity: MEDIUM)
**Triggered when:** User exceeds effective limit (normal + burst)

```javascript
{
  scenario: 'rate_limit_exceeded',
  fingerprint: 'hashed_identifier',
  eventType: 'view',
  requestCount: 15,
  effectiveLimit: 13,
  requestsInLastSecond: 3,  // < 5/sec, not aggressive
  severity: 'MEDIUM'
}
```

**What it means:** Excessive usage but not aggressive enough to be a bot

**Action needed:** Monitor - investigate if same fingerprint appears frequently

#### 3. Bot Attack (Severity: HIGH)
**Triggered when:** Any of these bot detection criteria are met:
- 5+ requests in last 1 second
- Average rate > 6 requests/second
- 4+ requests in last 500ms

```javascript
{
  scenario: 'bot_attack',
  fingerprint: 'hashed_identifier',
  eventType: 'view',
  userAgent: 'python-requests/2.28.1',
  requestCount: 50,
  requestsInLastSecond: 15,     // 🚨 15 requests in 1 second!
  requestRate: '12.50',         // 🚨 12.5 requests/second average
  requestsInLast500ms: 8,       // 🚨 8 requests in 500ms
  timeSpanMs: 4000,
  severity: 'HIGH'
}
```

**What it means:** Automated scraping or attack attempt

**Action needed:** 🚨 Investigate immediately, consider blocking

### Logging Implementation

Located in: `lib/rateLimiter.js`

```javascript
async function logRateLimitEvent(eventData) {
  const db = await getAdminDb();
  const logRef = db.collection('RateLimits').doc();

  await logRef.set({
    ...eventData,
    timestamp: new Date(),
    createdAt: new Date().toISOString()
  });
}

// Called when rate limit is triggered
if (recentRequests.length >= effectiveLimit) {
  // ✅ IMPROVED BOT DETECTION: Multi-factor analysis
  const requestsInLastSecond = recentRequests.filter(
    timestamp => now - timestamp < 1000
  ).length;

  // Calculate overall request rate (requests per second)
  const timeSpanMs = now - recentRequests[0];
  const requestRate = timeSpanMs > 0 ? (recentRequests.length / timeSpanMs) * 1000 : 0;

  // Check for rapid bursts in shorter windows
  const requestsInLast500ms = recentRequests.filter(
    timestamp => now - timestamp < 500
  ).length;

  // Bot attack detection criteria (any of these indicates bot):
  // 1. 5+ requests in last 1 second
  // 2. Average rate > 6 requests/second
  // 3. 4+ requests in last 500ms
  const isBotAttack = requestsInLastSecond >= 5 ||
                     requestRate > 6 ||
                     requestsInLast500ms >= 4;

  const scenario = isBotAttack ? 'bot_attack' : 'rate_limit_exceeded';

  // Log to Firestore (fire-and-forget, non-blocking)
  logRateLimitEvent({
    scenario,
    fingerprint: identifier,
    eventType: metadata.eventType,
    userId: metadata.userId,
    requestCount: recentRequests.length,
    requestsInLastSecond,
    requestRate: requestRate.toFixed(2),
    requestsInLast500ms,
    timeSpanMs,
    severity: scenario === 'bot_attack' ? 'HIGH' : 'MEDIUM'
  }).catch(err => console.error('Log failed:', err.message));
}
```

### Privacy & Performance

**Privacy:**
- Fingerprints are SHA-256 hashed (not reversible)
- No direct PII stored
- Can be anonymized after 30 days

**Performance:**
- Fire-and-forget pattern (no blocking)
- Logging failures don't break rate limiting
- Only abnormal activity logged (not every request)

**For detailed monitoring and analysis, see:** [RATE_LIMITS_COLLECTION_GUIDE.md](RATE_LIMITS_COLLECTION_GUIDE.md)

---

## 💻 Client-Side Service

Located in: `lib/services/serviceUser/client/services/TrackAnalyticsService.js`

### Session Management

**Creating a Session:**

```javascript
class SessionManager {
  static getOrCreateSession() {
    // 1. Check localStorage for existing session
    const stored = localStorage.getItem('analytics_session');

    // 2. Validate session age (30 minutes max)
    if (stored && notExpired(stored)) {
      return stored;
    }

    // 3. Create new session
    const session = {
      sessionId: generateUniqueId(),
      startTime: Date.now(),
      originalReferrer: document.referrer,
      trafficSource: detectTrafficSource(),
      utm: extractUTMParams(),
      // ... device info
    };

    // 4. Store in localStorage
    localStorage.setItem('analytics_session', JSON.stringify(session));

    return session;
  }
}
```

### Traffic Source Detection

**Algorithm:**

```javascript
function detectTrafficSource() {
  const referrer = document.referrer;
  const url = window.location.href;

  // Priority 1: UTM Parameters
  if (urlHasUTM('utm_source')) {
    return { source: utm_source, medium: utm_medium, type: classify(utm_medium) };
  }

  // Priority 2: QR Code Scan
  if (url.includes('qr=') || url.includes('scan=')) {
    return { source: 'qr_code', medium: 'scan', type: 'QR' };
  }

  // Priority 3: No Referrer = Direct
  if (!referrer) {
    return { source: 'direct', medium: 'none', type: 'DIRECT' };
  }

  // Priority 4: Social Media
  if (referrer.includes('facebook|instagram|twitter|linkedin|...')) {
    return { source: 'facebook', medium: 'social', type: 'SOCIAL' };
  }

  // Priority 5: Search Engines
  if (referrer.includes('google|bing|yahoo|...')) {
    return { source: 'google', medium: 'organic', type: 'SEARCH' };
  }

  // Priority 6: Generic Referral
  return { source: hostname, medium: 'referral', type: 'REFERRAL' };
}
```

### Sending Analytics Events

**Using navigator.sendBeacon:**

```javascript
async trackClick(userId, linkData) {
  const payload = {
    eventType: 'click',
    userId,
    linkData,
    sessionData: SessionManager.getOrCreateSession(),
    timestamp: new Date().toISOString()
  };

  // Try sendBeacon first (works even during page unload)
  if (navigator.sendBeacon) {
    const blob = new Blob([JSON.stringify(payload)], {
      type: 'application/json'
    });

    const sent = navigator.sendBeacon('/api/user/analytics/track-event', blob);

    if (sent) {
      // Success! Request queued by browser
      return;
    }
  }

  // Fallback to fetch
  await fetch('/api/user/analytics/track-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true  // Important for page unload
  });
}
```

**Why sendBeacon?**

| Scenario | fetch() | sendBeacon() |
|----------|---------|--------------|
| User clicks link and navigates away | ❌ May be cancelled | ✅ Guaranteed to send |
| User closes tab | ❌ May be cancelled | ✅ Guaranteed to send |
| Page unload | ❌ Unreliable | ✅ Reliable |
| Network tab visibility | ✅ Shows up | ⚠️ May not show |

---

## 🖥️ Server-Side Service

Located in: `lib/services/serviceUser/server/services/trackAnalyticsService.js`

### Date Key Generation

**Time-Based Aggregations:**

```javascript
function getDateKeys() {
  const now = new Date();

  // Daily key: "2025-10-12"
  const today = now.toISOString().split('T')[0];

  // Weekly key: "2025-W41" (ISO 8601 week number)
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(
    ((now - yearStart) / 86400000 + yearStart.getDay() + 1) / 7
  );
  const weekKey = `${now.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;

  // Monthly key: "2025-10"
  const monthKey = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;

  // Yearly key: "2025"
  const yearKey = `${now.getFullYear()}`;

  return { today, weekKey, monthKey, yearKey };
}
```

### Tracking a Click

```javascript
static async trackClick({ userId, linkData, sessionData }) {
  const analyticsRef = adminDb.collection('Analytics').doc(userId);
  const { today, weekKey, monthKey, yearKey } = getDateKeys();
  const increment = FieldValue.increment(1);

  const updatePayload = {
    lastUpdated: new Date(),

    // Global counters
    totalClicks: increment,
    lastClickAt: new Date(),

    // Time-based aggregations
    [`dailyClicks.${today}`]: increment,          // "dailyClicks.2025-10-12": 1
    [`weeklyClicks.${weekKey}`]: increment,       // "weeklyClicks.2025-W41": 1
    [`monthlyClicks.${monthKey}`]: increment,     // "monthlyClicks.2025-10": 1
    [`yearlyClicks.${yearKey}`]: increment,       // "yearlyClicks.2025": 1

    // Per-link statistics
    [`linkClicks.${linkData.linkId}.totalClicks`]: increment,
    [`linkClicks.${linkData.linkId}.lastClicked`]: new Date(),
    [`linkClicks.${linkData.linkId}.title`]: linkData.linkTitle,
    [`linkClicks.${linkData.linkId}.url`]: linkData.linkUrl,
    [`linkClicks.${linkData.linkId}.dailyClicks.${today}`]: increment,

    // Traffic source tracking
    [`trafficSources.${sanitize(sessionData.trafficSource.source)}.clicks`]: increment,
    [`trafficSources.${sanitize(sessionData.trafficSource.source)}.lastClick`]: new Date(),

    // Device tracking
    [`deviceStats.${detectDevice(sessionData.userAgent)}.clicks`]: increment,
  };

  // Atomic update (no race conditions)
  await analyticsRef.set(updatePayload, { merge: true });
}
```

**Key Features:**

1. **Atomic Updates:** `FieldValue.increment(1)` is atomic - no race conditions
2. **Nested Keys:** Using dot notation for nested updates
3. **Merge Mode:** `{ merge: true }` - only updates specified fields
4. **Multiple Aggregations:** Daily, weekly, monthly, yearly - all in one write

---

## 🌐 API Route

Located in: `app/api/user/analytics/track-event/route.js`

### Request Flow

```javascript
export async function POST(request) {
  // STEP 1: Parse request body
  const body = await request.json();
  const { userId, eventType, linkData, sessionData } = body;

  // STEP 2: Validation
  if (!userId || !eventType) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (eventType === 'click' && !linkData?.linkId) {
    return NextResponse.json({ error: 'Missing link data' }, { status: 400 });
  }

  // STEP 3: Rate Limiting
  const rateLimitConfig = RATE_LIMIT_CONFIG[eventType.toUpperCase()];
  const rateLimitResult = applyAnalyticsRateLimit(request, eventType, rateLimitConfig);

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        retryAfter: rateLimitResult.retryAfter
      },
      {
        status: 429,
        headers: {
          'Retry-After': rateLimitResult.retryAfter.toString(),
          'X-RateLimit-Remaining': '0'
        }
      }
    );
  }

  // STEP 4: Process event
  let result;
  switch (eventType) {
    case 'view':
      result = await TrackAnalyticsService.trackView({ userId, username, sessionData });
      break;
    case 'click':
      result = await TrackAnalyticsService.trackClick({ userId, linkData, sessionData });
      break;
    case 'time_on_profile':
      result = await TrackAnalyticsService.trackTimeOnProfile({ userId, duration, sessionData });
      break;
  }

  // STEP 5: Success response
  return NextResponse.json(
    { success: true, message: result.message },
    {
      headers: {
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString()
      }
    }
  );
}
```

### Rate Limit Headers

Standard HTTP rate limiting headers:

```
X-RateLimit-Remaining: 7      ← Requests left in current window
X-RateLimit-Reset: 1697123456 ← Unix timestamp when limit resets
Retry-After: 5                 ← Seconds to wait (only when rate limited)
```

---

## 🔄 Data Flow

### Click Tracking Flow (Complete)

```
1. USER CLICKS BUTTON
   ↓
2. Button.jsx → handleLinkClick()
   - Extracts: userId, linkId, linkTitle, linkUrl, linkType
   ↓
3. TrackAnalyticsService.trackClick() [CLIENT]
   - Gets/Creates session from SessionManager
   - Detects traffic source
   - Extracts UTM parameters
   - Builds payload
   ↓
4. navigator.sendBeacon() or fetch()
   - Sends POST to /api/user/analytics/track-event
   - Payload: { eventType: 'click', userId, linkData, sessionData }
   ↓
5. API Route receives request
   - Parses JSON body
   - Validates required fields
   ↓
6. applyAnalyticsRateLimit()
   - Extracts: IP, User Agent, Session Cookie
   - Generates fingerprint: SHA256(IP + UA + Cookie + Salt)
   - Checks rate limit map
   - Returns: { allowed: true/false, remaining, resetTime }
   ↓
7. If rate limited:
   - Returns 429 with Retry-After header
   - STOP HERE
   ↓
8. TrackAnalyticsService.trackClick() [SERVER]
   - Gets date keys (today, weekKey, monthKey)
   - Builds Firestore update payload
   - Increments counters atomically
   ↓
9. Firestore Write
   - Updates Analytics/{userId} document
   - Increments: totalClicks, dailyClicks[date], linkClicks[linkId].totalClicks, etc.
   - All in ONE atomic operation (merge: true)
   ↓
10. Success Response
    - Returns: { success: true, message: 'Click tracked' }
    - Includes X-RateLimit-Remaining header
```

---

## 🗄️ Database Structure

### Firestore Collection: `Analytics`

```
Analytics/
  {userId}/
    ├─ username: string
    ├─ totalViews: number
    ├─ totalClicks: number
    ├─ totalTimeSpent: number (seconds)
    ├─ lastUpdated: Timestamp
    ├─ lastViewAt: Timestamp
    ├─ lastClickAt: Timestamp
    │
    ├─ dailyViews/
    │   ├─ "2025-10-12": 5
    │   ├─ "2025-10-13": 3
    │   └─ ...
    │
    ├─ weeklyViews/
    │   ├─ "2025-W41": 15
    │   ├─ "2025-W42": 12
    │   └─ ...
    │
    ├─ monthlyViews/
    │   ├─ "2025-10": 45
    │   ├─ "2025-11": 38
    │   └─ ...
    │
    ├─ dailyClicks/
    │   ├─ "2025-10-12": 8
    │   └─ ...
    │
    ├─ linkClicks/
    │   ├─ {linkId}/
    │   │   ├─ totalClicks: 12
    │   │   ├─ title: "My Portfolio"
    │   │   ├─ url: "https://example.com"
    │   │   ├─ type: "custom"
    │   │   ├─ lastClicked: Timestamp
    │   │   ├─ dailyClicks/
    │   │   │   ├─ "2025-10-12": 3
    │   │   │   └─ ...
    │   │   ├─ deviceStats/
    │   │   │   ├─ mobile: 7
    │   │   │   └─ desktop: 5
    │   │   └─ referrerData/
    │   │       └─ {sessionId}/
    │   │           ├─ source: "google"
    │   │           ├─ medium: "organic"
    │   │           ├─ clickedAt: Timestamp
    │   │           └─ utmParams: {...}
    │
    ├─ trafficSources/
    │   ├─ direct/
    │   │   ├─ views: 20
    │   │   ├─ clicks: 8
    │   │   ├─ lastView: Timestamp
    │   │   ├─ lastClick: Timestamp
    │   │   ├─ medium: "none"
    │   │   └─ type: "direct"
    │   ├─ google/
    │   │   ├─ views: 15
    │   │   ├─ clicks: 6
    │   │   └─ ...
    │   └─ ...
    │
    ├─ deviceStats/
    │   ├─ mobile/
    │   │   ├─ views: 30
    │   │   └─ clicks: 12
    │   └─ desktop/
    │       ├─ views: 25
    │       └─ clicks: 10
    │
    ├─ campaigns/
    │   └─ {campaignName}/
    │       ├─ views: 10
    │       ├─ clicks: 4
    │       ├─ source: "newsletter"
    │       └─ medium: "email"
    │
    └─ referrers/
        └─ {referrerDomain}/
            ├─ views: 8
            └─ lastView: Timestamp
```

### Why This Structure?

**Advantages:**
- ✅ Single document per user (no subcollections to query)
- ✅ Atomic updates (no race conditions)
- ✅ Fast reads (one document fetch gets everything)
- ✅ Efficient writes (increment operations)
- ✅ Time-based queries (just read nested objects)

**Trade-offs:**
- ⚠️ Document can grow large (but Firestore limit is 1MB)
- ⚠️ Need cleanup for old daily data (included in service)

---

## 🚀 Future Enhancements

### 1. Time on Profile Tracking

**Implementation Ready:**

```javascript
// In House.jsx, initialize time tracking
useEffect(() => {
  if (!isPreviewMode && userData?.uid) {
    const cleanup = TrackAnalyticsService.initializeTimeTracking(userData.uid);
    return cleanup; // Cleanup on unmount
  }
}, [userData?.uid, isPreviewMode]);
```

**How it works:**
- Heartbeat every 15 seconds
- Tracks visible time only (pauses when tab hidden)
- Sends final heartbeat on page unload
- Calculates: average session time, total time, engagement score

### 2. Retention Rate Calculation

**Already implemented:**

```javascript
const retention = await TrackAnalyticsService.calculateRetentionRate(userId, 'weekly');
// Returns: { retentionRate: 75.5, totalPeriods: 12, activePeriods: 9 }
```

**Formula:**
```
Retention Rate = (Active Periods / Total Periods) × 100

Example:
- User had 12 weeks of data
- User had views in 9 of those weeks
- Retention Rate = (9/12) × 100 = 75%
```

### 3. Conversion Tracking

**Future addition:**

```javascript
TrackAnalyticsService.trackConversion(userId, {
  conversionType: 'email_signup',
  linkId: 'link_xyz',
  value: 1,
  metadata: { source: 'hero_button' }
});
```

### 4. A/B Testing

**Future addition:**

```javascript
// Per-link variant tracking
{
  linkClicks: {
    "link_abc": {
      variants: {
        "A": { clicks: 50, conversions: 5 },
        "B": { clicks: 50, conversions: 8 }
      }
    }
  }
}
```

### 5. Geographic Analytics

**Requires IP geolocation service:**

```javascript
// Add to sessionData
const geoData = await getGeoFromIP(ipAddress);
sessionData.country = geoData.country;
sessionData.city = geoData.city;

// Track in Firestore
updatePayload[`geoData.${country}.clicks`] = increment;
```

---

## 🎯 Key Takeaways

### Rate Limiting
- **Multi-factor fingerprinting** prevents false positives
- **Sliding window** tracks requests over time
- **Burst allowance** handles legitimate rapid interactions
- **Convention-friendly** - won't block legitimate use

### Architecture
- **Client/Server separation** - clean, maintainable
- **sendBeacon** - reliable tracking even during navigation
- **Atomic updates** - no race conditions
- **Single document** - fast reads, efficient writes

### Scalability
- **In-memory rate limiting** - no database overhead
- **Automatic cleanup** - prevents memory leaks
- **Aggregated data** - daily/weekly/monthly summaries
- **GDPR-compliant** - cleanup methods included

### Extensibility
- **Event-based** - easy to add new event types
- **Session tracking** - rich context for analytics
- **Traffic attribution** - know where visitors come from
- **Ready for advanced features** - time tracking, retention, conversions

---

## 📖 Additional Resources

- [Firestore Data Model](https://firebase.google.com/docs/firestore/data-model)
- [navigator.sendBeacon()](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon)
- [Rate Limiting Algorithms](https://en.wikipedia.org/wiki/Rate_limiting)
- [UTM Parameters](https://en.wikipedia.org/wiki/UTM_parameters)
- [ISO 8601 Week Numbers](https://en.wikipedia.org/wiki/ISO_week_date)

---

**Questions or need clarification on any part of the implementation?** This guide covers the complete system architecture, but feel free to ask about specific components!
