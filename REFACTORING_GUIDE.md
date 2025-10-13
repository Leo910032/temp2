# Cost Tracking Service - Refactoring Guide

## Overview

This document explains the major refactoring of the cost tracking system to support:
1. **Generalized API cost tracking** - Track costs for any API (Google Maps, Pinecone, Neo4j, etc.)
2. **Session-based tracking** - Group multiple related API calls into logical sessions
3. **Better organization** - Separate concerns into multiple focused files
4. **Centralized cost constants** - Single source of truth for API pricing

## Architecture Changes

### Before
```
lib/services/serviceContact/server/
├── costTrackingService.js (monolithic)
└── placesService.js (hardcoded costs)
```

### After
```
lib/services/
├── constants/
│   └── apiCosts.js (NEW - centralized API pricing)
└── serviceContact/server/
    ├── costTrackingService.js (enhanced with sessions)
    ├── costTracking/
    │   └── sessionService.js (NEW - session tracking)
    └── placesService.js (uses constants & sessions)
```

## ⚠️ CRITICAL: Session vs Standalone Operations

The system now implements a clear separation:

### **Operations WITH `sessionId`**
- Recorded **ONLY** in `SessionUsage/{userId}/sessions/{sessionId}`
- **NOT duplicated** in `ApiUsage` or `AIUsage` collections
- Example: Google Maps search (autocomplete + details = 2 steps in 1 session)
- Purpose: Track multi-step workflows as a single logical operation

### **Operations WITHOUT `sessionId`**
- Recorded in `AIUsage` or `ApiUsage` collections
- Example: Standalone AI analysis, one-off API calls
- Purpose: Track individual, independent operations

### Why This Matters
- **No Duplication**: Each operation is stored in exactly ONE place
- **Clear Intent**: Session = workflow, Standalone = individual call
- **Better Analytics**: See complete workflows vs individual operations
- **Cost Accuracy**: Session totals reflect true feature costs

## Key Changes

### 1. API Cost Constants (`lib/services/constants/apiCosts.js`)

**Purpose:** Centralize all third-party API pricing in one location.

```javascript
import { API_COSTS } from '@/lib/services/constants/apiCosts';

// Access costs like this:
const cost = API_COSTS.GOOGLE_MAPS.PLACES_AUTOCOMPLETE.PER_REQUEST;
```

**Benefits:**
- Single source of truth for pricing
- Easy to update when APIs change pricing
- Clear documentation of costs
- Type-safe access with helper functions

### 2. Session Tracking Service (`lib/services/serviceContact/server/costTracking/sessionService.js`)

**Purpose:** Group related API calls into logical sessions.

**Example Use Case:** Google Maps search
1. User types query → Autocomplete API call
2. User selects result → Place Details API call
3. Both calls are part of the same "search session"

**Database Structure:**
```
SessionUsage/{userId}/sessions/{sessionId}
{
  feature: 'google_maps',
  status: 'in-progress' | 'completed' | 'abandoned',
  totalCost: 0.02053,
  totalRuns: 0,
  steps: [
    {
      operationId: 'op_123',
      feature: 'google_maps_autocomplete',
      cost: 0.00283,
      timestamp: '2024-10-12T...',
      metadata: {...}
    },
    {
      operationId: 'op_124',
      feature: 'google_maps_place_details',
      cost: 0.017,
      timestamp: '2024-10-12T...',
      metadata: {...}
    }
  ],
  createdAt: Timestamp,
  lastUpdatedAt: Timestamp,
  completedAt: Timestamp
}
```

### 3. Enhanced Cost Tracking Service

**New Parameter:** `sessionId` (optional)

```javascript
await CostTrackingService.recordUsage({
  userId,
  usageType: 'ApiUsage',
  feature: 'google_maps_autocomplete',
  cost: API_COSTS.GOOGLE_MAPS.PLACES_AUTOCOMPLETE.PER_REQUEST,
  provider: 'google_maps',
  sessionId: 'session_xyz', // NEW - links to session
  metadata: { input: 'pizza' }
});
```

**New Methods:**
- `CostTrackingService.finalizeSession(userId, sessionId)` - Mark session as complete
- `CostTrackingService.getSession(userId, sessionId)` - Get session details
- `CostTrackingService.getUserSessions(userId, options)` - List user sessions

