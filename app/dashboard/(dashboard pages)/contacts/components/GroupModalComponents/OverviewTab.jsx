// app/dashboard/(dashboard pages)/contacts/components/GroupModalComponents/OverviewTab.jsx
"use client"

import { CONTACT_FEATURES } from '@/lib/services/constants';
// import StatsGrid from './StatsGrid';
// import QuickActions from './QuickActions';
// import GroupCard from './GroupCard';

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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <StatCard
                    label="Total Groups"
                    value={groupStats.total}
                    icon="📁"
                    color="blue"
                />
                <StatCard
                    label="Custom Groups"
                    value={groupStats.custom}
                    icon="✏️"
                    color="green"
                />
                <StatCard
                    label="Auto Groups"
                    value={groupStats.auto}
                    icon="🔄"
                    color="purple"
                />
                <StatCard
                    label="AI Groups"
                    value={groupStats.ai}
                    icon="🤖"
                    color="pink"
                />
                <StatCard
                    label="Rules Groups"
                    value={groupStats.rules}
                    icon="📋"
                    color="indigo"
                />
            </div>

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
            <div>
                <h4 className="font-medium text-gray-900 mb-3">Quick Actions</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {hasBasicGroups && (
                        <ActionCard
                            title="Create Manual Group"
                            description="Manually select contacts to create a custom group"
                            icon="✏️"
                            onClick={() => onTabChange('create')}
                            buttonText="Create Group"
                        />
                    )}

                    {hasRulesBasedGroups && (
                        <ActionCard
                            title="Rules-Based Grouping"
                            description="Automatically group contacts based on rules"
                            icon="📋"
                            onClick={() => onTabChange('rules-generate')}
                            buttonText="Generate"
                            badge="Pro"
                        />
                    )}

                    {hasAIGroups && (
                        <ActionCard
                            title="AI Smart Grouping"
                            description="Let AI analyze and group your contacts intelligently"
                            icon="🤖"
                            onClick={() => onTabChange('ai-generate')}
                            buttonText="Generate"
                            badge="Premium"
                        />
                    )}

                    {!hasBasicGroups && (
                        <ActionCard
                            title="Upgrade for Groups"
                            description="Unlock group management features"
                            icon="🔒"
                            onClick={() => {/* TODO: Navigate to upgrade page */}}
                            buttonText="Upgrade Plan"
                            disabled
                        />
                    )}
                </div>
            </div>

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
                            <GroupPreviewCard
                                key={group.id}
                                group={group}
                                contacts={contacts}
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

function StatCard({ label, value, icon, color }) {
    const colorClasses = {
        blue: 'bg-blue-50 text-blue-700 border-blue-200',
        green: 'bg-green-50 text-green-700 border-green-200',
        purple: 'bg-purple-50 text-purple-700 border-purple-200',
        pink: 'bg-pink-50 text-pink-700 border-pink-200',
        indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200'
    };

    return (
        <div className={`rounded-lg p-4 border ${colorClasses[color] || colorClasses.blue}`}>
            <div className="text-2xl mb-2">{icon}</div>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-sm opacity-80">{label}</div>
        </div>
    );
}

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

function ActionCard({ title, description, icon, onClick, buttonText, badge, disabled }) {
    return (
        <div className={`border rounded-lg p-4 ${disabled ? 'bg-gray-50 opacity-60' : 'bg-white hover:shadow-md transition-shadow'}`}>
            <div className="flex items-start gap-3 mb-3">
                <div className="text-2xl">{icon}</div>
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <h5 className="font-medium text-gray-900">{title}</h5>
                        {badge && (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
                                {badge}
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-gray-600">{description}</p>
                </div>
            </div>
            <button
                onClick={onClick}
                disabled={disabled}
                className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    disabled
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-purple-600 text-white hover:bg-purple-700'
                }`}
            >
                {buttonText}
            </button>
        </div>
    );
}

function GroupPreviewCard({ group, contacts }) {
    const groupContacts = contacts.filter(c => group.contactIds?.includes(c.id));
    const memberCount = groupContacts.length;

    const getGroupTypeIcon = (type) => {
        if (type?.startsWith('ai_')) return '🤖';
        if (type?.startsWith('rules_')) return '📋';
        if (type === 'custom') return '✏️';
        if (type === 'auto' || type === 'auto_company') return '🔄';
        return '📁';
    };

    const getGroupTypeLabel = (type) => {
        if (type?.startsWith('ai_')) return 'AI';
        if (type?.startsWith('rules_')) return 'Rules';
        if (type === 'custom') return 'Custom';
        if (type === 'auto' || type === 'auto_company') return 'Auto';
        return 'Group';
    };

    return (
        <div className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
                <div className="text-xl">{getGroupTypeIcon(group.type)}</div>
                <div className="flex-1 min-w-0">
                    <h5 className="font-medium text-gray-900 truncate">{group.name}</h5>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span>{memberCount} members</span>
                        <span>•</span>
                        <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full">
                            {getGroupTypeLabel(group.type)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
