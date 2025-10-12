// app/dashboard/(dashboard pages)/contacts/components/GroupModalComponents/TimeFrameSelector.jsx
"use client"
import { useEffect } from 'react';

// Helper functions
function formatDateForInput(date) {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
}

function filterContactsByTimeFrame(contacts, startDate, endDate) {
    if (!startDate || !endDate) return [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    return contacts.filter(contact => {
        const contactDate = new Date(contact.submittedAt || contact.createdAt);
        return contactDate >= start && contactDate <= end;
    });
}

const TIME_FRAME_PRESETS = [
    { id: 'last4hours', label: 'Last 4 Hours' },
    { id: 'last8hours', label: 'Last 8 Hours' },
    { id: 'last24hours', label: 'Last 24 Hours' },
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'last7days', label: 'Last 7 Days' }
];

export default function TimeFrameSelector({
    useTimeFrame,
    startDate,
    endDate,
    timeFramePreset,
    contacts,
    onToggleTimeFrame,
    onDateChange,
    onPresetChange,
    onContactsChange,
    isSubmitting
}) {
    const timeFrameContacts = useTimeFrame && startDate && endDate
        ? filterContactsByTimeFrame(contacts, startDate, endDate)
        : [];

    // Auto-select contacts when timeframe changes
    useEffect(() => {
        if (useTimeFrame && startDate && endDate) {
            const filteredContacts = filterContactsByTimeFrame(contacts, startDate, endDate);
            onContactsChange(filteredContacts.map(c => c.id));
        }
    }, [useTimeFrame, startDate, endDate, contacts, onContactsChange]);

    const handleTimeFramePreset = (preset) => {
        const now = new Date();
        let start, end;

        switch (preset) {
            case 'today':
                start = new Date(now.setHours(0, 0, 0, 0));
                end = new Date(now.setHours(23, 59, 59, 999));
                break;
            case 'yesterday':
                const yesterday = new Date();
                yesterday.setDate(now.getDate() - 1);
                start = new Date(yesterday.setHours(0, 0, 0, 0));
                end = new Date(yesterday.setHours(23, 59, 59, 999));
                break;
            case 'last7days':
                start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                end = new Date();
                break;
            case 'last24hours':
                start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                end = new Date();
                break;
            case 'last8hours':
                start = new Date(now.getTime() - 8 * 60 * 60 * 1000);
                end = new Date();
                break;
            case 'last4hours':
                start = new Date(now.getTime() - 4 * 60 * 60 * 1000);
                end = new Date();
                break;
            default:
                return;
        }

        const formattedStart = formatDateForInput(start);
        const formattedEnd = formatDateForInput(end);

        onPresetChange(preset, {
            startDate: formattedStart,
            endDate: formattedEnd,
            timeFramePreset: preset
        });
    };

    return (
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <TimeFrameToggle
                useTimeFrame={useTimeFrame}
                onToggle={onToggleTimeFrame}
                isSubmitting={isSubmitting}
            />

            {useTimeFrame && (
                <TimeFrameContent
                    timeFramePreset={timeFramePreset}
                    startDate={startDate}
                    endDate={endDate}
                    timeFrameContacts={timeFrameContacts}
                    onPresetSelect={handleTimeFramePreset}
                    onDateChange={onDateChange}
                    isSubmitting={isSubmitting}
                />
            )}
        </div>
    );
}

// Supporting Components

function TimeFrameToggle({ useTimeFrame, onToggle, isSubmitting }) {
    return (
        <div className="flex items-center gap-2 mb-3">
            <input
                type="checkbox"
                id="useTimeFrame"
                checked={useTimeFrame}
                onChange={(e) => onToggle(e.target.checked)}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                disabled={isSubmitting}
            />
            <label htmlFor="useTimeFrame" className="font-medium text-gray-900">
                ⏰ Auto-select contacts by time frame
            </label>
        </div>
    );
}

function TimeFrameContent({
    timeFramePreset,
    startDate,
    endDate,
    timeFrameContacts,
    onPresetSelect,
    onDateChange,
    isSubmitting
}) {
    return (
        <div className="space-y-4">
            <QuickPresets
                presets={TIME_FRAME_PRESETS}
                timeFramePreset={timeFramePreset}
                onPresetSelect={onPresetSelect}
                isSubmitting={isSubmitting}
            />

            <DateInputs
                startDate={startDate}
                endDate={endDate}
                onDateChange={onDateChange}
                isSubmitting={isSubmitting}
            />

            {startDate && endDate && (
                <TimeFramePreview contacts={timeFrameContacts} />
            )}
        </div>
    );
}

function QuickPresets({ presets, timeFramePreset, onPresetSelect, isSubmitting }) {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Quick Presets</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {presets.map(preset => (
                    <PresetButton
                        key={preset.id}
                        preset={preset}
                        isActive={timeFramePreset === preset.id}
                        onClick={() => onPresetSelect(preset.id)}
                        isSubmitting={isSubmitting}
                    />
                ))}
            </div>
        </div>
    );
}

function PresetButton({ preset, isActive, onClick, isSubmitting }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                isActive
                    ? 'bg-purple-100 border-purple-300 text-purple-800'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
            disabled={isSubmitting}
        >
            {preset.label}
        </button>
    );
}

function DateInputs({ startDate, endDate, onDateChange, isSubmitting }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DateInput
                label="Start Date & Time"
                value={startDate}
                onChange={(value) => onDateChange('startDate', value)}
                isSubmitting={isSubmitting}
            />
            <DateInput
                label="End Date & Time"
                value={endDate}
                onChange={(value) => onDateChange('endDate', value)}
                isSubmitting={isSubmitting}
            />
        </div>
    );
}

function DateInput({ label, value, onChange, isSubmitting }) {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <input
                type="datetime-local"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                disabled={isSubmitting}
            />
        </div>
    );
}

function TimeFramePreview({ contacts }) {
    return (
        <div className="bg-white rounded-lg p-3 border border-gray-200">
            <PreviewHeader contactCount={contacts.length} />
            {contacts.length > 0 && (
                <PreviewContactList contacts={contacts} />
            )}
        </div>
    );
}

function PreviewHeader({ contactCount }) {
    return (
        <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-gray-700">
                📋 Contacts in time frame: {contactCount}
            </span>
        </div>
    );
}

function PreviewContactList({ contacts }) {
    const visibleContacts = contacts.slice(0, 10);
    const remainingCount = contacts.length - 10;

    return (
        <div className="flex flex-wrap gap-1">
            {visibleContacts.map(contact => (
                <ContactBadge key={contact.id} name={contact.name} />
            ))}
            {remainingCount > 0 && (
                <RemainingBadge count={remainingCount} />
            )}
        </div>
    );
}

function ContactBadge({ name }) {
    return (
        <span className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">
            {name}
        </span>
    );
}

function RemainingBadge({ count }) {
    return (
        <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
            +{count} more
        </span>
    );
}
