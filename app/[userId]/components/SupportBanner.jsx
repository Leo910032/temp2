// app/[userId]/components/SupportBanner.jsx - FIXED

"use client"
import React, { useContext, useMemo } from "react";
import { HouseContext } from "../House";

export default function Banner() {
    // HOOK #1: Always called first
    const { userData } = useContext(HouseContext);
    
    // Destructure with a fallback to prevent errors if userData is null
    const {
        bannerType = 'None',
        bannerColor = '#3B82F6',
        bannerGradientStart = '#667eea',
        bannerGradientEnd = '#764ba2',
        bannerGradientDirection = 'to right',
        bannerImage = null,
        bannerVideo = null,
        displayName = '',
        bio = '',
        themeFontColor = '#FFFFFF'
    } = userData || {};

    // HOOK #2: Always called second
    const bannerStyles = useMemo(() => {
        const baseStyles = {
            position: 'relative',
            width: '100%',
            height: '200px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '0 0 24px 24px',
            overflow: 'hidden',
            marginBottom: '20px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
        };

        switch (bannerType) {
            case 'Color':
                return { ...baseStyles, backgroundColor: bannerColor };
            case 'Gradient':
                return { ...baseStyles, backgroundImage: `linear-gradient(${bannerGradientDirection}, ${bannerGradientStart}, ${bannerGradientEnd})` };
            case 'Image':
                return { ...baseStyles, backgroundImage: bannerImage ? `url(${bannerImage})` : `linear-gradient(${bannerGradientDirection}, ${bannerGradientStart}, ${bannerGradientEnd})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' };
            case 'Video':
                return baseStyles;
            case 'Corporate':
                return { ...baseStyles, backgroundImage: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' };
            case 'Creative':
                return { ...baseStyles, backgroundImage: 'linear-gradient(45deg, #f093fb 0%, #f5576c 100%)' };
            case 'Minimal':
                return { ...baseStyles, backgroundImage: 'linear-gradient(to right, #ffecd2 0%, #fcb69f 100%)' };
            default:
                return { ...baseStyles, backgroundColor: bannerColor };
        }
    }, [bannerType, bannerColor, bannerGradientStart, bannerGradientEnd, bannerGradientDirection, bannerImage]);

    // ✅ CONDITIONAL RETURN: This happens AFTER all hooks are called
    if (!userData || bannerType === 'None') {
        return <BannerPlaceholder />; // Render placeholder or null
    }

    const getContrastColor = (backgroundColor) => {
        if (!backgroundColor || ['Gradient', 'Image', 'Video'].includes(bannerType)) {
            return themeFontColor || '#FFFFFF'; // Use theme font color or default to white
        }
        const hex = backgroundColor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return brightness > 128 ? '#000000' : '#FFFFFF';
    };

    const textColor = getContrastColor(bannerColor);
    
    console.log('🎯 Banner rendering:', { bannerType, bannerColor, bannerImage: !!bannerImage, bannerVideo: !!bannerVideo });

    return (
        <div className="w-full max-w-4xl mx-auto">
            <div style={bannerStyles}>
                {bannerType === 'Video' && bannerVideo && (
                    <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover" style={{ zIndex: 1 }}>
                        <source src={bannerVideo} type="video/mp4" />
                        <source src={bannerVideo} type="video/webm" />
                    </video>
                )}
                {(bannerType === 'Image' || bannerType === 'Video') && (
                    <div className="absolute inset-0 bg-black bg-opacity-30" style={{ zIndex: 1 }} />
                )}
                {(displayName || bio) && (
                    <div className="absolute bottom-5 left-5 right-5 z-10" style={{ color: textColor, textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)' }}>
                        {displayName && (
                            <h1 className="text-2xl md:text-3xl font-bold mb-2 leading-tight">{displayName}</h1>
                        )}
                        {bio && (
                            <p className="text-sm md:text-base opacity-90 max-w-lg leading-relaxed">
                                {bio.length > 120 ? `${bio.substring(0, 120)}...` : bio}
                            </p>
                        )}
                    </div>
                )}
                {(bannerType === 'Corporate' || bannerType === 'Creative' || bannerType === 'Minimal') && (
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.4"%3E%3Ccircle cx="12" cy="12" r="1"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")', zIndex: 1 }} />
                )}
            </div>
        </div>
    );
}

// Optional: Banner placeholder component for profiles without banners
export function BannerPlaceholder() {
    return (
        <div className="w-full max-w-4xl mx-auto mb-5">
            <div className="w-full h-24 bg-gradient-to-r from-gray-100 to-gray-200 rounded-b-3xl opacity-30" />
        </div>
    );
}