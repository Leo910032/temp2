# Budget & Affordability Check Implementation Guide

**Version:** 1.0
**Date:** October 2025
**Author:** Claude Code

This guide documents the complete implementation of budget tracking and affordability checks for features that consume AI or API resources. Use this as a reference when implementing similar checks for new features.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Components](#core-components)
4. [Implementation Steps](#implementation-steps)
5. [Code Examples](#code-examples)
6. [Testing & Verification](#testing--verification)
7. [Common Pitfalls](#common-pitfalls)
8. [Troubleshooting](#troubleshooting)

---

## Overview

### What This System Does

The budget tracking system provides:
- ✅ Real-time tracking of AI and API operation usage
- ✅ Per-tier monthly limits (runs and cost budget)
- ✅ Pre-flight affordability checks before expensive operations
- ✅ Automatic month rollover with counter resets
- ✅ Graceful fallback mechanisms (e.g., AI → Basic when limits reached)
- ✅ User-facing budget displays in the dashboard

### Key Concepts

**Two Types of Operations:**
- **AI Operations**: Gemini, GPT, Claude, AI-enhanced features (counted as `monthlyBillableRunsAI`)
- **API Operations**: Google Maps, OCR, Pinecone, external APIs (counted as `monthlyBillableRunsAPI`)

**Three Tracking Locations:**
1. **User Document** (Real-time, fast): `users/{userId}` - Used for affordability checks
2. **Usage Collections** (Detailed analytics): `AIUsage/{userId}/`, `ApiUsage/{userId}/` - Used for analytics
3. **Session Tracking** (Multi-step operations): `SessionUsage/{userId}/sessions/{sessionId}` - Used for complex workflows

---

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        USER REQUEST                         │
│                   (e.g., Scan Business Card)                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Step 1: PRE-FLIGHT CHECK (Route)               │
│                                                             │
│  • sessionManager.canAffordScan()                           │
│  • Reads from user document (real-time data)                │
│  • Checks AI + API limits + Cost budget                     │
│  • Returns: { allowed: true/false, scanType, reason }      │
└────────────────────────┬────────────────────────────────────┘
                         │
                    allowed?
                         │
           ┌─────────────┴─────────────┐
           │                           │
          YES                          NO
           │                           │
           ▼                           ▼
┌──────────────────────┐    ┌──────────────────────┐
│  Step 2: PROCESS     │    │  Return 402 Error    │
│                      │    │  Payment Required    │
│  • Execute operation │    │                      │
│  • Track usage       │    │  Show upgrade prompt │
└──────────┬───────────┘    └──────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│         Step 3: RECORD USAGE (During Operation)             │
│                                                             │
│  • CostTrackingService.recordUsage()                        │
│  • Updates user document atomically                         │
│  • Records in AIUsage/ApiUsage collections                  │
│  • If multi-step: records in SessionUsage                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Step 4: UPDATE DASHBOARD                       │
│                                                             │
│  • BudgetInfoCard fetches /api/user/budget/status           │
│  • Displays real-time AI/API usage                          │
│  • Shows warnings at 80%, critical at 95%                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. User Document Fields

**Location:** `users/{userId}`

```javascript
{
  // Real-time budget tracking (fast reads)
  monthlyTotalCost: 0.0249,           // Total cost in USD
  monthlyBillableRunsAI: 29,          // AI operations count
  monthlyBillableRunsAPI: 3,          // API operations count
  monthlyUsageMonth: "2025-10",       // Current month (YYYY-MM)
  monthlyUsageLastUpdated: Timestamp  // Last update timestamp
}
```

### 2. Constants (Single Source of Truth)

**Location:** `lib/services/core/constants.js`

```javascript
export const MAX_BILLABLE_RUNS_AI_PER_MONTH = {
  base: 0,
  pro: 0,        // Pro tier: No AI features
  premium: 30,   // Premium tier: 30 AI operations
  business: 50,
  enterprise: -1 // Unlimited
};

export const MAX_BILLABLE_RUNS_API_PER_MONTH = {
  base: 0,
  pro: 50,       // Pro tier: 50 API operations
  premium: 100,
  business: 200,
  enterprise: -1
};

export const MAX_COST_BUDGET_PER_MONTH = {
  base: 0,
  pro: 1.5,      // $1.50/month
  premium: 3.0,  // $3.00/month
  business: 5.0,
  enterprise: -1
};
```

**⚠️ IMPORTANT:** Keep `lib/services/serviceContact/client/constants/contactConstants.js` synchronized with these values!

### 3. SessionManager Methods

**Location:** `lib/server/session.js`

#### A. `getRemainingBudget()`
Returns current usage and remaining budget:

```javascript
const budget = await sessionManager.getRemainingBudget();
// Returns:
{
  subscriptionLevel: 'premium',
  unlimited: false,
  currentCost: 0.0249,
  currentRunsAI: 29,
  currentRunsAPI: 3,
  maxCost: 3.0,
  maxRunsAI: 30,
  maxRunsAPI: 100,
  remainingCost: 2.9751,
  remainingRunsAI: 1,
  remainingRunsAPI: 97,
  percentageUsedCost: 0.83,
  percentageUsedRunsAI: 96.67,
  percentageUsedRunsAPI: 3.0,
  month: "2025-10"
}
```

#### B. `canAffordOperation()`
Generic affordability check:

```javascript
const check = await sessionManager.canAffordOperation(
  0.002,      // estimatedCost
  true,       // requiresBillableRun
  'AIUsage'   // usageType: 'AIUsage' or 'ApiUsage'
);
// Returns:
{
  allowed: true/false,
  reason: 'within_limits' | 'budget_exceeded' | 'runs_exceeded',
  budget: { ... },
  message: "Error message if blocked"
}
```

#### C. `canAffordScan()` (Specialized)
Smart check for business card scans with fallback logic:

```javascript
const check = await sessionManager.canAffordScan(isDoubleSided);
// Returns:
{
  allowed: true,
  scanType: 'ai_enhanced' | 'basic',
  reason: 'within_limits' | 'ai_fallback',
  estimatedCost: 0.003,
  usageType: 'AIUsage' | 'ApiUsage',
  budget: { ... },
  fallbackMessage: "AI operations limit reached. Using basic scan."
}
```

### 4. CostTrackingService

**Location:** `lib/services/serviceContact/server/costTracking/costTrackingService.js`

#### Recording Usage

```javascript
await CostTrackingService.recordUsage({
  userId: 'user123',
  usageType: 'ApiUsage',           // 'AIUsage' or 'ApiUsage'
  feature: 'business_card_scan_basic',
  cost: 0.0015,                     // Actual cost in USD
  isBillableRun: true,              // Counts toward monthly limit
  provider: 'google_vision_ocr',
  sessionId: null,                  // Optional: for multi-step operations
  metadata: {
    side: 'front',
    requestId: 'scan_123'
  }
});
```

**What This Does:**
1. Updates user document atomically (transaction)
2. Handles month rollover automatically
3. Increments `monthlyBillableRunsAI` or `monthlyBillableRunsAPI`
4. Records detailed log in `AIUsage` or `ApiUsage` collection
5. If `sessionId` provided, also records in `SessionUsage`

---

## Implementation Steps

### Step 1: Define Your Feature's Limits

1. Decide which tiers get access to your feature
2. Determine operation type (AI or API)
3. Set appropriate cost estimates

**Example: Adding a new AI summarization feature**

```javascript
// In lib/services/core/constants.js or a feature-specific config
export const AI_SUMMARIZATION_COST = {
  SHORT: 0.0001,   // < 1000 chars
  MEDIUM: 0.0005,  // 1000-5000 chars
  LONG: 0.002      // > 5000 chars
};
```

### Step 2: Add Pre-flight Check to Your Route

**Location:** `app/api/user/your-feature/route.js`

```javascript
import { createApiSession, SessionManager } from '@/lib/server/session';

export async function POST(request) {
  try {
    const session = await createApiSession(request);
    const sessionManager = new SessionManager(session);

    // Parse request
    const { text } = await request.json();

    // Estimate cost based on text length
    const estimatedCost = text.length < 1000
      ? AI_SUMMARIZATION_COST.SHORT
      : AI_SUMMARIZATION_COST.MEDIUM;

    // Pre-flight affordability check
    const affordabilityCheck = await sessionManager.canAffordOperation(
      estimatedCost,
      true,        // This is a billable operation
      'AIUsage'    // This uses AI
    );

    if (!affordabilityCheck.allowed) {
      console.warn(`[API /summarize] User ${session.userId} cannot afford: ${affordabilityCheck.reason}`);
      return NextResponse.json(
        {
          success: false,
          error: affordabilityCheck.message || 'Monthly limit reached',
          reason: affordabilityCheck.reason,
          budget: affordabilityCheck.budget,
          upgradeRequired: affordabilityCheck.upgradeRequired,
          nextTier: affordabilityCheck.nextTier
        },
        { status: 402 } // Payment Required
      );
    }

    console.log(`[API /summarize] Affordability check passed - proceeding`);

    // Continue with your feature implementation...
    const result = await YourFeatureService.process({ text, session });

    return NextResponse.json(result);

  } catch (error) {
    console.error('[API /summarize] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

### Step 3: Record Usage During Operation

**In your service/feature implementation:**

```javascript
export class YourFeatureService {
  static async process({ text, session }) {
    try {
      // Do your actual work (call AI API, etc.)
      const result = await callAIService(text);
      const actualCost = calculateActualCost(result);

      // Record usage
      await CostTrackingService.recordUsage({
        userId: session.userId,
        usageType: 'AIUsage',
        feature: 'ai_summarization',
        cost: actualCost,
        isBillableRun: true,     // Counts toward monthly limit
        provider: 'openai_gpt4',
        sessionId: null,          // Or provide sessionId for multi-step
        metadata: {
          textLength: text.length,
          model: 'gpt-4-turbo',
          tokens: result.tokens
        }
      });

      return {
        success: true,
        summary: result.summary,
        cost: actualCost
      };

    } catch (error) {
      console.error('[YourFeatureService] Error:', error);
      throw error;
    }
  }
}
```

### Step 4: (Optional) Add Specialized Affordability Check

If your feature has complex logic (like fallback mechanisms), create a specialized method in SessionManager:

```javascript
// In lib/server/session.js

async canAffordYourFeature(inputSize) {
  const hasAdvancedAccess = this.session.permissions?.YOUR_ADVANCED_FEATURE;
  const hasBasicAccess = this.session.permissions?.YOUR_BASIC_FEATURE;

  const budget = await this.getRemainingBudget();

  if (budget.unlimited) {
    return { allowed: true, reason: 'unlimited', featureType: 'advanced' };
  }

  // Try advanced version first
  if (hasAdvancedAccess) {
    const advancedCost = estimateAdvancedCost(inputSize);
    const canAffordAICost = budget.maxCost <= 0 || (budget.currentCost + advancedCost) <= budget.maxCost;
    const canAffordAIRuns = budget.maxRunsAI <= 0 || (budget.currentRunsAI + 1) <= budget.maxRunsAI;

    if (canAffordAICost && canAffordAIRuns) {
      return {
        allowed: true,
        featureType: 'advanced',
        estimatedCost: advancedCost,
        usageType: 'AIUsage'
      };
    }

    console.log(`[SessionManager] AI limits reached - checking basic fallback`);
  }

  // Fallback to basic version
  if (hasBasicAccess || hasAdvancedAccess) {
    const basicCost = estimateBasicCost(inputSize);
    const canAffordBasicCost = budget.maxCost <= 0 || (budget.currentCost + basicCost) <= budget.maxCost;
    const canAffordAPIRuns = budget.maxRunsAPI <= 0 || (budget.currentRunsAPI + 1) <= budget.maxRunsAPI;

    if (canAffordBasicCost && canAffordAPIRuns) {
      return {
        allowed: true,
        featureType: 'basic',
        estimatedCost: basicCost,
        usageType: 'ApiUsage',
        fallbackMessage: hasAdvancedAccess ? 'AI limits reached. Using basic version.' : null
      };
    }

    return {
      allowed: false,
      reason: 'all_limits_exceeded',
      message: 'Monthly limits reached. Please upgrade or wait until next month.',
      budget
    };
  }

  return {
    allowed: false,
    reason: 'no_permission',
    message: 'You do not have permission for this feature.'
  };
}
```

### Step 5: Add Budget Display to Dashboard (Optional)

The existing `BudgetInfoCard` component already shows AI/API usage. If you want feature-specific displays:

```javascript
// In your dashboard component
import { useDashboard } from '@/app/dashboard/DashboardContext';

export function YourFeaturePage() {
  const { budgetInfo, budgetLoading } = useDashboard();

  if (budgetLoading) {
    return <div>Loading budget...</div>;
  }

  const remainingAIRuns = budgetInfo.remaining.runsAI;

  return (
    <div>
      <h1>Your Feature</h1>

      {remainingAIRuns <= 5 && (
        <div className="warning">
          ⚠️ Only {remainingAIRuns} AI operations remaining this month
        </div>
      )}

      {/* Your feature UI */}
    </div>
  );
}
```

---

## Code Examples

### Example 1: Simple API Check (No Fallback)

```javascript
// Route: app/api/user/geocode/route.js
export async function POST(request) {
  const session = await createApiSession(request);
  const sessionManager = new SessionManager(session);
  const { address } = await request.json();

  // Check affordability
  const GEOCODING_COST = 0.005; // $0.005 per request
  const check = await sessionManager.canAffordOperation(
    GEOCODING_COST,
    true,        // Billable
    'ApiUsage'   // API operation
  );

  if (!check.allowed) {
    return NextResponse.json(
      { error: check.message, reason: check.reason },
      { status: 402 }
    );
  }

  // Process
  const coords = await GeocodingService.geocode(address);

  // Record usage
  await CostTrackingService.recordUsage({
    userId: session.userId,
    usageType: 'ApiUsage',
    feature: 'geocoding',
    cost: GEOCODING_COST,
    isBillableRun: true,
    provider: 'google_maps',
    metadata: { address }
  });

  return NextResponse.json({ coords });
}
```

### Example 2: AI Feature with Fallback

```javascript
// Route: app/api/user/smart-summary/route.js
export async function POST(request) {
  const session = await createApiSession(request);
  const sessionManager = new SessionManager(session);
  const { text } = await request.json();

  // Use specialized check
  const check = await sessionManager.canAffordSmartSummary(text.length);

  if (!check.allowed) {
    return NextResponse.json(
      { error: check.message },
      { status: 402 }
    );
  }

  let result;
  if (check.summaryType === 'ai') {
    result = await SmartSummaryService.processWithAI(text, session);
  } else {
    result = await SmartSummaryService.processBasic(text, session);
  }

  return NextResponse.json({
    ...result,
    usedFallback: check.summaryType === 'basic',
    fallbackMessage: check.fallbackMessage
  });
}
```

### Example 3: Multi-Step Operation with Session

```javascript
// Service: lib/services/yourFeature/multiStepService.js
export class MultiStepService {
  static async processMultiStep({ data, session }) {
    const sessionId = `session_${Date.now()}`;

    try {
      // Step 1: Initial processing
      const step1Result = await this.step1(data);
      await CostTrackingService.recordUsage({
        userId: session.userId,
        usageType: 'ApiUsage',
        feature: 'multi_step_1',
        cost: 0.001,
        isBillableRun: false,  // Not billable
        provider: 'internal',
        sessionId              // Link to session
      });

      // Step 2: AI enhancement (BILLABLE)
      const step2Result = await this.step2(step1Result);
      await CostTrackingService.recordUsage({
        userId: session.userId,
        usageType: 'AIUsage',
        feature: 'multi_step_ai',
        cost: 0.005,
        isBillableRun: true,   // Billable!
        provider: 'openai',
        sessionId
      });

      // Finalize session
      await CostTrackingService.finalizeSession(session.userId, sessionId);

      return { step1Result, step2Result };

    } catch (error) {
      console.error('[MultiStepService] Error:', error);
      throw error;
    }
  }
}
```

---

## Testing & Verification

### Manual Testing Checklist

- [ ] **Within Limits**: Feature works when user has budget
- [ ] **At Exact Limit**: Works at 29/30, blocks at 30/30
- [ ] **Cost Budget**: Blocks when cost would exceed limit
- [ ] **Fallback Logic**: Falls back to basic when AI exhausted
- [ ] **Month Rollover**: Counters reset on new month
- [ ] **Dashboard Display**: Shows correct remaining budget
- [ ] **Error Messages**: Clear, actionable error messages
- [ ] **Enterprise Tier**: Unlimited works correctly

### Verification Queries

Check user document after operation:

```javascript
// Firebase Console or Admin SDK
const userDoc = await db.collection('users').doc(userId).get();
const data = userDoc.data();

console.log('Usage:', {
  cost: data.monthlyTotalCost,
  aiRuns: data.monthlyBillableRunsAI,
  apiRuns: data.monthlyBillableRunsAPI,
  month: data.monthlyUsageMonth
});
```

Check detailed analytics:

```javascript
const aiUsage = await db.collection('AIUsage')
  .doc(userId)
  .collection('monthly')
  .doc('2025-10')
  .get();

console.log('AI Usage Details:', aiUsage.data());
```

### Expected Database State

After a single AI scan operation:

```javascript
// User Document
{
  monthlyTotalCost: 0.0016,          // Incremented
  monthlyBillableRunsAI: 1,          // Incremented
  monthlyBillableRunsAPI: 0,         // Unchanged
  monthlyUsageMonth: "2025-10",
  monthlyUsageLastUpdated: Timestamp
}

// AIUsage Collection
AIUsage/{userId}/monthly/2025-10: {
  totalCost: 0.0016,
  totalRuns: 1,
  totalApiCalls: 1,
  featureBreakdown: {
    business_card_scan: {
      cost: 0.0016,
      apiCalls: 1,
      billableRuns: 1
    }
  }
}
```

---

## Common Pitfalls

### 1. **Inconsistent Constants**

❌ **Problem:** Different limit values in different files

```javascript
// lib/services/core/constants.js
MAX_BILLABLE_RUNS_AI_PER_MONTH.premium = 30;

// lib/services/serviceContact/client/constants/contactConstants.js
maxAiRunsPerMonth: 20;  // WRONG!
```

✅ **Solution:** Keep both files synchronized or use single source of truth

### 2. **Wrong Usage Type**

❌ **Problem:** Recording API operation as AI usage

```javascript
await CostTrackingService.recordUsage({
  usageType: 'AIUsage',  // Wrong! This is OCR
  feature: 'ocr_scan'
});
```

✅ **Solution:** Use correct type based on service

```javascript
await CostTrackingService.recordUsage({
  usageType: 'ApiUsage',  // Correct - OCR is API
  feature: 'ocr_scan'
});
```

### 3. **Forgetting Pre-flight Check**

❌ **Problem:** Recording usage without checking first

```javascript
// Route
const result = await expensiveOperation();  // User might not have budget!
await CostTrackingService.recordUsage(...);
```

✅ **Solution:** Always check before processing

```javascript
const check = await sessionManager.canAffordOperation(...);
if (!check.allowed) return error;

const result = await expensiveOperation();
await CostTrackingService.recordUsage(...);
```

### 4. **Not Handling Month Rollover**

❌ **Problem:** Manual month comparison

```javascript
if (userData.month !== currentMonth) {
  // Reset counters...  // Don't do this manually!
}
```

✅ **Solution:** `recordUsage()` handles this automatically

### 5. **Reading from Wrong Source**

❌ **Problem:** Reading from collections instead of user document

```javascript
const usage = await db.collection('AIUsage')
  .doc(userId)
  .collection('monthly')
  .doc(currentMonth)
  .get();
// This might be empty or stale!
```

✅ **Solution:** Use `SessionManager.getRemainingBudget()` which reads from user document

### 6. **Incorrect Greater Than Logic**

❌ **Problem:** Using `>=` instead of `>`

```javascript
if ((currentRuns + 1) >= maxRuns) {  // Blocks at 29/30!
  return 'exceeded';
}
```

✅ **Solution:** Use strict `>` to allow exactly at limit

```javascript
if ((currentRuns + 1) > maxRuns) {  // Allows 30/30
  return 'exceeded';
}
```

---

## Troubleshooting

### Issue: "Would exceed runs" at 29/30

**Cause:** Using `>=` instead of `>` in comparison

**Fix:** Check line 439 in `costTrackingService.js`:
```javascript
const wouldExceedRuns = (usage.usage.totalRuns + requireRuns) > usage.limits.maxRuns;
```

### Issue: Dashboard shows 0/0 for limits

**Cause:** Constants mismatch between files

**Fix:** Verify both files have same values:
- `lib/services/core/constants.js`
- `lib/services/serviceContact/client/constants/contactConstants.js`

### Issue: User document not updating

**Cause 1:** Recording with `sessionId` without updating user doc
**Fix:** Ensure session-based recording also updates user document (lines 89-131 in costTrackingService.js)

**Cause 2:** Transaction conflict
**Fix:** Check for errors in console, retry logic might be needed

### Issue: AI operations work despite limit reached

**Cause:** Service has own affordability check reading from wrong source

**Fix:** Update service to read from user document, not collections:
```javascript
// Before (wrong)
const usageDoc = await adminDb.collection('AIUsage')
  .doc(userId).get();

// After (correct)
const userDoc = await adminDb.collection('users')
  .doc(userId).get();
const aiRuns = userDoc.data().monthlyBillableRunsAI;
```

### Issue: Fallback not working (Premium users blocked)

**Cause:** Premium users don't have `BASIC_CARD_SCANNER` permission

**Fix:** Allow AI users implicit fallback:
```javascript
if (hasBasicAccess || hasAIAccess) {  // Note the || hasAIAccess
  // Check basic affordability...
}
```

### Issue: Month rollover not working

**Cause:** Comparing timestamps instead of month strings

**Fix:** Use ISO month format:
```javascript
const currentMonth = new Date().toISOString().slice(0, 7);  // "2025-10"
const needsReset = userData.monthlyUsageMonth !== currentMonth;
```

---

## Best Practices

### 1. Always Use Transactions for User Document Updates

```javascript
await adminDb.runTransaction(async (transaction) => {
  const userDoc = await transaction.get(userDocRef);
  const userData = userDoc.data();

  // Calculate new values
  const newCost = userData.monthlyTotalCost + cost;

  // Update atomically
  transaction.update(userDocRef, {
    monthlyTotalCost: FieldValue.increment(cost),
    monthlyUsageLastUpdated: FieldValue.serverTimestamp()
  });
});
```

### 2. Provide Actionable Error Messages

❌ Bad: "Budget exceeded"
✅ Good: "Monthly API operation limit of 50 has been reached. Current usage: 50. Upgrade to Premium for 100 operations."

### 3. Log Everything

```javascript
console.log(`💸 [Feature] Checking affordability - User: ${userId}, Cost: $${cost}`);
console.log(`📊 [Feature] Current usage: ${currentRuns}/${maxRuns}`);
console.log(`✅ [Feature] Check passed - proceeding`);
console.log(`❌ [Feature] Check failed - ${reason}`);
```

### 4. Handle Edge Cases

- Zero limits (Base tier)
- Unlimited limits (Enterprise: -1)
- Negative costs (refunds/credits)
- Very small costs (< $0.01)
- Month boundaries (UTC)

### 5. Test with Real Data

Don't just test with empty databases. Test with:
- Users at 0/30
- Users at 29/30
- Users at 30/30
- Users at 31/30 (over limit)
- New month transition

---

## Summary

### Checklist for New Feature

- [ ] Define operation type (AI or API)
- [ ] Estimate costs accurately
- [ ] Add pre-flight check in route
- [ ] Record usage during operation
- [ ] Update constants if needed
- [ ] Test all limit scenarios
- [ ] Add user-facing error messages
- [ ] Update dashboard if needed
- [ ] Document feature-specific behavior

### Key Files to Modify

1. **Route**: `app/api/user/your-feature/route.js` - Add pre-flight check
2. **Service**: `lib/services/yourFeature/service.js` - Record usage
3. **Constants**: `lib/services/core/constants.js` - Add limits if needed
4. **Session** (optional): `lib/server/session.js` - Add specialized check

### Testing Commands

```bash
# Watch user document in real-time
firebase firestore:watch users/{userId}

# Query usage analytics
firebase firestore:query AIUsage/{userId}/monthly --limit 1

# Reset user budget (testing only!)
firebase firestore:set users/{userId} '{"monthlyBillableRunsAI": 0, "monthlyBillableRunsAPI": 0, "monthlyTotalCost": 0}'
```

---

## Additional Resources

- [Firebase Transactions Documentation](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Atomic Operations Best Practices](https://firebase.google.com/docs/firestore/manage-data/add-data#update_fields_in_nested_objects)
- Project Constants: `lib/services/core/constants.js`
- Budget Display Component: `app/dashboard/general components/BudgetInfoCard.jsx`

---

**Last Updated:** October 2025
**Maintained By:** Development Team
**Questions?** Check troubleshooting section or review existing implementation in business card scanning feature.
