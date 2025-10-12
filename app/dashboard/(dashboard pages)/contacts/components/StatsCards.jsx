// app/dashboard/(dashboard pages)/contacts/components/StatsCards.jsx
"use client"

export default function StatsCards({ stats, translations }) {
    // Provide safe default values if stats is null or undefined
    const safeStats = stats || {
        total: 0,
        new: 0,
        viewed: 0,
        withLocation: 0
    };

    // Provide safe default translations
    const safeTranslations = translations || {
        totalContacts: 'Total Contacts',
        newContacts: 'New',
        viewedContacts: 'Viewed',
        withLocation: 'With Location'
    };

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                <div className="text-xl sm:text-2xl font-bold text-blue-600">
                    {safeStats.total}
                </div>
                <div className="text-xs sm:text-sm text-gray-600 mt-1">
                    {safeTranslations.totalContacts}
                </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                <div className="text-xl sm:text-2xl font-bold text-green-600">
                    {safeStats.new}
                </div>
                <div className="text-xs sm:text-sm text-gray-600 mt-1">
                    {safeTranslations.newContacts}
                </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                <div className="text-xl sm:text-2xl font-bold text-purple-600">
                    {safeStats.viewed}
                </div>
                <div className="text-xs sm:text-sm text-gray-600 mt-1">
                    {safeTranslations.viewedContacts}
                </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                <div className="text-xl sm:text-2xl font-bold text-orange-600">
                    {safeStats.withLocation}
                </div>
                <div className="text-xs sm:text-sm text-gray-600 mt-1">
                    {safeTranslations.withLocation}
                </div>
            </div>
        </div>
    );
}