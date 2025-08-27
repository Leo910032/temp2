import { collection, doc, getDoc, setDoc } from "firebase/firestore";
import { fireApp } from "@/important/firebase";

export default async function updateDisplayName(displayNameText, userId) {
    if (!userId) {
        console.error("updateDisplayName failed: No user ID provided.");
        throw new Error("User not authenticated.");
    }

    try {
        const accountDataCollectionRef = collection(fireApp, "AccountData");
        const userDocRef = doc(accountDataCollectionRef, userId);
        const docSnap = await getDoc(userDocRef);
        
        if (docSnap.exists()) {
            const previousData = docSnap.data();
            const objectToUpdate = { ...previousData, displayName: displayNameText };
            await setDoc(userDocRef, objectToUpdate);
            return;
        } else {
            // This case handles if a user document doesn't exist for some reason.
            // We can create it with the new display name.
            await setDoc(userDocRef, { displayName: displayNameText });
        }
    } catch (error) {
        console.error("Error updating display name:", error);
        throw new Error(error.message);
    }
}