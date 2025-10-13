# Session Tracking Fix: User Document Updates

## Problem Identified

When business card scanning (or any session-based operation) was executed, the cost tracking was recording data to `SessionUsage` collection but **NOT updating the user document** with the billing fields needed for budget tracking.

### Root Cause

In `costTrackingService.js` (lines 64-86), when a `sessionId` was provided, the code would:
1. ✅ Record to SessionUsage collection
2. ❌ Return immediately without updating user document
3. ❌ Skip lines 185-219 that update `monthlyTotalCost` and `monthlyBillableRuns`

```javascript
// OLD CODE - Problematic
if (sessionId) {
  await SessionTrackingService.addStepToSession({ ... });
  return { success: true };  // ← Returns here, never updates user doc!
}

// User document update code was here (lines 185-219)
// But it never ran for session-based operations!
```

### Evidence from Logs

```
💰 bgtfrdsZ [usage_1760380378785_zrix] Recording AIUsage: {
  sessionId: 'session_scan_1760380376660_72r1'  ← Session ID present
}
📋 [CostTracking] Session-based operation - recording ONLY in SessionUsage
✅ [CostTracking] Session operation recorded  ← Returned here
```

Result: User document in Firestore had **no billing fields** (`monthlyTotalCost`, `monthlyBillableRuns`, etc.)

## Solution Implemented

### Changes Made

**File**: `lib/services/serviceContact/server/costTracking/costTrackingService.js` (lines 86-128)

Added logic to **ALSO** update the user document when recording session-based operations:

```javascript
if (sessionId) {
  // 1. Record to SessionUsage (as before)
  await SessionTrackingService.addStepToSession({ ... });

  // 2. ✅ NEW: ALSO update user document for billing
  if (isBillableRun || safeCost > 0) {
    const userDocRef = adminDb.collection('users').doc(userId);

    await adminDb.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userDocRef);
      const userData = userDoc.exists ? userDoc.data() : {};
      const needsReset = userData.monthlyUsageMonth !== currentMonth;

      if (needsReset) {
        // Reset counters for new month
        transaction.set(userDocRef, {
          monthlyTotalCost: safeCost,
          monthlyBillableRuns: isBillableRun ? 1 : 0,
          monthlyUsageMonth: currentMonth,
          monthlyUsageLastUpdated: FieldValue.serverTimestamp()
        }, { merge: true });
      } else {
        // Increment existing counters
        const updateData = {
          monthlyTotalCost: FieldValue.increment(safeCost),
          monthlyUsageLastUpdated: FieldValue.serverTimestamp()
        };
        if (isBillableRun) {
          updateData.monthlyBillableRuns = FieldValue.increment(1);
        }
        transaction.update(userDocRef, updateData);
      }
    });
  }

  return { success: true, operationId, recordedIn: 'SessionUsage+UserDoc' };
}
```

### What Changed

| Aspect | Before | After |
|--------|--------|-------|
| **SessionUsage recording** | ✅ Yes | ✅ Yes |
| **User document update** | ❌ No | ✅ Yes (for billable ops) |
| **Budget tracking** | ❌ Broken | ✅ Works |
| **Cost accumulation** | ❌ Not tracked | ✅ Tracked in real-time |
| **Run counting** | ❌ Not tracked | ✅ Tracked in real-time |

### Key Features

1. **Atomic Updates**: Uses `FieldValue.increment()` to prevent race conditions
2. **Month Rollover**: Automatically resets counters when month changes
3. **Error Handling**: User doc update failure doesn't break session tracking
4. **Conditional Logic**: Only updates for billable operations or operations with cost
5. **Logging**: Clear console logs for debugging

## Expected Behavior After Fix

### When Scanning a Business Card

**Console Logs** (new):
```
📋 [CostTracking] Session-based operation - recording in SessionUsage
✅ [CostTracking] Session operation recorded in SessionUsage
💰 [CostTracking] Updating user document for billable session operation
✅ [CostTracking] User document updated: cost=$0.000108, billableRun=true
```

**Firestore `users/{userId}` Document** (new fields added):
```javascript
{
  // ... existing fields ...

  // ✅ NEW FIELDS:
  monthlyTotalCost: 0.000108,           // AI cost from Gemini
  monthlyBillableRuns: 1,                // 1 AI-enhanced scan
  monthlyUsageMonth: "2025-10",          // Current month
  monthlyUsageLastUpdated: Timestamp     // Last update time
}
```

