import { fireApp } from "@/important/firebase";
import { collection, doc, getDoc } from "firebase/firestore";
import Image from "next/image";

/**
 * Fetches user profile data and returns a JSX element for the profile picture.
 * This is now an async function that performs a one-time fetch.
 * @param {string} userId - The Firebase Auth UID of the user.
 * @returns {Promise<JSX.Element>} A promise that resolves to an <Image> or a placeholder <div>.
 */
export async function fetchProfilePicture(userId) {
    // 1. A guard clause for when no userId is provided.
    if (!userId) {
        // Return a default placeholder JSX immediately.
        return (
            <div className="h-[95%] aspect-square w-[95%] rounded-full bg-gray-300 border grid place-items-center">
                <span className="text-3xl font-semibold uppercase">?</span>
            </div>
        );
    }
    
    try {
        const docRef = doc(fireApp, "AccountData", userId); // 2. Use the provided userId
        const docSnap = await getDoc(docRef); // 3. Use getDoc for a more efficient one-time fetch

        if (docSnap.exists()) {
            const { profilePhoto, displayName } = docSnap.data();

            if (profilePhoto && profilePhoto.trim() !== '') {
                // 4. Return the Image component directly
                return (
                    <Image
                        src={profilePhoto}
                        alt="profile"
                        height={1000}
                        width={1000}
                        className="min-w-full h-full object-cover"
                        priority
                    />
                );
            } else {
                // 5. Return the placeholder JSX with the user's initial
                return (
                    <div className="h-[95%] aspect-square w-[95%] rounded-full bg-gray-300 border grid place-items-center">
                        <span className="text-3xl font-semibold uppercase">
                            {/* Added safety checks for displayName */}
                            {displayName ? displayName.charAt(0) : ''} 
                        </span>
                    </div>
                );
            }
        } else {
            // Handle case where AccountData document doesn't exist for the user yet
            return (
                 <div className="h-[95%] aspect-square w-[95%] rounded-full bg-gray-300 border grid place-items-center">
                     <span className="text-3xl font-semibold uppercase">?</span>
                 </div>
            );
        }
    } catch (error) {
        console.error("Error fetching profile picture:", error);
        // Return a fallback in case of an error
        return (
             <div className="h-[95%] aspect-square w-[95%] rounded-full bg-gray-300 border grid place-items-center">
                 <span className="text-3xl font-semibold uppercase">!</span>
             </div>
        );
    }
}