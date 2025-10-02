'use client'

import { useDashboard } from '@/app/dashboard/DashboardContext';
import { useEffect, useState, useContext } from "react";
import { useSettings } from '../SettingsContext';
export default function Position() {
const { currentUser } = useDashboard();
const { settings, updateSettings } = useSettings();

    const [pick, setPick] = useState(0);

    // ✅ FIXED: Get social position from centralized settings state
    useEffect(() => {
        if (settings?.socialPosition !== undefined) {
            setPick(settings.socialPosition);
        }
    }, [settings?.socialPosition]);

    // ✅ FIXED: Update through centralized state with better logging
    const handlePositionChange = (position) => {
        console.log('🔄 Changing social position from', pick, 'to', position);
        setPick(position);
        updateSettings('socialPosition', position);
    };

    // Don't render if user is not authenticated or settings not loaded
    if (!currentUser || !settings) {
        return (
            <div className="my-5 grid gap-4 pl-5 animate-pulse">
                <div className="h-6 w-16 bg-gray-200 rounded-md"></div>
                <div className="h-6 w-20 bg-gray-200 rounded-md"></div>
            </div>
        );
    }

    return (
        <div className="my-5 grid gap-4 pl-5">
            <div className="cursor-pointer flex items-center gap-3 w-fit" onClick={() => handlePositionChange(0)}>
                <div className={`hover:scale-105 active:scale-95 h-6 w-6 bg-black rounded-full relative grid place-items-center bg-opacity-0 ${pick === 0 ? "after:absolute after:h-2 after:w-2 bg-opacity-100 after:bg-white after:rounded-full" : "border"} `}></div>
                <div className="flex items-center text-sm">
                    <span className="opacity-80">Top</span>
                </div>
            </div>
            <div className="cursor-pointer flex gap-3 w-fit" onClick={() => handlePositionChange(1)}>
                <div className={`hover:scale-105 active:scale-95 h-6 w-6 bg-black rounded-full relative grid place-items-center bg-opacity-0 ${pick === 1 ? "after:absolute after:h-2 after:w-2 bg-opacity-100 after:bg-white after:rounded-full" : "border"} `}></div>
                <div className="flex items-center text-sm">
                    <span className="opacity-80">bottom</span>
                </div>
            </div>
        </div>
    )
}