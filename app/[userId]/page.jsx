// File: app/[userId]/page.jsx

import { fetchProfileByUsername } from "@/lib/server/fetchProfileData";
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
            images: [userData.profilePhoto || ''],
        }
    };
}

export default async function UserLinksPage({ params: { userId } }) {
    const initialUserData = await fetchProfileByUsername(userId);

    if (!initialUserData) {
        notFound(); // Triggers the not-found.tsx page
    }
    
    return (
        <LanguageProvider>
            <div className="w-screen h-screen flex flex-col">
                <Toaster />
                {/* Pass all fetched data down to the client component */}
                <House initialUserData={initialUserData} />
            </div>
        </LanguageProvider>
    );
}