"use client"
import { useContext, useMemo } from "react";
import { HouseContext } from "../House";
import Button from "../elements/Button";
import Socials from "../elements/Socials";
import { filterProperly } from "@/lib/utilities";
import CVButton from '../elements/CVButton';
import ProfileCarousel from './ProfileCarousel';
import MediaDisplay from './MediaDisplay';
import { hasAppearanceFeature, APPEARANCE_FEATURES } from "@/lib/services/constants";

export default function MyLinks() {
    const { userData } = useContext(HouseContext);
    const {
        links = [],
        socials = [],
        socialPosition = 0,
        supportBannerStatus = false,
        themeFontColor = "",
        themeTextColour = "",
        sensitiveStatus = false,
        carousels = [],
        cvEnabled = false,
        cvItems = [],
        cvDocument = null,
        mediaEnabled = false,
        mediaItems = [],
        subscriptionLevel = 'base'
    } = userData;

    // Check if user has permission for carousel and media embed features
    const canUseCarousel = hasAppearanceFeature(subscriptionLevel, APPEARANCE_FEATURES.CUSTOM_CAROUSEL);
    const canUseMedia = hasAppearanceFeature(subscriptionLevel, APPEARANCE_FEATURES.CUSTOM_MEDIA_EMBED);

    // ✅ IMPROVED: Better memoization of filtered links
    const displayLinks = useMemo(() => {
        return links.filter((link) => link.isActive !== false);
    }, [links]);

    // ✅ IMPROVED: Better memoization of active socials
    const activeSocials = useMemo(() => {
        return socials.filter((social) => social.active === true);
    }, [socials]);

    // ✅ IMPROVED: Memoize display color
    const displayColor = useMemo(() => {
        return themeFontColor === "#000" ? themeTextColour : themeFontColor;
    }, [themeFontColor, themeTextColour]);

    // ✅ ADDED: Debug logging
    console.log('🔄 MyLinks render:', {
        linksCount: displayLinks.length,
        socialsCount: activeSocials.length,
        socialPosition,
        supportBannerStatus
    });

    return (
        <div className={`flex flex-col gap-4 my-4 w-full px-5 py-1 items-center max-h-fit ${
            supportBannerStatus ? "pb-12" : ""
        }`}>
            {/* ✅ FIXED: Better conditional rendering for top socials */}
            {socialPosition === 0 && activeSocials.length > 0 && (
                <div className="w-full flex justify-center">
                    <Socials />
                </div>
            )}
            
            {/* ✅ IMPROVED: Better key for links */}
            {displayLinks.map((link) => {
                if (link.type === 0) { // Header type
                    return (
                        <span
                            key={`header-${link.id}`}
                            style={{ color: displayColor }}
                            className="mx-auto font-semibold text-sm mt-2"
                        >
                            {sensitiveStatus ? link.title : filterProperly(link.title)}
                        </span>
                    );
                } else if (link.type === 2) { // Carousel type
                    // Find the specific carousel linked to this link
                    const linkedCarousel = carousels?.find(
                        carousel => carousel.id === link.carouselId
                    );

                    // Only render if user has permission, carousel exists, is enabled, and has items
                    if (canUseCarousel && linkedCarousel && linkedCarousel.enabled && linkedCarousel.items?.length > 0) {
                        return (
                            <div key={`carousel-${link.id}`} className="w-full flex justify-center md:block md:max-w-2xl">
                                <ProfileCarousel
                                    items={linkedCarousel.items}
                                    style={linkedCarousel.style || 'modern'}
                                    backgroundType={linkedCarousel.backgroundType}
                                    backgroundColor={linkedCarousel.backgroundColor}
                                    backgroundImage={linkedCarousel.backgroundImage}
                                    backgroundVideo={linkedCarousel.backgroundVideo}
                                    showTitle={linkedCarousel.showTitle !== false}
                                    showDescription={linkedCarousel.showDescription !== false}
                                />
                            </div>
                        );
                    }
                    // If carousel not configured or no permission, don't render anything
                    return null;
                } else if (link.type === 3) { // CV type
                    // Find the specific CV item this link refers to
                    const cvItem = cvItems.find(cv => cv.id === link.cvItemId);

                    // Only render CV if it's enabled and the specific document exists
                    if (cvEnabled && cvItem && cvItem.url) {
                        return (
                            <CVButton
                                key={`cv-${link.id}`}
                                cvDocument={cvItem}
                                userData={userData}
                            />
                        );
                    }
                    // If CV not configured or document not uploaded, don't render anything
                    return null;
                } else if (link.type === 4) { // Media type (images or videos)
                    // Find the specific media item linked to this link
                    const linkedMediaItem = mediaItems?.find(
                        item => item.id === link.mediaItemId
                    );

                    // Only render if user has permission, media is enabled, and the linked media exists with a URL
                    if (canUseMedia && mediaEnabled && linkedMediaItem && linkedMediaItem.url) {
                        return (
                            <div key={`media-${link.id}`} className="w-full">
                                <MediaDisplay items={[linkedMediaItem]} />
                            </div>
                        );
                    }
                    // If media not configured or no permission, don't render anything
                    return null;
                } else { // Button type
                    return (
                        <Button
                            key={`button-${link.id}`}
                            linkData={link}
                            content={sensitiveStatus ? link.title : filterProperly(link.title)}
                        />
                    );
                }
            })}

            {/* ✅ FIXED: Better conditional rendering for bottom socials */}
            {socialPosition === 1 && activeSocials.length > 0 && (
                <div className="w-full flex justify-center">
                    <Socials />
                </div>
            )}
        </div>
        
    );
}
