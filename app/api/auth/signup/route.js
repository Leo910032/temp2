// app/api/auth/signup/route.js - FIXED VERSION with Admin SDK
import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { validateEmail, validatePassword } from '@/lib/utilities';

// Initialize Firebase Admin SDK (only once)
if (!getApps().length) {
    initializeApp({
        credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    });
}

// Get Admin SDK instances
const adminAuth = getAuth();
const adminDb = getFirestore();

// Rate limiting
const rateLimitMap = new Map();

function getRateLimitKey(request) {
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : 
               request.headers.get('x-real-ip') || 'unknown';
    return `signup:${ip}`;
}

function isRateLimited(key) {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    const maxRequests = 3; // Max 3 signup attempts per minute
    
    if (!rateLimitMap.has(key)) {
        rateLimitMap.set(key, { count: 1, lastReset: now });
        return false;
    }
    
    const data = rateLimitMap.get(key);
    
    if (now - data.lastReset > windowMs) {
        data.count = 1;
        data.lastReset = now;
        return false;
    }
    
    if (data.count >= maxRequests) {
        return true;
    }
    
    data.count++;
    return false;
}

// Helper functions using Admin SDK
async function checkUsernameExists(username) {
    try {
        const snapshot = await adminDb.collection('AccountData')
            .where('username', '==', username.toLowerCase())
            .limit(1)
            .get();
        return !snapshot.empty;
    } catch (error) {
        console.error('Error checking username with Admin SDK:', error);
        throw error;
    }
}

async function checkEmailExists(email) {
    try {
        const user = await adminAuth.getUserByEmail(email);
        return !!user;
    } catch (error) {
        if (error.code === 'auth/user-not-found') {
            return false;
        }
        throw error;
    }
}

function validateUsername(username) {
    if (!username || typeof username !== 'string') {
        throw new Error("Username is required");
    }
    
    const clean = username.trim();
    
    if (clean.length < 3) {
        throw new Error("Username must be at least 3 characters long");
    }
    
    if (clean.length > 30) {
        throw new Error("Username must be less than 30 characters");
    }
    
    if (!/^[a-zA-Z0-9_-]+$/.test(clean)) {
        throw new Error("Username can only contain letters, numbers, underscores, and hyphens");
    }
    
    if (clean.includes(' ')) {
        throw new Error("Username cannot contain spaces");
    }
    
    return clean;
}

async function createUserDocument(uid, userData) {
    try {
        const userDoc = {
            displayName: userData.username,
            username: userData.username.toLowerCase(),
            email: userData.email.toLowerCase(),
            links: [],
            socials: [],
            profilePhoto: "",
            selectedTheme: "Lake White",
            createdAt: new Date(),
            emailVerified: false,
            onboardingCompleted: false,
            uid: uid // Add UID for reference
        };
        
        // Use Admin SDK to write to Firestore (bypasses security rules)
        await adminDb.collection('AccountData').doc(uid).set(userDoc);
        return userDoc;
    } catch (error) {
        console.error('Error creating user document with Admin SDK:', error);
        throw error;
    }
}

