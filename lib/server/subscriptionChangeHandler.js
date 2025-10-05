// lib/server/subscriptionChangeHandler.js
/**
 * Handler for subscription level changes
 * This can be used in Firestore triggers or called directly when subscription changes
 */

/**
 * Calls the webhook to revalidate user's page when subscription changes
 * @param {string} userId - The user's ID
 * @param {string} username - The user's username
 * @param {string} oldLevel - Previous subscription level
 * @param {string} newLevel - New subscription level
 * @returns {Promise<boolean>} - Success status
 */
export async function handleSubscriptionChange({ userId, username, oldLevel, newLevel }) {
    try {
        console.log('🔔 [Subscription Change Handler] Detected change:', {
            userId,
            username,
            oldLevel,
            newLevel
        });

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                       process.env.NEXT_PUBLIC_APP_URL ||
                       'http://localhost:3000';

        const webhookUrl = `${baseUrl}/api/webhooks/subscription-change`;
        const webhookSecret = process.env.WEBHOOK_SECRET || process.env.REVALIDATION_SECRET;

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${webhookSecret}`
            },
            body: JSON.stringify({
                userId,
                username,
                oldSubscriptionLevel: oldLevel,
                newSubscriptionLevel: newLevel
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Webhook call failed:', errorText);
            return false;
        }

        const result = await response.json();
        console.log('✅ Subscription change webhook successful:', result);
        return true;

    } catch (error) {
        console.error('❌ Error calling subscription change webhook:', error);
        return false;
    }
}

/**
 * Determines if subscription change affects appearance features
 * @param {string} oldLevel - Previous subscription level
 * @param {string} newLevel - New subscription level
 * @returns {boolean} - True if features are affected
 */
export function affectsAppearanceFeatures(oldLevel, newLevel) {
    // Normalize levels
    const old = oldLevel?.toLowerCase() || 'base';
    const newL = newLevel?.toLowerCase() || 'base';

    // Features that are affected by subscription changes
    const premiumFeatures = ['pro', 'premium', 'business', 'enterprise'];

    const hadPremium = premiumFeatures.includes(old);
    const hasPremium = premiumFeatures.includes(newL);

    // Return true if premium status changed (either gained or lost)
    return hadPremium !== hasPremium;
}

/**
 * Example: Firestore trigger function (for Cloud Functions)
 * This would go in your Firebase Cloud Functions file
 *
 * EXAMPLE IMPLEMENTATION:
 *
 * import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
 * import { handleSubscriptionChange, affectsAppearanceFeatures } from './subscriptionChangeHandler';
 *
 * export const onUserSubscriptionChange = onDocumentUpdated(
 *     'users/{userId}',
 *     async (event) => {
 *         const beforeData = event.data.before.data();
 *         const afterData = event.data.after.data();
 *         const userId = event.params.userId;
 *
 *         const oldLevel = beforeData.subscriptionLevel;
 *         const newLevel = afterData.subscriptionLevel;
 *
 *         // Only trigger if subscription level changed and affects features
 *         if (oldLevel !== newLevel && affectsAppearanceFeatures(oldLevel, newLevel)) {
 *             await handleSubscriptionChange({
 *                 userId,
 *                 username: afterData.username,
 *                 oldLevel,
 *                 newLevel
 *             });
 *         }
 *     }
 * );
 */
