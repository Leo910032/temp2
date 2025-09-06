// lib/firebaseAdmin.js - FIXED VERSION
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

let adminApp, adminAuth, adminDb;

// Only initialize on server-side
if (typeof window === 'undefined') {
    try {
        if (getApps().length === 0) {
            // ✅ VALIDATION: Check all required environment variables
            const requiredEnvVars = {
                FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
                FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
                FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
                FIREBASE_CLIENT_ID: process.env.FIREBASE_CLIENT_ID,
                FIREBASE_PRIVATE_KEY_ID: process.env.FIREBASE_PRIVATE_KEY_ID,
                FIREBASE_CLIENT_CERT_URL: process.env.FIREBASE_CLIENT_CERT_URL
            };

            // Check for missing environment variables
            const missingVars = Object.entries(requiredEnvVars)
                .filter(([key, value]) => !value)
                .map(([key]) => key);

            if (missingVars.length > 0) {
                console.error('❌ Missing Firebase Admin environment variables:', missingVars);
                throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
            }

            const serviceAccount = {
                type: "service_account",
                project_id: process.env.FIREBASE_PROJECT_ID,
                private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
                private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                client_email: process.env.FIREBASE_CLIENT_EMAIL,
                client_id: process.env.FIREBASE_CLIENT_ID,
                auth_uri: "https://accounts.google.com/o/oauth2/auth",
                token_uri: "https://oauth2.googleapis.com/token",
                auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
                client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
                universe_domain: "googleapis.com"
            };

            // ✅ DEBUG: Log service account (without private key for security)
            console.log('🔍 Service Account Debug:', {
                project_id: serviceAccount.project_id,
                client_email: serviceAccount.client_email,
                hasPrivateKey: !!serviceAccount.private_key,
                private_key_length: serviceAccount.private_key?.length
            });

            adminApp = initializeApp({
                credential: cert(serviceAccount),
                projectId: process.env.FIREBASE_PROJECT_ID,
                storageBucket: process.env.NEXT_PUBLIC_storageBucket || process.env.FIREBASE_STORAGE_BUCKET,
            });
            
            console.log('✅ Firebase Admin SDK initialized successfully');
        } else {
            adminApp = getApps()[0];
        }

        adminDb = getFirestore(adminApp);
        adminAuth = getAuth(adminApp);

    } catch (error) {
        console.error('❌ Firebase Admin SDK initialization failed:', error);
        
        // ✅ FALLBACK: Create dummy exports to prevent build failures
        console.log('🔄 Creating fallback exports to prevent build failure');
        adminDb = null;
        adminAuth = null;
        
        // Don't throw error during build - let it fail gracefully at runtime
        if (process.env.NODE_ENV === 'production') {
            console.error('Production Firebase Admin initialization failed - check environment variables');
        }
    }
}

export { adminDb, adminAuth };
export default adminApp;