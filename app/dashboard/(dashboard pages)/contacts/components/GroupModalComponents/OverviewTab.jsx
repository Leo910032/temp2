// app/dashboard/(dashboard pages)/contacts/components/GroupModalComponents/OverviewTab.jsx
"use client"

import { CONTACT_FEATURES } from '@/lib/services/constants';
import StatsGrid from './overview/StatsGrid';
import QuickActions from './overview/QuickActions';
import GroupCard from './GroupCard';

export default function OverviewTab({
    groupStats,
    onTabChange,
    groups,
    contacts,
    hasFeature,
    usageInfo,
    usageLoading,
    isLoading
}) {
    // Check feature availability
    const hasBasicGroups = hasFeature(CONTACT_FEATURES.BASIC_GROUPS);
    const hasAdvancedGroups = hasFeature(CONTACT_FEATURES.ADVANCED_GROUPS);
    const hasAIGroups = hasFeature(CONTACT_FEATURES.AI_GROUPS);
    const hasRulesBasedGroups = hasFeature(CONTACT_FEATURES.RULES_BASED_GROUPS);

    return (
        <div className="space-y-6">
            {/* Stats Grid */}
            <StatsGrid groupStats={groupStats} />

            {/* Feature Status */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-200">
                <div className="flex items-center gap-3">
                    <div className="text-2xl">💎</div>
                    <div className="flex-1">
                        <h4 className="font-medium text-gray-900 mb-2">Available Features</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                            <FeatureItem
                                label="Basic Groups"
                                available={hasBasicGroups}
                            />
                            <FeatureItem
                                label="Advanced Groups"
                                available={hasAdvancedGroups}
                            />
                            <FeatureItem
                                label="AI-Powered Grouping"
                                available={hasAIGroups}
                            />
                            <FeatureItem
                                label="Rules-Based Grouping"
                                available={hasRulesBasedGroups}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <QuickActions
                availableAiFeatures={hasAIGroups ? ['AI_GROUPS'] : []}
                onTabChange={onTabChange}
            />

            {/* Usage Info (if available) */}
            {hasAIGroups && usageInfo && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <h4 className="font-medium text-gray-900 mb-2">AI Usage</h4>
                    <div className="text-sm text-gray-600">
                        {usageLoading ? (
                            <div className="animate-pulse">Loading usage info...</div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <div className="text-xs text-gray-500">Groups Created</div>
                                    <div className="text-lg font-semibold text-blue-700">
                                        {usageInfo.groupsCreated || 0}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500">Remaining Credits</div>
                                    <div className="text-lg font-semibold text-blue-700">
                                        {usageInfo.creditsRemaining || 'Unlimited'}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Recent Groups Preview */}
            {groups.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">Recent Groups</h4>
                        <button
                            onClick={() => onTabChange('groups')}
                            className="text-sm text-purple-600 hover:text-purple-700"
                        >
                            View All →
                        </button>
                    </div>
                    <div className="space-y-2">
                        {groups.slice(0, 5).map(group => (
                            <GroupCard
                                key={group.id}
                                group={group}
                                groups={groups}
                                contacts={contacts}
                                compact={true}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {groups.length === 0 && (
                <div className="text-center py-8">
                    <div className="text-4xl mb-3">📁</div>
                    <h4 className="font-medium text-gray-900 mb-2">No Groups Yet</h4>
                    <p className="text-gray-600 text-sm mb-4">
                        Get started by creating your first contact group
                    </p>
                    {hasBasicGroups && (
                        <button
                            onClick={() => onTabChange('create')}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                        >
                            Create First Group
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

// Supporting Components

function FeatureItem({ label, available }) {
    return (
        <div className="flex items-center gap-2">
            <span className={`text-lg ${available ? '✅' : '❌'}`}>
                {available ? '✅' : '❌'}
            </span>
            <span className={available ? 'text-green-700' : 'text-gray-500'}>
                {label}
            </span>
        </div>
    );
}
