import { fireApp } from "@/important/firebase";
import { collection, doc, setDoc } from "firebase/firestore";

/**
 * Updates the 'socials' array in the user's AccountData document.
 * @param {Array} arrayOfSocials - The new array of social links.
 * @param {string} userId - The Firebase Auth UID of the user.
 */
export async function updateSocials(arrayOfSocials, userId) {
    if (!userId) {
        throw new Error("User not authenticated. Cannot update socials.");
    }
    
    try {
        const docRef = doc(fireApp, "AccountData", userId);
        await setDoc(docRef, { socials: arrayOfSocials }, { merge: true });
    } catch (error) {
        console.error("Error updating socials:", error);
        throw new Error(error.message);
    }
}

/**
 * Updates the position of the social icons on the user's page.
 * @param {string} position - The position value (e.g., 'top' or 'bottom').
 * @param {string} userId - The Firebase Auth UID of the user.
 */
export async function updateSocialPosition(position, userId) {
    if (!userId) {
        throw new Error("User not authenticated. Cannot update social position.");
    }
    
    try {
        const docRef = doc(fireApp, "AccountData", userId);
        await setDoc(docRef, { socialPosition: position }, { merge: true });
    } catch (error) {
        console.error("Error updating social position:", error);
        throw new Error(error.message);
    }
}

/**
 * Updates the user's chosen support banner cause.
 * @param {object} choice - The object representing the chosen cause.
 * @param {string} userId - The Firebase Auth UID of the user.
 */
export async function updateSupportBanner(choice, userId) {
    if (!userId) {
        throw new Error("User not authenticated. Cannot update support banner.");
    }
    
    try {
        const docRef = doc(fireApp, "AccountData", userId);
        await setDoc(docRef, { supportBanner: choice }, { merge: true });
    } catch (error) {
        console.error("Error updating support banner:", error);
        throw new Error(error.message);
    }
}

/**
 * Updates the visibility status of the support banner.
 * @param {boolean} status - The new status (true for visible, false for hidden).
 * @param {string} userId - The Firebase Auth UID of the user.
 */
export async function updateSupportBannerStatus(status, userId) {
    if (!userId) {
        throw new Error("User not authenticated. Cannot update support banner status.");
    }
    
    try {
        const docRef = doc(fireApp, "AccountData", userId);
        await setDoc(docRef, { supportBannerStatus: status }, { merge: true });
    } catch (error) {
        console.error("Error updating support banner status:", error);
        throw new Error(error.message);
    }
}

/**
 * Updates the type of sensitive content warning.
 * @param {string} type - The type of sensitive content.
 * @param {string} userId - The Firebase Auth UID of the user.
 */
export async function updateSensitiveType(type, userId) {
    if (!userId) {
        throw new Error("User not authenticated. Cannot update sensitive content type.");
    }

    try {
        const docRef = doc(fireApp, "AccountData", userId);
        await setDoc(docRef, { sensitivetype: type }, { merge: true });
    } catch (error) {
        console.error("Error updating sensitive content type:", error);
        throw new Error(error.message);
    }
}

/**
 * Updates the status of the sensitive content warning.
 * @param {boolean} status - The new status (true for active, false for inactive).
 * @param {string} userId - The Firebase Auth UID of the user.
 */
export async function updateSensitiveStatus(status, userId) {
    if (!userId) {
        throw new Error("User not authenticated. Cannot update sensitive content status.");
    }

    try {
        const docRef = doc(fireApp, "AccountData", userId);
        await setDoc(docRef, { sensitiveStatus: status }, { merge: true });
    } catch (error) {
        console.error("Error updating sensitive content status:", error);
        throw new Error(error.message);
    }
}

/**
 * Updates the custom SEO metadata for the user's page.
 * @param {object} metadata - The object containing the meta title and description.
 * @param {string} userId - The Firebase Auth UID of the user.
 */
export async function updateCustomMetaData(metadata, userId) {
    if (!userId) {
        throw new Error("User not authenticated. Cannot update metadata.");
    }

    try {
        const docRef = doc(fireApp, "AccountData", userId);
        await setDoc(docRef, { metaData: metadata }, { merge: true });
    } catch (error) {
        console.error("Error updating metadata:", error);
        throw new Error(error.message);
    }
}