"use client";

import React, { createContext, useState, useContext } from 'react';

const MapVisibilityContext = createContext(null);

export function useMapVisibility() {
    return useContext(MapVisibilityContext);
}

export function MapVisibilityProvider({ children }) {
    const [isMapOpen, setIsMapOpen] = useState(false);

    const value = { isMapOpen, setIsMapOpen };

    return (
        <MapVisibilityContext.Provider value={value}>
            {children}
        </MapVisibilityContext.Provider>
    );
}
