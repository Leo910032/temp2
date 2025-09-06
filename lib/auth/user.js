// lib/auth/user.js
import { auth } from "@/important/firebase"; // ✅ USES YOUR EXISTING FIREBASE SETUP!

/**
 * Gets the Firebase auth token for the current user.
 * It waits for the auth state to be resolved before attempting to get the token.
 * @returns {Promise<string>} A promise that resolves with the user's ID token.
 * @throws {Error} If no user is authenticated or the token cannot be retrieved.
 */
export async function getCurrentUserToken() {
  // We check for the auth object to ensure it's loaded
  if (!auth) {
    throw new Error("Firebase Auth has not been initialized.");
  }

  return new Promise((resolve, reject) => {
    // onAuthStateChanged is the most reliable way to get the current user
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      unsubscribe(); // Stop listening once we have the user state

      if (user) {
        try {
          const token = await user.getIdToken(true); // Force refresh if needed
          resolve(token);
        } catch (error) {
          console.error("Error getting user ID token:", error);
          reject(new Error("Failed to get authentication token."));
        }
      } else {
        // No user is signed in.
        reject(new Error("No authenticated user found."));
      }
    });
  });
}
