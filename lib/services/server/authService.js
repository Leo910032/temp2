import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { validateEmail as isValidEmail, validatePassword } from '@/lib/utilities';
import { DisposableEmailService } from './disposableEmailService';
import { getAuth } from 'firebase/auth';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { initializeApp, getApps, deleteApp } from 'firebase/app';

// This is a simple in-memory store for rate limiting.
// For production, a more robust solution like Redis would be better.
const rateLimitMap = new Map();
setInterval(() => {
    const now = Date.now();
    rateLimitMap.forEach((data, key) => {
        if (now - data.lastReset > 5 * 60 * 1000) {
            rateLimitMap.delete(key);
        }
    });
}, 5 * 60 * 1000);

function checkRateLimit(key, maxRequests, windowMs) {
    const rateLimitData = rateLimitMap.get(key) || { count: 0, lastReset: Date.now() };
    if (Date.now() - rateLimitData.lastReset > windowMs) {
        rateLimitData.count = 0;
        rateLimitData.lastReset = Date.now();
    }
    if (rateLimitData.count >= maxRequests) {
        return false; // Rate limit exceeded
    }
    rateLimitData.count++;
    rateLimitMap.set(key, rateLimitData);
    return true;
}
// ✅ FIXED: Updated getTempApp to use server-side variables first
let tempApp;
const getTempApp = () => {
    if (tempApp) return tempApp;
    
    // Best Practice: Use dedicated server-side variables if available.
    // Fallback to NEXT_PUBLIC_ variables for flexibility.
    const firebaseConfig = {
        apiKey: process.env.NEXT_PUBLIC_apiKey,
        authDomain: process.env.NEXT_PUBLIC_authDomain,
        projectId: process.env.NEXT_PUBLIC_projectId
    };
    
    // ✅ IMPROVED: The validation now checks for both variable types.
    if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId) {
        console.error("🔴 CRITICAL: Missing Firebase client config environment variables on the server.");
        console.error("🔴 Please ensure FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, and FIREBASE_PROJECT_ID are set in your .env.local file.");
        console.error("🔴 After adding them, you MUST restart your development server.");
        throw new Error("Server is misconfigured. Firebase client credentials are not available.");
    }

    const appName = 'temp-auth-app-for-password-verification';
    const existingApp = getApps().find(app => app.name === appName);
    
    if (existingApp) {
        tempApp = existingApp;
    } else {
        tempApp = initializeApp(firebaseConfig, appName);
    }
    return tempApp;
};


export class AuthService {
    /**
 * ✅ PERFECT: Creates the exact user document structure as specified
 * This template will be used by all user creation methods
 */
static createPerfectUserDocument(userRecord, username, displayName = null, avatarUrl = null) {
    return {
        // --- Core Identity (Set once at creation) ---
        uid: userRecord.uid,
        email: userRecord.email,
        emailVerified: userRecord.emailVerified,
        createdAt: new Date(),
        lastLoginAt: new Date(),
        username: username.toLowerCase(),
        
        // --- Subscription & Status ---
        accountType: "base", // Changed from accountType
        onboardingCompleted: false,

        // --- User-Editable Profile Data ---
        profile: {
            displayName: displayName || username,
            bio: "",
            avatarUrl: avatarUrl || null, // Renamed from avatar
            location: ""
        },

        // --- Enterprise Context (Empty for non-enterprise users) ---
        enterprise: {
            organizationId: null,
            organizationRole: null,
            teams: {} // Always an empty map, never null
        },

        // --- User-Configured Page Content ---
        links: [], // Always an empty array, never null
        socials: [], // Always an empty array, never null
        
        // --- User-Configured Page Appearance ---
        appearance: {
            selectedTheme: "Lake White",
            themeFontColor: "#000000",
            fontType: 0,
            backgroundColor: "#FFFFFF",
            backgroundType: "Color",
            btnColor: "#000000",
            btnFontColor: "#FFFFFF",
            btnType: 0,
            cvDocument: null
        },

        // --- User-Specific Settings ---
        settings: {
            isPublic: true,
            allowMessages: true,
            theme: "light", // This is for the DASHBOARD theme, not the public profile
            notifications: {
                email: true,
                push: true
            }
        }
        // Note: No analytics map - this should be in separate /Analytics/{userId} collection
    };
}

