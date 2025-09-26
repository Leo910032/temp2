// Create this file: components/GradientDebug.jsx
// Add this component temporarily to your profile page to see gradient data

"use client"
import React, { useContext } from "react";
import { HouseContext } from "../House";

export default function GradientDebug() {
    const { userData } = useContext(HouseContext);
    
    if (!userData) return null;

    const {
        backgroundType,
        gradientDirection,
        gradientColorStart,
        gradientColorEnd,
        backgroundColor,
        selectedTheme
    } = userData;

    const gradientStyle = {
        background: backgroundType === 'Gradient' 
            ? `linear-gradient(${gradientDirection === 1 ? 'to top' : 'to bottom'}, ${gradientColorStart || '#FFFFFF'}, ${gradientColorEnd || '#000000'})`
            : backgroundColor || '#FFFFFF',
        height: '100px',
        width: '200px',
        borderRadius: '8px',
        border: '2px solid #333'
    };

    return (
        <div 
            style={{
                position: 'fixed',
                top: '10px',
                right: '10px',
                background: 'rgba(255, 255, 255, 0.95)',
                padding: '12px',
                borderRadius: '8px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                fontSize: '12px',
                fontFamily: 'monospace',
                zIndex: 9999,
                maxWidth: '250px'
            }}
        >
            <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>
                🎨 Gradient Debug
            </div>
            
            <div style={gradientStyle}></div>
            
            <div style={{ marginTop: '8px', lineHeight: '1.4' }}>
                <div><strong>Theme:</strong> {selectedTheme}</div>
                <div><strong>Type:</strong> {backgroundType}</div>
                <div><strong>Direction:</strong> {gradientDirection} ({gradientDirection === 1 ? 'up' : 'down'})</div>
                <div><strong>Start:</strong> {gradientColorStart || 'undefined'}</div>
                <div><strong>End:</strong> {gradientColorEnd || 'undefined'}</div>
                <div><strong>BgColor:</strong> {backgroundColor || 'undefined'}</div>
            </div>
            
            {backgroundType === 'Gradient' && (
                <div style={{ 
                    marginTop: '6px', 
                    padding: '4px', 
                    background: '#f0f0f0', 
                    borderRadius: '4px',
                    fontSize: '10px',
                    wordBreak: 'break-all'
                }}>
                    CSS: linear-gradient({gradientDirection === 1 ? 'to top' : 'to bottom'}, {gradientColorStart}, {gradientColorEnd})
                </div>
            )}
        </div>
    );
}

// To use this, add it to your House.jsx component:
// 1. Import it: import GradientDebug from "./components/GradientDebug";
// 2. Add it right before the closing </HouseContext.Provider> tag:
//    <GradientDebug />

// This will show you a small debug panel in the top-right corner of your profile
// Remove it once you confirm the gradient is working correctly