// components/admin/UserList.jsx
"use client"
import Image from 'next/image';

export default function UserList({ users, selectedUser, onUserClick }) {
    const formatNumber = (num) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    };

    const getTrafficSourceIcon = (source) => {
        const icons = {
            'instagram': '📸',
            'tiktok': '🎵',
            'twitter': '🐦',
            'facebook': '👤',
            'linkedin': '💼',
            'youtube': '📺',
            'google': '🔍',
            'direct': '🔗',
            'email': '📧',
            'localhost': '🏠'
        };
        return icons[source?.toLowerCase()] || '🌐';
    };

    return (
        <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">All Users ({users.length})</h3>
                <p className="text-sm text-gray-500">Sorted by engagement (views + clicks)</p>
            </div>
            <div className="max-h-96 overflow-y-auto">
                {users.map((user) => (
                    <div
                        key={user.id}
                        onClick={() => onUserClick(user)}
                        className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                            selectedUser?.id === user.id ? 'bg-blue-50 border-blue-200' : ''
                        }`}
                    >
                        <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0">
                                {user.profilePhoto ? (
                                    <Image
                                        src={user.profilePhoto}
                                        alt={user.displayName}
                                        width={40}
                                        height={40}
                                        className="rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                                        <span className="text-sm font-semibold text-gray-600">
                                            {user.displayName?.charAt(0) || 'U'}
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium text-gray-900 truncate">
                                        {user.displayName} (@{user.username})
                                    </p>
                                    <span className={`text-xs px-2 py-1 rounded-full ${
                                        user.accountType === 'business' ? 'bg-yellow-100 text-yellow-800' :
                                        user.accountType === 'premium' ? 'bg-purple-100 text-purple-800' :
                                        user.accountType === 'pro' ? 'bg-blue-100 text-blue-800' :
                                        'bg-gray-100 text-gray-800'
                                    }`}>
                                        {user.accountType || 'base'}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-500 truncate">{user.email}</p>
                                
                                <div className="flex items-center space-x-3 mt-1">
                                    <div className="flex items-center space-x-1">
                                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                            👁️ {formatNumber(user.analytics?.totalViews || 0)}
                                        </span>
                                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                            🖱️ {formatNumber(user.analytics?.totalClicks || 0)}
                                        </span>
                                    </div>
                                    {user.analytics?.topTrafficSource && (
                                        <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                                            {getTrafficSourceIcon(user.analytics.topTrafficSource.name)} {user.analytics.topTrafficSource.name}
                                        </span>
                                    )}
                                </div>
                                
                                <div className="flex items-center space-x-2 mt-1">
                                    <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                                        {user.linksCount} links
                                    </span>
                                    <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                                        {user.selectedTheme}
                                    </span>
                                    {user.sensitiveStatus && (
                                        <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                            Sensitive
                                        </span>
                                    )}
                                    {(user.analytics?.todayViews > 0 || user.analytics?.todayClicks > 0) && (
                                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                            🔥 Active
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}