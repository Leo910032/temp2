// app/dashboard/(dashboard pages)/contacts/components/GroupModalComponents/CreateGroupTab.jsx
"use client"
import ContactSelector from './creategroup/ContactSelector';
import TimeFrameSelector from './creategroup/TimeFrameSelector';
import LocationSelector from './creategroup/LocationSelector'; // TODO: Uncomment when LocationSelector is refactored

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
                <GroupBasicInfo
                    formState={formState}
                    updateFormState={updateFormState}
                    isSubmitting={isSubmitting}
                />

                 <LocationSelector
                    eventLocation={formState.eventLocation}
                    onLocationSelect={(location) => updateFormState({ eventLocation: location })}
                /> 

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

                {!formState.useTimeFrame && (
                    <ContactSelector
                        contacts={contacts}
                        selectedContacts={formState.selectedContacts}
                        onSelectionChange={(contactIds) => updateFormState({ selectedContacts: contactIds })}
                        isSubmitting={isSubmitting}
                    />
                )}

                <SubmissionFeedback formState={formState} />
            </div>

            <ActionButtons
                formState={formState}
                isSubmitting={isSubmitting}
                onClose={() => updateFormState({ showCreateModal: false })}
            />
        </form>
    );
}

// Supporting Components

function GroupBasicInfo({ formState, updateFormState, isSubmitting }) {
    return (
        <>
            <GroupNameInput
                value={formState.newGroupName}
                onChange={(value) => updateFormState({ newGroupName: value })}
                isSubmitting={isSubmitting}
            />

            <GroupTypeSelector
                value={formState.newGroupType}
                onChange={(value) => updateFormState({ newGroupType: value })}
                isSubmitting={isSubmitting}
            />

            <GroupDescriptionInput
                value={formState.newGroupDescription}
                onChange={(value) => updateFormState({ newGroupDescription: value })}
                isSubmitting={isSubmitting}
            />
        </>
    );
}

function GroupNameInput({ value, onChange, isSubmitting }) {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Group Name *</label>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Enter group name..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                required
                disabled={isSubmitting}
            />
        </div>
    );
}

function GroupTypeSelector({ value, onChange, isSubmitting }) {
    const groupTypes = [
        { value: 'custom', label: '👥 Custom Group' },
        { value: 'company', label: '🏢 Company/Organization' },
        { value: 'event', label: '📅 Event-based' }
    ];

    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Group Type</label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                disabled={isSubmitting}
            >
                {groupTypes.map(type => (
                    <option key={type.value} value={type.value}>
                        {type.label}
                    </option>
                ))}
            </select>
        </div>
    );
}

function GroupDescriptionInput({ value, onChange, isSubmitting }) {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Enter group description..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-vertical"
                disabled={isSubmitting}
            />
        </div>
    );
}

function SubmissionFeedback({ formState }) {
    if (formState.selectedContacts.length === 0) return null;

    return (
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <FeedbackHeader selectedCount={formState.selectedContacts.length} />
            {formState.useTimeFrame && formState.startDate && formState.endDate && (
                <TimeFrameDisplay
                    startDate={formState.startDate}
                    endDate={formState.endDate}
                />
            )}
        </div>
    );
}

function FeedbackHeader({ selectedCount }) {
    return (
        <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium text-green-800">
                Ready to create group with {selectedCount} contact{selectedCount !== 1 ? 's' : ''}
            </span>
        </div>
    );
}

function TimeFrameDisplay({ startDate, endDate }) {
    return (
        <div className="text-sm text-green-700">
            Time frame: {new Date(startDate).toLocaleString()} - {new Date(endDate).toLocaleString()}
        </div>
    );
}

function ActionButtons({ formState, isSubmitting, onClose }) {
    const isDisabled = !formState.newGroupName.trim() || formState.selectedContacts.length === 0 || isSubmitting;

    return (
        <div className="flex gap-3 pt-2">
            <CancelButton onClick={onClose} isSubmitting={isSubmitting} />
            <SubmitButton
                isDisabled={isDisabled}
                isSubmitting={isSubmitting}
                selectedCount={formState.selectedContacts.length}
            />
        </div>
    );
}

function CancelButton({ onClick, isSubmitting }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            disabled={isSubmitting}
        >
            Cancel
        </button>
    );
}

function SubmitButton({ isDisabled, isSubmitting, selectedCount }) {
    return (
        <button
            type="submit"
            disabled={isDisabled}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
            {isSubmitting ? (
                <SubmittingState />
            ) : (
                `Create Group (${selectedCount})`
            )}
        </button>
    );
}

function SubmittingState() {
    return (
        <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            <span>Creating...</span>
        </>
    );
}