**SessionUsage Collection** (still works as before):
```javascript
{
  sessionId: "session_scan_...",
  status: "completed",
  totalCost: 0.00160785,  // OCR + AI
  totalRuns: 1,
  steps: [
    { feature: "business_card_scan_ocr", cost: 0.0015, isBillableRun: false },
    { feature: "business_card_scan", cost: 0.000108, isBillableRun: true }
  ]
}
```

## Testing Instructions

### 1. Clear Previous Data (Optional)
If you want a clean test, delete these fields from your user document:
```
monthlyTotalCost
monthlyBillableRuns
monthlyUsageMonth
monthlyUsageLastUpdated
```

### 2. Scan a Business Card
1. Go to Contacts page
2. Click "Scan Business Card"
3. Upload/capture a business card image
4. Wait for processing to complete

### 3. Verify in Firestore Console
Navigate to: `users/{your-user-id}`

**Expected fields** (should now exist):
```
monthlyTotalCost: 0.000108 (or similar small number)
monthlyBillableRuns: 1
monthlyUsageMonth: "2025-10"
monthlyUsageLastUpdated: [recent timestamp]
```

### 4. Verify in Dashboard
1. Go to Contacts page
2. Look for the Budget Info Card (below the page title)
3. Should display:
   - "AI Operations: 1 / 30" (for Premium users)
   - "$0.00 / $3.00" (for Premium users)
   - Progress bars showing usage

### 5. Test Multiple Scans
1. Scan another business card
2. Check that counters increment:
   - `monthlyBillableRuns: 2`
   - `monthlyTotalCost: ~0.000216`
3. Dashboard should update to show "2 / 30"

## Impact on Other Features

### Features That Will Now Work Correctly

✅ **Budget Display in Dashboard**
- Shows real-time usage
- Progress bars update immediately
- Warnings appear when approaching limits

✅ **Pre-flight Budget Checks**
- `canAffordOperation()` now has accurate data
- Prevents operations when budget exceeded
- Shows correct remaining budget/runs

✅ **All Session-Based Operations**
- Business card scanning (single & double-sided)
- Any future multi-step AI operations using sessions

### Features Not Affected

✅ **Standalone Operations**
Operations without `sessionId` already worked (unchanged)

✅ **Session Tracking**
SessionUsage collection still tracks all steps (unchanged)

✅ **Historical Analytics**
AIUsage/ApiUsage collections still work for detailed analytics

## Benefits

1. **Real-time Tracking**: Budget info updates immediately after each operation
2. **Accurate Limits**: Users can't exceed their monthly allowance
3. **Better UX**: Users see their usage in the dashboard
4. **Prevents Overuse**: Pre-flight checks stop operations before they start
5. **Month Rollover**: Automatically resets on the 1st of each month
6. **Thread-safe**: Atomic increments prevent race conditions

## Backward Compatibility

✅ **Fully backward compatible**
- Existing AIUsage/ApiUsage collections untouched
- SessionUsage collection still works
- No breaking changes to existing code
- New fields added to user document only (won't break existing logic)

## Future Enhancements

Potential improvements for later:
1. Add real-time Firestore listener to refresh budget display automatically
2. Add email alerts at 80% and 95% usage
3. Show historical usage chart (past 6 months)
4. Add per-feature cost breakdown in dashboard
5. Implement usage prediction ("You'll hit your limit in X days")

## Related Files

- **Modified**: [lib/services/serviceContact/server/costTracking/costTrackingService.js](lib/services/serviceContact/server/costTracking/costTrackingService.js:86-128)
- **Budget API**: [app/api/user/budget/status/route.js](app/api/user/budget/status/route.js)
- **Budget Display**: [app/dashboard/general components/BudgetInfoCard.jsx](app/dashboard/general components/BudgetInfoCard.jsx)
- **Context**: [app/dashboard/DashboardContext.js](app/dashboard/DashboardContext.js)
- **Session Manager**: [lib/server/session.js](lib/server/session.js:270-378)
- **Constants**: [lib/services/core/constants.js](lib/services/core/constants.js:67-85)

## Rollback Instructions

If you need to revert this change:

```javascript
// In costTrackingService.js, replace lines 86-128 with:
if (sessionId) {
  await SessionTrackingService.addStepToSession({ ... });
  return { success: true, operationId, recordedIn: 'SessionUsage' };
}
```

This restores the original behavior (session tracking only, no user doc updates).
