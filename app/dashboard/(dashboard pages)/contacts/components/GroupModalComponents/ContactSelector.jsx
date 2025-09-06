// app/dashboard/(dashboard pages)/contacts/components/GroupModalComponents/ContactSelector.jsx
"use client"

export default function ContactSelector({ 
    contacts, 
    selectedContacts, 
    onSelectionChange, 
    isSubmitting 
}) {
    const handleToggleContact = (contactId) => {
        const isSelected = selectedContacts.includes(contactId);
        const newSelection = isSelected
            ? selectedContacts.filter(id => id !== contactId)
            : [...selectedContacts, contactId];
        onSelectionChange(newSelection);
    };

    const handleSelectAll = () => {
        if (selectedContacts.length === contacts.length) {
            onSelectionChange([]);
        } else {
            onSelectionChange(contacts.map(c => c.id));
        }
    };

    const isAllSelected = selectedContacts.length === contacts.length && contacts.length > 0;
    const isPartiallySelected = selectedContacts.length > 0 && selectedContacts.length < contacts.length;

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                    Select Contacts ({selectedContacts.length} selected)
                </label>
                {contacts.length > 0 && (
                    <button
                        type="button"
                        onClick={handleSelectAll}
                        disabled={isSubmitting}
                        className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                    >
                        {isAllSelected ? 'Deselect All' : 'Select All'}
                    </button>
                )}
            </div>
            
            <div className="border border-gray-300 rounded-lg max-h-64 overflow-y-auto">
                {contacts.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                        No contacts available
                    </div>
                ) : (
                    contacts.map(contact => (
                        <ContactItem
                            key={contact.id}
                            contact={contact}
                            isSelected={selectedContacts.includes(contact.id)}
                            onToggle={() => handleToggleContact(contact.id)}
                            isSubmitting={isSubmitting}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

function ContactItem({ contact, isSelected, onToggle, isSubmitting }) {
    return (
        <label className="flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0">
            <input 
                type="checkbox" 
                checked={isSelected} 
                onChange={onToggle} 
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 mr-3" 
                disabled={isSubmitting}
            />
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                    {contact.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900 truncate">{contact.name}</div>
                    <div className="text-sm text-gray-600 truncate">{contact.email}</div>
                    {contact.company && (
                        <div className="text-xs text-gray-500 truncate">{contact.company}</div>
                    )}
                    <div className="text-xs text-gray-400">
                        Added {new Date(contact.submittedAt || contact.createdAt).toLocaleDateString()}
                    </div>
                </div>
            </div>
        </label>
    );
}