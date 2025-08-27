
// app/api/admin/migrate-account-types/route.js
// ⚠️ ADMIN ONLY - Migration script to add accountType to existing users

import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { isServerAdmin } from '@/lib/serverAdminAuth';

export async function POST(request) {
    try {
        // ✅ ADMIN AUTHENTICATION
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);

        if (!isServerAdmin(decodedToken.email)) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const { dryRun = true } = await request.json();

        console.log(`🔄 Starting account type migration (dryRun: ${dryRun})`);

        // Get all users from AccountData collection
        const usersSnapshot = await adminDb.collection('AccountData').get();
        const migrationStats = {
            total: 0,
            needsMigration: 0,
            alreadyHasAccountType: 0,
            migrated: 0,
            errors: 0
        };

        const batch = adminDb.batch();
        let batchCount = 0;
        const maxBatchSize = 500; // Firestore batch limit

        for (const doc of usersSnapshot.docs) {
            migrationStats.total++;
            const userData = doc.data();

            // Check if user already has accountType
            if (userData.accountType) {
                migrationStats.alreadyHasAccountType++;
                console.log(`✅ User ${doc.id} already has accountType: ${userData.accountType}`);
                continue;
            }

            migrationStats.needsMigration++;

            // Determine default account type (you can customize this logic)
            let defaultAccountType = 'base';
            
            // Example: Give Pro access to users who already have analytics data
            try {
                const analyticsDoc = await adminDb.collection('Analytics').doc(doc.id).get();
                if (analyticsDoc.exists) {
                    const analyticsData = analyticsDoc.data();
                    // If user has significant analytics data, give them Pro access
                    if ((analyticsData.totalViews || 0) > 10 || (analyticsData.totalClicks || 0) > 5) {
                        defaultAccountType = 'pro';
                        console.log(`🎁 User ${doc.id} gets Pro for existing analytics data`);
                    }
                }
            } catch (error) {
                console.log(`ℹ️ No analytics data for user ${doc.id}`);
            }

            if (!dryRun) {
                // Add accountType to user document
                const userRef = adminDb.collection('AccountData').doc(doc.id);
                batch.update(userRef, { accountType: defaultAccountType });
                batchCount++;

                // Commit batch if we reach the limit
                if (batchCount >= maxBatchSize) {
                    await batch.commit();
                    console.log(`📦 Committed batch of ${batchCount} updates`);
                    batchCount = 0;
                }
            }

            migrationStats.migrated++;
            console.log(`🔄 User ${doc.id} will get accountType: ${defaultAccountType}`);
        }

        // Commit any remaining updates
        if (!dryRun && batchCount > 0) {
            await batch.commit();
            console.log(`📦 Committed final batch of ${batchCount} updates`);
        }

        const result = {
            success: true,
            dryRun,
            stats: migrationStats,
            message: dryRun 
                ? `Migration preview completed. ${migrationStats.needsMigration} users need migration.`
                : `Migration completed successfully. ${migrationStats.migrated} users updated.`
        };

        console.log('✅ Migration completed:', result);
        return NextResponse.json(result);

    } catch (error) {
        console.error('💥 Migration error:', error);
        return NextResponse.json({ 
            error: 'Migration failed', 
            details: error.message 
        }, { status: 500 });
    }
}

// GET endpoint to check migration status
export async function GET(request) {
    try {
        // ✅ ADMIN AUTHENTICATION
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);

        if (!isServerAdmin(decodedToken.email)) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        // Check how many users need migration
        const usersSnapshot = await adminDb.collection('AccountData').get();
        const stats = {
            total: 0,
            withAccountType: 0,
            withoutAccountType: 0,
            accountTypes: {}
        };

        usersSnapshot.docs.forEach(doc => {
            stats.total++;
            const userData = doc.data();
            
            if (userData.accountType) {
                stats.withAccountType++;
                stats.accountTypes[userData.accountType] = (stats.accountTypes[userData.accountType] || 0) + 1;
            } else {
                stats.withoutAccountType++;
            }
        });

        return NextResponse.json({
            stats,
            needsMigration: stats.withoutAccountType > 0
        });

    } catch (error) {
        console.error('Error checking migration status:', error);
        return NextResponse.json({ 
            error: 'Failed to check migration status', 
            details: error.message 
        }, { status: 500 });
    }
}
    