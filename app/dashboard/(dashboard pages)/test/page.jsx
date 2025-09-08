"use client"
import React, { useState } from 'react';
import { ContactApiClient } from '@/lib/services/serviceContact/client/core/contactApiClient';

const CostTrackingTest = () => {
  const [testResults, setTestResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [usageInfo, setUsageInfo] = useState(null);

  const runCostTrackingTest = async () => {
    setLoading(true);
    try {
      console.log('🧪 Running cost tracking test...');
      const response = await ContactApiClient.post('/api/user/contacts/test-cost-tracking', {});
      setTestResults(response);
      console.log('🧪 Test results:', response);
    } catch (error) {
      console.error('❌ Test failed:', error);
      setTestResults({
        error: error.message,
        summary: { success: false }
      });
    } finally {
      setLoading(false);
    }
  };

  const getUsageInfo = async () => {
    setLoading(true);
    try {
      console.log('📊 Getting usage info...');
      const response = await ContactApiClient.get('/api/user/contacts/ai-usage');
      setUsageInfo(response);
      console.log('📊 Usage info:', response);
    } catch (error) {
      console.error('❌ Failed to get usage info:', error);
      setUsageInfo({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const testEstimate = async () => {
    setLoading(true);
    try {
      console.log('💰 Testing cost estimate...');
      const response = await ContactApiClient.post('/api/user/contacts/ai-usage', {
        action: 'estimate',
        options: {
          useSmartCompanyMatching: true,
          useIndustryDetection: true
        }
      });
      console.log('💰 Estimate response:', response);
    } catch (error) {
      console.error('❌ Estimate failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Cost Tracking Debug Panel</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <button
          onClick={runCostTrackingTest}
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Run Cost Tracking Test'}
        </button>
        
        <button
          onClick={getUsageInfo}
          disabled={loading}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Get Usage Info'}
        </button>
        
        <button
          onClick={testEstimate}
          disabled={loading}
          className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Test Cost Estimate'}
        </button>
      </div>

      {/* Test Results */}
      {testResults && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-3">Test Results</h2>
          <div className={`p-4 rounded ${testResults.summary?.success ? 'bg-green-100 border-green-500' : 'bg-red-100 border-red-500'} border`}>
            {testResults.error ? (
              <div>
                <p className="font-bold text-red-600">Test Failed</p>
                <p className="text-sm">{testResults.error}</p>
              </div>
            ) : (
              <div>
                <p className="font-bold mb-2">
                  {testResults.summary?.success ? '✅ All Tests Passed' : '❌ Some Tests Failed'}
                </p>
                <p className="text-sm mb-3">
                  {testResults.summary?.passed}/{testResults.summary?.total} tests passed
                </p>
                
                <div className="space-y-2">
                  {testResults.tests?.map((test, index) => (
                    <div key={index} className="flex items-center text-sm">
                      <span className={`mr-2 ${test.status === 'PASS' ? 'text-green-600' : 'text-red-600'}`}>
                        {test.status === 'PASS' ? '✅' : '❌'}
                      </span>
                      <span className="font-mono">{test.name}</span>
                      {test.error && (
                        <span className="ml-2 text-red-600 text-xs">({test.error})</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Usage Info */}
      {usageInfo && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-3">Current Usage Info</h2>
          <div className="bg-gray-100 p-4 rounded border">
            {usageInfo.error ? (
              <div>
                <p className="font-bold text-red-600">Failed to Load Usage</p>
                <p className="text-sm">{usageInfo.error}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">Current Month</h3>
                  <div className="text-sm space-y-1">
                    <div>Month: {usageInfo.currentMonth?.month}</div>
                    <div>Total Cost: ${usageInfo.currentMonth?.usage?.totalCost?.toFixed(6) || '0.000000'}</div>
                    <div>Total Runs: {usageInfo.currentMonth?.usage?.totalRuns || 0}</div>
                    <div>Percentage Used: {usageInfo.currentMonth?.percentageUsed?.toFixed(1) || 0}%</div>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-2">Subscription & Limits</h3>
                  <div className="text-sm space-y-1">
                    <div>Level: {usageInfo.subscriptionLevel}</div>
                    <div>Max Cost: ${usageInfo.currentMonth?.limits?.maxCost || 0}</div>
                    <div>Max Runs: {usageInfo.currentMonth?.limits?.maxRuns || 0}</div>
                    <div>Remaining Budget: ${usageInfo.currentMonth?.remaining?.budget?.toFixed(6) || '0.000000'}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Debug Info */}
      <div className="bg-gray-50 p-4 rounded border">
        <h3 className="font-semibold mb-2">Debug Info</h3>
        <div className="text-sm text-gray-600">
          <p>Check your browser console for detailed logs from each operation.</p>
          <p>Check your server logs for backend cost tracking operations.</p>
          <p>Verify Firestore AIUsage collection is being populated correctly.</p>
        </div>
      </div>
    </div>
  );
};

export default CostTrackingTest;