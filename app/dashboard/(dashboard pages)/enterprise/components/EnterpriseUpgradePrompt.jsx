"use client"

export default function EnterpriseUpgradePrompt({ currentPlan }) {
    return (
        <div className="flex-1 flex items-center justify-center h-full p-4 sm:p-8">
            <div className="max-w-2xl w-full mx-auto text-center">
                <div className="bg-gradient-to-br from-purple-50 to-blue-100 rounded-3xl p-6 sm:p-8 shadow-lg border border-purple-200">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                        </svg>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">Unlock Team Management</h1>
                    <p className="text-base sm:text-lg text-gray-600 mb-6">
                        The Enterprise Dashboard is available on our Business and Enterprise plans.
                    </p>
                    <div className="inline-flex items-center px-4 py-2 bg-white rounded-full shadow-sm border mb-6">
                        <span className="text-sm text-gray-500 mr-2">Your current plan:</span>
                        <span className="font-semibold text-gray-900 capitalize">{currentPlan || 'Base'}</span>
                    </div>
                    
                    <div className="bg-white rounded-2xl p-6 mb-8 shadow-sm text-left">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Upgrade to Business to:</h3>
                        <ul className="space-y-3">
                            {['Create and manage teams', 'Invite members with specific roles', 'Share contacts collaboratively', 'Access the manager dashboard'].map((feature, index) => (
                                <li key={index} className="flex items-center">
                                    <svg className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    <span className="text-sm text-gray-700">{feature}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button className="px-8 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors duration-200 shadow-md">
                            Upgrade Your Plan
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}