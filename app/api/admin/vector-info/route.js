// app/api/admin/vector-info/route.js - FINAL, GUARANTEED FIX
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { VectorService } from '../../../../lib/services/serviceContact/server/vectorService.js';

export async function GET(request) {
    try {
        console.log('📊 GET /api/admin/vector-info - Getting REAL vector information from Pinecone');

        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        await adminAuth.verifyIdToken(token);
        
        const url = new URL(request.url);
        const userId = url.searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const userDoc = await adminDb.collection('AccountData').doc(userId).get();
        if (!userDoc.exists) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const userData = userDoc.data();
        const subscriptionTier = userData.accountType?.toLowerCase() || 'base';
        const hasVectorSupport = ['premium', 'business', 'enterprise'].includes(subscriptionTier);

        let vectorInfo = {
            vectorsStored: 0,
            pineconeIndexStatus: hasVectorSupport ? 'unknown' : 'not_supported',
            vectorDimensions: 0,
            subscriptionTier,
            hasVectorSupport,
            totalContacts: 0,
            vectorPercentage: 0
        };

        const contactsDoc = await adminDb.collection('Contacts').doc(userId).get();
        if (contactsDoc.exists) {
            vectorInfo.totalContacts = (contactsDoc.data().contacts || []).length;
        }

        if (hasVectorSupport) {
            try {
                const stats = await VectorService.getIndexStats();
                
                if (stats) {
                    vectorInfo.pineconeIndexStatus = 'ready';
                    vectorInfo.vectorDimensions = stats.dimension || 768;
                    const userNamespace = `user_${userId}`;

                    if (stats.namespaces && stats.namespaces[userNamespace]) {
                        // ✅ THE FINAL FIX: Use "recordCount" instead of "vectorCount"
                        vectorInfo.vectorsStored = stats.namespaces[userNamespace].recordCount || 0;
                    } else {
                        vectorInfo.vectorsStored = 0; 
                    }
                } else {
                     vectorInfo.pineconeIndexStatus = 'initializing';
                }
            
            } catch (vectorError) {
                console.warn(`Could not fetch vector metadata for user ${userId}:`, vectorError.message);
                vectorInfo.pineconeIndexStatus = 'error';
            }
        }
        
        if (vectorInfo.totalContacts > 0) {
            vectorInfo.vectorPercentage = (vectorInfo.vectorsStored / vectorInfo.totalContacts) * 100;
        } else {
            vectorInfo.vectorPercentage = 0;
        }

        console.log('✅ Vector info retrieved FROM PINECONE (Correct Key):', {
            userId,
            vectorsStored: vectorInfo.vectorsStored,
            totalContacts: vectorInfo.totalContacts,
            coverage: `${vectorInfo.vectorPercentage.toFixed(1)}%`
        });

        return NextResponse.json(vectorInfo);

    } catch (error) {
        console.error('❌ Error getting vector info:', error);
        return NextResponse.json({ 
            error: 'Failed to get vector information',
            details: error.message 
        }, { status: 500 });
    }
}