// app/dashboard/(dashboard pages)/contacts/components/VectorDebugPanel.jsx
"use client"
import React, { useState } from 'react';

export default function VectorDebugPanel({ results, query, searchMetadata }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);

  if (!results || results.length === 0) {
    return null;
  }

  // Calculate debug statistics
  const vectorScores = results.map(r => r._vectorScore).filter(s => s !== undefined);
  const rerankScores = results.map(r => r.searchMetadata?.rerankScore).filter(s => s !== undefined);
  const hybridScores = results.map(r => r.searchMetadata?.hybridScore).filter(s => s !== undefined);

  const vectorStats = vectorScores.length > 0 ? {
    avg: (vectorScores.reduce((sum, s) => sum + s, 0) / vectorScores.length),
    max: Math.max(...vectorScores),
    min: Math.min(...vectorScores),
    count: vectorScores.length
  } : null;

  const rerankStats = rerankScores.length > 0 ? {
    avg: (rerankScores.reduce((sum, s) => sum + s, 0) / rerankScores.length),
    max: Math.max(...rerankScores),
    min: Math.min(...rerankScores),
    count: rerankScores.length
  } : null;

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-yellow-800 flex items-center gap-2">
          <span>🔍</span>
          Vector Score Debug Panel
        </h4>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-yellow-600 hover:text-yellow-800 px-2 py-1 rounded"
        >
          {isExpanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      <div className="text-xs text-yellow-700 mb-3">
        Query: "{query}" | Results: {results.length} | Reranking: {searchMetadata?.hasReranking ? 'Enabled' : 'Disabled'}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {vectorStats && (
          <div className="bg-white p-2 rounded border">
            <div className="text-xs font-medium text-gray-600">Vector Scores</div>
            <div className="text-sm font-bold text-gray-900">
              {(vectorStats.avg * 100).toFixed(1)}% avg
            </div>
            <div className="text-xs text-gray-500">
              {(vectorStats.min * 100).toFixed(1)}% - {(vectorStats.max * 100).toFixed(1)}%
            </div>
          </div>
        )}

        {rerankStats && (
          <div className="bg-white p-2 rounded border">
            <div className="text-xs font-medium text-gray-600">Rerank Scores</div>
            <div className="text-sm font-bold text-teal-700">
              {(rerankStats.avg * 100).toFixed(1)}% avg
            </div>
            <div className="text-xs text-gray-500">
              {(rerankStats.min * 100).toFixed(1)}% - {(rerankStats.max * 100).toFixed(1)}%
            </div>
          </div>
        )}

        <div className="bg-white p-2 rounded border">
          <div className="text-xs font-medium text-gray-600">Categories</div>
          <div className="text-sm font-bold text-gray-900">
            H:{searchMetadata?.vectorCategories?.high || 0} 
            M:{searchMetadata?.vectorCategories?.medium || 0} 
            L:{searchMetadata?.vectorCategories?.low || 0}
          </div>
        </div>

        <div className="bg-white p-2 rounded border">
          <div className="text-xs font-medium text-gray-600">Subscription</div>
          <div className="text-sm font-bold text-purple-700 capitalize">
            {searchMetadata?.subscriptionLevel || 'Unknown'}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-4">
          {/* Detailed Results Table */}
          <div className="bg-white rounded border overflow-hidden">
            <div className="bg-gray-50 px-3 py-2 border-b">
              <h5 className="text-sm font-medium text-gray-700">Individual Contact Scores</h5>
            </div>
            
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium text-gray-600">#</th>
                    <th className="text-left p-2 font-medium text-gray-600">Contact</th>
                    <th className="text-left p-2 font-medium text-gray-600">Vector %</th>
                    <th className="text-left p-2 font-medium text-gray-600">Rerank %</th>
                    <th className="text-left p-2 font-medium text-gray-600">Hybrid %</th>
                    <th className="text-left p-2 font-medium text-gray-600">Tier</th>
                    <th className="text-left p-2 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((contact, index) => {
                    const vectorScore = contact._vectorScore;
                    const rerankScore = contact.searchMetadata?.rerankScore;
                    const hybridScore = contact.searchMetadata?.hybridScore;
                    const tier = contact.similarityTier || contact.searchMetadata?.similarityTier;
                    
                    const tierColor = 
                      tier === 'high' ? 'text-green-600' :
                      tier === 'medium' ? 'text-yellow-600' :
                      tier === 'low' ? 'text-orange-600' : 'text-gray-600';

                    return (
                      <tr key={contact.id} className="border-b hover:bg-gray-50">
                        <td className="p-2 font-medium">{index + 1}</td>
                        <td className="p-2">
                          <div className="font-medium truncate max-w-32" title={contact.name}>
                            {contact.name}
                          </div>
                          <div className="text-gray-500 truncate max-w-32" title={contact.company}>
                            {contact.company}
                          </div>
                        </td>
                        <td className="p-2 font-mono">
                          {vectorScore !== undefined ? 
                            <span className={vectorScore > 0.6 ? 'text-green-600' : vectorScore > 0.4 ? 'text-yellow-600' : 'text-red-600'}>
                              {(vectorScore * 100).toFixed(1)}%
                            </span>
                            : 'N/A'
                          }
                        </td>
                        <td className="p-2 font-mono">
                          {rerankScore !== undefined ? 
                            <span className={rerankScore > 0.8 ? 'text-teal-600' : rerankScore > 0.6 ? 'text-blue-600' : 'text-orange-600'}>
                              {(rerankScore * 100).toFixed(1)}%
                            </span>
                            : 'N/A'
                          }
                        </td>
                        <td className="p-2 font-mono">
                          {hybridScore !== undefined ? 
                            <span className={hybridScore > 0.7 ? 'text-purple-600' : hybridScore > 0.5 ? 'text-indigo-600' : 'text-gray-600'}>
                              {(hybridScore * 100).toFixed(1)}%
                            </span>
                            : 'N/A'
                          }
                        </td>
                        <td className={`p-2 font-medium ${tierColor} capitalize`}>
                          {tier || 'N/A'}
                        </td>
                        <td className="p-2">
                          <button
                            onClick={() => setSelectedContact(contact)}
                            className="text-blue-600 hover:text-blue-800 underline"
                          >
                            Debug
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Raw Debug Data */}
          <div className="bg-white rounded border">
            <div className="bg-gray-50 px-3 py-2 border-b">
              <h5 className="text-sm font-medium text-gray-700">Raw Debug Output</h5>
              <p className="text-xs text-gray-500">Check browser console for detailed logs</p>
            </div>
            <div className="p-3">
              <button
                onClick={() => {
                  console.log('=== VECTOR DEBUG DUMP ===');
                  console.log('Query:', query);
                  console.log('Search Metadata:', searchMetadata);
                  console.log('Results with Debug Info:', results.map(r => ({
                    name: r.name,
                    vectorScore: r._vectorScore,
                    rerankScore: r.searchMetadata?.rerankScore,
                    hybridScore: r.searchMetadata?.hybridScore,
                    debugInfo: r._debugInfo,
                    searchMetadata: r.searchMetadata
                  })));
                  console.log('=== END DEBUG DUMP ===');
                }}
                className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200"
              >
                Dump to Console
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact Detail Modal */}
      {selectedContact && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-96 overflow-y-auto">
            <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">Debug: {selectedContact.name}</h3>
              <button
                onClick={() => setSelectedContact(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Scores */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded">
                  <div className="text-xs text-gray-600">Vector Score</div>
                  <div className="text-lg font-bold text-blue-700">
                    {selectedContact._vectorScore ? (selectedContact._vectorScore * 100).toFixed(3) + '%' : 'N/A'}
                  </div>
                </div>
                <div className="text-center p-3 bg-teal-50 rounded">
                  <div className="text-xs text-gray-600">Rerank Score</div>
                  <div className="text-lg font-bold text-teal-700">
                    {selectedContact.searchMetadata?.rerankScore ? (selectedContact.searchMetadata.rerankScore * 100).toFixed(3) + '%' : 'N/A'}
                  </div>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded">
                  <div className="text-xs text-gray-600">Hybrid Score</div>
                  <div className="text-lg font-bold text-purple-700">
                    {selectedContact.searchMetadata?.hybridScore ? (selectedContact.searchMetadata.hybridScore * 100).toFixed(3) + '%' : 'N/A'}
                  </div>
                </div>
              </div>

              {/* Debug Info */}
              {selectedContact._debugInfo && (
                <div className="bg-gray-50 p-3 rounded">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Pinecone Debug Info</h4>
                  <pre className="text-xs overflow-x-auto">
                    {JSON.stringify(selectedContact._debugInfo, null, 2)}
                  </pre>
                </div>
              )}

              {/* Search Metadata */}
              {selectedContact.searchMetadata && (
                <div className="bg-gray-50 p-3 rounded">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Search Metadata</h4>
                  <pre className="text-xs overflow-x-auto">
                    {JSON.stringify(selectedContact.searchMetadata, null, 2)}
                  </pre>
                </div>
              )}

              {/* Contact Data Preview */}
              <div className="bg-gray-50 p-3 rounded">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Contact Data</h4>
                <div className="text-xs space-y-1">
                  <div><strong>Name:</strong> {selectedContact.name}</div>
                  <div><strong>Email:</strong> {selectedContact.email}</div>
                  <div><strong>Company:</strong> {selectedContact.company}</div>
                  {selectedContact.notes && (
                    <div><strong>Notes:</strong> {selectedContact.notes.substring(0, 200)}...</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}