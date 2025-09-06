// components/ContactsMap/MapControls.jsx - Minimal controls without group creation
import React from 'react';

export default function MapControls({
    isLoaded,
    isMobile
}) {
    if (!isLoaded || isMobile) return null;

    return (
        <div className="absolute top-20 right-4 z-20">
            {/* Controls could be added here in the future if needed */}
            {/* For now, this component serves as a placeholder for any future map controls */}
        </div>
    );
}