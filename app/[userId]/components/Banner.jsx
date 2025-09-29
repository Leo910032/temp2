// app/[userId]/components/Banner.jsx - FIXED

"use client"
import React, { useContext, useMemo } from "react";
import { HouseContext } from "../House";

export default function Banner() {
    const { userData } = useContext(HouseContext); // Hook #1: Always runs first
    
    // Use an empty object as a fallback to prevent errors if userData is null
    const {
        bannerType = 'None',
        bannerColor = '#3B82F6',
        bannerGradientStart = '#667eea',
        bannerGradientEnd = '#764ba2',
        bannerGradientDirection = 'to right',
        bannerImage = null,
        bannerVideo = null
    } = userData || {};

    // Hook #2: useMemo now runs on every render, maintaining the correct order
    const bannerStyles = useMemo(() => {
        const baseStyles = {
            position: 'fixed',
            top: '16px',
            left: '16px',
            right: '16px',
            width: 'calc(100% - 32px)',
            height: '200px',
            maxHeight: '40vh',
            zIndex: 15,
            overflow: 'hidden',
            pointerEvents: 'none',
            borderRadius: '24px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)'
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

    // ✅ This is the ONLY place you should check whether to render.
    // It comes AFTER all Hooks have been called.
    if (!userData || bannerType === 'None') {
        return null;
    }

    console.log('🎯 Banner rendering as TOP background layer with margins:', {
        bannerType,
        height: '200px',
        margins: '16px all around'
    });

    return (
        <div style={bannerStyles}>
            {bannerType === 'Video' && bannerVideo && (
                <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover rounded-3xl" style={{ zIndex: 1 }}>
                    <source src={bannerVideo} type="video/mp4" />
                    <source src={bannerVideo} type="video/webm" />
                </video>
            )}
            {(bannerType === 'Image' || bannerType === 'Video') && (
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20 rounded-3xl" style={{ zIndex: 2 }} />
            )}
            {(bannerType === 'Corporate' || bannerType === 'Creative' || bannerType === 'Minimal') && (
                <div className="absolute inset-0 opacity-5 rounded-3xl" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.4"%3E%3Ccircle cx="12" cy="12" r="1"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")', zIndex: 3 }} />
            )}
        </div>
    );
}