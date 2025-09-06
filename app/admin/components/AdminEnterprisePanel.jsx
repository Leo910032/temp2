//app/admin/components/AdminEnterprisePanel.jsx
"use client"
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';

// --- Reusable Test Results Display Component ---
const TestResultsDisplay = ({ title, results, overallSuccess, isLoading }) => {
    if (isLoading && results.length === 0) {
        return <div className="mt-4 p-4 border rounded-lg bg-gray-50 animate-pulse h-48"></div>;
    }
    if (results.length === 0) return null;

    return (
        <div className="mt-4 p-4 border rounded-lg bg-gray-50 max-h-80 overflow-y-auto">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
                {title}:
                <span className={`px-2 py-0.5 text-xs rounded-full ${overallSuccess ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {overallSuccess === null ? 'Running...' : overallSuccess ? 'All Tests Passed' : 'Test Failed'}
                </span>
            </h4>
            <div className="font-mono text-xs space-y-1">
                {results.map((result, index) => (
                    <div key={index} className="flex items-start">
                        {result.status === 'success' && <span className="text-green-500 mr-2">✓</span>}
                        {result.status === 'running' && <span className="text-yellow-500 mr-2 animate-spin">⏳</span>}
                        {result.status === 'error' && <span className="text-red-500 mr-2">✗</span>}
                        <div className="flex-1">
                            <span className={result.status === 'error' ? 'text-red-600 font-bold' : 'text-gray-700'}>{result.step}</span>
                            {result.details && <p className="text-gray-500 pl-4 break-words">{result.details}</p>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ✅ NEW: Permission Display Component
const PermissionDisplay = ({ permissions, title = "Permissions" }) => {
    if (!permissions || typeof permissions !== 'object') return null;
    
    const permissionEntries = Object.entries(permissions);
    if (permissionEntries.length === 0) return null;
    
    return (
        <div className="mt-2">
            <div className="text-xs font-medium text-gray-600 mb-1">{title}:</div>
            <div className="flex flex-wrap gap-1">
                {permissionEntries.map(([key, value]) => (
                    <span 
                        key={key} 
                        className={`text-xs px-1.5 py-0.5 rounded ${
                            value 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-500'
                        }`}
                        title={key}
                    >
                        {key.replace(/^can|^CAN_/, '').replace(/_/g, ' ').toLowerCase()}
                        {value ? ' ✓' : ' ✗'}
                    </span>
                ))}
            </div>
        </div>
    );
};

export default function AdminEnterprisePanel() {
    const { currentUser } = useAuth();
    
    // State variables
    const [isLoading, setIsLoading] = useState(false);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [data, setData] = useState({ organizations: [], invitations: [] });
    const [isTesting, setIsTesting] = useState(false);
    const [testResults, setTestResults] = useState([]);
    const [overallTestSuccess, setOverallTestSuccess] = useState(null);
    const [recentlyCreatedUsers, setRecentlyCreatedUsers] = useState([]);
    
    // Form state for manual tools
    const [addUserEmail, setAddUserEmail] = useState('');
    const [addUserOrgId, setAddUserOrgId] = useState('');
    const [addUserRole, setAddUserRole] = useState('employee');

    // Utility function for copying to clipboard
    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard!');
    };

    // Fetch enterprise data
    const fetchData = useCallback(async () => {
        if (!currentUser) return;
        setIsLoading(true);
        try {
            const token = await currentUser.getIdToken();
            const response = await fetch('/api/admin/enterprise-tools', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_all_data' })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to fetch data');
            setData(result);
        } catch (error) {
            console.error('Fetch data error:', error);
            toast.error(error.message);
        } finally {
            setIsLoading(false);
        }
    }, [currentUser]);

    // Generic API action handler
    const handleApiAction = async (action, params = {}) => {
        setIsActionLoading(true);
        try {
            console.log('🔄 API Action Starting:', { action, params }); // Debug log
            
            const token = await currentUser.getIdToken();
            const response = await fetch('/api/admin/enterprise-tools', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...params })
            });
            
            console.log('📡 API Response Status:', response.status); // Debug log
            
            const result = await response.json();
            console.log('📦 API Response Data:', result); // Debug log
            
            if (!response.ok) throw new Error(result.error || 'Action failed');
            
            // Handle different actions
            if (action === 'create_test_manager') {
                setRecentlyCreatedUsers(prev => [result.user, ...prev]);
                toast.success(`Test manager "${result.user.username}" created successfully!`);
            } else if (action === 'add_user_to_org') {
                console.log('✅ Add user result:', result); // Debug log
                toast.success(`User added to ${result.organizationName} successfully!`);
                setAddUserEmail('');
                setAddUserOrgId('');
                setAddUserRole('employee');
            } else {
                console.log('✅ Generic action result:', result); // Debug log
                toast.success('Action completed successfully!');
            }
            
            // Refresh data
            console.log('🔄 Refreshing data...'); // Debug log
            await fetchData();
            console.log('✅ Data refreshed'); // Debug log
        } catch (error) {
            console.error('❌ API Action Error:', error); // Debug log
            toast.error(error.message);
        } finally {
            setIsActionLoading(false);
        }
    };

    // Create test manager
    const handleCreateManager = () => {
        handleApiAction('create_test_manager');
    };

    // Delete test user
    const handleDeleteUser = async (userId) => {
        if (!confirm('Are you sure you want to delete this test user?')) return;
        
        setIsActionLoading(true);
        try {
            const token = await currentUser.getIdToken();
            const response = await fetch('/api/admin/enterprise-tools', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete_test_user', userId })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Delete failed');
            
            setRecentlyCreatedUsers(prev => prev.filter(user => user.uid !== userId));
            toast.success('Test user deleted successfully!');
            await fetchData();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsActionLoading(false);
        }
    };

    // Add user to organization
    const handleAddUserToOrg = (e) => {
        e.preventDefault();
        if (!addUserEmail.trim() || !addUserOrgId.trim()) {
            toast.error('Email and Organization ID are required');
            return;
        }
        handleApiAction('add_user_to_org', {
            email: addUserEmail.trim(),
            orgId: addUserOrgId.trim(),
            role: addUserRole
        });
    };

    // Run comprehensive test
    const handleRunTest = async () => {
        setIsTesting(true);
        setTestResults([]);
        setOverallTestSuccess(null);
        try {
            const token = await currentUser.getIdToken();
            const response = await fetch('/api/admin/enterprise-tools', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'run_phase1_comprehensive_test' })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Test runner failed.');
            setTestResults(result.logs);
            setOverallTestSuccess(result.success);
            toast[result.success ? 'success' : 'error']('Comprehensive test run complete!');
        } catch (error) {
            toast.error(error.message);
            setTestResults(prev => [...prev, { step: "Framework Error", status: "error", details: error.message }]);
            setOverallTestSuccess(false);
        } finally {
            setIsTesting(false);
        }
    };

    // Load data on component mount
    useEffect(() => {
        if (currentUser) {
            fetchData();
        }
    }, [currentUser, fetchData]);

    return (
        <div className="bg-white rounded-lg shadow-lg border-2 border-purple-200 p-6 space-y-6">
            <div className="border-b pb-4">
                <h2 className="text-2xl font-bold text-purple-700">Admin Enterprise Tools</h2>
                <p className="text-gray-600 mt-1">Manage enterprise features, test accounts, and run validation tests with proper permission structure</p>
            </div>

            {/* Action Buttons Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                    onClick={fetchData}
                    disabled={isLoading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                    {isLoading ? 'Refreshing...' : 'Refresh Data'}
                </button>
                
                <button
                    onClick={handleCreateManager}
                    disabled={isActionLoading}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                    {isActionLoading ? 'Creating...' : 'Create Test Manager'}
                </button>
                
                <button
                    onClick={handleRunTest}
                    disabled={isTesting}
                    className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                    {isTesting ? 'Testing...' : 'Run Comprehensive Test'}
                </button>
            </div>

            {/* Add User to Organization Form */}
            <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-3">Add User to Organization</h3>
                <form onSubmit={handleAddUserToOrg} className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input
                            type="email"
                            placeholder="User Email"
                            value={addUserEmail}
                            onChange={(e) => setAddUserEmail(e.target.value)}
                            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            required
                        />
                        <input
                            type="text"
                            placeholder="Organization ID"
                            value={addUserOrgId}
                            onChange={(e) => setAddUserOrgId(e.target.value)}
                            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            required
                        />
                        <select
                            value={addUserRole}
                            onChange={(e) => setAddUserRole(e.target.value)}
                            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                            <option value="employee">Employee (Org Role)</option>
                            <option value="manager">Manager (Org Role)</option>
                            <option value="owner">Owner (Org Role)</option>
                        </select>
                    </div>
                    <div className="text-xs text-gray-600">
                        <strong>Note:</strong> Organization roles determine company-wide permissions. Team roles are assigned when joining specific teams.
                    </div>
                    <button
                        type="submit"
                        disabled={isActionLoading}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                        {isActionLoading ? 'Adding...' : 'Add User'}
                    </button>
                </form>
            </div>

            {/* Recently Created Users */}
            {recentlyCreatedUsers.length > 0 && (
                <div className="bg-green-50 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold mb-3 text-green-800">Recently Created Test Users</h3>
                    <div className="space-y-2">
                        {recentlyCreatedUsers.map((user, index) => (
                            <div key={index} className="bg-white p-3 rounded border flex justify-between items-start">
                                <div className="text-sm font-mono space-y-1 flex-1">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
                                        <div><strong>Username:</strong> {user.username}</div>
                                        <div><strong>Email:</strong> {user.email}</div>
                                        <div><strong>Password:</strong> {user.password}</div>
                                        <div><strong>Org Role:</strong> 
                                            <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                                                {user.organizationRole || 'manager'} (mapping only)
                                            </span>
                                        </div>
                                        {user.teamRole && (
                                            <div><strong>Team Role:</strong> 
                                                <span className="ml-1 px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">
                                                    {user.teamRole} (grants permissions)
                                                </span>
                                            </div>
                                        )}
                                        <div className="md:col-span-2"><strong>Organization:</strong> {user.organizationName}</div>
                                        {user.adminTeamId && (
                                            <div className="md:col-span-2 text-xs text-blue-600">
                                                <strong>Admin Team ID:</strong> {user.adminTeamId}
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* ✅ UPDATED: Display team-based permissions */}
                                    {user.permissions && (
                                        <PermissionDisplay 
                                            permissions={user.permissions} 
                                            title="Team-Based Permissions (from Manager role)" 
                                        />
                                    )}
                                    
                                    <div className="text-xs text-gray-500 mt-2">
                                        UID: {user.uid} | Org ID: {user.organizationId}
                                    </div>
                                </div>
                                <div className="flex gap-2 ml-4">
                                    <button
                                        onClick={() => copyToClipboard(`Email: ${user.email}\nPassword: ${user.password}\nOrg Role: ${user.organizationRole || 'manager'}`)}
                                        className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs whitespace-nowrap"
                                    >
                                        Copy Credentials
                                    </button>
                                    <button
                                        onClick={() => handleDeleteUser(user.uid)}
                                        className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs"
                                        disabled={isActionLoading}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Test Results Display */}
            <TestResultsDisplay 
                title="Comprehensive Test Results"
                results={testResults}
                overallSuccess={overallTestSuccess}
                isLoading={isTesting}
            />

            {/* Organizations Data */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold">Organizations ({data.organizations.length})</h3>
                {isLoading ? (
                    <div className="animate-pulse space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-gray-200 h-20 rounded"></div>
                        ))}
                    </div>
                ) : data.organizations.length === 0 ? (
                    <div className="text-gray-500 italic p-4 bg-gray-50 rounded">
                        No organizations found. Create a test manager to get started.
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {data.organizations.map((org) => (
                            <div key={org.id} className="border rounded-lg p-4 bg-gray-50">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-medium text-lg">{org.name}</h4>
                                    <div className="flex gap-2">
                                        {org.isTestOrganization && (
                                            <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs">
                                                Test Org
                                            </span>
                                        )}
                                        <button
                                            onClick={() => copyToClipboard(org.id)}
                                            className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs"
                                        >
                                            Copy ID
                                        </button>
                                    </div>
                                </div>
                                <div className="text-sm text-gray-600 space-y-1 mb-3">
                                    <div><strong>ID:</strong> <span className="font-mono">{org.id}</span></div>
                                    <div><strong>Domain:</strong> {org.domain}</div>
                                    <div><strong>Teams:</strong> {Object.keys(org.teams || {}).length}</div>
                                    <div><strong>Seats:</strong> {org.billing?.currentSeats || 0} / {org.billing?.maxSeats || 50}</div>
                                    <div><strong>Created:</strong> {new Date(org.createdAt).toLocaleDateString()}</div>
                                </div>

                                {/* ✅ NEW: Display organization settings */}
                                {org.settings && (
                                    <div className="bg-white p-2 rounded border mt-2">
                                        <div className="text-xs font-medium text-gray-600 mb-1">Organization Settings:</div>
                                        <div className="flex flex-wrap gap-1">
                                            {Object.entries(org.settings).map(([key, value]) => (
                                                <span 
                                                    key={key} 
                                                    className={`text-xs px-1.5 py-0.5 rounded ${
                                                        value 
                                                            ? 'bg-green-100 text-green-800' 
                                                            : 'bg-gray-100 text-gray-500'
                                                    }`}
                                                >
                                                    {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                                                    {value ? ' ✓' : ' ✗'}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* ✅ NEW: Display team details with roles */}
                                {Object.keys(org.teams || {}).length > 0 && (
                                    <div className="bg-white p-2 rounded border mt-2">
                                        <div className="text-xs font-medium text-gray-600 mb-2">Teams & Members:</div>
                                        <div className="space-y-2">
                                            {Object.entries(org.teams || {}).map(([teamId, teamData]) => (
                                                <div key={teamId} className="text-xs">
                                                    <div className="font-medium">{teamData.name || teamId}</div>
                                                    <div className="text-gray-500 ml-2">
                                                        Members: {Object.keys(teamData.members || {}).length}
                                                        {teamData.members && Object.entries(teamData.members).length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mt-1">
                                                                {Object.entries(teamData.members).map(([memberId, memberData]) => (
                                                                    <span key={memberId} className="bg-blue-100 text-blue-800 px-1 py-0.5 rounded text-xs">
                                                                        {memberData.role || 'employee'}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Invitations Data */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold">Team Invitations ({data.invitations.length})</h3>
                {isLoading ? (
                    <div className="animate-pulse space-y-3">
                        {[1, 2].map(i => (
                            <div key={i} className="bg-gray-200 h-16 rounded"></div>
                        ))}
                    </div>
                ) : data.invitations.length === 0 ? (
                    <div className="text-gray-500 italic p-4 bg-gray-50 rounded">
                        No pending invitations found.
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {data.invitations.map((invite) => (
                            <div key={invite.id} className="border rounded-lg p-3 bg-gray-50">
                                <div className="text-sm space-y-1">
                                    <div className="flex justify-between items-start">
                                        <div><strong>Email:</strong> {invite.invitedEmail || invite.email}</div>
                                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                                            invite.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                                            invite.status === 'accepted' ? 'bg-green-100 text-green-800' : 
                                            'bg-red-100 text-red-800'
                                        }`}>
                                            {invite.status}
                                        </span>
                                    </div>
                                    <div><strong>Team Role:</strong> 
                                        <span className="ml-1 px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs">
                                            {invite.role}
                                        </span>
                                    </div>
                                    <div><strong>Organization:</strong> {invite.organizationId}</div>
                                    <div><strong>Team:</strong> {invite.teamId}</div>
                                    {invite.inviteCode && (
                                        <div><strong>Code:</strong> 
                                            <span className="ml-1 font-mono bg-gray-200 px-1 rounded">
                                                {invite.inviteCode}
                                            </span>
                                        </div>
                                    )}
                                    <div className="text-xs text-gray-500">
                                        Created: {new Date(invite.createdAt?.toDate ? invite.createdAt.toDate() : invite.createdAt).toLocaleString()}
                                        {invite.expiresAt && (
                                            <span className="ml-2">
                                                Expires: {new Date(invite.expiresAt?.toDate ? invite.expiresAt.toDate() : invite.expiresAt).toLocaleString()}
                                            </span>
                                        )}
                                        {invite.resentCount > 0 && (
                                            <span className="ml-2 text-orange-600">
                                                Resent {invite.resentCount} times
                                            </span>
                                        )}
                                    </div>

                                    {/* ✅ NEW: Display role permissions for invitation */}
                                    {invite.permissions && (
                                        <PermissionDisplay 
                                            permissions={invite.permissions} 
                                            title="Invited Role Permissions" 
                                        />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer Info */}
            <div className="text-xs text-gray-500 pt-4 border-t">
                <p><strong>Permission System:</strong> Users have Organization Roles (manager, employee) and Team Roles (owner, manager, team_lead, employee) with specific permissions for each role.</p>
                <p><strong>Test Data:</strong> All test accounts and organizations are automatically marked and can be safely deleted. Organization roles determine company-wide access, while team roles control specific team permissions.</p>
            </div>
        </div>
    )};