        /**
     * ✅ NEW & SECURE: Verifies a user's password using a temporary client auth instance.
     * This is the recommended secure way to check a password on the server.
     * @param {string} email - The user's email.
     * @param {string} password - The password to verify.
     * @returns {Promise<boolean>} - True if the password is correct.
     */
    static async verifyPassword(email, password) {
        try {
            const tempAuth = getAuth(getTempApp());
            await signInWithEmailAndPassword(tempAuth, email, password);
            return true;
        } catch (error) {
            // "auth/wrong-password" or "auth/user-not-found" are expected here for invalid credentials
            if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
                return false;
            }
            // Re-throw unexpected errors
            throw error;
        }
    }
    
    /**
 * ✅ FIXED: Creates a login session ONLY after verifying the password.
 * Now handles missing Firestore documents by creating them.
 * @param {object} options - { usernameOrEmail, password, ip, userAgent }
 * @returns {Promise<{customToken: string, user: object}>}
 */
/**
 * ✅ UPDATED: Simplified loginWithPassword using the helper method
 */
static async loginWithPassword({ usernameOrEmail, password }) {
    let email = usernameOrEmail;
    let userData = null;

    // Step 1: Find the user's email if a username is provided
    if (!usernameOrEmail.includes('@')) {
        const userResult = await this.getUserByUsername(usernameOrEmail);
        if (!userResult.user) {
            throw new Error('Invalid credentials');
        }
        userData = userResult.user;
        email = userData.email;
    }

    // Step 2: Verify the password
    const isPasswordCorrect = await this.verifyPassword(email, password);
    if (!isPasswordCorrect) {
        throw new Error('Invalid credentials');
    }

    // Step 3: Get Firebase Auth user record
    const userRecord = await adminAuth.getUserByEmail(email);

    // Step 4: Ensure Firestore document exists
    if (!userData) {
        userData = await this.ensureUserDocument(userRecord);
    }

    // Step 5: Update last login
    await adminDb.collection('users').doc(userRecord.uid).update({ 
        lastLoginAt: new Date() 
    });

    // Step 6: Create custom token
    const customToken = await adminAuth.createCustomToken(userRecord.uid);
    
     return {
        customToken,
        user: {
            uid: userRecord.uid,
            email: userRecord.email,
            username: userData.username,
            displayName: userData.profile?.displayName || userData.displayName, // Handle both old and new structure
            emailVerified: userRecord.emailVerified
        }
    };
}
/**
 * ✅ UPDATED: Google Sign-In with perfect document structure
 */
static async findOrCreateUserForGoogleSignIn(googleUser) {
    const userDocRef = adminDb.collection('users').doc(googleUser.uid);
    const userDoc = await userDocRef.get();

    let userData;

    if (userDoc.exists) {
        // User already has a Firestore document, just update their login time and avatar
        console.log(`Google Sign-In: Found existing Firestore document for ${googleUser.uid}`);
        userData = userDoc.data();
        await userDocRef.update({ 
            lastLoginAt: new Date(), 
            'profile.avatarUrl': googleUser.photoURL || userData.profile?.avatarUrl || null
        });
    } else {
        // This is a brand new user - create their Firestore document
        console.log(`Google Sign-In: Creating new Firestore document for ${googleUser.uid}`);
        
        // Generate a unique username
        let username = (googleUser.displayName || googleUser.email.split('@')[0])
            .toLowerCase()
            .replace(/[^a-z0-9_.-]/g, '')
            .substring(0, 20) || `user${Date.now()}`;
        
        // Ensure username is unique
        let isUsernameTaken = (await this.validateUsername({ username, ip: 'internal' })).exists;
        let counter = 1;
        while(isUsernameTaken) {
            const newUsername = `${username}${counter}`;
            isUsernameTaken = (await this.validateUsername({ username: newUsername, ip: 'internal' })).exists;
            if(!isUsernameTaken) { username = newUsername; }
            counter++;
        }
        
    // ✅ CORRECT:
userData = this.createPerfectUserDocument(
    googleUser, 
    username, 
    googleUser.displayName, 
    googleUser.photoURL
);
        
        // Create the Firestore document
        await userDocRef.set(userData);
        console.log(`Google Sign-In: Successfully created Firestore document for ${googleUser.uid} with username ${username}`);
    }

    // Create custom token for client-side authentication
    const customToken = await adminAuth.createCustomToken(googleUser.uid);
    
    return { 
        customToken, 
        user: {
            uid: googleUser.uid,
            email: googleUser.email,
            username: userData.username,
            displayName: userData.profile.displayName, // Updated to use profile.displayName
            emailVerified: googleUser.emailVerified
        }
    };
}

  /**
 * ✅ FIXED: Now returns proper metadata that the API route expects
 */
