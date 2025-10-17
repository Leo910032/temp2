// app/admin/components/SessionUsageViewer.jsx
"use client"
import React, { useState, useEffect, useCallback } from 'react';
import { AdminServiceSessions } from '@/lib/services/serviceAdmin/client/adminServiceSessions';

// Status Badge Component
const StatusBadge = ({ status }) => {
  const config = {
    completed: { icon: '✅', color: 'text-green-600 bg-green-50 border-green-200', label: 'Completed' },
    'in-progress': { icon: '🔄', color: 'text-blue-600 bg-blue-50 border-blue-200', label: 'In Progress' },
    abandoned: { icon: '❌', color: 'text-gray-600 bg-gray-50 border-gray-200', label: 'Abandoned' }
  };

  const { icon, color, label } = config[status] || config.abandoned;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${color}`}>
      <span>{icon}</span>
      {label}
    </span>
  );
};

// Step Box Component
const StepBox = ({ step, isLast, isExpanded, onToggle }) => {
  const getBorderColor = () => {
    if (step.isBillableRun) return 'border-yellow-400 bg-yellow-50';
    return 'border-gray-300 bg-white';
  };

  return (
    <div className="flex items-center">
      <div
        className={`relative rounded-lg border-2 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${getBorderColor()}`}
        onClick={onToggle}
        style={{ minWidth: '200px' }}
      >
        {/* Feature name */}
        <div className="font-semibold text-sm text-gray-900 mb-2 truncate" title={step.feature}>
          {AdminServiceSessions.formatFeatureName(step.feature)}
        </div>

        {/* Key metrics */}
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-1 text-gray-700">
            <span>💰</span>
            <span className="font-medium">{AdminServiceSessions.formatCost(step.cost)}</span>
          </div>

          <div className="flex items-center gap-1 text-gray-600 truncate" title={step.provider}>
            <span>🔌</span>
            <span>{AdminServiceSessions.formatProviderName(step.provider)}</span>
          </div>

          <div className="flex items-center gap-1 text-gray-600">
            <span>🕐</span>
            <span>{AdminServiceSessions.formatTime(step.timestamp)}</span>
          </div>

          {step.isBillableRun && (
            <div className="mt-1 pt-1 border-t border-yellow-300">
              <span className="text-yellow-700 font-medium">✓ Billable</span>
            </div>
          )}
        </div>

        {/* Expand indicator */}
        <div className="absolute bottom-1 right-1">
          <span className="text-gray-400 text-sm">
            {isExpanded ? '▲' : '▼'}
          </span>
        </div>

        {/* Expanded details */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-gray-200 text-xs">
            <div className="font-semibold text-gray-700 mb-1">Details:</div>
            <div className="space-y-1 text-gray-600">
              <div>ID: <span className="font-mono text-[10px]">{step.operationId}</span></div>
              <div>Type: <span className="font-mono text-[10px]">{step.usageType}</span></div>
              {step.metadata && Object.keys(step.metadata).length > 0 && (
                <div className="mt-2">
                  <div className="font-semibold text-gray-700 mb-1">Metadata:</div>
                  <pre className="bg-gray-50 p-2 rounded text-[10px] overflow-x-auto max-h-40">
                    {JSON.stringify(step.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Arrow to next step */}
      {!isLast && (
        <div className="flex items-center justify-center px-4">
          <svg width="40" height="40" viewBox="0 0 40 40">
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                <polygon points="0 0, 10 3, 0 6" fill="#6B7280" />
              </marker>
            </defs>
            <line x1="0" y1="20" x2="35" y2="20" stroke="#6B7280" strokeWidth="2" markerEnd="url(#arrowhead)" />
          </svg>
        </div>
      )}
    </div>
  );
};

// Session Card Component
const SessionCard = ({ session }) => {
  const [expandedSteps, setExpandedSteps] = useState(new Set());
  const [isSessionExpanded, setIsSessionExpanded] = useState(false);

  const toggleStep = (operationId) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(operationId)) {
        next.delete(operationId);
      } else {
        next.add(operationId);
      }
      return next;
    });
  };

  const duration = AdminServiceSessions.formatDuration(session.createdAt, session.completedAt);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      {/* Session Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-gray-900">
              {AdminServiceSessions.formatFeatureName(session.feature)}
            </h3>
            <StatusBadge status={session.status} />
          </div>
          <button
            onClick={() => setIsSessionExpanded(!isSessionExpanded)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            {isSessionExpanded ? 'Hide' : 'Show'} Session Info
          </button>
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span className="flex items-center gap-1">
            <span>💰</span>
            Total: {AdminServiceSessions.formatCost(session.totalCost)}
          </span>
          <span className="flex items-center gap-1">
            <span>📋</span>
            {session.steps.length} steps
          </span>
          <span className="flex items-center gap-1">
            <span>🕐</span>
            {duration}
          </span>
        </div>

        {isSessionExpanded && (
          <div className="mt-3 pt-3 border-t border-gray-200 text-sm space-y-1 text-gray-600">
            <div>Session ID: <span className="font-mono text-xs">{session.sessionId}</span></div>
            <div>Created: {AdminServiceSessions.formatDate(session.createdAt)}</div>
            {session.completedAt && <div>Completed: {AdminServiceSessions.formatDate(session.completedAt)}</div>}
            <div>Billable Runs: {session.totalRuns}</div>
          </div>
        )}
      </div>

      {/* Steps Flow */}
      <div className="overflow-x-auto pb-4">
        <div className="flex items-start min-w-max">
          {session.steps.map((step, index) => (
            <StepBox
              key={step.operationId}
              step={step}
              isLast={index === session.steps.length - 1}
              isExpanded={expandedSteps.has(step.operationId)}
              onToggle={() => toggleStep(step.operationId)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// Empty State Component
const EmptyState = ({ message }) => {
  return (
    <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
      <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
        <span className="text-3xl">📊</span>
      </div>
      <h4 className="text-lg font-medium text-gray-900 mb-2">No Sessions Found</h4>
      <p className="text-gray-600">{message}</p>
    </div>
  );
};

// Error State Component
const ErrorState = ({ message, onRetry }) => {
  return (
    <div className="text-center py-12 bg-red-50 rounded-lg border-2 border-red-200">
      <div className="w-16 h-16 bg-red-200 rounded-full flex items-center justify-center mx-auto mb-4">
        <span className="text-4xl">⚠️</span>
      </div>
      <h4 className="text-lg font-medium text-red-900 mb-2">Failed to Load Sessions</h4>
      <p className="text-red-700 mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  );
};

// Loading State Component
const LoadingState = () => {
  return (
    <div className="text-center py-12">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
      <p className="text-gray-600">Loading sessions...</p>
    </div>
  );
};

// Main SessionUsageViewer Component
export default function SessionUsageViewer({ userId, initialLimit = 50, autoRefresh = false }) {
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    status: 'all',
    limit: initialLimit
  });

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('[SessionUsageViewer] Fetching sessions for user:', userId);
      const result = await AdminServiceSessions.fetchUserSessions(userId, filters);

      setSessions(result.sessions || []);
      setStats(result.stats || null);

      console.log('[SessionUsageViewer] Sessions loaded:', result.sessions?.length || 0);
    } catch (err) {
      console.error('[SessionUsageViewer] Error fetching sessions:', err);
      setError(err.message || 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [userId, filters]);

  useEffect(() => {
    if (userId) {
      fetchSessions();
    }
  }, [userId, fetchSessions]);

  const handleRefresh = () => {
    fetchSessions();
  };

  const handleStatusChange = (newStatus) => {
    setFilters(prev => ({ ...prev, status: newStatus }));
  };

  const handleLimitChange = (newLimit) => {
    setFilters(prev => ({ ...prev, limit: newLimit }));
  };

  return (
    <div className="space-y-6">
      {/* Header with Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>📊</span>
            Session Usage Viewer
          </h2>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className={loading ? 'animate-spin inline-block' : ''}>🔄</span>
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="all">All Sessions</option>
              <option value="completed">Completed</option>
              <option value="in-progress">In Progress</option>
              <option value="abandoned">Abandoned</option>
            </select>
          </div>

          {/* Limit Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Limit
            </label>
            <select
              value={filters.limit}
              onChange={(e) => handleLimitChange(parseInt(e.target.value))}
              disabled={loading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value={25}>25 sessions</option>
              <option value={50}>50 sessions</option>
              <option value={100}>100 sessions</option>
            </select>
          </div>
        </div>

        {/* Stats Summary */}
        {stats && !loading && !error && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-purple-600">{stats.totalSessions}</div>
                <div className="text-sm text-gray-600">Total Sessions</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{stats.completedSessions}</div>
                <div className="text-sm text-gray-600">Completed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-600">{AdminServiceSessions.formatCost(stats.totalCost)}</div>
                <div className="text-sm text-gray-600">Total Cost</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{stats.totalSteps}</div>
                <div className="text-sm text-gray-600">Total Steps</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Legend:</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-white border-2 border-gray-300 rounded"></div>
            <span>Standard step</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-50 border-2 border-yellow-400 rounded"></div>
            <span>Billable step</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">▼</span>
            <span>Click box to expand details</span>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={handleRefresh} />}
      {!loading && !error && sessions.length === 0 && (
        <EmptyState message="No sessions found for this user with the selected filters" />
      )}
      {!loading && !error && sessions.length > 0 && (
        <div>
          {sessions.map(session => (
            <SessionCard key={session.sessionId} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}
