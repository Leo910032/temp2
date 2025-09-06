// lib/update data/updateTheme.jsx - FIXED

import { doc, updateDoc, setDoc } from "firebase/firestore";
import { auth, fireApp } from "@/important/firebase"; // ✅ 1. Import auth

/**
 * A generic helper function to update a user's theme data in Firestore.
 * It now gets the user ID automatically.
 * @param {object} dataToUpdate - An object containing the key-value pairs to update.
 */
async function updateUserThemeData(dataToUpdate) {
    const user = auth.currentUser; // ✅ 2. Get the current user

    if (!user) { // ✅ 3. Check if the user exists
        console.error("Update failed: User is not authenticated.");
        throw new Error("User not authenticated.");
    }
    
    const userId = user.uid; // ✅ 4. Get the UID

    try {
        const docRef = doc(fireApp, "AccountData", userId);
        await updateDoc(docRef, dataToUpdate);

    } catch (error) {
        if (error.code === 'not-found') {
            console.warn("Document not found, creating with new data...");
            try {
                const docRef = doc(fireApp, "AccountData", userId);
                await setDoc(docRef, dataToUpdate, { merge: true });
                return;
            } catch (set_error) {
                console.error("Error setting new theme data:", set_error);
                throw set_error;
            }
        }
        console.error("Error updating theme data:", error);
        throw error;
    }
}

// ✅ 5. REMOVE the userId parameter from all exported functions.
// They will now work automatically.

export async function updateTheme(theme, themeColor) {
    await updateUserThemeData({ 
        selectedTheme: theme, 
        themeFontColor: themeColor 
    });
}

export async function updateThemeBackground(type) {
    await updateUserThemeData({ backgroundType: type });
}

export async function updateThemeBackgroundColor(color) {
    await updateUserThemeData({ backgroundColor: color });
}

export async function updateThemeBtnColor(color) {
    await updateUserThemeData({ btnColor: color });
}

export async function updateThemeBtnFontColor(color) {
    await updateUserThemeData({ btnFontColor: color });
}

export async function updateThemeBtnShadowColor(color) {
    await updateUserThemeData({ btnShadowColor: color });
}

export async function updateThemeTextColour(color) {
    await updateUserThemeData({ themeTextColour: color });
}

export async function updateThemeGradientDirection(direction) {
    await updateUserThemeData({ gradientDirection: direction });
}

export async function updateThemeButton(btn) {
    await updateUserThemeData({ btnType: btn });
}

export async function updateThemeFont(font) {
    await updateUserThemeData({ fontType: font });
}