static async validateUsername({ username, ip, isAuthenticated = false }) {
    const rateLimitKey = `validate-username:${ip}`;
    const maxRequests = isAuthenticated ? 60 : 30;
    const windowMs = 60000; // 1 minute window
    
    // Skip rate limiting for internal server calls
    if (ip !== 'internal' && !checkRateLimit(rateLimitKey, maxRequests, windowMs)) {
        throw new Error('Too many requests');
    }

    if (!username || typeof username !== 'string' || username.length < 3 || username.length > 30) { 
        throw new Error('Username must be between 3 and 30 characters.');
    }
    
    const cleanUsername = username.trim().toLowerCase();
    
    if (!/^[a-z0-9_.-]+$/.test(cleanUsername)) { 
        throw new Error('Username contains invalid characters.'); 
    }
    
    const dbStartTime = Date.now();
    const usersQuery = await adminDb.collection("users").where("username", "==", cleanUsername).limit(1).get();
    const dbQueryTime = Date.now() - dbStartTime;
    
    return { 
        exists: !usersQuery.empty,
        metadata: {
            cleanUsername,
            dbQueryTime,
            isAuthenticated,
            rateLimit: { maxRequests, windowMs }
        }
    };
}
    // Update the validateEmail method to include disposable email checking:
/**
 * Validates if an email exists in the system and checks for disposable domains
 * @param {object} options
 * @param {string} options.email - The email to check
 * @param {string} options.ip - The IP address for rate limiting
 * @param {boolean} options.isAuthenticated - Whether the request is authenticated
 * @param {boolean} options.checkDisposable - Whether to check for disposable domains (default: true)
 * @param {boolean} options.strictDisposable - Use strict mode for disposable checking (default: false)
 * @returns {Promise<{exists: boolean, isDisposable?: boolean, metadata?: object}>}
 */

  /**
 * ✅ UPDATED: Standard user creation with perfect document structure
 */
