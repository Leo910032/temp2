// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

// app/dashboard/(dashboard pages)/contacts/components/GroupModalComponents/OverviewTab.jsx
"use client"
import StatsGrid from './StatsGrid';
import QuickActions from './QuickActions';
import GroupCard from './GroupCard';

export default function OverviewTab({ 
    groupStats, 
    subscriptionLevel, 
    onTabChange, 
    groups, 
    onDeleteGroup 
}) {
    // Subscription tier features mapping
    const TIER_FEATURES = {
        base: [],
        pro: [],
        premium: ['SMART_COMPANY_MATCHING'],
        business: ['SMART_COMPANY_MATCHING', 'INDUSTRY_DETECTION'],
        enterprise: ['SMART_COMPANY_MATCHING', 'INDUSTRY_DETECTION', 'RELATIONSHIP_DETECTION']
    };

    const availableAiFeatures = TIER_FEATURES[subscriptionLevel] || [];

    return (
        <div className="space-y-6">
            {/* Stats Grid */}
            <StatsGrid groupStats={groupStats} />

            {/* Subscription Level Info */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-200">
                <div className="flex items-center gap-3">
                    <div className="text-2xl">💎</div>
                    <div>
                        <h4 className="font-medium text-gray-900">Current Plan: {subscriptionLevel.toUpperCase()}</h4>
                        <div className="text-sm text-gray-600">
                            {availableAiFeatures.length > 0 ? (
                                <>AI Features: {availableAiFeatures.join(', ')}</>
                            ) : (
                                'Upgrade for AI-powered grouping features!'
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <QuickActions 
                availableAiFeatures={availableAiFeatures}
                onTabChange={onTabChange}
            />

            {/* Recent Groups */}
            {groups.length > 0 && (
                <div>
                    <h4 className="font-medium text-gray-900 mb-3">Recent Groups</h4>
                    <div className="space-y-2">
                        {groups.slice(0, 5).map(group => (
                            <GroupCard
                                key={group.id}
                                group={group}
                                groups={groups}
                                onDelete={onDeleteGroup}
                                compact={true}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}