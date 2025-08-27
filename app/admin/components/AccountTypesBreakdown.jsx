// components/admin/AccountTypesBreakdown.jsx
"use client"

export default function AccountTypesBreakdown({ stats }) {
    return (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Types</h3>
            <div className="grid grid-cols-4 gap-4">
                <div className="text-center">
                    <div className="text-xl font-bold text-gray-600">{stats.accountTypes?.base || 0}</div>
                    <div className="text-sm text-gray-500">Base</div>
                </div>
                <div className="text-center">
                    <div className="text-xl font-bold text-blue-600">{stats.accountTypes?.pro || 0}</div>
                    <div className="text-sm text-gray-500">Pro</div>
                </div>
                <div className="text-center">
                    <div className="text-xl font-bold text-purple-600">{stats.accountTypes?.premium || 0}</div>
                    <div className="text-sm text-gray-500">Premium</div>
                </div>
                <div className="text-center">
                    <div className="text-xl font-bold text-yellow-600">{stats.accountTypes?.business || 0}</div>
                    <div className="text-sm text-gray-500">Business</div>
                </div>
            </div>
        </div>
    );
}