import { fireApp } from "@/important/firebase";
import { doc, getDoc } from "firebase/firestore";

/**
 * Fetches all appearance-related data for a given user in a single, efficient database read.
 * Replaces the individual fetchTheme, fetchThemeBtn, and fetchThemeFont functions.
 * 
 * @param {string} userId - The UID of the authenticated user.
 * @returns {Promise<object>} A promise that resolves to an object containing theme, button, and font data.
 *                            Returns default values if the document or fields don't exist.
 */
export async function fetchAppearanceData(userId) {
    // 1. Validate that a userId was provided to the function.
    if (!userId) {
        console.error("fetchAppearanceData called without a userId.");
        // Return a default state so the calling component doesn't break.
        return {
            selectedTheme: null,
            btnDesign: null,
            fontType: null,
        };
    }

    const docRef = doc(fireApp, "AccountData", userId);

    try {
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            // 2. Return all relevant fields from the single document read.
            //    Use nullish coalescing (??) or logical OR (||) to provide safe default values.
            return {
                selectedTheme: data.selectedTheme || null,
                btnDesign: data.btnDesign || null,
                fontType: data.fontType || null,
            };
        } else {
            // 3. Handle the case where the user document doesn't exist yet.
            console.log("No appearance document found for user:", userId);
            return {
                selectedTheme: null,
                btnDesign: null,
                fontType: null,
            };
        }
    } catch (error) {
        console.error("Error fetching appearance data:", error);
        // You could re-throw the error or return a default state.
        // Returning a default state is often safer for the UI.
        return {
            selectedTheme: null,
            btnDesign: null,
            fontType: null,
        };
    }
}