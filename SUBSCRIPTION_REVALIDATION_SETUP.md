# Subscription Change Revalidation Setup

This document explains how to set up automatic page revalidation when a user's subscription level changes.

## Overview

When a user's subscription level changes (e.g., from Pro to Base, or Base to Premium), their public profile page needs to be revalidated to ensure that premium features like Carousel and Video Embed are properly shown or hidden based on their current subscription tier.

## Components Created

### 1. Webhook Endpoint
**File:** `app/api/webhooks/subscription-change/route.js`

This endpoint handles subscription change notifications and triggers page revalidation.

**Usage:**
```bash
POST /api/webhooks/subscription-change
Authorization: Bearer YOUR_WEBHOOK_SECRET
Content-Type: application/json

{
  "userId": "user_id_here",
  "username": "username_here",
  "oldSubscriptionLevel": "base",
  "newSubscriptionLevel": "pro"
}
```

### 2. Subscription Change Handler
**File:** `lib/server/subscriptionChangeHandler.js`

Helper functions for handling subscription changes.

**Functions:**
- `handleSubscriptionChange()` - Calls the webhook to trigger revalidation
- `affectsAppearanceFeatures()` - Checks if the change affects premium features

### 3. Permission Checks on Public Profile
**Files Modified:**
- `lib/server/fetchProfileData.js` - Now includes `subscriptionLevel` in profile data
- `app/[userId]/components/MyLinks.jsx` - Checks permissions before rendering carousel and video embed

## Implementation Options

### Option 1: Firestore Trigger (Recommended)

Create a Firebase Cloud Function that listens to user document changes:

```javascript
// functions/index.js
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { handleSubscriptionChange, affectsAppearanceFeatures } from './subscriptionChangeHandler';

export const onUserSubscriptionChange = onDocumentUpdated(
    'users/{userId}',
    async (event) => {
        const beforeData = event.data.before.data();
        const afterData = event.data.after.data();
        const userId = event.params.userId;

        const oldLevel = beforeData.subscriptionLevel;
        const newLevel = afterData.subscriptionLevel;

        // Only trigger if subscription level changed and affects features
        if (oldLevel !== newLevel && affectsAppearanceFeatures(oldLevel, newLevel)) {
            await handleSubscriptionChange({
                userId,
                username: afterData.username,
                oldLevel,
                newLevel
            });
        }
    }
);
```

**Steps to Deploy:**
1. Initialize Firebase Functions in your project:
   ```bash
   firebase init functions
   ```

2. Copy the handler code to your functions directory

3. Deploy the function:
   ```bash
   firebase deploy --only functions:onUserSubscriptionChange
   ```

### Option 2: Manual Trigger

If you update subscriptions programmatically, call the handler directly:

```javascript
import { handleSubscriptionChange } from '@/lib/server/subscriptionChangeHandler';

// After updating subscription in your code
async function updateUserSubscription(userId, newLevel) {
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();
    const userData = userDoc.data();
    const oldLevel = userData.subscriptionLevel;

    // Update subscription
    await userRef.update({ subscriptionLevel: newLevel });

    // Trigger revalidation
    await handleSubscriptionChange({
        userId,
        username: userData.username,
        oldLevel,
        newLevel
    });
}
```

### Option 3: Vercel Cron Job

Create a cron job that periodically checks for subscription changes:

**File:** `app/api/cron/check-subscriptions/route.js`

```javascript
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { handleSubscriptionChange } from '@/lib/server/subscriptionChangeHandler';

export async function GET(request) {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Query users with recent subscription changes
        // This assumes you have a 'subscriptionChangedAt' field
        const cutoffTime = new Date(Date.now() - 60 * 60 * 1000); // Last hour

        const snapshot = await adminDb.collection('users')
            .where('subscriptionChangedAt', '>', cutoffTime)
            .get();

        const revalidations = [];
        for (const doc of snapshot.docs) {
            const data = doc.data();
            revalidations.push(
                handleSubscriptionChange({
                    userId: doc.id,
                    username: data.username,
                    oldLevel: data.previousSubscriptionLevel,
                    newLevel: data.subscriptionLevel
                })
            );
        }

        await Promise.all(revalidations);

        return NextResponse.json({
            success: true,
            processed: revalidations.length
        });
    } catch (error) {
        console.error('Cron job error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
```