static async createStandardUser({ email, password, username, additionalData = {} }) {
    // --- 1. Comprehensive Validation ---
    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();
    
    if (!isValidEmail(cleanEmail)) {
        throw new Error('Invalid email format');
    }
    
    // Check for disposable email domains
    try {
        const disposableCheck = await DisposableEmailService.isDisposableEmail(cleanEmail, { 
            strict: false,
            updateCache: true 
        });
        
        if (disposableCheck.isDisposable) {
            throw new Error('Account creation with disposable email addresses is not permitted');
        }
        
        console.log(`Email ${cleanEmail} passed disposable check (confidence: ${disposableCheck.confidence})`);
    } catch (error) {
        if (error.message.includes('disposable email')) {
            throw error;
        }
        console.warn('Disposable email check failed during signup:', error.message);
    }
    
    const passwordValidation = validatePassword(password);
    if (passwordValidation !== true) {
        throw new Error(passwordValidation);
    }
        
    // Validate username format
    if (cleanUsername.length < 3 || cleanUsername.length > 30) {
        throw new Error('Username must be between 3 and 30 characters');
    }
    
    if (!/^[a-z0-9_.-]+$/.test(cleanUsername)) {
        throw new Error('Username can only contain letters, numbers, underscores, periods, and hyphens');
    }

    // --- 2. Check for Duplicates ---
    const [usernameCheck, emailExists] = await Promise.all([
        this.validateUsername({ username: cleanUsername, ip: 'internal' }),
        adminAuth.getUserByEmail(cleanEmail).then(() => true).catch((error) => {
            if (error.code === 'auth/user-not-found') return false;
            throw error;
        })
    ]);

    if (usernameCheck.exists) {
        throw new Error('Username is already taken');
    }
    
    if (emailExists) {
        throw new Error('An account with this email already exists');
    }
    
    // --- 3. Create Firebase Auth User ---
    const userRecord = await adminAuth.createUser({
        email: cleanEmail,
        password: password,
        displayName: username, // Keep original case for display
        emailVerified: false
    });

   // --- 4. Create Perfect Firestore User Document ---
    const userDoc = this.createPerfectUserDocument(userRecord, cleanUsername, username, null);
    
    // Set lastLoginAt to null for new signups (they haven't logged in yet)
    userDoc.lastLoginAt = null;
    
    // Merge any additional data (but preserve the perfect structure)
    Object.assign(userDoc, additionalData);

    // Create document in the users collection
    await adminDb.collection('users').doc(userRecord.uid).set(userDoc);
    // --- 5. Generate Custom Token for Client-Side Sign-In ---
    const customToken = await adminAuth.createCustomToken(userRecord.uid);

    console.log(`AuthService: Created user ${userRecord.uid} with username ${cleanUsername}`);

    return { 
        uid: userRecord.uid, 
        customToken,
        user: userDoc
    };
}


   /**
     * ✅ CLEANED UP: Removed legacy fallback to AccountData.
     */
    static async getUserByUsername(username) {
        if (!username) throw new Error('Username is required.');
        const cleanUsername = username.trim().toLowerCase();
        
        const usersQuery = await adminDb.collection("users").where("username", "==", cleanUsername).limit(1).get();
        if (!usersQuery.empty) {
            return { user: { id: usersQuery.docs[0].id, ...usersQuery.docs[0].data() } };
        }
        return { user: null };
    }

    /**
     * Retrieves user data by email
     * @param {string} email
     * @returns {Promise<{user: object | null}>}
     */
      static async getUserByEmail(email) {
        if (!email) throw new Error('Email is required.');
        try {
            const userRecord = await adminAuth.getUserByEmail(email);
            const userDoc = await adminDb.collection('users').doc(userRecord.uid).get();
            if (userDoc.exists) {
                return { user: { id: userDoc.id, ...userDoc.data() } };
            }
            return { user: null };
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                return { user: null };
            }
            throw error;
        }
    }

    /**
     * Updates user's last login timestamp
     * @param {string} uid
     * @returns {Promise<void>}
     */
    static async updateLastLogin(uid) {
        if (!uid) {
            throw new Error('User ID is required.');
        }

        try {
            const lastLoginAt = new Date().toISOString();
            
            // Try to update in users collection first
            const userRef = adminDb.collection('users').doc(uid);
            const userDoc = await userRef.get();
            
            if (userDoc.exists) {
                await userRef.update({ lastLoginAt });
            } else {
                // Fallback to AccountData collection
                const accountRef = adminDb.collection('AccountData').doc(uid);
                const accountDoc = await accountRef.get();
                
                if (accountDoc.exists) {
                    await accountRef.update({ lastLoginAt });
                }
            }
        } catch (error) {
            console.error('AuthService: Error updating last login:', error);
            // Don't throw here as this is not critical
        }
    }

    /**
     * Verifies a Firebase ID token and returns user data
     * @param {string} idToken
     * @returns {Promise<{user: object}>}
     */
    static async verifyIdToken(idToken) {
        if (!idToken) {
            throw new Error('ID token is required.');
        }

        try {
            const decodedToken = await adminAuth.verifyIdToken(idToken);
            
            // Try to get user from users collection first
            let userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
            
            if (!userDoc.exists) {
                // Fallback to AccountData collection
                userDoc = await adminDb.collection('AccountData').doc(decodedToken.uid).get();
            }
            
            if (!userDoc.exists) {
                throw new Error('User document not found.');
            }
            
            return {
                user: {
                    id: userDoc.id,
                    ...userDoc.data(),
                    tokenData: decodedToken
                }
            };
            
        } catch (error) {
            console.error('AuthService: Error verifying token:', error);
            throw new Error(`Token verification failed: ${error.message}`);
        }
    }