### 4. Updated Places Service

**Changes:**
- Uses `API_COSTS` constants instead of hardcoded values
- Accepts optional `sessionId` parameter
- Automatically finalizes session after Place Details call

**Usage:**
```javascript
// Server-side
const sessionId = `session_${Date.now()}`;

// Step 1: Autocomplete
await PlacesService.searchPlaces(userId, {
  input: 'pizza',
  sessiontoken: 'token_123',
  sessionId // Pass session ID
});

// Step 2: Details (automatically finalizes session)
await PlacesService.getPlaceDetails(userId, {
  place_id: 'ChIJ...',
  sessiontoken: 'token_123',
  sessionId // Same session ID
});
```

## Migration Steps

### For Existing Code

**1. No changes required for basic usage**
The `recordUsage()` method is backward compatible. Existing code will continue to work without modifications.

**2. To add session tracking:**

```javascript
// Generate a session ID (client or server)
const sessionId = `session_${Date.now()}_${userId}`;

// Pass it to all related API calls
await CostTrackingService.recordUsage({
  // ... existing params
  sessionId // Add this
});

// Finalize when done
await CostTrackingService.finalizeSession(userId, sessionId);
```

### For New APIs

**1. Add pricing to `apiCosts.js`:**

```javascript
export const API_COSTS = {
  // ... existing APIs
  PINECONE: {
    QUERY: {
      PER_1000: 0.00,
      PER_REQUEST: 0.00
    },
    UPSERT: {
      PER_1000: 0.00,
      PER_REQUEST: 0.00
    }
  }
};
```

**2. Create a service (e.g., `pineconeService.js`):**

```javascript
import { CostTrackingService } from './costTrackingService.js';
import { API_COSTS } from '../../../services/constants/apiCosts.js';

export class PineconeService {
  static async query(userId, { vector, sessionId = null }) {
    // Call Pinecone API
    const results = await pinecone.query(vector);

    // Track cost
    await CostTrackingService.recordUsage({
      userId,
      usageType: 'ApiUsage',
      feature: 'pinecone_query',
      cost: API_COSTS.PINECONE.QUERY.PER_REQUEST,
      provider: 'pinecone',
      sessionId,
      metadata: { resultCount: results.length }
    });

    return results;
  }
}
```

## Benefits

### 1. **Better Analytics**
- Track complete user workflows, not just individual API calls
- Understand the full cost of features (e.g., "search with autocomplete")
- Identify abandoned sessions (user typed but didn't select)

### 2. **Improved Cost Management**
- Centralized pricing makes updates easier
- Session totals show real feature costs
- Better budgeting and forecasting

### 3. **Scalability**
- Easy to add new APIs (just add to constants)
- Consistent pattern for all services
- Clear separation of concerns

### 4. **Maintainability**
- Smaller, focused files
- Well-documented structure
- Easy to test individual components

## Database Collections

### Existing Collections (unchanged)
- `AIUsage/{userId}/monthly/{YYYY-MM}` - AI monthly summaries
- `AIUsage/{userId}/operations/{operationId}` - Individual AI operations
- `ApiUsage/{userId}/monthly/{YYYY-MM}` - API monthly summaries
- `ApiUsage/{userId}/operations/{operationId}` - Individual API operations

### New Collection
- `SessionUsage/{userId}/sessions/{sessionId}` - Multi-step operation sessions

## Future Enhancements

1. **Client-side session generation**
   - Generate sessionId in React hooks
   - Pass through API routes automatically

2. **Session timeout handling**
   - Auto-mark sessions as "abandoned" after N hours
   - Cleanup old incomplete sessions

3. **Advanced analytics**
   - Session completion rates
   - Average cost per completed session
   - Feature usage funnels

4. **Cost optimization**
   - Identify expensive patterns
   - Suggest caching opportunities
   - Alert on unusual spending

## Questions?

For implementation questions or issues, refer to:
- [costTrackingService.js](./costTrackingService.js) - Main service with examples
- [sessionService.js](./costTracking/sessionService.js) - Session tracking logic
- [apiCosts.js](../../constants/apiCosts.js) - Pricing constants
- [COST_TRACKING_MIGRATION_GUIDE.md](./COST_TRACKING_MIGRATION_GUIDE.md) - Original migration guide