**Then add to `vercel.json`:**
```json
{
  "crons": [
    {
      "path": "/api/cron/check-subscriptions",
      "schedule": "0 * * * *"
    }
  ]
}
```

## Environment Variables

Add these to your `.env.local` and Vercel environment variables:

```bash
# For webhook authentication
WEBHOOK_SECRET=your-secure-random-secret-here

# For cron jobs (if using Option 3)
CRON_SECRET=your-cron-secret-here

# Revalidation secret (already exists)
REVALIDATION_SECRET=your-revalidation-secret
```

## How It Works

1. **User subscription changes** (via Stripe webhook, admin panel, etc.)
2. **Trigger fires** (Firestore trigger, manual call, or cron job)
3. **Webhook is called** (`/api/webhooks/subscription-change`)
4. **Page is revalidated** (via `/api/revalidate`)
5. **Next.js rebuilds** the static page with fresh data
6. **Permission checks** in `MyLinks.jsx` hide/show premium features based on current subscription

## Permission Checks

The public profile now checks permissions before rendering:

```javascript
// In MyLinks.jsx
const canUseCarousel = hasAppearanceFeature(subscriptionLevel, APPEARANCE_FEATURES.CUSTOM_CAROUSEL);
const canUseVideoEmbed = hasAppearanceFeature(subscriptionLevel, APPEARANCE_FEATURES.CUSTOM_VIDEO_EMBED);

// Only render if user has permission
if (canUseCarousel && carouselEnabled && carouselItems.length > 0) {
    // Render carousel
}

if (canUseVideoEmbed && videoEmbedEnabled && videoEmbedItems.length > 0) {
    // Render video embed
}
```

## Subscription Limits

- **Base**: No carousel, no video embed
- **Pro**: Up to 3 carousel items, up to 3 video embeds
- **Premium**: Up to 5 carousel items, up to 5 video embeds
- **Business**: Up to 5 carousel items, up to 5 video embeds
- **Enterprise**: Up to 10 carousel items, up to 10 video embeds

## Testing

1. **Test permission checks locally:**
   ```bash
   # Change a user's subscription level in Firestore
   # Visit their public profile at /{username}
   # Verify carousel/video embed shows/hides correctly
   ```

2. **Test webhook manually:**
   ```bash
   curl -X POST http://localhost:3000/api/webhooks/subscription-change \
     -H "Authorization: Bearer YOUR_WEBHOOK_SECRET" \
     -H "Content-Type: application/json" \
     -d '{
       "userId": "test_user_id",
       "username": "testuser",
       "oldSubscriptionLevel": "base",
       "newSubscriptionLevel": "pro"
     }'
   ```

3. **Verify revalidation:**
   - Check server logs for revalidation messages
   - Visit the user's profile page and verify it's updated
   - Check that premium features appear/disappear correctly

## Troubleshooting

**Issue: Page not revalidating**
- Check that `WEBHOOK_SECRET` is set correctly
- Verify webhook logs in Vercel/server console
- Ensure `/api/revalidate` endpoint is working

**Issue: Features still showing after downgrade**
- Clear Next.js cache: `rm -rf .next`
- Rebuild: `npm run build`
- Check that `subscriptionLevel` is correctly saved in Firestore

**Issue: Trigger not firing**
- Verify Firestore trigger is deployed: `firebase functions:list`
- Check Firebase Functions logs: `firebase functions:log`
- Ensure field name is exactly `subscriptionLevel`

## Best Practices

1. **Always validate subscription on the server** - Never trust client-side checks alone
2. **Log all subscription changes** - Keep an audit trail in Firestore
3. **Handle failures gracefully** - If revalidation fails, retry or log for manual review
4. **Test thoroughly** - Verify all subscription tier combinations work correctly
5. **Monitor performance** - Watch for excessive revalidation calls

## Future Improvements

- Add retry logic for failed revalidations
- Implement batch revalidation for multiple users
- Add analytics for subscription change patterns
- Create admin dashboard to manually trigger revalidations
- Add email notifications when premium features are removed due to downgrade
