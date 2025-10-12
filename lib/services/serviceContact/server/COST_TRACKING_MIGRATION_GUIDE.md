# Cost Tracking Service - Migration Guide & Usage Examples

## Overview

The `CostTrackingService` has been refactored to support tracking costs across multiple resource types (AI, third-party APIs, etc.) while maintaining backward compatibility with existing code.

## Database Structure

### New Scalable Architecture

The service now uses **top-level collections** for each usage type:

```
AIUsage/
  {userId}/
    monthly/
      {YYYY-MM}/
        - totalCost
        - totalRuns
        - totalApiCalls
        - featureBreakdown
        - providerBreakdown
        - efficiency metrics
    operations/
      {operationId}/
        - timestamp
        - feature
        - provider
        - cost
        - isBillableRun
        - metadata

ApiUsage/
  {userId}/
    monthly/
      {YYYY-MM}/
        - Similar structure
    operations/
      {operationId}/
        - Similar structure
```

### Benefits

- **Scalability**: No document size limits per user
- **Performance**: Queries for AI don't slow down API queries
- **Flexibility**: Easy to add new usage types
- **Security**: Granular Firestore security rules per usage type

---

## New Main API: `recordUsage()`

### Function Signature

```javascript
static async recordUsage({
  userId,           // Required: User ID
  usageType,        // 'AIUsage' | 'ApiUsage' (default: 'AIUsage')
  feature,          // Required: Feature name
  cost,             // Required: Monetary cost in dollars
  isBillableRun,    // Whether this counts toward monthly run limits (default: false)
  provider,         // Service provider name (default: 'unknown')
  metadata          // Additional data to store (default: {})
})
```

### Usage Examples

#### 1. Track AI Usage (Business Card Analysis)

```javascript
import { CostTrackingService } from '@/lib/services/serviceContact/server/costTrackingService';

// After a successful AI analysis
await CostTrackingService.recordUsage({
  userId: session.userId,
  usageType: 'AIUsage',
  feature: 'business_card_analysis',
  cost: 0.0042,
  isBillableRun: true,  // This counts toward monthly AI run limits
  provider: 'openai-gpt4',
  metadata: {
    model: 'gpt-4-vision-preview',
    inputTokens: 1250,
    outputTokens: 420,
    analysisType: 'deep'
  }
});
```

#### 2. Track AI API Call (without billable run)

```javascript
// For an AI call that was filtered out or failed validation
await CostTrackingService.recordUsage({
  userId: session.userId,
  usageType: 'AIUsage',
  feature: 'business_card_analysis',
  cost: 0.0015,
  isBillableRun: false,  // API call cost but doesn't count as a successful run
  provider: 'openai-gpt4',
  metadata: {
    reason: 'filtered_duplicate',
    confidence: 0.45
  }
});
```

#### 3. Track Google Maps API Usage

```javascript
// Track Google Maps Places API call
await CostTrackingService.recordUsage({
  userId: session.userId,
  usageType: 'ApiUsage',
  feature: 'google_maps_places',
  cost: 0.032,  // Google charges per request
  isBillableRun: false,  // API calls typically don't have "runs"
  provider: 'google_maps',
  metadata: {
    apiEndpoint: 'places/autocomplete',
    query: 'restaurants near me',
    resultsCount: 20
  }
});
```

#### 4. Track Pinecone Vector Database Usage

```javascript
// Track Pinecone query cost
await CostTrackingService.recordUsage({
  userId: session.userId,
  usageType: 'ApiUsage',
  feature: 'vector_search',
  cost: 0.0005,
  isBillableRun: false,
  provider: 'pinecone',
  metadata: {
    operation: 'query',
    vectorDimensions: 1536,
    topK: 10,
    indexName: 'contacts-embeddings'
  }
});
```

---

## Checking User Affordability

### AI Operations (Backward Compatible)

