/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
// app/[userId]/components/AssetLayer.jsx
"use client"

import React, { useContext } from 'react';
import { HouseContext } from '../House';
import SnowFall from '../elements/themes/SnowFall'; // Import the SnowFall component

/**
 * Renders visual assets and effects (like snow, confetti) over the main profile content.
 * It reads the current settings from the HouseContext.
 */
export default function AssetLayer() {
    // 1. Get the full user data from the context provided by House.jsx
    const { userData } = useContext(HouseContext);

    // 2. Get the specific accessory value from the user data.
    const accessory = userData?.christmasAccessory;

    // 3. Conditionally render the correct component based on the value.
    // This is easily extendable for future accessories.
    switch (accessory) {
        case 'Snow Fall':
            return <SnowFall />;
        // case 'Confetti':
        //     return <Confetti />; // Example for a future accessory
        default:
            // If the accessory is null, undefined, or an unknown value, render nothing.
            return null;
    }
}