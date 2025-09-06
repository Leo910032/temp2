import { collection, doc, getDoc, setDoc } from "firebase/firestore";
import { fireApp } from "@/important/firebase";

export const backgroundVideoUpload = async (url, userId) => {
    // Validate that a userId was provided
    if (!userId) {
        console.error("backgroundVideoUpload failed: No user ID provided.");
        throw new Error("User not authenticated.");
    }

    try {
        const AccountDocRef = collection(fireApp, "AccountData");
        // Use the provided userId (Firebase Auth UID) to reference the document
        const docRef = doc(AccountDocRef, userId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            // If the document exists, merge the new URL with existing data
            const previousData = docSnap.data();
            const objectToUpdate = { ...previousData, backgroundVideo: url };
            await setDoc(docRef, objectToUpdate);
            return;
        }

        // If the document does not exist, create it using setDoc.
        // The previous use of addDoc was incorrect as it's for collections, not specific documents.
        await setDoc(docRef, { backgroundVideo: url });

    } catch (error) {
        console.error("Error in backgroundVideoUpload:", error);
        throw new Error(error.message);
    }
}