import { collection, doc, setDoc } from "firebase/firestore";
import { fireApp } from "@/important/firebase";

export const updateProfilePhoto = async (url, userId) => {
    // 1. Check if a userId was provided.
    if (!userId) {
        throw new Error("User not authenticated. Cannot update profile photo.");
    }

    try {
        // 2. Create a reference directly to the user's document using their UID.
        const docRef = doc(fireApp, "AccountData", userId);

        // 3. Use setDoc with { merge: true } to update or add the profilePhoto field
        //    without destroying other data in the document.
        await setDoc(docRef, { profilePhoto: url }, { merge: true });
        
    } catch (error) {
        console.error("Error updating profile photo in Firestore:", error);
        throw new Error("Failed to update profile photo.");
    }
};