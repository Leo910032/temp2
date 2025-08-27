// app/dashboard/(dashboard pages)/enterprise/components/PendingInvitationsBanner.jsx
"use client"
import { useState, useEffect } from 'react';
import { useAuth } from "@/contexts/AuthContext";
import { toast } from 'react-hot-toast';

// We need a client-side service to interact with our new APIs
async function fetchPendingInvitations(token) {
    const response = await fetch('/api/enterprise/invitations/invitations', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) {
        throw new Error('Could not fetch invitations.');
    }
    return response.json();
}

async function acceptInvitation(token, invitationId) {
    const response = await fetch('/api/enterprise/invitations/accept', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'accept', invitationId })
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to join the team.');
    }
    return response.json();
}


export default function PendingInvitationsBanner() {
    const { currentUser } = useAuth();
    const [invitations, setInvitations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAccepting, setIsAccepting] = useState(null); // Tracks which invitation is being accepted

    useEffect(() => {
        if (!currentUser) return;

        const getInvitations = async () => {
            try {
                const token = await currentUser.getIdToken();
                const data = await fetchPendingInvitations(token);
                setInvitations(data);
            } catch (error) {
                console.error("Failed to fetch pending invitations:", error);
                // Don't show an error toast, just fail silently.
            } finally {
                setLoading(false);
            }
        };

        getInvitations();
    }, [currentUser]);

    const handleAccept = async (invitationId) => {
        if (!currentUser) return;
        
        setIsAccepting(invitationId);
        const toastId = toast.loading('Joining team...');

        try {
            const token = await currentUser.getIdToken();
            await acceptInvitation(token, invitationId);
            toast.success('Welcome to the team!', { id: toastId });

            // Reload the page to reflect the new team membership and refresh all data
            window.location.reload();

        } catch (error) {
            toast.error(error.message, { id: toastId });
            setIsAccepting(null);
        }
    };

    if (loading) {
        // Show a subtle loading skeleton
        return (
            <div className="bg-gray-100 border border-gray-200 rounded-lg p-4 animate-pulse">
                <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                <div className="h-8 bg-gray-300 rounded w-24 mt-2"></div>
            </div>
        );
    }

    if (invitations.length === 0) {
        return null; // Don't render anything if there are no invitations
    }

    return (
        <div className="space-y-4 my-4">
            {invitations.map(invite => (
                <div key={invite.id} className="bg-blue-50 border border-blue-200 rounded-lg p-4 shadow-sm">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-blue-900">
                                    You've been invited to join a team!
                                </p>
                                <p className="text-sm text-blue-700">
                                    Join the <span className="font-bold">{invite.teamName}</span> team in the <span className="font-bold">{invite.organizationName}</span> organization.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => handleAccept(invite.id)}
                            disabled={isAccepting === invite.id}
                            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center"
                        >
                            {isAccepting === invite.id && (
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            )}
                            {isAccepting === invite.id ? 'Joining...' : 'Join Team'}
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}