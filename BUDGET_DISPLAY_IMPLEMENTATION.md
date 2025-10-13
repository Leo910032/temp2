# Budget Display Implementation Summary

## Overview

Budget information is now displayed throughout the dashboard, showing users their monthly AI operation usage and cost budget in real-time.

## Implementation Details

### 1. API Endpoint
**File**: [app/api/user/budget/status/route.js](app/api/user/budget/status/route.js)

New GET endpoint that returns:
- Current cost and run usage for the month
- Maximum limits based on subscription level
- Remaining budget and runs
- Usage percentages
- Warning flags (80% and 95% thresholds)

**Endpoint**: `GET /api/user/budget/status`

**Response Structure**:
```json
{
  "success": true,
  "subscriptionLevel": "pro",
  "unlimited": false,
  "currentUsage": {
    "cost": 0.45,
    "runs": 8
  },
  "limits": {
    "maxCost": 1.5,
    "maxRuns": 15
  },
  "remaining": {
    "cost": 1.05,
    "runs": 7
  },
  "percentageUsed": {
    "cost": 30,
    "runs": 53
  },
  "month": "2025-10",
  "warnings": {
    "costWarning": false,
    "runsWarning": false,
    "costCritical": false,
    "runsCritical": false
  }
}
```

### 2. DashboardContext Enhancement
**File**: [app/dashboard/DashboardContext.js](app/dashboard/DashboardContext.js)

**New State**:
- `budgetInfo` - Budget data object
- `budgetLoading` - Loading state for budget fetch

**New Functions**:
- `fetchBudgetInfo()` - Fetches budget data from API
- `refreshBudget()` - Exposed to consumers for manual refresh

**Context Value Additions**:
```javascript
{
  budgetInfo: Object,        // Budget data
  budgetLoading: boolean,    // Loading state
  refreshBudget: function    // Refresh function
}
```

**Behavior**:
- Budget info is automatically fetched when subscription data loads
- Updates when user changes (logout/login)
- Available to all dashboard pages via `useDashboard()` hook

### 3. BudgetInfoCard Component
**File**: [app/dashboard/general components/BudgetInfoCard.jsx](app/dashboard/general components/BudgetInfoCard.jsx)

Reusable component that displays budget information with:
- **Progress bars** for runs and cost
- **Color-coded warnings**:
  - Green: 0-79% usage
  - Yellow: 80-94% usage
  - Red: 95-100% usage
- **Remaining capacity display**
- **Upgrade prompt** when approaching limits
- **Unlimited badge** for Enterprise users
- **Responsive design** with compact mode option

**Props**:
```javascript
<BudgetInfoCard
  budgetInfo={budgetInfo}     // Budget data object
  budgetLoading={boolean}      // Loading state
  compact={boolean}            // Compact layout (optional)
/>
```

### 4. Contacts Page Integration
**File**: [app/dashboard/(dashboard pages)/contacts/page.jsx](app/dashboard/(dashboard pages)/contacts/page.jsx:226-231)

Budget card is displayed:
- After the page title/subtitle
- Before the stats cards
- Shows real-time usage for AI operations

## Usage in Other Pages

To add budget display to any dashboard page:

```javascript
// 1. Import the component
import BudgetInfoCard from '../../general components/BudgetInfoCard';

// 2. Get budget info from context
function MyPage() {
  const { budgetInfo, budgetLoading } = useDashboard();

  return (
    <div>
      {/* Your page header */}

      {/* Budget display */}
      <BudgetInfoCard
        budgetInfo={budgetInfo}
        budgetLoading={budgetLoading}
        compact={false}
      />

      {/* Rest of your page */}
    </div>
  );
}
```

## Visual States

### Unlimited (Enterprise)
```
┌─────────────────────────────────────┐
│ ✨ Unlimited Usage                  │
│ Your enterprise plan includes       │
│ unlimited AI operations             │
└─────────────────────────────────────┘
```

### Normal Usage (< 80%)
```
┌─────────────────────────────────────┐
│ 💰 Monthly Usage          2025-10   │
│                                     │
│ AI Operations              8 / 15   │
│ ████████░░░░░░░░ (53%)             │
│                                     │
│ Cost Budget          $0.45 / $1.50 │
│ ████░░░░░░░░░░░░ (30%)             │
└─────────────────────────────────────┘
```

