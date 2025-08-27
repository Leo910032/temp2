import { fireApp } from '@/important/firebase';
import { collection, doc, getDoc, query, where, getDocs } from 'firebase/firestore';

export const fetchUserData = async (userId) => {
    try {
        // First, try to get user data directly by Firebase Auth UID
        const docRef = doc(fireApp, "AccountData", userId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return userId; // Return the Firebase Auth UID
        }

        // If not found, try to find by username
        const collectionRef = collection(fireApp, "AccountData");
        const q = query(collectionRef, where("username", "==", userId.toLowerCase()));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            // Found user by username, return the Firebase Auth UID
            return querySnapshot.docs[0].id;
        }

        // User not found
        return null;

    } catch (error) {
        console.error("Error fetching user data:", error);
        throw error;
    }
};