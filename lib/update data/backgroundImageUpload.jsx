import { collection, doc, setDoc } from "firebase/firestore";
import { fireApp } from "@/important/firebase";

export const backgroundImageUpload = async (url, userId) => {
    if (!userId) {
        console.error("backgroundImageUpload failed: No user ID was provided.");
        throw new Error("User not authenticated.");
    }

    try {
        const docRef = doc(fireApp, "AccountData", userId);

        // Use setDoc with { merge: true } to update the backgroundImage field.
        // This will create the document if it doesn't exist, or update/add
        // the backgroundImage field without overwriting the rest of the document.
        await setDoc(docRef, { 
            backgroundImage: url 
        }, { merge: true });

    } catch (error) {
        console.error("Error in backgroundImageUpload:", error);
        throw new Error(error.message);
    }
};