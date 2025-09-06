// app/dashboard/(dashboard pages)/contacts/components/GroupModalComponents/LocationSelector.jsx
"use client"
import EventLocationSearch from '../EventLocationSearch.jsx';

export default function LocationSelector({ eventLocation, onLocationSelect }) {
    return (
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <label className="font-medium text-gray-900">📍 Event Location (Optional)</label>
            </div>
            <EventLocationSearch
                onLocationSelect={onLocationSelect}
                selectedLocation={eventLocation}
            />
            {eventLocation && (
                <div className="mt-3 p-2 bg-white rounded border border-green-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="font-medium text-sm">{eventLocation.name}</div>
                            <div className="text-xs text-gray-600">{eventLocation.address}</div>
                        </div>
                        <button
                            type="button"
                            onClick={() => onLocationSelect(null)}
                            className="text-red-500 hover:text-red-700 text-sm"
                        >
                            Remove
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}