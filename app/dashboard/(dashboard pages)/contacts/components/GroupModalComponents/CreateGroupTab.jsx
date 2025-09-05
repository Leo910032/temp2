// app/dashboard/(dashboard pages)/contacts/components/GroupModalComponents/CreateGroupTab.jsx
"use client"
import ContactSelector from './ContactSelector';
import TimeFrameSelector from './TimeFrameSelector';
import LocationSelector from './LocationSelector';

export default function CreateGroupTab({ 
    contacts, 
    formState, 
    updateFormState, 
    onCreateGroup, 
    isSubmitting 
}) {
    return (
        <form onSubmit={onCreateGroup} className="space-y-6">
            <div className="space-y-6">
                {/* Basic Group Info */}
                <GroupBasicInfo 
                    formState={formState}
                    updateFormState={updateFormState}
                    isSubmitting={isSubmitting}
                />
                
                {/* Location Selector */}
                <LocationSelector
                    eventLocation={formState.eventLocation}
                    onLocationSelect={(location) => updateFormState({ eventLocation: location })}
                />
                
                {/* Time Frame Selector */}
                <TimeFrameSelector
                    useTimeFrame={formState.useTimeFrame}
                    startDate={formState.startDate}
                    endDate={formState.endDate}
                    timeFramePreset={formState.timeFramePreset}
                    contacts={contacts}
                    onToggleTimeFrame={(useTimeFrame) => updateFormState({ useTimeFrame })}
                    onDateChange={(field, value) => updateFormState({ [field]: value })}
                    onPresetChange={(preset, dates) => updateFormState({ 
                        timeFramePreset: preset, 
                        ...dates 
                    })}
                    onContactsChange={(contactIds) => updateFormState({ selectedContacts: contactIds })}
                    isSubmitting={isSubmitting}
                />
                
                {/* Contact Selector */}
                {!formState.useTimeFrame && (
                    <ContactSelector
                        contacts={contacts}
                        selectedContacts={formState.selectedContacts}
                        onSelectionChange={(contactIds) => updateFormState({ selectedContacts: contactIds })}
                        isSubmitting={isSubmitting}
                    />
                )}

                {/* Submission Feedback */}
                <SubmissionFeedback formState={formState} />
            </div>

            {/* Action Buttons */}
            <ActionButtons 
                formState={formState}
                isSubmitting={isSubmitting}
                onClose={() => updateFormState({ showCreateModal: false })}
            />
        </form>
    );
}

function GroupBasicInfo({ formState, updateFormState, isSubmitting }) {
    return (
        <>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Group Name *</label>
                <input 
                    type="text" 
                    value={formState.newGroupName} 
                    onChange={(e) => updateFormState({ newGroupName: e.target.value })} 
                    placeholder="Enter group name..." 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500" 
                    required 
                    disabled={isSubmitting} 
                />
            </div>
            
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Group Type</label>
                <select 
                    value={formState.newGroupType} 
                    onChange={(e) => updateFormState({ newGroupType: e.target.value })} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500" 
                    disabled={isSubmitting}
                >
                    <option value="custom">👥 Custom Group</option>
                    <option value="company">🏢 Company/Organization</option>
                    <option value="event">📅 Event-based</option>
                </select>
            </div>
           
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
                <textarea 
                    value={formState.newGroupDescription} 
                    onChange={(e) => updateFormState({ newGroupDescription: e.target.value })} 
                    placeholder="Enter group description..." 
                    rows={3} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-vertical" 
                    disabled={isSubmitting} 
                />
            </div>
        </>
    );
}

function SubmissionFeedback({ formState }) {
    if (formState.selectedContacts.length === 0) return null;

    return (
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium text-green-800">
                    Ready to create group with {formState.selectedContacts.length} contact{formState.selectedContacts.length !== 1 ? 's' : ''}
                </span>
            </div>
            {formState.useTimeFrame && formState.startDate && formState.endDate && (
                <div className="text-sm text-green-700">
                    Time frame: {new Date(formState.startDate).toLocaleString()} - {new Date(formState.endDate).toLocaleString()}
                </div>
            )}
        </div>
    );
}

function ActionButtons({ formState, isSubmitting, onClose }) {
    return (
        <div className="flex gap-3 pt-2">
            <button 
                type="button" 
                onClick={onClose} 
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                disabled={isSubmitting}
            >
                Cancel
            </button>
            <button 
                type="submit" 
                disabled={!formState.newGroupName.trim() || formState.selectedContacts.length === 0 || isSubmitting} 
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
                {isSubmitting ? (
                    <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Creating...</span>
                    </>
                ) : (
                    `Create Group (${formState.selectedContacts.length})`
                )}
            </button>
        </div>
    );
}