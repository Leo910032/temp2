// components/UserSeederManager.jsx - Component to manage test users
"use client"
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';

export default function UserSeederManager() {
    const [isLoading, setIsLoading] = useState(false);
    const [userCount, setUserCount] = useState(100);
    const [testUsers, setTestUsers] = useState(null);
    const [showManager, setShowManager] = useState(false);

    // Create test users
    const createTestUsers = async () => {
        if (isLoading) return;
        
        setIsLoading(true);
        toast.loading('Creating test users...', { id: 'create-users' });
        
        try {
            const response = await fetch('/api/seed-users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    count: userCount,
                    batchSize: 25 
                }),
            });
            
            const result = await response.json();
            
            if (result.success) {
                toast.success(
                    `✅ Created ${result.stats.successCount} test users!`, 
                    { id: 'create-users' }
                );
                
                console.log('🎉 Test Users Created:');
                console.log('Sample usernames:', result.stats.sampleUsernames);
                
                // Show sample usernames in UI
                setTestUsers(result.stats);
            } else {
                throw new Error(result.error || 'Failed to create users');
            }
        } catch (error) {
            console.error('❌ Error creating test users:', error);
            toast.error(
                `❌ Error: ${error.message}`, 
                { id: 'create-users' }
            );
        } finally {
            setIsLoading(false);
        }
    };

    // Get existing test users
    const getTestUsers = async () => {
        setIsLoading(true);
        toast.loading('Fetching test users...', { id: 'get-users' });
        
        try {
            const response = await fetch('/api/seed-users');
            const result = await response.json();
            
            if (result.success) {
                setTestUsers({
                    successCount: result.count,
                    sampleUsernames: result.sampleUsernames
                });
                
                toast.success(
                    `📊 Found ${result.count} test users`, 
                    { id: 'get-users' }
                );
                
                console.log('Existing test users:', result.sampleUsernames);
            } else {
                throw new Error(result.error || 'Failed to fetch users');
            }
        } catch (error) {
            console.error('❌ Error fetching test users:', error);
            toast.error(
                `❌ Error: ${error.message}`, 
                { id: 'get-users' }
            );
        } finally {
            setIsLoading(false);
        }
    };

    // Delete all test users
    const deleteTestUsers = async () => {
        if (isLoading) return;
        
        if (!confirm('Are you sure you want to delete ALL test users? This cannot be undone.')) {
            return;
        }
        
        setIsLoading(true);
        toast.loading('Deleting test users...', { id: 'delete-users' });
        
        try {
            const response = await fetch('/api/seed-users', {
                method: 'DELETE',
            });
            
            const result = await response.json();
            
            if (result.success) {
                toast.success(
                    `🗑️ Deleted ${result.deletedCount} test users`, 
                    { id: 'delete-users' }
                );
                
                setTestUsers(null);
                console.log('🧹 Test users cleaned up');
            } else {
                throw new Error(result.error || 'Failed to delete users');
            }
        } catch (error) {
            console.error('❌ Error deleting test users:', error);
            toast.error(
                `❌ Error: ${error.message}`, 
                { id: 'delete-users' }
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed bottom-4 left-4 z-50">
            {/* Toggle Button */}
            <button
                onClick={() => setShowManager(!showManager)}
                className="mb-2 px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 font-semibold text-sm shadow-lg"
            >
                {showManager ? '🔽 Hide' : '🔧 DB Tools'}
            </button>

            {/* Manager Panel */}
            {showManager && (
                <div className="bg-white border border-gray-300 rounded-lg p-4 shadow-xl max-w-sm">
                    <h3 className="font-bold text-sm mb-3 text-purple-700">🔧 Database Test Tools</h3>
                    
                    {/* User Count Input */}
                    <div className="mb-3">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                            Number of test users:
                        </label>
                        <input
                            type="number"
                            min="10"
                            max="500"
                            value={userCount}
                            onChange={(e) => setUserCount(parseInt(e.target.value) || 100)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            disabled={isLoading}
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-2">
                        <button
                            onClick={createTestUsers}
                            disabled={isLoading}
                            className={`w-full px-3 py-2 rounded-md font-semibold text-sm ${
                                isLoading 
                                    ? 'bg-gray-300 cursor-not-allowed' 
                                    : 'bg-green-500 hover:bg-green-600 text-white'
                            }`}
                        >
                            {isLoading ? '⏳ Creating...' : `🌱 Create ${userCount} Users`}
                        </button>

                        <button
                            onClick={getTestUsers}
                            disabled={isLoading}
                            className={`w-full px-3 py-2 rounded-md font-semibold text-sm ${
                                isLoading 
                                    ? 'bg-gray-300 cursor-not-allowed' 
                                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                            }`}
                        >
                            {isLoading ? '⏳ Fetching...' : '📊 Check Existing'}
                        </button>

                        <button
                            onClick={deleteTestUsers}
                            disabled={isLoading}
                            className={`w-full px-3 py-2 rounded-md font-semibold text-sm ${
                                isLoading 
                                    ? 'bg-gray-300 cursor-not-allowed' 
                                    : 'bg-red-500 hover:bg-red-600 text-white'
                            }`}
                        >
                            {isLoading ? '⏳ Deleting...' : '🗑️ Delete All Test Users'}
                        </button>
                    </div>

                    {/* Test Users Info */}
                    {testUsers && (
                        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                            <div className="text-xs font-semibold text-gray-700 mb-2">
                                📈 Test Users: {testUsers.successCount}
                            </div>
                            
                            {testUsers.sampleUsernames && testUsers.sampleUsernames.length > 0 && (
                                <>
                                    <div className="text-xs font-medium text-gray-600 mb-1">
                                        Sample usernames to test:
                                    </div>
                                    <div className="space-y-1">
                                        {testUsers.sampleUsernames.slice(0, 5).map((username, index) => (
                                            <div
                                                key={index}
                                                onClick={() => {
                                                    navigator.clipboard.writeText(username);
                                                    toast.success(`Copied: ${username}`);
                                                }}
                                                className="text-xs bg-white px-2 py-1 rounded border cursor-pointer hover:bg-blue-50 font-mono"
                                            >
                                                {username}
                                            </div>
                                        ))}
                                        {testUsers.sampleUsernames.length > 5 && (
                                            <div className="text-xs text-gray-500 italic">
                                                ...and {testUsers.sampleUsernames.length - 5} more
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-2">
                                        💡 Click usernames to copy them
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Instructions */}
                    <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                        <div className="text-xs font-semibold text-yellow-800 mb-1">
                            🚀 How to test performance:
                        </div>
                        <ol className="text-xs text-yellow-700 space-y-1">
                            <li>1. Create test users</li>
                            <li>2. Click &ldquo;🔥 Compare DB Methods&rdquo;</li>
                            <li>3. See the speed difference!</li>
                            <li>4. Try typing sample usernames</li>
                        </ol>
                    </div>

                    {/* Close Button */}
                    <button
                        onClick={() => setShowManager(false)}
                        className="mt-3 w-full text-xs text-gray-500 hover:text-gray-700"
                    >
                        ✕ Close Tools
                    </button>
                </div>
            )}
        </div>
    );
}