### Warning State (80-94%)
```
┌─────────────────────────────────────┐
│ 💰 Monthly Usage          2025-10   │
│                                     │
│ AI Operations             13 / 15   │
│ ████████████████ (87%)             │
│ ⚠️ Only 2 operations remaining      │
│                                     │
│ Cost Budget          $1.25 / $1.50 │
│ ████████████████ (83%)             │
│ ⚠️ $0.25 remaining                  │
└─────────────────────────────────────┘
```

### Critical State (≥95%)
```
┌─────────────────────────────────────┐
│ 💰 Monthly Usage          2025-10   │
│                                     │
│ AI Operations             15 / 15   │
│ ████████████████████ (100%)        │
│ ❌ Monthly limit reached            │
│                                     │
│ Cost Budget          $1.48 / $1.50 │
│ ████████████████████ (99%)         │
│                                     │
│ Consider upgrading for more         │
│ capacity                            │
│ ┌─────────────────────────────────┐ │
│ │      Upgrade Plan               │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

## Data Flow

```
User Operation
    ↓
CostTrackingService.recordUsage()
    ↓
Updates users/{userId} document
    ↓
(Real-time) Firestore listener in DashboardContext (optional)
    ↓
fetchBudgetInfo() triggered
    ↓
GET /api/user/budget/status
    ↓
SessionManager.getRemainingBudget()
    ↓
Reads from users/{userId} document
    ↓
Returns to client
    ↓
Updates budgetInfo state
    ↓
BudgetInfoCard re-renders with new data
```

## Benefits

✅ **Available everywhere** - All dashboard pages can access via `useDashboard()`
✅ **Real-time tracking** - Uses real-time user document fields
✅ **Visual warnings** - Color-coded progress bars alert users before limits
✅ **Reusable component** - Single component for consistent UX
✅ **Performance** - Cached in DashboardContext, fetched once per session
✅ **Responsive** - Works on mobile and desktop
✅ **Enterprise-friendly** - Special handling for unlimited plans

## Future Enhancements

### Suggested Improvements:
1. **Real-time updates**: Add Firestore listener to refresh when `monthlyTotalCost` or `monthlyBillableRuns` change
2. **Historical chart**: Show usage trends over past months
3. **Upgrade flow**: Link upgrade button to subscription management
4. **Email alerts**: Notify users when approaching 80% and 95% limits
5. **Per-feature breakdown**: Show which features are using the most budget
6. **Prediction**: Estimate when user will hit limits based on current usage rate

### Optional Real-Time Listener:
Add to DashboardContext.js to automatically refresh budget when it changes:

```javascript
useEffect(() => {
  if (!currentUser?.uid) return;

  const db = getFirestore(app);
  const userRef = doc(db, 'users', currentUser.uid);

  const unsubscribe = onSnapshot(userRef, (docSnapshot) => {
    if (docSnapshot.exists()) {
      const userData = docSnapshot.data();
      const currentMonth = new Date().toISOString().slice(0, 7);

      // Refresh if usage data changed for current month
      if (userData.monthlyUsageMonth === currentMonth) {
        fetchBudgetInfo();
      }
    }
  });

  return () => unsubscribe();
}, [currentUser?.uid, fetchBudgetInfo]);
```

## Testing

To test the implementation:

1. **As Pro user (15 runs, $1.50 budget)**:
   - Perform AI operations (semantic search, business card scan)
   - Watch progress bars update
   - Verify warnings at 12+ runs (80%)
   - Verify critical state at 15 runs

2. **As Enterprise user**:
   - Verify "Unlimited Usage" badge shows
   - Confirm no progress bars displayed

3. **Budget refresh**:
   - Call `refreshBudget()` from context
   - Verify data updates

4. **Month rollover**:
   - Change system date to next month
   - Verify counters reset to 0

## Related Files

- [lib/services/core/constants.js](lib/services/core/constants.js) - Budget limit constants
- [lib/services/serviceContact/server/costTracking/costTrackingService.js](lib/services/serviceContact/server/costTracking/costTrackingService.js) - Usage tracking
- [lib/server/session.js](lib/server/session.js) - SessionManager with budget methods
- [BUDGET_CHECK_USAGE_GUIDE.md](BUDGET_CHECK_USAGE_GUIDE.md) - API usage guide
