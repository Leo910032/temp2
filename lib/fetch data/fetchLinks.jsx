import { fireApp } from "@/important/firebase";
import { doc, getDoc } from "firebase/firestore";

export async function fetchLinks(userId) {
    if (!userId) {
        console.error("fetchLinks requires a userId.");
        return []; // Return an empty array if no user ID is provided
    }

    try {
        const docRef = doc(fireApp, "AccountData", userId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            return data.links || []; // Return links or an empty array if undefined
        } else {
            // The user document might not exist yet for a new user
            return [];
        }
    } catch (error) {
        console.error("Error fetching user links:", error);
        // Throw the error to be caught by the calling component
        throw new Error("Failed to fetch links.");
    }
}