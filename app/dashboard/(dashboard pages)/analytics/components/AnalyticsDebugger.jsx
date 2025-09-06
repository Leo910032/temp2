// Add this temporary debug component to your analytics page to see the raw API response

"use client"
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";

export default function AnalyticsDebugger() {
    const { currentUser } = useAuth();
    const [apiResponse, setApiResponse] = useState(null);
    const [loading, setLoading] = useState(false);

    const testAPI = async () => {
        if (!currentUser) return;
        
        setLoading(true);
        try {
            const token = await currentUser.getIdToken();
            const response = await fetch('/api/user/analytics', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const data = await response.json();
            setApiResponse(data);
            console.log('🔍 Raw API Response:', data);
        } catch (error) {
            console.error('API Error:', error);
            setApiResponse({ error: error.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-yellow-100 border border-yellow-400 p-4 rounded-lg mb-6">
            <h3 className="font-bold text-yellow-800 mb-2">🔍 Analytics API Debugger</h3>
            
            <button 
                onClick={testAPI}
                disabled={loading}
                className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 disabled:opacity-50"
            >
                {loading ? 'Testing...' : 'Test API Response'}
            </button>
            
            {apiResponse && (
                <div className="mt-4">
                    <h4 className="font-semibold mb-2">API Response:</h4>
                    <div className="bg-white p-3 rounded border text-xs font-mono overflow-x-auto">
                        <div className="mb-2">
                            <strong>Total Views:</strong> {apiResponse.totalViews}
                        </div>
                        <div className="mb-2">
                            <strong>Total Clicks:</strong> {apiResponse.totalClicks}
                        </div>
                        <div className="mb-2">
                            <strong>Daily Views Keys:</strong> {apiResponse.dailyViews ? Object.keys(apiResponse.dailyViews).length : 'undefined'}
                        </div>
                        <div className="mb-2">
                            <strong>Daily Clicks Keys:</strong> {apiResponse.dailyClicks ? Object.keys(apiResponse.dailyClicks).length : 'undefined'}
                        </div>
                        <div className="mb-2">
                            <strong>Daily Views Object:</strong>
                            <pre className="text-xs bg-gray-100 p-2 mt-1 rounded">
                                {JSON.stringify(apiResponse.dailyViews, null, 2)}
                            </pre>
                        </div>
                        <div className="mb-2">
                            <strong>Daily Clicks Object:</strong>
                            <pre className="text-xs bg-gray-100 p-2 mt-1 rounded">
                                {JSON.stringify(apiResponse.dailyClicks, null, 2)}
                            </pre>
                        </div>
                        <details className="mt-4">
                            <summary className="cursor-pointer font-semibold">Full Response (click to expand)</summary>
                            <pre className="text-xs bg-gray-100 p-2 mt-2 rounded overflow-x-auto">
                                {JSON.stringify(apiResponse, null, 2)}
                            </pre>
                        </details>
                    </div>
                </div>
            )}
        </div>
    );
}