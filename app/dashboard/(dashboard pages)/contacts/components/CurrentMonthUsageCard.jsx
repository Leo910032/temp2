// components/CurrentMonthUsageCard.jsx
"use client"
import { ContactServiceFactory } from '@/lib/services/serviceContact/client/factories/ContactServiceFactory';

export function CurrentMonthUsageCard({ usageInfo }) {
  // Safety checks to prevent undefined errors
  if (!usageInfo || !usageInfo.currentMonth || !usageInfo.currentMonth.usage) {
    return null;
  }

  const aicostService = ContactServiceFactory.getAICostService();
  const { currentMonth } = usageInfo;
  const { usage, limits } = currentMonth;
  
  // Ensure we have valid numbers with fallbacks
  const totalCost = usage.totalCost || 0;
  const totalRuns = usage.totalRuns || 0;
  const maxCost = limits.maxCost || 0;
  const maxRuns = limits.maxRuns || 0;
  const percentageUsed = currentMonth.percentageUsed || 0;
  
  return (
    <div className="bg-gray-50 border rounded-lg p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-gray-700">This Month's Usage</h4>
      </div>
      
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Cost:</span>
          <span className="font-medium">
            {aicostService.formatCost(totalCost)} 
            {maxCost > 0 && (
              <span className="text-gray-500"> / {aicostService.formatCost(maxCost)}</span>
            )}
          </span>
        </div>
        
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Runs:</span>
          <span className="font-medium">
            {totalRuns}
            {maxRuns > 0 && (
              <span className="text-gray-500"> / {maxRuns}</span>
            )}
          </span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${
              percentageUsed >= 90 ? 'bg-red-500' :
              percentageUsed >= 70 ? 'bg-yellow-500' : 'bg-blue-500'
            }`}
            style={{ 
              width: `${Math.min(percentageUsed, 100)}%` 
            }}
          ></div>
        </div>
        
        {percentageUsed >= 80 && (
          <div className="text-xs text-orange-600 mt-1">
            {percentageUsed >= 95 ? 'Nearly at limit' : 'Approaching limit'}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function for cost formatting (if not available in service)
function formatCost(cost) {
  if (cost === 0) return '$0.00';
  if (cost === -1) return 'Unlimited';
  
  if (cost < 0.001) {
    return `$${(cost * 1000000).toFixed(1)}µ`; // Microcents
  } else if (cost < 0.01) {
    return `$${cost.toFixed(6)}`;
  } else {
    return `$${cost.toFixed(4)}`;
  }
}