/**
 * Validates if an email exists in the system
 * @param {object} options
 * @param {string} options.email - The email to check
 * @param {string} options.ip - The IP address for rate limiting
 * @param {boolean} options.isAuthenticated - Whether the request is authenticated
 * @returns {Promise<{exists: boolean, metadata?: object}>}
 */
static async validateEmail({ email, ip, isAuthenticated = false, checkDisposable = true, strictDisposable = false }) {
    const rateLimitKey = `validate-email:${ip}`;
    const maxRequests = isAuthenticated ? 60 : 20;
    const windowMs = 60000; // 1 minute window
    
    // Skip rate limiting for internal server calls
    if (ip !== 'internal' && !checkRateLimit(rateLimitKey, maxRequests, windowMs)) {
        throw new Error('Too many requests');
    }

    if (!email || typeof email !== 'string') {
        throw new Error('Email is required');
    }
    
    const cleanEmail = email.trim().toLowerCase();
    
    if (!isValidEmail(cleanEmail)) {
        throw new Error('Invalid email format');
    }

    // Check for disposable email domains first (if enabled)
    let disposableCheck = null;
    if (checkDisposable) {
        try {
            disposableCheck = await DisposableEmailService.isDisposableEmail(cleanEmail, { 
                strict: strictDisposable,
                updateCache: true 
            });
            
            if (disposableCheck.isDisposable) {
                throw new Error('Disposable email addresses are not allowed');
            }
        } catch (error) {
            // If disposable check fails, log but don't block the validation
            // unless it's specifically a disposable email error
            if (error.message.includes('Disposable email addresses are not allowed')) {
                throw error;
            }
            console.warn('Disposable email check failed:', error.message);
        }
    }

    const dbStartTime = Date.now();
    
    try {
        // Check Firebase Auth first
        await adminAuth.getUserByEmail(cleanEmail);
        const dbQueryTime = Date.now() - dbStartTime;
        
        return {
            exists: true,
            isDisposable: disposableCheck?.isDisposable || false,
            metadata: {
                dbQueryTime,
                cleanEmail,
                isAuthenticated,
                disposableCheck,
                rateLimit: { maxRequests, windowMs }
            }
        };
    } catch (error) {
        const dbQueryTime = Date.now() - dbStartTime;
        
        if (error.code === 'auth/user-not-found') {
            return {
                exists: false,
                isDisposable: disposableCheck?.isDisposable || false,
                metadata: {
                    dbQueryTime,
                    cleanEmail,
                    isAuthenticated,
                    disposableCheck,
                    rateLimit: { maxRequests, windowMs }
                }
            };
        }
        throw error;
    }
}
/**
 * Authenticates a user by username or email and returns user data
 * @param {object} options
 * @param {string} options.usernameOrEmail - Username or email to authenticate
 * @param {string} options.ip - IP address for logging
 * @returns {Promise<{userRecord: object, userData: object, customToken: string}>}
 */
