# Admin Analytics Integration Guide

## Overview
This guide documents how to integrate new API/AI features into the admin analytics dashboard, including cost tracking, session management, and free tier calculations.

**Last Updated:** October 13, 2025
**System Version:** Admin Dashboard v2.0 with Session Tracking

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Cost Tracking System](#cost-tracking-system)
3. [Adding New API/AI Features](#adding-new-apiAI-features)
4. [Session-Based Multi-Step Operations](#session-based-multi-step-operations)
5. [Free Tier Configuration](#free-tier-configuration)
6. [Troubleshooting](#troubleshooting)
7. [Examples](#examples)

---

## Architecture Overview

### Data Flow
```
User Action → Feature Code → Cost Tracking Service → Firestore → Analytics Service → Admin Dashboard
```

### Collections Structure
```
Firestore
├── ApiUsage/{userId}/monthly/{YYYY-MM}        # Standalone API operations
├── ApiUsage/{userId}/operations/{operationId} # Individual API operation logs
├── AIUsage/{userId}/monthly/{YYYY-MM}         # Standalone AI operations
├── AIUsage/{userId}/operations/{operationId}  # Individual AI operation logs
└── SessionUsage/{userId}/sessions/{sessionId} # Multi-step operations (e.g., front+back scan)
```

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **Cost Tracking Service** | `lib/services/serviceContact/server/costTrackingService.js` | Records usage for AI/API operations |
| **Session Service** | `lib/services/serviceContact/server/costTracking/sessionService.js` | Manages multi-step operations |
| **Analytics Service** | `lib/services/serviceAdmin/server/analyticsService.js` | Aggregates data for admin dashboard |
| **Admin Constants** | `lib/services/serviceAdmin/constants/adminConstants.js` | Pricing and free tier configuration |
| **Admin Dashboard** | `app/admin/components/ApiUsageStats.jsx` | Frontend display component |

---

## Cost Tracking System

### When to Use Each Collection

#### Use `ApiUsage` or `AIUsage` (Standalone)
- **Single-step operations** that complete in one API call
- Examples: Single-sided card scan, standalone AI query, single map search

```javascript
await CostTrackingService.recordUsage({
    userId: 'user123',
    usageType: 'ApiUsage',  // or 'AIUsage'
    feature: 'google_vision_ocr',
    cost: 0.0015,
    isBillableRun: false,
    provider: 'google_vision_ocr',
    metadata: { /* additional data */ }
    // NO sessionId - standalone operation
});
```

#### Use `SessionUsage` (Multi-Step)
- **Multi-step operations** that are part of a logical group
- Examples: Front+back card scan, autocomplete → place details, multi-model AI pipeline

```javascript
const sessionId = `session_${Date.now()}_${uuid}`;

// Step 1
await CostTrackingService.recordUsage({
    userId: 'user123',
    usageType: 'ApiUsage',
    feature: 'business_card_scan_basic_front',
    cost: 0.0015,
    isBillableRun: false,
    provider: 'google_vision_ocr',
    sessionId: sessionId,  // ← Links to session
    metadata: { side: 'front' }
});

// Step 2
await CostTrackingService.recordUsage({
    userId: 'user123',
    usageType: 'ApiUsage',
    feature: 'business_card_scan_basic_back',
    cost: 0.0015,
    isBillableRun: false,
    provider: 'google_vision_ocr',
    sessionId: sessionId,  // ← Same session
    metadata: { side: 'back' }
});

// Finalize
await CostTrackingService.finalizeSession(userId, sessionId);
```

---

## Adding New API/AI Features

### Step 1: Add Pricing Configuration

**File:** `lib/services/serviceAdmin/constants/adminConstants.js`

#### For AI Providers
```javascript
export const AI_PROVIDER_PRICING = {
  'your_ai_provider': {
    displayName: 'Your AI Provider Name',
    inputCostPerMillionTokens: 0.10,
    outputCostPerMillionTokens: 0.40,
    estimatedCostPerOperation: 0.00013,
    freeTier: {
      enabled: true,
      limit: 500,
      unit: 'requests/day',
      description: 'Free tier description'
    }
  },
};
```

#### For Third-Party APIs
```javascript
export const THIRD_PARTY_API_PRICING = {
  'your_api_feature': {  // ← Must match the feature name in recordUsage()
    displayName: 'Your API Display Name',
    costPerRequest: 0.00283,
    costPer1000: 2.83,
    freeTier: {
      enabled: true,
      limit: 200,              // Free tier limit
      unit: 'USD/month',       // or 'units/month'
      description: 'Eligible for the recurring $200 monthly credit.'
    }
  },
};
```

**Important:** The key (e.g., `'your_api_feature'`) must **exactly match** the `feature` parameter you pass to `recordUsage()`.

### Step 2: Implement Cost Tracking in Your Feature

**Example: Semantic Search Feature**

```javascript
// lib/services/serviceContact/server/semanticSearchService.js

import { CostTrackingService } from './costTrackingService.js';

export class SemanticSearchService {
  static async searchContacts(userId, query, options = {}) {
    const requestId = `search_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

    try {
      // Perform semantic search with Pinecone
      const results = await pineconeClient.query({
        vector: await getEmbedding(query),
        topK: 10,
      });

      // Calculate cost
      const vectorSearchCost = 0.0002; // Cost per query
      const embeddingCost = 0.0001;    // Cost for embedding generation
      const totalCost = vectorSearchCost + embeddingCost;

      // Record usage
      await CostTrackingService.recordUsage({
        userId: userId,
        usageType: 'ApiUsage',
        feature: 'semantic_search',  // ← Must match adminConstants.js key
        cost: totalCost,
        isBillableRun: true,  // Premium feature counts as billable run
        provider: 'pinecone',
        metadata: {
          requestId: requestId,
          queryLength: query.length,
          resultsCount: results.length,
          model: 'text-embedding-ada-002'
        }
      });

      return results;

    } catch (error) {
      console.error(`[SemanticSearch] Error:`, error);
      throw error;
    }
  }
}
```

### Step 3: Test the Integration

1. **Execute your feature** as a user
2. **Check Firestore** to verify data was written:
   - For standalone: `ApiUsage/{userId}/monthly/2025-10`
   - For sessions: `SessionUsage/{userId}/sessions/{sessionId}`
3. **Check admin dashboard** to see the feature appear in:
   - Top Features by Cost
   - Top Providers by Cost
   - Free Tier Usage Status (if applicable)

---

## Session-Based Multi-Step Operations

### When to Use Sessions
Use sessions when multiple API calls are **logically grouped** as one user operation:
- Card scanning (front + back sides)
- Location search (autocomplete → place details)
- AI pipelines (OCR → field extraction → validation)

### Session Lifecycle

```javascript
// 1. Create session ID
const sessionId = `session_${Date.now()}_${uuid()}`;

// 2. Record each step with the SAME sessionId
for (const step of steps) {
  await CostTrackingService.recordUsage({
    userId: userId,
    usageType: 'ApiUsage',
    feature: step.featureName,
    cost: step.cost,
    isBillableRun: step.billable,
    provider: step.provider,
    sessionId: sessionId,  // ← Link to session
    metadata: step.metadata
  });
}

// 3. Finalize session when complete
await CostTrackingService.finalizeSession(userId, sessionId);
```

### Session Database Structure

```javascript
SessionUsage/{userId}/sessions/{sessionId}
{
  feature: "google_maps",           // Base feature name
  status: "completed",              // "in-progress" | "completed" | "abandoned"
  totalCost: 0.0283,               // Sum of all steps
  totalRuns: 0,                    // Billable runs count
  steps: [
    {
      operationId: "usage_xxx_xxx",
      usageType: "ApiUsage",
      feature: "google_maps_autocomplete",
      provider: "google_maps",
      cost: 0.00283,
      isBillableRun: false,
      timestamp: "2025-10-13T12:24:36.914Z",
      metadata: { /* step-specific data */ }
    },
    // ... more steps
  ],
  createdAt: Timestamp,
  lastUpdatedAt: Timestamp,
  completedAt: Timestamp
}
```

---

## Free Tier Configuration

### Free Tier Types

#### 1. USD/month (Shared Credit)
Used by: Google Maps, Google Cloud APIs

```javascript
freeTier: {
  enabled: true,
  limit: 200,                    // $200 USD
  unit: 'USD/month',
  description: 'Eligible for the recurring $200 monthly credit.'
}
```

**Calculation Logic:**
- If total cost < $200 → All free (saves 100%)
- If total cost > $200 → Saves $200, rest is billed

#### 2. units/month (Fixed Count)
Used by: Google Vision, specific APIs with unit-based pricing

```javascript
freeTier: {
  enabled: true,
  limit: 1000,                   // 1,000 requests
  unit: 'units/month',
  description: 'First 1,000 units/month free.'
}
```

**Calculation Logic:**
- If API calls ≤ 1000 → All free (saves 100%)
- If API calls > 1000 → First 1000 free, rest is billed

#### 3. requests/day (Daily Limit)
Used by: AI models with daily quotas

```javascript
freeTier: {
  enabled: true,
  limit: 500,                    // 500 requests per day
  unit: 'requests/day',
  description: 'Free tier for getting started, includes 500 RPD.'
}
```

### How Free Tier is Calculated

**File:** `app/admin/components/ApiUsageStats.jsx` → `calculateFreeTierData()`

The system:
1. **Matches features** (not providers) against `THIRD_PARTY_API_PRICING` keys
2. **Checks if free tier is enabled**
3. **Calculates usage percentage** based on free tier type
4. **Determines savings**:
   - Within limit: Saves 100% of cost
   - Exceeds limit: Saves only the free portion

**Key Insight:** For services like Google Maps with multiple APIs, each API endpoint has its own free tier configuration. The system checks **features** (e.g., `google_maps_autocomplete`) not the generic provider name (`google_maps`).

---

## Troubleshooting

### Issue: Feature Not Showing in Admin Dashboard

**Check:**
1. Did you add the feature to `adminConstants.js`?
2. Does the feature key in constants match `recordUsage()` call exactly?
3. Is data being written to Firestore? (Check `ApiUsage` or `SessionUsage` collection)
4. Are you looking at the right usage type (AI vs API)?

**Debug:**
```javascript
// Add logging in your feature
console.log('[YourFeature] Recording usage:', {
  feature: 'your_feature_name',
  cost: calculatedCost,
  provider: 'your_provider'
});
```

### Issue: Free Tier Not Applying

**Common Causes:**

1. **Provider vs Feature Mismatch**
   - ❌ Wrong: Checking provider name `google_maps`
   - ✅ Correct: Checking feature name `google_maps_autocomplete`

2. **Case Sensitivity Issues**
   - Database: `ApiUsage`
   - Code: `APIUsage`
   - **Solution:** Use case-insensitive comparison (already implemented)

3. **Free Tier Not Enabled**
   ```javascript
   freeTier: {
     enabled: true,  // ← Must be true!
     limit: 200,
     unit: 'USD/month',
     description: '...'
   }
   ```

**Debug:**
```javascript
// Check browser console for these logs:
console.log('[ApiUsageStats] Processing API features for free tier:', features);
console.log('[ApiUsageStats] Checking feature:', featureName);
console.log('[ApiUsageStats] Found free tier for:', featureKey);
```

### Issue: Session Data Not Aggregated

**Symptoms:**
- Total API Calls shows 0
- Top Features list is empty
- Free tier shows no savings

**Fix Applied:**
The analytics service now:
1. Fetches `SessionUsage` data alongside `ApiUsage` and `AIUsage`
2. Filters sessions by current month
3. Processes each step in the session
4. Uses **case-insensitive** comparison for `usageType` (`ApiUsage` vs `APIUsage`)
5. Adds step costs to aggregated totals

**Verify Fix:**
```bash
# Check server logs for:
[AnalyticsService] 📋 Processing 3 users' session data...
[AnalyticsService] 📋 Session has 2 steps
[AnalyticsService] ✅ Step 0 included - cost: $0.0015, totalCost now $0.0015
```

---

## Examples

### Example 1: Simple API Call (Standalone)

**Feature:** Single Google Vision OCR call

```javascript
// In your business card service
await CostTrackingService.recordUsage({
    userId: session.userId,
    usageType: 'ApiUsage',
    feature: 'business_card_scan_basic',
    cost: 0.0015,
    isBillableRun: false,
    provider: 'google_vision_ocr',
    metadata: {
        side: 'front',
        ocrConfidence: 0.98,
        method: 'basic_ocr_qr'
    }
});
```

**Result in Admin Dashboard:**
- Shows in "Third-Party API Usage"
- Top Features: `business_card_scan_basic` - $0.0015
- Top Providers: `google_vision_ocr` - $0.0015
- Free Tier: 1/1000 units used (99.9% remaining)

### Example 2: Multi-Step Session

**Feature:** Google Maps location search (autocomplete + details)

```javascript
const sessionId = `session_${Date.now()}_${uuid()}`;

// User types "55 cours de..."
for (const query of ['55 cours', '55 cours de', '55 cours de la']) {
  await CostTrackingService.recordUsage({
    userId: userId,
    usageType: 'ApiUsage',
    feature: 'google_maps_autocomplete',
    cost: 0.00283,
    isBillableRun: false,
    provider: 'google_maps',
    sessionId: sessionId,
    metadata: { input: query, resultCount: 5 }
  });
}

// User selects a place
await CostTrackingService.recordUsage({
  userId: userId,
  usageType: 'ApiUsage',
  feature: 'google_maps_place_details',
  cost: 0.017,
  isBillableRun: false,
  provider: 'google_maps',
  sessionId: sessionId,
  metadata: { place_id: 'ChIJ...' }
});

// Finalize
await CostTrackingService.finalizeSession(userId, sessionId);
```

**Result in Admin Dashboard:**
- Shows in "Third-Party API Usage"
- Total API Calls: 4
- Total Cost: $0.0263 (3 × $0.00283 + 1 × $0.017)
- Free Tier: Fully covered by $200/month credit
- Cost with Free Tier: $0.00

### Example 3: AI + API Hybrid Session (Premium Card Scan)

**Feature:** AI-enhanced card scan (OCR + Gemini analysis)

```javascript
const sessionId = `session_scan_${Date.now()}_${userId.slice(-4)}`;

// Step 1: OCR
await CostTrackingService.recordUsage({
  userId: userId,
  usageType: 'ApiUsage',
  feature: 'business_card_scan_ocr',
  cost: 0.0015,
  isBillableRun: false,
  provider: 'google_vision_ocr',
  sessionId: sessionId,
  metadata: { side: 'front', ocrConfidence: 0.98 }
});

// Step 2: AI field extraction
await CostTrackingService.recordUsage({
  userId: userId,
  usageType: 'AIUsage',  // ← Different usage type!
  feature: 'business_card_analysis',
  cost: 0.002,
  isBillableRun: true,  // ← Counts as billable run
  provider: 'gemini-2.0-flash',
  sessionId: sessionId,
  metadata: {
    model: 'gemini-2.0-flash',
    inputTokens: 500,
    outputTokens: 200
  }
});

await CostTrackingService.finalizeSession(userId, sessionId);
```

**Result in Admin Dashboard:**
- API section shows OCR: $0.0015
- AI section shows Gemini: $0.002
- Total Platform Cost: $0.0035
- Operations: 1 (only AI step is billable)

### Example 4: Semantic Search (Future Implementation)

**Feature:** Vector-based contact search with Pinecone

```javascript
// Step 1: Add to adminConstants.js
export const THIRD_PARTY_API_PRICING = {
  'semantic_search': {
    displayName: 'Semantic Search (Pinecone)',
    costPerRequest: 0.0002,
    costPer1000: 0.20,
    freeTier: {
      enabled: true,
      limit: 10000,
      unit: 'units/month',
      description: 'First 10,000 queries/month free.'
    }
  },
};

// Step 2: Implement in service
export class SemanticSearchService {
  static async search(userId, query) {
    // Get embedding
    const embedding = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: query
    });
    const embeddingCost = 0.0001;

    // Query Pinecone
    const results = await pinecone.query({
      vector: embedding.data[0].embedding,
      topK: 10
    });
    const pineconeQueryCost = 0.0002;

    // Record usage
    await CostTrackingService.recordUsage({
      userId: userId,
      usageType: 'ApiUsage',
      feature: 'semantic_search',
      cost: embeddingCost + pineconeQueryCost,
      isBillableRun: true,  // Premium feature
      provider: 'pinecone',
      metadata: {
        queryLength: query.length,
        resultsCount: results.length,
        embeddingModel: 'text-embedding-ada-002'
      }
    });

    return results;
  }
}
```

**Result:**
- Shows in "Third-Party API Usage"
- Free Tier: X/10,000 units (99.X% remaining)
- Only charges when exceeding 10,000 searches/month

---

## Best Practices

### 1. Cost Tracking
- ✅ **Always record usage** immediately after API/AI calls
- ✅ **Use accurate costs** from official pricing pages
- ✅ **Include metadata** for debugging and auditing
- ❌ **Don't forget** to finalize sessions

### 2. Naming Conventions
- Feature names: `lowercase_with_underscores`
- Provider names: `lowercase_provider_name`
- Session IDs: `session_timestamp_uuid`
- Operation IDs: `usage_timestamp_randomcode`

### 3. Testing
1. **Unit Test**: Verify cost calculations
2. **Integration Test**: Check Firestore writes
3. **E2E Test**: Validate admin dashboard display
4. **Load Test**: Ensure session handling scales

### 4. Monitoring
- Check admin dashboard daily for cost trends
- Set up alerts for unusual usage patterns
- Review free tier usage monthly
- Monitor efficiency metrics (runs/calls ratio)

---

## Quick Reference

### Cost Tracking Service Methods

```javascript
// Record usage (standalone or session)
await CostTrackingService.recordUsage(params);

// Get user's monthly usage
const usage = await CostTrackingService.getUserMonthlyUsage(userId, 'ApiUsage');

// Check if user can afford operation
const check = await CostTrackingService.canAffordOperation(userId, estimatedCost, requireRuns);

// Finalize a session
await CostTrackingService.finalizeSession(userId, sessionId);

// Get session details
const session = await CostTrackingService.getSession(userId, sessionId);
```

### Analytics Service Methods

```javascript
// Get platform-wide analytics
const analytics = await AnalyticsService.getPlatformAnalytics();

// Get user-specific analytics
const userAnalytics = await AnalyticsService.getUserAnalytics(userId);
```

---

## Change Log

### v2.0 - October 13, 2025
- ✅ Added session-based tracking for multi-step operations
- ✅ Implemented case-insensitive usage type matching
- ✅ Fixed free tier calculation for features (not providers)
- ✅ Added support for Google Maps multi-API free tier
- ✅ Enhanced debugging and logging throughout system

### v1.0 - Initial Release
- Basic cost tracking for standalone operations
- Admin dashboard with usage visualization
- Free tier support for AI and API providers

---

## Support & Documentation

- **Main Documentation**: See individual service files for detailed API docs
- **Architecture Docs**: `ADMIN_SERVICE_SEPARATION_GUIDE.md`, `ADMIN_SECURITY_LAYERS_GUIDE.md`
- **Issues**: Check server logs and browser console for detailed error messages
- **Updates**: Keep pricing in `adminConstants.js` synchronized with official provider pricing

---

**End of Guide**
