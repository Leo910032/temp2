# Budget Check Usage Guide

This guide explains how to use the new real-time budget tracking and permission checking system.

## Overview

The system now maintains real-time cost and run tracking directly in the user document, enabling fast pre-flight permission checks before expensive API operations.

## Database Schema

New fields added to `users/{userId}` document:
```javascript
{
  monthlyTotalCost: number,          // Current month's accumulated cost in USD
  monthlyBillableRuns: number,       // Current month's billable run count
  monthlyUsageMonth: string,         // "YYYY-MM" format
  monthlyUsageLastUpdated: timestamp // Last update timestamp
}
```

## Constants Configuration

### Maximum Billable Runs Per Month
Location: `lib/services/core/constants.js`

```javascript
export const MAX_BILLABLE_RUNS_PER_MONTH = {
  base: 0,
  pro: 15,
  premium: 30,
  business: 50,
  enterprise: -1  // Unlimited
};
```

### Maximum Cost Budget Per Month
Location: `lib/services/core/constants.js`

```javascript
export const MAX_COST_BUDGET_PER_MONTH = {
  base: 0,
  pro: 1.5,        // $1.50 per month
  premium: 3.0,    // $3.00 per month
  business: 5.0,   // $5.00 per month
  enterprise: -1   // Unlimited
};
```

## Usage in API Routes

### Example 1: Pre-flight Check Before Expensive Operation

```javascript
// app/api/user/contacts/semantic-search/route.js
import { createApiSession, SessionManager } from '@/lib/server/session';

export async function POST(req) {
  try {
    // 1. Create session
    const session = await createApiSession(req);
    const sessionManager = new SessionManager(session);

    // 2. Check if user can afford this operation
    const affordabilityCheck = await sessionManager.canAffordOperation(
      0.02,  // Estimated cost: $0.02
      true   // Requires a billable run slot
    );

    if (!affordabilityCheck.allowed) {
      return Response.json({
        error: affordabilityCheck.message,
        reason: affordabilityCheck.reason,
        budget: affordabilityCheck.budget,
        upgradeRequired: affordabilityCheck.upgradeRequired,
        nextTier: affordabilityCheck.nextTier
      }, { status: 402 });
    }

    // 3. Proceed with the operation
    const result = await performSemanticSearch(/* ... */);

    // 4. Record actual usage (automatically updates user document)
    await CostTrackingService.recordUsage({
      userId: session.userId,
      usageType: 'AIUsage',
      feature: 'semantic_search',
      cost: result.actualCost,
      isBillableRun: true,
      provider: 'openai',
      metadata: { /* ... */ }
    });

    return Response.json({ success: true, result });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
```

### Example 2: Check Budget Status

```javascript
// app/api/user/budget/status/route.js
import { createApiSession, SessionManager } from '@/lib/server/session';

export async function GET(req) {
  try {
    const session = await createApiSession(req);
    const sessionManager = new SessionManager(session);

    // Get current budget status
    const budget = await sessionManager.getRemainingBudget();

    return Response.json({
      subscriptionLevel: budget.subscriptionLevel,
      unlimited: budget.unlimited,
      currentUsage: {
        cost: budget.currentCost,
        runs: budget.currentRuns
      },
      limits: {
        maxCost: budget.maxCost,
        maxRuns: budget.maxRuns
      },
      remaining: {
        cost: budget.remainingCost,
        runs: budget.remainingRuns
      },
      percentageUsed: {
        cost: budget.percentageUsedCost,
        runs: budget.percentageUsedRuns
      },
      month: budget.month
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
```

### Example 3: Cost-Only Operation (No Billable Run)

```javascript
// For API calls that cost money but don't count as "billable runs"
const affordabilityCheck = await sessionManager.canAffordOperation(
  0.001,  // Estimated cost: $0.001
  false   // Does NOT require a billable run slot
);

// Later, record the usage
await CostTrackingService.recordUsage({
  userId: session.userId,
  usageType: 'ApiUsage',
  feature: 'google_maps_geocoding',
  cost: 0.005,
  isBillableRun: false,  // Just tracks cost, not runs
  provider: 'google_maps',
  metadata: { /* ... */ }
});
```

## Cost Tracking Service

### Automatic User Document Updates

When you call `CostTrackingService.recordUsage()`, the service now:

1. Records detailed usage in `AIUsage` or `ApiUsage` collections (existing behavior)
2. **NEW**: Updates the user document with real-time counters (atomic operation)
3. Automatically handles month rollovers (resets counters when month changes)

```javascript
await CostTrackingService.recordUsage({
  userId: 'user123',
  usageType: 'AIUsage',
  feature: 'business_card_scan',
  cost: 0.015,
  isBillableRun: true,
  provider: 'openai',
  metadata: {
    model: 'gpt-4',
    tokens: 1500
  }
});
```

This automatically updates:
- `users/user123` → `monthlyTotalCost` += 0.015
- `users/user123` → `monthlyBillableRuns` += 1
- `users/user123` → `monthlyUsageLastUpdated` = now()

## Session Manager Methods

### `canAffordOperation(estimatedCost, requiresBillableRun)`

Pre-flight check to see if user has budget/runs available.

**Parameters:**
- `estimatedCost` (number): Estimated cost in USD
- `requiresBillableRun` (boolean): Whether operation counts as a billable run

**Returns:**
```javascript
{
  allowed: boolean,
  reason: string,  // 'unlimited', 'within_limits', 'budget_exceeded', 'runs_exceeded'
  message?: string,  // Error message if not allowed
  budget: Object,  // Full budget status
  upgradeRequired?: boolean,
  nextTier?: string,
  estimatedCostAfter?: number,
  estimatedRunsAfter?: number
}
```

### `getRemainingBudget()`

Get current usage status for the month.

**Returns:**
```javascript
{
  subscriptionLevel: string,
  unlimited: boolean,
  currentCost: number,
  currentRuns: number,
  maxCost: number,
  maxRuns: number,
  remainingCost: number,
  remainingRuns: number,
  percentageUsedCost: number,
  percentageUsedRuns: number,
  month: string  // "YYYY-MM"
}
```

## Response Codes

- **200**: Operation allowed and completed
- **402**: Payment required (budget or runs exceeded)
- **403**: Forbidden (insufficient permissions)
- **500**: Server error

## Client-Side Integration

### Example: Show Budget Warning in UI

```javascript
// Fetch budget status
const response = await fetch('/api/user/budget/status');
const budget = await response.json();

// Show warning if approaching limits
if (budget.percentageUsed.runs >= 80 || budget.percentageUsed.cost >= 80) {
  showWarningBanner({
    message: `You've used ${Math.round(budget.percentageUsed.runs)}% of your monthly limit`,
    upgradeLink: true
  });
}

// Disable features if limit reached
if (budget.remaining.runs === 0) {
  disableAIFeatures();
}
```

## Benefits

✅ **Fast**: Single document read vs collection query
✅ **Real-time**: Always up-to-date budget enforcement
✅ **Consistent**: Maintains detailed analytics in separate collections
✅ **Safe**: Atomic updates prevent race conditions
✅ **Scalable**: Efficient for high-traffic operations

## Migration Notes

- Existing users will have counters initialized on their first usage after this update
- No data migration required - counters start from 0 for new month
- Backward compatible with existing cost tracking analytics
- All existing `CostTrackingService` methods continue to work unchanged
