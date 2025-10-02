
//UPDATED
// app/dashboard/(dashboard pages)/contacts/components/ContactsMap/ZoomIndicator.jsx
import React from 'react';

export function ZoomIndicator({ isLoaded, currentZoom, clusterState }) {
    if (!isLoaded) return null;

    return (
        <div className="absolute top-4 left-4 bg-black bg-opacity-75 text-white px-3 py-2 rounded-lg text-xs z-40">
            <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                    currentZoom < 11 ? 'bg-blue-400' : 
                    currentZoom < 14 ? 'bg-yellow-400' : 'bg-green-400'
                }`}></div>
                <span>
                    {currentZoom < 11 && 'Group Clusters'}
                    {currentZoom >= 11 && currentZoom < 14 && 'Mixed View'}
                    {currentZoom >= 14 && 'Individual Markers'}
                </span>
                <span className="text-gray-300">({currentZoom?.toFixed(1)})</span>
            </div>
            {clusterState && (
                <div className="mt-1 text-xs opacity-75">
                    Groups: {clusterState.groupMarkersVisible} | Individual: {clusterState.individualMarkersVisible}
                </div>
            )}
        </div>
    );
}