```javascript
// Check if user can afford an AI operation
const affordability = await CostTrackingService.canAffordOperation(
  userId,
  0.005,  // Estimated cost
  1       // Number of billable runs required
);

if (!affordability.canAfford) {
  if (affordability.reason === 'budget_exceeded') {
    throw new Error(`Monthly AI budget exceeded. Remaining: $${affordability.remainingBudget}`);
  }
  if (affordability.reason === 'runs_exceeded') {
    throw new Error(`Monthly AI runs limit reached. Remaining: ${affordability.remainingRuns}`);
  }
}
```

### Generic Usage Types (New)

```javascript
// Check affordability for any usage type
const affordability = await CostTrackingService.canAffordGeneric(
  userId,
  'ApiUsage',  // Check API usage limits
  0.032,       // Estimated cost
  false        // Doesn't require a billable run slot
);

if (!affordability.canAfford) {
  throw new Error(`Cannot afford operation: ${affordability.reason}`);
}
```

---

## Getting Usage Statistics

### Current Month Usage

```javascript
// Get AI usage for current month
const aiUsage = await CostTrackingService.getUserMonthlyUsage(
  userId,
  'AIUsage'
);

console.log(aiUsage);
// {
//   month: '2025-10',
//   subscriptionLevel: 'pro',
//   usageType: 'AIUsage',
//   usage: {
//     totalCost: 2.45,
//     totalRuns: 156,
//     totalApiCalls: 203,
//     featureBreakdown: {
//       business_card_analysis: { cost: 1.89, apiCalls: 150, billableRuns: 120 },
//       contact_enrichment: { cost: 0.56, apiCalls: 53, billableRuns: 36 }
//     },
//     providerBreakdown: {
//       'openai-gpt4': { cost: 2.10, apiCalls: 180, billableRuns: 140 },
//       'anthropic-claude': { cost: 0.35, apiCalls: 23, billableRuns: 16 }
//     }
//   },
//   limits: {
//     maxCost: 10.00,
//     maxRuns: 500
//   },
//   remainingBudget: 7.55,
//   remainingRuns: 344,
//   percentageUsed: 24.5
// }
```

### Detailed Historical Usage

```javascript
// Get 6 months of history with individual operations
const detailedUsage = await CostTrackingService.getDetailedUsage(
  userId,
  'AIUsage',
  6,      // Number of months
  true,   // Include individual operations
  200     // Max operations to return
);

console.log(detailedUsage);
// {
//   usageType: 'AIUsage',
//   subscriptionLevel: 'pro',
//   monthlyBreakdown: [ ... ],
//   totalLifetimeCost: 14.23,
//   totalLifetimeRuns: 892,
//   totalLifetimeApiCalls: 1156,
//   recentOperations: [ ... ]
// }
```

### Usage Warnings

```javascript
// Check if user is approaching limits
const warnings = await CostTrackingService.checkUsageWarnings(
  userId,
  'AIUsage'
);

if (warnings.warnings.length > 0) {
  warnings.warnings.forEach(warning => {
    console.log(`${warning.severity}: ${warning.message}`);
    // medium: You've used 85% of your monthly AIUsage budget
  });
}
```

---

## Migration from Old Code

### Old Code (Deprecated)

```javascript
// OLD: recordSeparatedUsage
await CostTrackingService.recordSeparatedUsage(
  userId,
  0.0042,
  'gpt-4',
  'business_card_scan',
  { tokens: 1670 },
  'successful_run'
);
```

### New Code (Recommended)

```javascript
// NEW: recordUsage
await CostTrackingService.recordUsage({
  userId,
  usageType: 'AIUsage',
  feature: 'business_card_scan',
  cost: 0.0042,
  isBillableRun: true,
  provider: 'gpt-4',
  metadata: { tokens: 1670 }
});
```

### Backward Compatibility

The old `recordSeparatedUsage()` method is still available but deprecated. It now internally calls `recordUsage()` and logs a deprecation warning. Your existing code will continue to work without changes.

---

## Real-World Implementation Example

### Complete AI Analysis Flow

