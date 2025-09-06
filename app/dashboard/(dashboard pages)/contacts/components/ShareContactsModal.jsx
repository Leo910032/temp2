// app/dashboard/(dashboard pages)/contacts/components/ShareContactsModal.jsx - SERVER-SIDE VERSION

import { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/translation/useTranslation';
import { toast } from 'react-hot-toast';
import { auth } from '@/important/firebase';

export function ShareContactsModal({ 
    isOpen, 
    onClose, 
    contacts = [], 
    selectedContactIds = [], 
    onShare,
    onGetTeamMembers
}) {
    const { t } = useTranslation();
    const [teamMembers, setTeamMembers] = useState([]);
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [shareWithAll, setShareWithAll] = useState(true);
    const [isSharing, setIsSharing] = useState(false);
    const [sharingEnabled, setSharingEnabled] = useState(false);
    const [loading, setLoading] = useState(true);
    const [sharingInfo, setSharingInfo] = useState(null);

    // Load team data and check permissions
    useEffect(() => {
        if (isOpen) {
            loadSharingInfo();
        }
    }, [isOpen]);

    const loadSharingInfo = async () => {
        try {
            setLoading(true);
            console.log('🔍 Loading team sharing information...');
            
            // ✅ Use the new server-side API to get sharing info
            const user = auth.currentUser;
            if (!user) {
                throw new Error('User not authenticated');
            }

            const token = await user.getIdToken();
            const response = await fetch('/api/user/contacts/share', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to load sharing information');
            }

            const result = await response.json();
            console.log('✅ Sharing info loaded:', result);
            
            setSharingInfo(result);
            setSharingEnabled(result.canShare);
            setTeamMembers(result.teamMembers || []);

        } catch (error) {
            console.error('❌ Error loading sharing info:', error);
            setSharingEnabled(false);
            setTeamMembers([]);
            
            // Don't show error toast for permission-related issues
            if (!error.message.includes('not in a team') && 
                !error.message.includes('not enabled') &&
                !error.message.includes('permission')) {
                toast.error(error.message || 'Failed to load team information');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleMemberToggle = (memberId) => {
        setSelectedMembers(prev => 
            prev.includes(memberId) 
                ? prev.filter(id => id !== memberId)
                : [...prev, memberId]
        );
    };

    const handleShareModeChange = (shareAll) => {
        setShareWithAll(shareAll);
        if (shareAll) {
            setSelectedMembers([]);
        }
    };

    const handleShare = async () => {
        if (!shareWithAll && selectedMembers.length === 0) {
            toast.error(t('contacts.select_team_members') || 'Please select at least one team member');
            return;
        }

        setIsSharing(true);
        
        try {
            console.log('📤 Sharing contacts via server API...', {
                contactIds: selectedContactIds,
                targetMembers: shareWithAll ? 'all' : selectedMembers,
                teamMembers: teamMembers.length
            });

            // ✅ Use the new server-side sharing API
            const user = auth.currentUser;
            if (!user) {
                throw new Error('User not authenticated');
            }

            const token = await user.getIdToken();
            const response = await fetch('/api/user/contacts/share', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contactIds: selectedContactIds,
                    targetMembers: shareWithAll ? 'all' : selectedMembers
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to share contacts');
            }

            const result = await response.json();
            console.log('✅ Contacts shared successfully:', result);

            // ✅ Enhanced success/failure reporting
            const { results } = result;
            const successfulShares = results.successfulShares;
            const totalContactsShared = results.totalContactsShared;
            const duplicatesSkipped = results.duplicatesSkipped;

            if (successfulShares > 0) {
                let successMessage = t('contacts.share_success', {
                    contacts: totalContactsShared,
                    members: successfulShares
                });
                
                if (!successMessage) {
                    successMessage = `Successfully shared ${totalContactsShared} contact(s) with ${successfulShares} team member(s)`;
                }

                if (duplicatesSkipped > 0) {
                    successMessage += ` (${duplicatesSkipped} duplicates skipped)`;
                }

                toast.success(successMessage, { duration: 4000 });
            }

            if (results.shareResults.some(r => r.error)) {
                const failedShares = results.shareResults.filter(r => r.error).length;
                toast.error(
                    t('contacts.share_partial_failure', { count: failedShares }) ||
                    `Failed to share with ${failedShares} member(s)`,
                    { duration: 3000 }
                );
            }

            onClose();

        } catch (error) {
            console.error('❌ Error sharing contacts:', error);
            
            let errorMessage = t('contacts.share_failed') || 'Failed to share contacts';
            
            if (error.message.includes('permission')) {
                errorMessage = t('contacts.share_permission_denied') || 'You do not have permission to share contacts';
            } else if (error.message.includes('not found')) {
                errorMessage = t('contacts.share_no_contacts') || 'No valid contacts found to share';
            } else if (error.message.includes('Token expired')) {
                errorMessage = t('auth.token_expired') || 'Session expired. Please refresh the page.';
            }
            
            toast.error(errorMessage);
        } finally {
            setIsSharing(false);
        }
    };

    if (!isOpen) return null;

    // Get contacts to share
    const contactsToShare = contacts.filter(contact => 
        selectedContactIds.includes(contact.id)
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b">
                    <h3 className="text-lg font-semibold text-gray-900">
                        {t('contacts.share_with_team') || 'Share with Team'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                        disabled={isSharing}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <span className="ml-3 text-gray-600">
                                {t('contacts.loading_team_info') || 'Loading team information...'}
                            </span>
                        </div>
                    ) : !sharingEnabled ? (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">
                                {t('contacts.sharing_disabled') || 'Contact Sharing Disabled'}
                            </h3>
                            <p className="text-gray-500 text-sm">
                                {sharingInfo?.reason ? (
                                    <span className="capitalize">{sharingInfo.reason}</span>
                                ) : (
                                    t('contacts.sharing_disabled_message') || 
                                    'Contact sharing is not available. You may need to join a team or ask your team manager to enable it.'
                                )}
                            </p>
                            {sharingInfo?.team && (
                                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                                    <p className="text-sm text-blue-800">
                                        <strong>{t('contacts.team') || 'Team'}:</strong> {sharingInfo.team.teamName}
                                    </p>
                                    <p className="text-xs text-blue-600 mt-1">
                                        {t('contacts.ask_manager_enable') || 'Ask your team manager to enable contact sharing in team settings.'}
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Contacts to share */}
                            <div className="mb-6">
                                <h4 className="text-sm font-medium text-gray-900 mb-3">
                                    {t('contacts.contacts_to_share') || 'Contacts to Share'} ({contactsToShare.length})
                                </h4>
                                <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                                    {contactsToShare.map(contact => (
                                        <div key={contact.id} className="flex items-center gap-3 py-1">
                                            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                                                {contact.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 truncate">
                                                    {contact.name}
                                                </p>
                                                <p className="text-xs text-gray-500 truncate">
                                                    {contact.email}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Share mode selection */}
                            <div className="mb-6">
                                <h4 className="text-sm font-medium text-gray-900 mb-3">
                                    {t('contacts.share_with') || 'Share With'}
                                </h4>
                                
                                <div className="space-y-3">
                                    {/* Share with all members */}
                                    <label className="flex items-center">
                                        <input
                                            type="radio"
                                            checked={shareWithAll}
                                            onChange={() => handleShareModeChange(true)}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            disabled={isSharing}
                                        />
                                        <span className="ml-3 text-sm text-gray-700">
                                            {t('contacts.all_team_members') || 'All Team Members'} ({teamMembers.length})
                                        </span>
                                    </label>

                                    {/* Share with specific members */}
                                    <label className="flex items-center">
                                        <input
                                            type="radio"
                                            checked={!shareWithAll}
                                            onChange={() => handleShareModeChange(false)}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            disabled={isSharing}
                                        />
                                        <span className="ml-3 text-sm text-gray-700">
                                            {t('contacts.specific_members') || 'Specific Members'}
                                        </span>
                                    </label>
                                </div>
                            </div>

                            {/* Team members selection */}
                            {!shareWithAll && (
                                <div className="mb-6">
                                    <h4 className="text-sm font-medium text-gray-900 mb-3">
                                        {t('contacts.select_members') || 'Select Members'}
                                    </h4>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {teamMembers.map(member => (
                                            <label key={member.userId} className="flex items-center p-2 hover:bg-gray-50 rounded-lg">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedMembers.includes(member.userId)}
                                                    onChange={() => handleMemberToggle(member.userId)}
                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    disabled={isSharing}
                                                />
                                                <div className="ml-3 flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                                                        {(member.displayName || member.username).charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900">
                                                            {member.displayName || member.username}
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            {member.teamRole} • {member.email}
                                                        </p>
                                                    </div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Team info */}
                            {sharingInfo?.team && (
                                <div className="mb-6 p-3 bg-purple-50 rounded-lg border border-purple-200">
                                    <div className="flex items-center gap-2 mb-2">
                                        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                        <h4 className="text-sm font-medium text-purple-900">
                                            {sharingInfo.team.teamName}
                                        </h4>
                                    </div>
                                    <div className="text-xs text-purple-700 space-y-1">
                                        <p>
                                            <strong>{t('contacts.members') || 'Members'}:</strong> {sharingInfo.team.memberCount}
                                        </p>
                                        <p>
                                            <strong>{t('contacts.your_role') || 'Your Role'}:</strong> {sharingInfo.userRole || 'Member'}
                                        </p>
                                        {sharingInfo.permissions?.isManager && (
                                            <p className="text-purple-600">
                                                👑 {t('contacts.manager_privileges') || 'You have manager privileges'}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Warning message */}
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
                                <div className="flex">
                                    <svg className="w-5 h-5 text-yellow-400 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    <div className="text-sm text-yellow-800">
                                        <p className="font-medium mb-1">
                                            {t('contacts.sharing_notice') || 'Important Notice'}
                                        </p>
                                        <p>
                                            {t('contacts.sharing_warning') || 'Shared contacts will be added to team members\' contact lists. They can view but not edit these contacts.'}
                                        </p>
                                        <p className="mt-1 text-xs">
                                            {t('contacts.duplicate_handling') || 'Duplicate contacts (same email) will be automatically skipped.'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                    disabled={isSharing}
                                >
                                    {t('common.cancel') || 'Cancel'}
                                </button>
                                <button
                                    onClick={handleShare}
                                    disabled={isSharing || (!shareWithAll && selectedMembers.length === 0) || contactsToShare.length === 0}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isSharing && (
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    )}
                                    {isSharing ? (
                                        <span>{t('contacts.sharing') || 'Sharing...'}</span>
                                    ) : (
                                        <span>
                                            {t('contacts.share_contacts') || 'Share Contacts'} ({contactsToShare.length})
                                        </span>
                                    )}
                                </button>
                            </div>

                            {/* Sharing progress */}
                            {isSharing && (
                                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                    <div className="flex items-center gap-3">
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-blue-900">
                                                {t('contacts.sharing_progress') || 'Sharing contacts...'}
                                            </p>
                                            <p className="text-xs text-blue-700">
                                                {shareWithAll ? 
                                                    t('contacts.sharing_with_all', { count: teamMembers.length }) || 
                                                    `Sharing with all ${teamMembers.length} team members` :
                                                    t('contacts.sharing_with_selected', { count: selectedMembers.length }) || 
                                                    `Sharing with ${selectedMembers.length} selected members`
                                                }
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}