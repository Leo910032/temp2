// app/dashboard/(dashboard pages)/contacts/components/GroupModalComponents/QuickActions.jsx
"use client"

export default function QuickActions({ availableAiFeatures, onTabChange }) {
    const actions = [
        {
            id: 'ai-generate',
            icon: '🤖',
            title: 'AI Group Generator',
            subtitle: 'Smart grouping with AI',
            className: 'bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600',
            available: availableAiFeatures.length > 0
        },
        {
            id: 'create',
            icon: '➕',
            title: 'Create Custom Group',
            subtitle: 'Manual selection or time frames',
            className: 'bg-white border border-gray-200 hover:bg-gray-50 text-gray-900',
            available: true
        },
        {
            id: 'groups',
            icon: '📋',
            title: 'Manage Groups',
            subtitle: 'View and edit existing groups',
            className: 'bg-white border border-gray-200 hover:bg-gray-50 text-gray-900',
            available: true
        }
    ];

    return (
        <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">Quick Actions</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {actions.filter(action => action.available).map(action => (
                    <QuickActionButton
                        key={action.id}
                        {...action}
                        onClick={() => onTabChange(action.id)}
                    />
                ))}
            </div>
        </div>
    );
}

function QuickActionButton({ icon, title, subtitle, className, onClick }) {
    return (
        <button 
            onClick={onClick}
            className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${className}`}
        >
            <span className="text-lg">{icon}</span>
            <div className="text-left">
                <div className="font-medium">{title}</div>
                <div className="text-xs opacity-90">{subtitle}</div>
            </div>
        </button>
    );
}