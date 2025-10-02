// app/[userId]/page.jsx (This is a Server Component)

// ✅ SAFE IMPORTS
import { fetchProfileByUsername } from "@/lib/server/fetchProfileData";
import { ScanTokenService } from "@/lib/services/serviceContact/server/scanTokenService";
import House from "./House";
import Filter from "bad-words";
import { Toaster } from "react-hot-toast";
import { LanguageProvider } from "@/lib/translation/languageContext";
import { notFound } from 'next/navigation';

export async function generateMetadata({ params: { userId } }) {
    const userData = await fetchProfileByUsername(userId);
    
    if (!userData) {
        return {
            title: "Profile Not Found",
            description: "The profile you are looking for does not exist.",
        };
    }
    
    const filter = new Filter();
    const { metaData, displayName, username } = userData;
    
    return {
        title: metaData?.title ? filter.clean(metaData.title) : `@${username || userId} | MyLinks`,
        description: metaData?.description ? filter.clean(metaData.description) : `Check out ${displayName || username || userId}'s links and profile.`,
        openGraph: {
            images: [userData.avatarUrl || ''],
        }
    };
}

export default async function UserLinksPage({ params: { userId } }) {
    const initialUserData = await fetchProfileByUsername(userId);

    if (!initialUserData) {
        notFound();
    }

    // NEW: Generate secure scan token for business card scanning
    let scanToken = null;
    let scanAvailable = false;

    try {
        // Check if this profile supports business card scanning
        const scanAvailability = await ScanTokenService.checkScanAvailability(initialUserData.uid);
        
        if (scanAvailability.available) {
            console.log(`🔐 Generating scan token for profile: ${initialUserData.uid}`);
            
            const tokenResult = await ScanTokenService.generatePublicScanToken(
                initialUserData.uid,
                initialUserData.displayName || initialUserData.username || 'Profile Owner'
            );

            if (tokenResult.success) {
                scanToken = tokenResult.token;
                scanAvailable = true;
                console.log(`✅ Scan token generated successfully for: ${initialUserData.username}`);
            } else {
                console.log(`❌ Scan token generation failed: ${tokenResult.error}`);
            }
        } else {
            console.log(`⏭️ Business card scanning not available for ${initialUserData.username}: ${scanAvailability.reason}`);
        }
    } catch (error) {
        console.error('❌ Error setting up business card scanning:', error);
        // Fail gracefully - the exchange form will still work without scanning
    }
    
    return (
        <LanguageProvider>
            <div className="w-screen h-screen flex flex-col">
                <Toaster />
                <House 
                    initialUserData={initialUserData}
                    scanToken={scanToken}
                    scanAvailable={scanAvailable}
                />
            </div>
        </LanguageProvider>
    );
}