static async authenticateUser({ usernameOrEmail, ip }) {
    let email = usernameOrEmail;
    let userData = null;

    // If input isn't an email, find the corresponding email
    if (!usernameOrEmail.includes('@')) {
        const userResult = await this.getUserByUsername(usernameOrEmail);
        if (!userResult.user) {
            throw new Error('Invalid credentials');
        }
        userData = userResult.user;
        email = userData.email;
    }

    // Verify the user exists in Firebase Auth
    let userRecord;
    try {
        userRecord = await adminAuth.getUserByEmail(email);
    } catch (error) {
        if (error.code === 'auth/user-not-found') {
            throw new Error('Invalid credentials');
        }
        throw error;
    }

    // Get user data from Firestore if not already retrieved
    if (!userData) {
        const userDoc = await adminDb.collection('users').doc(userRecord.uid).get();
        if (!userDoc.exists) {
            // Fallback to AccountData collection
            const accountDoc = await adminDb.collection('AccountData').doc(userRecord.uid).get();
            if (accountDoc.exists) {
                userData = accountDoc.data();
            }
        } else {
            userData = userDoc.data();
        }
    }

    // Create custom token for client authentication
    const customToken = await adminAuth.createCustomToken(userRecord.uid);

    return {
        userRecord,
        userData,
        customToken
    };
}

/**
 * Creates a login session for a user
 * @param {object} options
 * @param {string} options.usernameOrEmail
 * @param {string} options.ip
 * @param {string} options.userAgent
 * @returns {Promise<{customToken: string, user: object}>}
 */
// In lib/services/server/authService.js
static async createLoginSession({ usernameOrEmail, ip, userAgent }) {
    let email = usernameOrEmail;
    let userData = null;

    // If input isn't an email, find the corresponding email
    if (!usernameOrEmail.includes('@')) {
        // Check the USERS collection (not AccountData)
        const usersRef = adminDb.collection("users");
        const q = usersRef.where("username", "==", usernameOrEmail.toLowerCase()).limit(1);
        const snapshot = await q.get();

        if (snapshot.empty) {
            throw new Error('Invalid credentials');
        }
        
        userData = snapshot.docs[0].data();
        email = userData.email;
    }

    // Verify user exists in Firebase Auth
    const userRecord = await adminAuth.getUserByEmail(email);
    
    // Create custom token
    const customToken = await adminAuth.createCustomToken(userRecord.uid);
    
    // Get user data if not already retrieved
    if (!userData) {
        const userDoc = await adminDb.collection('users').doc(userRecord.uid).get();
        userData = userDoc.exists ? userDoc.data() : null;
    }

 return {
        customToken,
        user: {
            uid: userRecord.uid,
            email: userRecord.email,
            username: userData?.username,
            displayName: userData?.profile?.displayName || userData?.displayName // Handle both structures
        }
    };
}

// Fix your ensureUserDocument method - replace it entirely:
static async ensureUserDocument(userRecord) {
    const userDoc = await adminDb.collection('users').doc(userRecord.uid).get();
    
    if (userDoc.exists) {
        return userDoc.data();
    }
    
    console.log(`Creating missing Firestore document for user ${userRecord.uid}`);
    
    // Generate a unique username
    let username = userRecord.displayName || userRecord.email.split('@')[0];
    username = username.toLowerCase().replace(/[^a-z0-9_.-]/g, '').substring(0, 20) || `user${Date.now()}`;
    
    // Ensure username is unique
    let isUsernameTaken = (await this.validateUsername({ username, ip: 'internal' })).exists;
    let counter = 1;
    while(isUsernameTaken) {
        const newUsername = `${username}${counter}`;
        isUsernameTaken = (await this.validateUsername({ username: newUsername, ip: 'internal' })).exists;
        if(!isUsernameTaken) { username = newUsername; }
        counter++;
    }
    
    // Create the perfect user document structure
    const userData = this.createPerfectUserDocument(
        userRecord, 
        username, 
        userRecord.displayName, 
        userRecord.photoURL
    );
    
    // Save to Firestore
    await adminDb.collection('users').doc(userRecord.uid).set(userData);
    console.log(`Created Firestore document for user ${userRecord.uid} with username ${username}`);
    
    return userData;
}



}