// app/api/webhooks/subscription-change/route.js
/**
 * Webhook endpoint to handle subscription level changes
 * This endpoint should be called when a user's subscription changes
 * It will revalidate the user's static page to ensure proper permission checks
 */

import { NextResponse } from 'next/server';
import { revalidateUserPage } from '@/lib/server/revalidation';
import { adminDb } from '@/lib/firebaseAdmin';

export async function POST(request) {
    try {
        // Verify the webhook secret for security
        const authHeader = request.headers.get('authorization');
        const expectedSecret = process.env.WEBHOOK_SECRET || process.env.REVALIDATION_SECRET;

        if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
            console.error('❌ Unauthorized webhook request - invalid secret');
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { userId, username, oldSubscriptionLevel, newSubscriptionLevel } = body;

        if (!userId && !username) {
            return NextResponse.json(
                { error: 'userId or username is required' },
                { status: 400 }
            );
        }

        console.log('🔄 [Subscription Change Webhook] Processing:', {
            userId,
            username,
            oldLevel: oldSubscriptionLevel,
            newLevel: newSubscriptionLevel
        });

        // Get username if not provided
        let targetUsername = username;
        if (!targetUsername && userId) {
            const userDoc = await adminDb.collection('users').doc(userId).get();
            if (userDoc.exists) {
                targetUsername = userDoc.data().username;
            }
        }

        if (!targetUsername) {
            return NextResponse.json(
                { error: 'Could not determine username for revalidation' },
                { status: 400 }
            );
        }

        // Revalidate the user's public page
        const revalidated = await revalidateUserPage(targetUsername);

        if (revalidated) {
            console.log(`✅ Successfully revalidated page for ${targetUsername} after subscription change`);
            return NextResponse.json({
                success: true,
                message: `Page revalidated for ${targetUsername}`,
                username: targetUsername,
                revalidated: true
            });
        } else {
            console.error(`❌ Failed to revalidate page for ${targetUsername}`);
            return NextResponse.json({
                success: false,
                message: `Failed to revalidate page for ${targetUsername}`,
                username: targetUsername,
                revalidated: false
            }, { status: 500 });
        }

    } catch (error) {
        console.error('❌ Error in subscription change webhook:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}