export async function POST(request) {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(7);
    
    try {
        console.log(`🟢 SERVER-SIDE SIGNUP [${requestId}] - Request received`);
        
        // Rate limiting
        const rateLimitKey = getRateLimitKey(request);
        if (isRateLimited(rateLimitKey)) {
            console.log(`🟢 SERVER-SIDE SIGNUP [${requestId}] - RATE LIMITED`);
            return NextResponse.json(
                { 
                    error: 'Too many signup attempts. Please wait a moment.',
                    code: 'RATE_LIMITED'
                }, 
                { status: 429 }
            );
        }
        
        // Parse request body
        const body = await request.json();
        const { username, email, password } = body;
        
        console.log(`🟢 SERVER-SIDE SIGNUP [${requestId}] - Processing signup for: ${email}`);
        
        // ====================================================================
        // VALIDATION
        // ====================================================================
        
        // Validate username
        let cleanUsername;
        try {
            cleanUsername = validateUsername(username);
        } catch (error) {
            return NextResponse.json(
                { error: error.message, code: 'INVALID_USERNAME' },
                { status: 400 }
            );
        }
        
        // Validate email
        if (!email || !validateEmail(email)) {
            return NextResponse.json(
                { error: 'Please enter a valid email address', code: 'INVALID_EMAIL' },
                { status: 400 }
            );
        }
        
        // Validate password
        const passwordValidation = validatePassword(password);
        if (passwordValidation !== true) {
            return NextResponse.json(
                { error: passwordValidation, code: 'WEAK_PASSWORD' },
                { status: 400 }
            );
        }
        
        // ====================================================================
        // CHECK FOR EXISTING USERS
        // ====================================================================
        
        console.log(`🟢 SERVER-SIDE SIGNUP [${requestId}] - Checking for existing username/email`);
        
        // Check if username already exists (using Admin SDK)
        const usernameExists = await checkUsernameExists(cleanUsername);
        if (usernameExists) {
            return NextResponse.json(
                { error: 'Username is already taken', code: 'USERNAME_EXISTS' },
                { status: 409 }
            );
        }
        
        // Check if email already exists
        const emailExists = await checkEmailExists(email);
        if (emailExists) {
            return NextResponse.json(
                { error: 'An account with this email already exists', code: 'EMAIL_EXISTS' },
                { status: 409 }
            );
        }
        
        // ====================================================================
        // CREATE FIREBASE AUTH USER
        // ====================================================================
        
        console.log(`🟢 SERVER-SIDE SIGNUP [${requestId}] - Creating Firebase Auth user`);
        
        const userRecord = await adminAuth.createUser({
            email: email.toLowerCase(),
            password: password,
            displayName: cleanUsername,
            emailVerified: false
        });
        
        console.log(`🟢 SERVER-SIDE SIGNUP [${requestId}] - Firebase user created: ${userRecord.uid}`);
        
        // ====================================================================
        // CREATE FIRESTORE DOCUMENT (Using Admin SDK)
        // ====================================================================
        
        console.log(`🟢 SERVER-SIDE SIGNUP [${requestId}] - Creating Firestore document with Admin SDK`);
        
        const userDocument = await createUserDocument(userRecord.uid, {
            username: cleanUsername,
            email: email.toLowerCase()
        });
        
        console.log(`🟢 SERVER-SIDE SIGNUP [${requestId}] - Firestore document created successfully`);
        
        // ====================================================================
        // GENERATE CUSTOM TOKEN FOR CLIENT
        // ====================================================================
        
        const customToken = await adminAuth.createCustomToken(userRecord.uid);
        
        const totalTime = Date.now() - startTime;
        
        console.log(`🟢 SERVER-SIDE SIGNUP [${requestId}] - SUCCESS`);
        console.log(`   UID: ${userRecord.uid}`);
        console.log(`   Username: ${cleanUsername}`);
        console.log(`   Email: ${email}`);
        console.log(`   Processing time: ${totalTime}ms`);
        
        // ====================================================================
        // RETURN SUCCESS RESPONSE
        // ====================================================================
        
        return NextResponse.json({
            success: true,
            user: {
                uid: userRecord.uid,
                email: userRecord.email,
                username: cleanUsername,
                displayName: cleanUsername,
                emailVerified: false
            },
            customToken,
            message: 'Account created successfully',
            processingTime: totalTime,
            requestId
        });
        
    } catch (error) {
        const errorTime = Date.now() - startTime;
        
        console.error(`🟢 SERVER-SIDE SIGNUP [${requestId}] - ERROR`);
        console.error(`   Error: ${error.message}`);
        console.error(`   Code: ${error.code}`);
        console.error(`   Time: ${errorTime}ms`);
        console.error(`   Stack: ${error.stack}`);
        
        // Handle specific Firebase errors
        let errorMessage = 'Failed to create account';
        let errorCode = 'SERVER_ERROR';
        let statusCode = 500;
        
        if (error.code === 'auth/email-already-exists') {
            errorMessage = 'An account with this email already exists';
            errorCode = 'EMAIL_EXISTS';
            statusCode = 409;
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address';
            errorCode = 'INVALID_EMAIL';
            statusCode = 400;
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'Password is too weak';
            errorCode = 'WEAK_PASSWORD';
            statusCode = 400;
        } else if (error.message.includes('permission') || error.message.includes('PERMISSION_DENIED')) {
            errorMessage = 'Database configuration error. Please contact support.';
            errorCode = 'CONFIG_ERROR';
            console.error(`🟢 IMPORTANT: Firestore permissions error. Check your security rules or Admin SDK setup.`);
        }
        
        return NextResponse.json(
            { 
                error: errorMessage,
                code: errorCode,
                requestId,
                timestamp: new Date().toISOString()
            }, 
            { status: statusCode }
        );
    }
}

// Handle other HTTP methods
export async function GET() {
    return NextResponse.json(
        { 
            error: 'Method not allowed. Use POST.',
            requiredBody: { username: 'string', email: 'string', password: 'string' },
            rateLimits: { maxAttempts: 3, windowMs: 60000 }
        }, 
        { status: 405 }
    );
}

export async function PUT() {
    return NextResponse.json(
        { error: 'Method not allowed. Use POST.' }, 
        { status: 405 }
    );
}

export async function DELETE() {
    return NextResponse.json(
        { error: 'Method not allowed. Use POST.' }, 
        { status: 405 }
    );
}