// lib/update data/updateChristmasAccessory.js
import { fireApp } from "@/important/firebase";
import { collection, doc, getDoc, updateDoc, setDoc } from "firebase/firestore";

export async function updateChristmasAccessory(accessoryType, userId) {
    if (!userId) {
        throw new Error("User ID is required");
    }
    
    try {
        const AccountDocRef = collection(fireApp, "AccountData");
        const docRef = doc(AccountDocRef, userId);
        
        // First check if document exists
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            // Document exists, update it
            await updateDoc(docRef, {
                christmasAccessory: accessoryType,
                selectedTheme: accessoryType === "Snow Fall" ? "Snow Fall" : docSnap.data().selectedTheme || "Lake White"
            });
        } else {
            // Document doesn't exist, create it
            await setDoc(docRef, {
                christmasAccessory: accessoryType,
                selectedTheme: accessoryType === "Snow Fall" ? "Snow Fall" : "Lake White",
                username: "",
                displayName: "",
                email: "",
                links: [],
                socials: [],
                createdAt: new Date()
            });
        }
        
        console.log("Christmas accessory updated successfully:", accessoryType);
        
    } catch (error) {
        console.error("Error updating Christmas accessory:", error);
        throw new Error("Failed to update Christmas accessory: " + error.message);
    }
}