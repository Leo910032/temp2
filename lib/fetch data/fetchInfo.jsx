import { fireApp } from "@/important/firebase";
import { doc, getDoc } from "firebase/firestore";

/**
 * Fetches user's display name and bio from Firestore.
 * This is a one-time fetch.
 * @param {string} userId - The UID of the user whose info is being fetched.
 * @returns {Promise<object|null>} A promise that resolves to an object { displayName, bio } or null if not found.
 */
export async function fetchInfo(userId) {
    // This function now requires a userId. It no longer has a fallback.
    if (!userId) {
        console.error("fetchInfo error: A user ID must be provided.");
        return null;
    }

    try {
        const docRef = doc(fireApp, "AccountData", userId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const { displayName, bio } = docSnap.data();
            // Return a structured object for better readability and usability.
            return {
                displayName: displayName || "", // Provide a default empty string
                bio: bio || ""              // Provide a default empty string
            };
        } else {
            // The user is authenticated but doesn't have a document in AccountData yet.
            return null;
        }
    } catch (error) {
        console.error("Error fetching user info in fetchInfo:", error);
        // Throw the error to let the calling function handle it.
        throw error;
    }
}