```javascript
import { CostTrackingService } from '@/lib/services/serviceContact/server/costTrackingService';
import { analyzeBusinessCard } from './aiService';

export async function processBusinessCard(userId, imageUrl) {
  // Step 1: Check affordability BEFORE making the AI call
  const estimatedCost = 0.005;  // Rough estimate based on image size

  const affordability = await CostTrackingService.canAffordOperation(
    userId,
    estimatedCost,
    1  // Requires 1 billable run
  );

  if (!affordability.canAfford) {
    throw new Error(`Cannot process: ${affordability.reason}`);
  }

  // Step 2: Make the AI call
  let analysisResult;
  let actualCost;

  try {
    const response = await analyzeBusinessCard(imageUrl);
    analysisResult = response.data;
    actualCost = calculateActualCost(response.usage);

    // Step 3: Record successful run
    await CostTrackingService.recordUsage({
      userId,
      usageType: 'AIUsage',
      feature: 'business_card_analysis',
      cost: actualCost,
      isBillableRun: true,  // Successful analysis
      provider: 'openai-gpt4',
      metadata: {
        model: response.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        confidence: analysisResult.confidence
      }
    });

    return analysisResult;

  } catch (error) {
    // Step 4: Record failed API call (if it actually called the API)
    if (actualCost) {
      await CostTrackingService.recordUsage({
        userId,
        usageType: 'AIUsage',
        feature: 'business_card_analysis',
        cost: actualCost,
        isBillableRun: false,  // Failed, doesn't count as billable run
        provider: 'openai-gpt4',
        metadata: {
          error: error.message,
          errorType: error.code
        }
      });
    }

    throw error;
  }
}
```

---

## Subscription Limits Configuration

Make sure your subscription limits are configured correctly in your subscription service:

```javascript
// In your subscriptionService or constants
const SUBSCRIPTION_LIMITS = {
  free: {
    aiCostBudget: 1.00,           // $1 per month for AI
    maxAiRunsPerMonth: 50,        // 50 successful AI analyses
    apiCostBudget: 0.50,          // $0.50 for third-party APIs
    maxApiCallsPerMonth: 100      // 100 API calls
  },
  pro: {
    aiCostBudget: 10.00,
    maxAiRunsPerMonth: 500,
    apiCostBudget: 5.00,
    maxApiCallsPerMonth: 1000
  },
  enterprise: {
    aiCostBudget: -1,             // Unlimited
    maxAiRunsPerMonth: -1,        // Unlimited
    apiCostBudget: -1,
    maxApiCallsPerMonth: -1
  }
};
```

---

## Key Concepts

### Cost vs Billable Runs

- **Cost**: Every API call has a monetary cost that counts toward the budget
- **Billable Run**: A successful operation that counts toward the run limit

Example scenarios:
- ✅ Successful AI analysis → Cost + Billable Run
- ❌ AI call filtered out → Cost only, no Billable Run
- ❌ AI call failed → Cost only (if API was called), no Billable Run
- ✅ Google Maps query → Cost only (APIs typically don't have "runs")

### Usage Types

- **AIUsage**: For AI/ML operations (OpenAI, Anthropic, etc.)
- **ApiUsage**: For third-party API services (Google Maps, Pinecone, etc.)
- You can add more types as needed (e.g., 'StorageUsage', 'ComputeUsage')

---

## Best Practices

1. **Always check affordability BEFORE making expensive API calls**
2. **Record usage IMMEDIATELY after the operation** (success or failure)
3. **Use descriptive feature names** (e.g., 'business_card_analysis' not 'bc_scan')
4. **Include relevant metadata** for debugging and analytics
5. **Set `isBillableRun = true`** only for successful, valuable operations
6. **Monitor usage warnings** and alert users when approaching limits

---

## Questions?

For more information, check the source code in:
- [costTrackingService.js](./costTrackingService.js)

For subscription limits configuration:
- [subscriptionService.js](../../server/subscriptionService.js)
