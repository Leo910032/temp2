// components/admin/UserDetails.jsx
"use client"
import Image from 'next/image';
import UserUsageOverview from './UserUsageOverview';

export default function UserDetails({ selectedUser, userDetailLoading, userUsageLogs }) {
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
                <h3 className="text-lg font-semibold text-gray-900">User Details</h3>
                {selectedUser && (
                    <p className="text-sm text-gray-500">Selected: {selectedUser.displayName}</p>
                )}
            </div>
            <div className="p-6">
                {userDetailLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                            <p className="mt-2 text-sm text-gray-600">Loading user details...</p>
                        </div>
                    </div>
                ) : selectedUser ? (
                    <div className="space-y-4">
                        <div className="flex items-center space-x-4">
                            {selectedUser.profilePhoto ? (
                                <Image
                                    src={selectedUser.profilePhoto}
                                    alt={selectedUser.displayName}
                                    width={64}
                                    height={64}
                                    className="rounded-full object-cover"
                                />
                            ) : (
                                <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center">
                                    <span className="text-xl font-semibold text-gray-600">
                                        {selectedUser.displayName?.charAt(0) || 'U'}
                                    </span>
                                </div>
                            )}
                            <div>
                                <h4 className="text-xl font-bold">{selectedUser.displayName}</h4>
                                <p className="text-gray-600">@{selectedUser.username}</p>
                                <p className="text-sm text-gray-500">{selectedUser.email}</p>
                                <div className="flex items-center space-x-2 mt-1">
                                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                        selectedUser.accountType === 'business' ? 'bg-yellow-100 text-yellow-800' :
                                        selectedUser.accountType === 'premium' ? 'bg-purple-100 text-purple-800' :
                                        selectedUser.accountType === 'pro' ? 'bg-blue-100 text-blue-800' :
                                        'bg-gray-100 text-gray-800'
                                    }`}>
                                        {selectedUser.accountType || 'base'} account
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Analytics Section */}
                        <div className="bg-gray-50 rounded-lg p-4">
                            <h5 className="font-medium text-gray-900 mb-3">📊 Analytics Overview</h5>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-green-600">
                                        {formatNumber(selectedUser.analytics?.totalViews || 0)}
                                    </div>
                                    <div className="text-sm text-gray-600">Total Views</div>
                                    {selectedUser.analytics?.todayViews > 0 && (
                                        <div className="text-xs text-green-500">
                                            +{selectedUser.analytics.todayViews} today
                                        </div>
                                    )}
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-blue-600">
                                        {formatNumber(selectedUser.analytics?.totalClicks || 0)}
                                    </div>
                                    <div className="text-sm text-gray-600">Total Clicks</div>
                                    {selectedUser.analytics?.todayClicks > 0 && (
                                        <div className="text-xs text-blue-500">
                                            +{selectedUser.analytics.todayClicks} today
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            {selectedUser.analytics?.topTrafficSource && (
                                <div className="border-t pt-3">
                                    <div className="text-sm font-medium text-gray-700 mb-2">Top Traffic Source</div>
                                    <div className="flex items-center justify-between bg-white rounded p-3">
                                        <div className="flex items-center space-x-2">
                                            <span className="text-lg">
                                                {getTrafficSourceIcon(selectedUser.analytics.topTrafficSource.name)}
                                            </span>
                                            <div>
                                                <div className="font-medium capitalize">
                                                    {selectedUser.analytics.topTrafficSource.name}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {selectedUser.analytics.topTrafficSource.medium}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-semibold">
                                                {selectedUser.analytics.topTrafficSource.views + selectedUser.analytics.topTrafficSource.clicks} total
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {selectedUser.analytics.topTrafficSource.views}v • {selectedUser.analytics.topTrafficSource.clicks}c
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t">
                                <div className="text-center">
                                    <div className="text-lg font-bold text-purple-600">
                                        {selectedUser.analytics?.linkCount || 0}
                                    </div>
                                    <div className="text-sm text-gray-600">Links Tracked</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-lg font-bold text-orange-600">
                                        {selectedUser.analytics?.trafficSourceCount || 0}
                                    </div>
                                    <div className="text-sm text-gray-600">Traffic Sources</div>
                                </div>
                            </div>
                        </div>

                        {/* User Usage Overview Component */}
                        <UserUsageOverview usageLogs={userUsageLogs} userId={selectedUser.id} />

                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Bio</label>
                                <p className="text-sm text-gray-900">{selectedUser.bio || 'No bio'}</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Theme</label>
                                <p className="text-sm text-gray-900">{selectedUser.selectedTheme}</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Links ({selectedUser.links?.length || 0})</label>
                                <div className="space-y-1 max-h-32 overflow-y-auto">
                                    {selectedUser.links?.length > 0 ? (
                                        selectedUser.links.map((link, index) => (
                                            <div key={index} className="text-sm p-2 bg-gray-50 rounded">
                                                <div className="font-medium">{link.title}</div>
                                                <div className="text-gray-600 truncate">{link.url}</div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-gray-500">No links</p>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Social Links</label>
                                <p className="text-sm text-gray-900">{selectedUser.socials?.length || 0} social accounts</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Created</label>
                                <p className="text-sm text-gray-900">
                                    {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString() : 'Unknown'}
                                </p>
                            </div>

                            <div className="flex items-center space-x-4">
                                {selectedUser.sensitiveStatus && (
                                    <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded">
                                        Sensitive Content
                                    </span>
                                )}
                                {selectedUser.supportBannerStatus && (
                                    <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
                                        Support Banner
                                    </span>
                                )}
                                {selectedUser.emailVerified && (
                                    <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                                        Email Verified
                                    </span>
                                )}
                            </div>

                            <div className="pt-4">
                                <a
                                    href={`/${selectedUser.username}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                >
                                    View Public Profile →
                                </a>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-500">
                        <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Select a user to view details
                    </div>
                )}
            </div>
        </div>
    );
}