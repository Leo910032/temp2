// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

// app/dashboard/(dashboard pages)/contacts/components/GroupModalComponents/GroupCard.jsx
"use client"

// Helper function to get group color
function getGroupColor(groupId, groups) {
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'];
    const index = groups.findIndex(g => g.id === groupId);
    return colors[index % colors.length] || '#6B7280';
}

export default function GroupCard({ 
    group, 
    groups, 
    contacts = [], 
    onDelete, 
    onEdit, 
    compact = false 
}) {
    if (compact) {
        return <CompactGroupCard group={group} groups={groups} onDelete={onDelete} />;
    }

    return <FullGroupCard group={group} groups={groups} contacts={contacts} onDelete={onDelete} onEdit={onEdit} />;
}

function CompactGroupCard({ group, groups, onDelete }) {
    return (
        <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center gap-3">
                <div 
                    className="w-4 h-4 rounded-full border-2 border-white shadow" 
                    style={{ backgroundColor: getGroupColor(group.id, groups) }} 
                />
                <div className="min-w-0">
                    <div className="font-medium text-gray-900 truncate" title={group.name}>
                        {group.name}
                    </div>
                    <div className="text-sm text-gray-600">
                        {group.contactIds?.length || 0} contact{(group.contactIds?.length || 0) !== 1 ? 's' : ''} • {group.type}
                        {group.metadata?.aiGenerated && ' 🤖'}
                        {group.timeFrame && ' ⏰'}
                    </div>
                </div>
            </div>
            <button 
                onClick={() => onDelete(group.id)} 
                className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            </button>
        </div>
    );
}

function FullGroupCard({ group, groups, contacts, onDelete, onEdit }) {
    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 flex-1">
                    <div 
                        className="w-6 h-6 rounded-full border-2 border-white shadow flex-shrink-0" 
                        style={{ backgroundColor: getGroupColor(group.id, groups) }} 
                    />
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900">{group.name}</h4>
                            {group.metadata?.aiGenerated && (
                                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                                    AI Generated
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{group.description}</p>
                        <GroupMetadata group={group} />
                    </div>
                </div>
                <div className="flex gap-2">
                    {onEdit && (
                        <button 
                            onClick={() => onEdit(group)} 
                            className="p-2 text-blue-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                    )}
                    <button 
                        onClick={() => onDelete(group.id)} 
                        className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 flex-shrink-0 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </div>
            
            {/* Contact Preview */}
            {group.contactIds && group.contactIds.length > 0 && contacts.length > 0 && (
                <ContactPreview groupContactIds={group.contactIds} contacts={contacts} />
            )}
        </div>
    );
}

function GroupMetadata({ group }) {
    const metadataItems = [
        `${group.contactIds?.length || 0} contact${(group.contactIds?.length || 0) !== 1 ? 's' : ''}`,
        group.type
    ];

    if (group.timeFrame) {
        metadataItems.push(`⏰ ${new Date(group.timeFrame.startDate).toLocaleDateString()} - ${new Date(group.timeFrame.endDate).toLocaleDateString()}`);
    }

    if (group.createdAt) {
        metadataItems.push(`Created ${new Date(group.createdAt).toLocaleDateString()}`);
    }

    return (
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            {metadataItems.map((item, index) => (
                <span key={index}>{item}</span>
            ))}
        </div>
    );
}

function ContactPreview({ groupContactIds, contacts }) {
    return (
        <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2 flex-wrap">
                {groupContactIds.slice(0, 5).map(contactId => {
                    const contact = contacts.find(c => c.id === contactId);
                    if (!contact) return null;
                    return (
                        <div key={contactId} className="flex items-center gap-1 bg-gray-100 rounded-full px-2 py-1">
                            <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">
                                {contact.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs text-gray-700">{contact.name}</span>
                        </div>
                    );
                })}
                {groupContactIds.length > 5 && (
                    <span className="text-xs text-gray-500">+{groupContactIds.length - 5} more</span>
                )}
            </div>
        </div>
    );
}