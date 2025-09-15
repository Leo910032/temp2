/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
// app/dashboard/(dashboard pages)/appearance/elements/Button.jsx
"use client"
import { useContext } from 'react';
import { AppearanceContext } from '../AppearanceContext';

export default function Button({ type, modifierClass, modifierStyles, onUpdate, disabled }) {
    // Get the current button type from the context to see if this one is selected.
    const { appearance } = useContext(AppearanceContext);
    const isSelected = appearance?.btnType === type;

    const handleClick = () => {
        // Only call the update function if not disabled and not already selected.
        if (!disabled && !isSelected) {
            onUpdate(type);
        }
    };

    return (
        <div
            onClick={handleClick}
            className={`flex-1 h-10 relative cursor-pointer active:scale-90 hover:scale-105 transition-transform duration-200 ${
                disabled ? 'opacity-50 cursor-not-allowed' : ''
            } ${modifierClass}`}
            style={modifierStyles}
        >
            {isSelected && (
                <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">✓</span>
                </div>
            )}
        </div>
    );
}