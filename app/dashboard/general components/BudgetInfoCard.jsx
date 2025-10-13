// app/dashboard/general components/BudgetInfoCard.jsx
"use client";

import React from 'react';

/**
 * Reusable component to display budget usage information
 * Shows cost, AI operations, and API operations with progress bars and warnings
 */
export default function BudgetInfoCard({ budgetInfo, budgetLoading, compact = false }) {
  // Loading state
  if (budgetLoading) {
    return (
      <div className={`bg-white rounded-lg shadow ${compact ? 'p-3' : 'p-4'} mb-4`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  // No data state
  if (!budgetInfo) {
    return null;
  }

  // Unlimited users
  if (budgetInfo.unlimited) {
    return (
      <div className={`bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg shadow ${compact ? 'p-3' : 'p-4'} mb-4 border border-purple-200`}>
        <div className="flex items-center gap-2">
          <span className="text-2xl">✨</span>
          <div>
            <h3 className={`font-semibold text-gray-900 ${compact ? 'text-sm' : 'text-base'}`}>
              Unlimited Usage
            </h3>
            <p className={`text-gray-600 ${compact ? 'text-xs' : 'text-sm'}`}>
              Your {budgetInfo.subscriptionLevel} plan includes unlimited operations
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { currentUsage, limits, remaining, percentageUsed, warnings } = budgetInfo;

  // Determine card color based on usage
  const getColorClasses = (percentage) => {
    if (percentage >= 95) return 'from-red-50 to-red-100 border-red-300';
    if (percentage >= 80) return 'from-yellow-50 to-yellow-100 border-yellow-300';
    return 'from-green-50 to-green-100 border-green-300';
  };

  // Determine progress bar color
  const getProgressColor = (percentage) => {
    if (percentage >= 95) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  // Use the highest percentage for card color
  const maxPercentage = Math.max(
    percentageUsed.cost || 0,
    percentageUsed.runsAI || 0,
    percentageUsed.runsAPI || 0
  );
  const cardColorClasses = getColorClasses(maxPercentage);

  // Always show both AI and API sections to make it clear what the limits are
  const hasAIAccess = true;
  const hasAPIAccess = true;

  return (
    <div className={`bg-gradient-to-r ${cardColorClasses} rounded-lg shadow ${compact ? 'p-3' : 'p-4'} mb-4 border`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className={`font-semibold text-gray-900 ${compact ? 'text-sm' : 'text-base'}`}>
          💰 Monthly Usage
        </h3>
        <span className={`text-gray-600 ${compact ? 'text-xs' : 'text-sm'}`}>
          {budgetInfo.month}
        </span>
      </div>

      {/* AI Operations (only show if user has access) */}
      {hasAIAccess && (
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className={`text-gray-700 font-medium ${compact ? 'text-xs' : 'text-sm'}`}>
              🤖 AI Operations
            </span>
            <span className={`font-semibold ${compact ? 'text-xs' : 'text-sm'} ${warnings.runsAIWarning ? 'text-red-600' : 'text-gray-900'}`}>
              {currentUsage.runsAI} / {limits.maxRunsAI}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(percentageUsed.runsAI)}`}
              style={{ width: `${Math.min(percentageUsed.runsAI, 100)}%` }}
            ></div>
          </div>
          {remaining.runsAI <= 3 && remaining.runsAI > 0 && (
            <p className="text-xs text-red-600 mt-1">
              ⚠️ Only {remaining.runsAI} AI operation{remaining.runsAI !== 1 ? 's' : ''} remaining
            </p>
          )}
          {remaining.runsAI === 0 && (
            <p className="text-xs text-red-600 font-semibold mt-1">
              ❌ AI operations limit reached
            </p>
          )}
        </div>
      )}

      {/* API Operations (only show if user has access) */}
      {hasAPIAccess && (
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className={`text-gray-700 font-medium ${compact ? 'text-xs' : 'text-sm'}`}>
              🔌 API Operations
            </span>
            <span className={`font-semibold ${compact ? 'text-xs' : 'text-sm'} ${warnings.runsAPIWarning ? 'text-red-600' : 'text-gray-900'}`}>
              {currentUsage.runsAPI} / {limits.maxRunsAPI}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(percentageUsed.runsAPI)}`}
              style={{ width: `${Math.min(percentageUsed.runsAPI, 100)}%` }}
            ></div>
          </div>
          {remaining.runsAPI <= 10 && remaining.runsAPI > 0 && (
            <p className="text-xs text-yellow-600 mt-1">
              ⚠️ {remaining.runsAPI} API operation{remaining.runsAPI !== 1 ? 's' : ''} remaining
            </p>
          )}
          {remaining.runsAPI === 0 && (
            <p className="text-xs text-red-600 font-semibold mt-1">
              ❌ API operations limit reached
            </p>
          )}
        </div>
      )}

      {/* Cost Usage */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className={`text-gray-700 font-medium ${compact ? 'text-xs' : 'text-sm'}`}>
            💵 Cost Budget
          </span>
          <span className={`font-semibold ${compact ? 'text-xs' : 'text-sm'} ${warnings.costWarning ? 'text-red-600' : 'text-gray-900'}`}>
            ${currentUsage.cost.toFixed(4)} / ${limits.maxCost.toFixed(2)}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(percentageUsed.cost)}`}
            style={{ width: `${Math.max(Math.min(percentageUsed.cost, 100), percentageUsed.cost > 0 ? 1 : 0)}%` }}
          ></div>
        </div>
        {warnings.costWarning && remaining.cost > 0 && (
          <p className="text-xs text-yellow-600 mt-1">
            ⚠️ ${remaining.cost.toFixed(2)} remaining
          </p>
        )}
        {remaining.cost <= 0 && (
          <p className="text-xs text-red-600 font-semibold mt-1">
            ❌ Budget exceeded
          </p>
        )}
        {currentUsage.cost > 0 && currentUsage.cost < 0.01 && (
          <p className="text-xs text-gray-600 mt-1">
            Very low usage this month
          </p>
        )}
      </div>

      {/* Upgrade message if approaching limits */}
      {(warnings.costCritical || warnings.runsAICritical || warnings.runsAPICritical) && (
        <div className="mt-3 pt-3 border-t border-gray-300">
          <p className={`text-gray-700 ${compact ? 'text-xs' : 'text-sm'} mb-2`}>
            Consider upgrading for more capacity
          </p>
          <button className={`w-full ${compact ? 'py-1.5 text-xs' : 'py-2 text-sm'} bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium`}>
            Upgrade Plan
          </button>
        </div>
      )}
    </div>
  );
}
