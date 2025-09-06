// app/admin/page.jsx - Enhanced Main Admin Dashboard
"use client"
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

// Import components
import AdminContactTestPanel from './components/AdminContactTestPanel';
import PlatformUsageOverview from './components/PlatformUsageOverview';
import UserUsageOverview from './components/UserUsageOverview';
import UserList from './components/UserList';
import UserDetails from './components/UserDetails';
import StatsCards from './components/StatsCards';
import AccountTypesBreakdown from './components/AccountTypesBreakdown';
import AdminEnterprisePanel from './components/AdminEnterprisePanel';

export default function AdminDashboard() {
    const { currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [userDetailLoading, setUserDetailLoading] = useState(false);
    
    // Global and user-specific analytics data
    const [globalAnalytics, setGlobalAnalytics] = useState(null);
    const [userUsageLogs, setUserUsageLogs] = useState([]);
    
    // Test panel state
    const [showTestPanel, setShowTestPanel] = useState(false);
    const [testPanelLoading, setTestPanelLoading] = useState(false);
    const [showEnterprisePanel, setShowEnterprisePanel] = useState(false); // <-- NEW STATE

    
    const [stats, setStats] = useState({
        total: 0,
        withLinks: 0,
        withSocials: 0,
        sensitiveContent: 0,
        withAnalytics: 0,
        totalViews: 0,
        totalClicks: 0,
        activeToday: 0,
        accountTypes: {
            base: 0,
            pro: 0,
            premium: 0,
            business: 0
        }
    });

    useEffect(() => {
        const fetchAllData = async () => {
            if (!currentUser) return;
            setLoading(true);
            try {
                const token = await currentUser.getIdToken();
                
                // Fetch users and analytics in parallel for speed
                const [usersResponse, analyticsResponse] = await Promise.all([
                    fetch('/api/admin/users', { 
                        headers: { 
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        } 
                    }),
                    fetch('/api/admin/analytics', { 
                        headers: { 
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        } 
                    })
                ]);

                if (usersResponse.ok) {
                    const data = await usersResponse.json();
                    console.log('✅ Users data received:', data);
                    setUsers(data.users);
                    setStats(data.stats);
                } else {
                    const errorData = await usersResponse.json();
                    console.error('❌ Users API Error:', usersResponse.status, errorData);
                    
                    if (usersResponse.status === 401) {
                        alert('Authentication failed. Please log out and log back in.');
                    } else if (usersResponse.status === 403) {
                        alert('Access denied. You need admin privileges.');
                    } else {
                        alert(`Error: ${errorData.error || 'Unknown error'}`);
                    }
                }

                if (analyticsResponse.ok) {
                    const data = await analyticsResponse.json();
                    console.log('✅ Analytics data received:', data);
                    setGlobalAnalytics(data.summary);
                    const logsByUser = data.recentRuns?.reduce((acc, log) => {
                        acc[log.userId] = acc[log.userId] || [];
                        acc[log.userId].push(log);
                        return acc;
                    }, {}) || {};
                    setUserUsageLogs(logsByUser);
                } else {
                    console.error('Failed to fetch analytics:', await analyticsResponse.json());
                    console.error("Failed to load analytics data.");
                }
            } catch (error) {
                console.error('💥 Fetch error:', error);
                alert('Failed to load data. Check console for details.');
            } finally {
                setLoading(false);
            }
        };
        
        fetchAllData();
    }, [currentUser]);

    const fetchUserDetail = async (userId) => {
        console.log('🎯 === FETCH USER DETAIL START ===');
        console.log('🎯 User ID received:', userId);
        
        if (!userId) {
            console.error('❌ No userId provided to fetchUserDetail');
            alert('Error: No user ID provided');
            return;
        }

        setUserDetailLoading(true);
        setSelectedUser(null);
        
        try {
            if (!currentUser) {
                console.error("❌ No currentUser available");
                throw new Error("Authentication context is not available.");
            }
            
            const token = await currentUser.getIdToken();
            console.log('🔑 Token obtained for user detail:', token ? 'Yes' : 'No');
            
            const apiUrl = `/api/admin/user/${userId}`;
            console.log('🌐 Making request to:', apiUrl);
            
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            console.log('📡 User detail response status:', response.status);

            if (response.ok) {
                const userData = await response.json();
                console.log('✅ User detail data received:', userData);
                setSelectedUser(userData);
            } else {
                const errorText = await response.text();
                console.error(`❌ Failed to fetch user ${userId}:`, {
                    status: response.status,
                    statusText: response.statusText,
                    rawResponse: errorText
                });
                
                let errorMessage = errorText;
                try {
                    const errorData = JSON.parse(errorText);
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {
                    console.warn('⚠️ Response is not valid JSON');
                }
                
                alert(`Error loading user details: ${errorMessage}`);
            }
        } catch (error) {
            console.error('💥 Client-side error in fetchUserDetail:', {
                message: error.message,
                stack: error.stack,
                userId: userId
            });
            alert(`An unexpected error occurred: ${error.message}`);
        } finally {
            console.log('🏁 fetchUserDetail completed');
            setUserDetailLoading(false);
        }
    };

    const handleUserClick = (user) => {
        console.log('🖱️ === USER CLICK EVENT ===');
        console.log('🖱️ Clicked user object:', user);
        console.log('🖱️ User ID:', user.id);
        console.log('🖱️ User username:', user.username);
        
        if (!user.id) {
            console.error('❌ User object has no ID property');
            alert('Error: User has no ID');
            return;
        }
        
        fetchUserDetail(user.id);
    };

    // Handle test data cleanup
    const handleCleanupTestData = async (userId) => {
        if (!userId || !selectedUser) {
            alert('Please select a user first');
            return;
        }

        const confirmCleanup = confirm(`Are you sure you want to delete all test data for ${selectedUser.displayName}? This action cannot be undone.`);
        if (!confirmCleanup) return;

        setTestPanelLoading(true);
        try {
            const token = await currentUser.getIdToken();
            const response = await fetch('/api/admin/cleanup-test-data', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    userId: userId,
                    cleanupType: 'contacts'
                })
            });

            if (response.ok) {
                const result = await response.json();
                alert(`✅ Successfully deleted ${result.deletedCount} test contacts for ${selectedUser.displayName}`);
                // Refresh user details
                await fetchUserDetail(userId);
            } else {
                const errorData = await response.json();
                alert(`❌ Cleanup failed: ${errorData.error}`);
            }
        } catch (error) {
            console.error('Error cleaning up test data:', error);
            alert('Failed to cleanup test data');
        } finally {
            setTestPanelLoading(false);
        }
    };

    // Handle test contact generation for selected user
    const handleTestContactGeneration = async (generationOptions) => {
        if (!selectedUser) {
            alert('Please select a user first');
            return;
        }

        setTestPanelLoading(true);
        try {
            const token = await currentUser.getIdToken();
            const response = await fetch('/api/admin/generate-contacts', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...generationOptions,
                    targetUserId: selectedUser.id
                })
            });

            if (response.ok) {
                const result = await response.json();
                alert(`✅ Successfully generated ${result.data.generated} test contacts for ${selectedUser.displayName}`);
                // Refresh user details to show updated stats
                await fetchUserDetail(selectedUser.id);
                return result;
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Generation failed');
            }
        } catch (error) {
            console.error('Error generating test contacts:', error);
            alert(`❌ Generation failed: ${error.message}`);
            throw error;
        } finally {
            setTestPanelLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading admin dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Admin Dashboard</h2>
                <div className="flex items-center gap-3">
                    {/* Test Panel Toggle */}
                     <button
                        onClick={() => setShowEnterprisePanel(!showEnterprisePanel)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors font-medium ${
                            showEnterprisePanel 
                                ? 'bg-purple-100 border border-purple-300 text-purple-800 hover:bg-purple-200' 
                                : 'bg-purple-600 text-white hover:bg-purple-700'
                        }`}
                    >
                        <span>🏢</span>
                        {showEnterprisePanel ? 'Hide Enterprise Panel' : 'Show Enterprise Panel'}
                    </button>
                    <button
                        onClick={() => setShowTestPanel(!showTestPanel)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors font-medium ${
                            showTestPanel 
                                ? 'bg-orange-100 border border-orange-300 text-orange-800 hover:bg-orange-150' 
                                : 'bg-orange-600 text-white hover:bg-orange-700'
                        }`}
                    >
                        <span>🧪</span>
                        {showTestPanel ? 'Hide Test Panel' : 'Show Test Panel'}
                    </button>
                    <Link 
                        href="/dashboard" 
                        className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
                    >
                        Back to Dashboard
                    </Link>
                </div>
            </div>

            {/* 4. RENDER THE PANEL CONDITIONALLY */}
            {showEnterprisePanel && (
                <AdminEnterprisePanel />
            )}
            {/* Test Panel Section */}
            {showTestPanel && (
                <div className="bg-white rounded-lg shadow-lg border-2 border-orange-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <span>🧪</span>
                            Contact Test Panel
                        </h3>
                        {selectedUser && (
                            <div className="text-sm text-gray-600">
                                Target User: <span className="font-medium text-blue-600">{selectedUser.displayName} (@{selectedUser.username})</span>
                            </div>
                        )}
                    </div>
                    
                    {selectedUser ? (
                        <AdminContactTestPanel 
                            targetUser={selectedUser}
                            onGenerate={handleTestContactGeneration}
                            onCleanup={() => handleCleanupTestData(selectedUser.id)}
                            loading={testPanelLoading}
                        />
                    ) : (
                        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="text-2xl">👤</span>
                            </div>
                            <h4 className="text-lg font-medium text-gray-900 mb-2">Select a User</h4>
                            <p className="text-gray-600">Choose a user from the list below to generate test contacts for them</p>
                        </div>
                    )}
                </div>
            )}

            {/* Platform Usage Overview */}
            <PlatformUsageOverview stats={globalAnalytics} />

            {/* Enhanced Stats Cards with API Data */}
            <StatsCards stats={stats} apiStats={globalAnalytics} />

            {/* Account Types Breakdown */}
            <AccountTypesBreakdown stats={stats} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Users List */}
                <UserList 
                    users={users}
                    selectedUser={selectedUser}
                    onUserClick={handleUserClick}
                />

                {/* User Details */}
                <UserDetails 
                    selectedUser={selectedUser}
                    userDetailLoading={userDetailLoading}
                    userUsageLogs={selectedUser ? userUsageLogs[selectedUser.id] || [] : []}
                />
            </div>
        </div>
    );
}