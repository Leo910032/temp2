// app/admin/components/TopLevelSecurityLogs.jsx
"use client"
import { useState, useEffect } from 'react';
import { AdminServiceSecurity } from '@/lib/services/serviceAdmin/client/adminServiceSecurity';

export default function TopLevelSecurityLogs() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({
        severity: 'ALL',
        limit: 50,
        action: 'ALL'
    });

    // Fetch logs on component mount and when filters change
    useEffect(() => {
        fetchSecurityLogs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters]);

    const fetchSecurityLogs = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await AdminServiceSecurity.fetchTopLevelSecurityLogs(filters);
            setLogs(data.logs || []);
        } catch (err) {
            console.error('Error fetching security logs:', err);
            setError(err.message || 'Failed to load security logs');
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (filterName, value) => {
        setFilters(prev => ({
            ...prev,
            [filterName]: value
        }));
    };

    const getSeverityColor = (severity) => {
        switch (severity?.toUpperCase()) {
            case 'CRITICAL':
                return 'text-red-700 bg-red-100 border-red-300';
            case 'HIGH':
                return 'text-orange-700 bg-orange-100 border-orange-300';
            case 'MEDIUM':
                return 'text-yellow-700 bg-yellow-100 border-yellow-300';
            case 'LOW':
                return 'text-blue-700 bg-blue-100 border-blue-300';
            default:
                return 'text-gray-700 bg-gray-100 border-gray-300';
        }
    };

    const getSeverityIcon = (severity) => {
        switch (severity?.toUpperCase()) {
            case 'CRITICAL':
                return '🚨';
            case 'HIGH':
                return '⚠️';
            case 'MEDIUM':
                return '⚡';
            case 'LOW':
                return 'ℹ️';
            default:
                return '📝';
        }
    };

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'N/A';
        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            return new Intl.DateTimeFormat('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }).format(date);
        } catch (e) {
            return 'Invalid date';
        }
    };

    const getActionIcon = (action) => {
        if (action?.includes('login') || action?.includes('authentication')) return '🔐';
        if (action?.includes('access') || action?.includes('permission')) return '🚪';
        if (action?.includes('data') || action?.includes('export')) return '📤';
        if (action?.includes('delete') || action?.includes('remove')) return '🗑️';
        if (action?.includes('create') || action?.includes('add')) return '➕';
        if (action?.includes('update') || action?.includes('modify')) return '✏️';
        return '🔔';
    };

    // Extract unique actions from logs for filter dropdown
    const uniqueActions = ['ALL', ...new Set(logs.map(log => log.action).filter(Boolean))];

    if (loading && logs.length === 0) {
        return (
            <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                        <p className="mt-4 text-gray-600">Loading security logs...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-lg p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <span>🔒</span>
                        Top-Level Security Logs
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                        Platform-wide security events without organization context
                    </p>
                </div>
                <button
                    onClick={fetchSecurityLogs}
                    disabled={loading}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                    <span>{loading ? '⏳' : '🔄'}</span>
                    Refresh
                </button>
            </div>

            {/* Filters */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Severity Filter */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Severity Level
                    </label>
                    <select
                        value={filters.severity}
                        onChange={(e) => handleFilterChange('severity', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="ALL">All Severities</option>
                        <option value="CRITICAL">Critical</option>
                        <option value="HIGH">High</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="LOW">Low</option>
                    </select>
                </div>

                {/* Action Filter */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Action Type
                    </label>
                    <select
                        value={filters.action}
                        onChange={(e) => handleFilterChange('action', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        {uniqueActions.map(action => (
                            <option key={action} value={action}>{action}</option>
                        ))}
                    </select>
                </div>

                {/* Limit Filter */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Number of Logs
                    </label>
                    <select
                        value={filters.limit}
                        onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="25">25 logs</option>
                        <option value="50">50 logs</option>
                        <option value="100">100 logs</option>
                        <option value="200">200 logs</option>
                    </select>
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    <div className="flex items-center gap-2">
                        <span>❌</span>
                        <span>{error}</span>
                    </div>
                </div>
            )}

            {/* Summary Stats */}
            {logs.length > 0 && (
                <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg text-center">
                        <div className="text-2xl font-bold text-indigo-600">{logs.length}</div>
                        <div className="text-sm text-gray-600">Total Logs</div>
                    </div>
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center">
                        <div className="text-2xl font-bold text-red-600">
                            {logs.filter(l => l.severity === 'CRITICAL').length}
                        </div>
                        <div className="text-sm text-gray-600">Critical</div>
                    </div>
                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg text-center">
                        <div className="text-2xl font-bold text-orange-600">
                            {logs.filter(l => l.severity === 'HIGH').length}
                        </div>
                        <div className="text-sm text-gray-600">High</div>
                    </div>
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                        <div className="text-2xl font-bold text-yellow-600">
                            {logs.filter(l => l.severity === 'MEDIUM').length}
                        </div>
                        <div className="text-sm text-gray-600">Medium</div>
                    </div>
                </div>
            )}

            {/* Logs Table */}
            {logs.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">🔒</span>
                    </div>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">No Security Logs Found</h4>
                    <p className="text-gray-600">
                        {filters.severity !== 'ALL' || filters.action !== 'ALL'
                            ? 'Try adjusting your filters to see more logs.'
                            : 'No security events have been logged at the platform level yet.'}
                    </p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Severity
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Action
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    User ID
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    IP Address
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Timestamp
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Details
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {logs.map((log, index) => (
                                <tr key={log.id || index} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-4 whitespace-nowrap">
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1 w-fit ${getSeverityColor(log.severity)}`}>
                                            <span>{getSeverityIcon(log.severity)}</span>
                                            {log.severity || 'UNKNOWN'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-2">
                                            <span>{getActionIcon(log.action)}</span>
                                            <span className="font-medium text-gray-900">{log.action || 'N/A'}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {log.userId ? (
                                            <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                                                {log.userId.substring(0, 12)}...
                                            </span>
                                        ) : (
                                            <span className="text-gray-400 italic">anonymous</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">
                                        {log.ipAddress || 'N/A'}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {formatTimestamp(log.timestamp || log.createdAt)}
                                    </td>
                                    <td className="px-4 py-4 text-sm text-gray-600 max-w-md">
                                        {log.details && Object.keys(log.details).length > 0 ? (
                                            <details className="cursor-pointer">
                                                <summary className="text-indigo-600 hover:text-indigo-700 font-medium">
                                                    View Details
                                                </summary>
                                                <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-200 text-xs">
                                                    <pre className="whitespace-pre-wrap font-mono">
                                                        {JSON.stringify(log.details, null, 2)}
                                                    </pre>
                                                </div>
                                            </details>
                                        ) : (
                                            <span className="text-gray-400 italic">No details</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Loading Overlay */}
            {loading && logs.length > 0 && (
                <div className="mt-4 text-center text-sm text-gray-500">
                    <span className="animate-pulse">Refreshing logs...</span>
                </div>
            )}
        </div>
    );
}
