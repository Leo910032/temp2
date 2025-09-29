// app/dashboard/(dashboard pages)/contacts/components/UsageCards.jsx
"use client";

import { CONTACT_FEATURES } from '@/lib/services/constants';

export default function UsageCards({ usageInfo, usageLoading, hasFeature }) {
    // Don't show for enterprise users or if no usage info
    if (!usageInfo || !usageInfo.currentMonth || !usageInfo.currentMonth.usage) {
        return null;
    }

    // Don't show for enterprise (they have unlimited)
    if (!hasFeature || hasFeature(CONTACT_FEATURES.UNLIMITED_AI_FEATURES)) {
        return null;
    }

    const { currentMonth } = usageInfo;
    const { usage, remaining, percentageUsed } = currentMonth;

    const formatCost = (cost) => {
        if (cost === 0) return '$0.00';
        if (cost === -1) return 'Unlimited';
        if (cost < 0.001) return `$${(cost * 1000000).toFixed(1)}µ`;
        if (cost < 0.01) return `$${cost.toFixed(6)}`;
        return `$${cost.toFixed(4)}`;
    };

    const getUsageColor = (percentage) => {
        if (percentage >= 90) return 'text-red-600';
        if (percentage >= 70) return 'text-yellow-600';
        return 'text-blue-600';
    };

    const getProgressColor = (percentage) => {
        if (percentage >= 90) return 'bg-red-500';
        if (percentage >= 70) return 'bg-yellow-500';
        return 'bg-blue-500';
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {/* Budget Usage Percentage */}
            <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex items-center justify-between mb-2">
                    <div>
                        <div className={`text-2xl font-bold ${getUsageColor(percentageUsed || 0)}`}>
                            {Math.round(percentageUsed || 0)}%
                        </div>
                        <div className="text-sm text-gray-600">AI Budget Used</div>
                    </div>
                    {usageLoading && (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    )}
                </div>
                {/* Progress bar */}
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div 
                        className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(percentageUsed || 0)}`}
                        style={{ width: `${Math.min(percentageUsed || 0, 100)}%` }}
                    ></div>
                </div>
            </div>

            {/* Total AI Runs */}
            <div className="bg-white p-4 rounded-lg shadow">
                <div className="text-2xl font-bold text-green-600">
                    {usage.totalRuns || 0}
                </div>
                <div className="text-sm text-gray-600">AI Runs This Month</div>
                {remaining?.runs !== undefined && remaining.runs >= 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                        {remaining.runs} remaining
                    </div>
                )}
            </div>

            {/* Total Cost */}
            <div className="bg-white p-4 rounded-lg shadow">
                <div className="text-2xl font-bold text-purple-600">
                    {formatCost(usage.totalCost || 0)}
                </div>
                <div className="text-sm text-gray-600">Total Cost</div>
                <div className="text-xs text-gray-500 mt-1">
                    This billing cycle
                </div>
            </div>

            {/* Remaining Budget */}
            <div className="bg-white p-4 rounded-lg shadow">
                <div className="text-2xl font-bold text-orange-600">
                    {formatCost(remaining?.budget || 0)}
                </div>
                <div className="text-sm text-gray-600">Remaining Budget</div>
                {percentageUsed >= 80 && (
                    <div className="text-xs text-orange-600 mt-1 font-medium">
                        {percentageUsed >= 95 ? '⚠️ Nearly depleted' : '⚠️ Running low'}
                    </div>
                )}
            </div>
        </div>
    );
}