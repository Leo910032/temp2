import { collection, doc, getDoc, setDoc } from "firebase/firestore";
import { fireApp } from "@/important/firebase";

export default async function updateBio(bioText, userId) {
    if (!userId) {
        console.error("updateBio failed: No user ID provided.");
        throw new Error("User not authenticated.");
    }

    try {
        const AccountDocRef = collection(fireApp, "AccountData");
        const docRef = doc(AccountDocRef, userId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const previousData = docSnap.data();
            const objectToUpdate = {...previousData, bio: bioText};
            await setDoc(docRef, objectToUpdate);
            return;
        } else {
            // If the document doesn't exist, create it with the new bio
            await setDoc(docRef, { bio: bioText });
        }
    } catch (error) {
        console.error("Error updating bio:", error);
        throw new Error(error.message);
    }
}