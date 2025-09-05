// app/dashboard/(dashboard pages)/contacts/components/GroupModalComponents/AIGenerateTab.jsx
"use client"

// Subscription tier features mapping
const TIER_FEATURES = {
    base: [],
    pro: [],
    premium: ['SMART_COMPANY_MATCHING'],
    business: ['SMART_COMPANY_MATCHING', 'INDUSTRY_DETECTION'],
    enterprise: ['SMART_COMPANY_MATCHING', 'INDUSTRY_DETECTION', 'RELATIONSHIP_DETECTION']
};

export default function AIGenerateTab({
    contacts,
    formState,
    updateFormState,
    subscriptionLevel,
    backgroundJobId,
    onGenerateAIGroups,
    onShowJobProgress
}) {
    const availableAiFeatures = TIER_FEATURES[subscriptionLevel] || [];

    const updateAIOptions = (updates) => {
        updateFormState({
            aiOptions: {
                ...formState.aiOptions,
                ...updates
            }
        });
    };

    const handleGenerateGroups = async () => {
        try {
            await onGenerateAIGroups();
        } catch (error) {
            console.error('Failed to generate AI groups:', error);
        }
    };

    return (
        <div className="space-y-6">
            <AIIntroduction subscriptionLevel={subscriptionLevel} />
            
            {backgroundJobId && (
                <ActiveJobNotification onShowJobProgress={onShowJobProgress} />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <BasicOptions
                    aiOptions={formState.aiOptions}
                    updateAIOptions={updateAIOptions}
                    backgroundJobId={backgroundJobId}
                />
                
                <AIFeatures
                    aiOptions={formState.aiOptions}
                    updateAIOptions={updateAIOptions}
                    availableAiFeatures={availableAiFeatures}
                    subscriptionLevel={subscriptionLevel}
                    backgroundJobId={backgroundJobId}
                />
            </div>

            <GenerateButton
                contacts={contacts}
                onGenerate={handleGenerateGroups}
                disabled={!!backgroundJobId || contacts.length < 5}
            />
            
            {contacts.length < 5 && <MinContactsWarning />}
        </div>
    );
}

function AIIntroduction({ subscriptionLevel }) {
    return (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6 border border-purple-200">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">AI-Powered Group Generation</h3>
            <p className="text-gray-600 mb-4">
                Let our AI analyze your contacts and create intelligent groups. This process runs in the background so you can continue using the app.
            </p>
        </div>
    );
}

function ActiveJobNotification({ onShowJobProgress }) {
    return (
        <div className="bg-blue-100 border border-blue-300 rounded-lg p-4">
            <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <div>
                    <div className="font-medium text-blue-900">AI Analysis Running</div>
                    <div className="text-sm text-blue-700">
                        Group generation is running in the background. You can close this modal and continue using the app.
                    </div>
                </div>
                <button
                    onClick={onShowJobProgress}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                >
                    View Progress
                </button>
            </div>
        </div>
    );
}

function BasicOptions({ aiOptions, updateAIOptions, backgroundJobId }) {
    const options = [
        {
            key: 'groupByCompany',
            label: 'Group by Company',
            description: 'Groups contacts from the same organization'
        },
        {
            key: 'groupByTime',
            label: 'Group by Time/Events',
            description: 'Groups contacts added around the same time'
        },
        {
            key: 'groupByLocation',
            label: 'Group by Location',
            description: 'Groups contacts from similar locations'
        }
    ];

    return (
        <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Basic Grouping Options</h4>
            
            {options.map(option => (
                <CheckboxOption
                    key={option.key}
                    checked={aiOptions[option.key]}
                    onChange={(checked) => updateAIOptions({ [option.key]: checked })}
                    label={option.label}
                    description={option.description}
                    disabled={!!backgroundJobId}
                />
            ))}

            <NumberInput
                label="Minimum Group Size"
                value={aiOptions.minGroupSize}
                onChange={(value) => updateAIOptions({ minGroupSize: parseInt(value) })}
                min={2}
                max={10}
                disabled={!!backgroundJobId}
            />

            <NumberInput
                label="Maximum Groups"
                value={aiOptions.maxGroups}
                onChange={(value) => updateAIOptions({ maxGroups: parseInt(value) })}
                min={1}
                max={20}
                disabled={!!backgroundJobId}
            />
        </div>
    );
}

function AIFeatures({ aiOptions, updateAIOptions, availableAiFeatures, subscriptionLevel, backgroundJobId }) {
    const features = [
        {
            key: 'useSmartCompanyMatching',
            feature: 'SMART_COMPANY_MATCHING',
            label: 'Smart Company Matching',
            description: 'Groups variants like "Microsoft Corp" and "Microsoft Inc"'
        },
        {
            key: 'useIndustryDetection',
            feature: 'INDUSTRY_DETECTION',
            label: 'Industry Detection',
            description: 'Groups contacts by business domain (Tech, Healthcare, etc.)'
        },
        {
            key: 'useRelationshipDetection',
            feature: 'RELATIONSHIP_DETECTION',
            label: 'Relationship Detection',
            description: 'Finds business relationships and partnerships'
        }
    ];

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <h4 className="font-medium text-gray-900">AI Features</h4>
                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                    {subscriptionLevel.toUpperCase()}
                </span>
            </div>

            {features.map(feature => {
                const isAvailable = availableAiFeatures.includes(feature.feature);
                return (
                    <CheckboxOption
                        key={feature.key}
                        checked={aiOptions[feature.key] && isAvailable}
                        onChange={(checked) => updateAIOptions({ [feature.key]: checked })}
                        label={feature.label}
                        description={feature.description}
                        disabled={!isAvailable || !!backgroundJobId}
                    />
                );
            })}

            {availableAiFeatures.length === 1 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="text-sm text-yellow-800">
                        Upgrade to Business or Enterprise for more AI features!
                    </div>
                </div>
            )}
        </div>
    );
}

function CheckboxOption({ checked, onChange, label, description, disabled }) {
    return (
        <label className="flex items-center gap-2">
            <input 
                type="checkbox" 
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                disabled={disabled}
            />
            <div>
                <div className="text-sm text-gray-700">{label}</div>
                <div className="text-xs text-gray-500">{description}</div>
            </div>
        </label>
    );
}

function NumberInput({ label, value, onChange, min, max, disabled }) {
    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">{label}</label>
            <input 
                type="number" 
                min={min}
                max={max}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                disabled={disabled}
            />
        </div>
    );
}

function GenerateButton({ contacts, onGenerate, disabled }) {
    return (
        <div className="flex justify-center mt-6">
            <button 
                onClick={onGenerate}
                disabled={disabled}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
                <span className="text-lg">🚀</span>
                <span>Generate Smart Groups</span>
            </button>
        </div>
    );
}

function MinContactsWarning() {
    return (
        <div className="text-center text-sm text-gray-500 mt-2">
            You need at least 5 contacts to use AI grouping
        </div>
    );
}