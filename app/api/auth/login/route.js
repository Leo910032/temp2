import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth as clientAuth } from '@/important/firebase';

/**
 * Handles user login by username/email and password.
 * 1. Looks up the email by username if necessary (using Admin SDK).
 * 2. Attempts to sign in using the client SDK on the server.
 * 3. If successful, creates a custom token for the client to securely sign in.
 */
export async function POST(request) {
    try {
        const { username, password } = await request.json();

        if (!username || !password) {
            return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 });
        }

        let email = username;

        // Step 1: If the input isn't an email, find the corresponding email using the Admin SDK.
        if (!username.includes('@')) {
            const accountsRef = adminDb.collection("AccountData");
            const q = accountsRef.where("username", "==", username.toLowerCase()).limit(1);
            const snapshot = await q.get();

            if (snapshot.empty) {
                // Return a generic error to prevent username enumeration attacks.
                return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
            }
            email = snapshot.docs[0].data().email;
        }

        // Step 2: Use the Client Auth SDK (on the server) to verify the password.
        // The Admin SDK cannot verify passwords directly. This is the standard pattern.
        const userCredential = await signInWithEmailAndPassword(clientAuth, email, password);
        
        // Step 3: If password is correct, create a secure custom token for the client.
        const customToken = await adminAuth.createCustomToken(userCredential.user.uid);

        return NextResponse.json({ customToken });

    } catch (error) {
        // This will catch Firebase errors like 'auth/wrong-password'.
        console.error("API Login Error:", error.code);
        // Always return a generic error to the client for security.
        return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }
}
