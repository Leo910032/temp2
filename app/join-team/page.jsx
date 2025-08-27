"use client"
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from "@/contexts/AuthContext";
import { toast } from 'react-hot-toast';

// ✅ ADDED: Error code to user-friendly message mapping
const ERROR_MESSAGES = {
    ALREADY_ACCEPTED: {
        title: "Already a Team Member",
        message: "You're already part of this team! Check your dashboard to see your teams.",
        action: "Go to Dashboard",
        severity: "info"
    },
    EXPIRED: {
        title: "Invitation Expired",
        message: "This invitation has expired. Please ask your team manager for a new invitation.",
        action: "Contact Manager",
        severity: "warning"
    },
    REVOKED: {
        title: "Invitation Revoked",
        message: "This invitation has been cancelled. Please contact your team manager for assistance.",
        action: "Contact Manager",
        severity: "warning"
    },
    NOT_FOUND: {
        title: "Invalid Code",
        message: "The invitation code you entered is not valid. Please check your email and try again.",
        action: "Try Again",
        severity: "error"
    },
    EMAIL_MISMATCH: {
        title: "Wrong Account",
        message: "This invitation was sent to a different email address. Please sign in with the correct account.",
        action: "Switch Account",
        severity: "warning"
    },
    ALREADY_MEMBER: {
        title: "Already a Member",
        message: "You're already a member of this team. Check your dashboard to access team features.",
        action: "Go to Dashboard",
        severity: "info"
    }
};

function JoinTeamContent() {
    const { currentUser } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    
    const [code, setCode] = useState(searchParams.get('code') || '');
    const [isVerifying, setIsVerifying] = useState(false);
    const [isAccepting, setIsAccepting] = useState(false);
    const [error, setError] = useState('');
    const [errorCode, setErrorCode] = useState('');
    const [verifiedInvitation, setVerifiedInvitation] = useState(null);
    const [retryCount, setRetryCount] = useState(0);
    
    // ✅ ADDED: Auto-verify when user logs in and code is present
    useEffect(() => {
        if (code && currentUser && !verifiedInvitation && !error) {
            handleVerify();
        }
    }, [currentUser, code]);

    // ✅ ADDED: Better input validation
    const validateCode = (inputCode) => {
        const cleanCode = inputCode.trim().toUpperCase();
        if (cleanCode.length === 0) return { valid: false, message: "Please enter an invitation code" };
        if (cleanCode.length !== 6) return { valid: false, message: "Invitation code must be 6 characters" };
        if (!/^[A-Z0-9]+$/.test(cleanCode)) return { valid: false, message: "Invalid characters in code" };
        return { valid: true, code: cleanCode };
    };
    

    const handleVerify = async (e) => {
        if (e) e.preventDefault();
        
        if (!currentUser) {
            toast.error("Please log in to verify your invitation.");
            router.push(`/login?redirect=/join-team?code=${code}`);
            return;
        }

        // Validate code format
        const validation = validateCode(code);
        if (!validation.valid) {
            setError(validation.message);
            return;
        }
        
        setIsVerifying(true);
        setError('');
        setErrorCode('');
        
        try {
            const token = await currentUser.getIdToken();
            
            console.log('🔄 Verifying invitation with code:', validation.code);
            
            const response = await fetch('/api/enterprise/invitations/verify', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`, 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ 
                    code: validation.code, 
                    email: currentUser.email 
                })
            });

            const result = await response.json();
            
            console.log('Verification response:', { status: response.status, result });
            
            if (!response.ok) {
                const errorInfo = ERROR_MESSAGES[result.code] || {
                    title: "Verification Failed",
                    message: result.error || `Verification failed: ${response.status}`,
                    action: "Try Again",
                    severity: "error"
                };
                
                setError(errorInfo.message);
                setErrorCode(result.code || 'UNKNOWN');
                
                // Show appropriate toast based on error type
                if (errorInfo.severity === 'info') {
                    toast.success(errorInfo.message);
                } else if (errorInfo.severity === 'warning') {
                    toast.error(errorInfo.message);
                } else {
                    toast.error(errorInfo.message);
                }
                
                return;
            }
            
            if (result.success && result.invitation) {
                setVerifiedInvitation(result.invitation);
                setRetryCount(0); // Reset retry count on success
                toast.success('Invitation verified successfully!');
                
                // Show warning if invitation is expiring soon
                if (result.invitation.isExpiringSoon) {
                    toast.error('⚠️ This invitation expires soon. Please accept it now!', { duration: 6000 });
                }
            } else {
                throw new Error('Invalid response format from server');
            }
            
        } catch (err) {
            console.error('Verification error:', err);
            setError(err.message);
            setErrorCode('NETWORK_ERROR');
            toast.error(err.message);
        } finally {
            setIsVerifying(false);
        }
    };

    const handleAccept = async () => {
        if (!verifiedInvitation?.id) {
            setError('No valid invitation to accept');
            return;
        }
        
        setIsAccepting(true);
        setError('');
        setErrorCode('');
        
        try {
            const token = await currentUser.getIdToken();
            
            console.log('🔄 Accepting invitation:', verifiedInvitation.id);
            
            const response = await fetch('/api/enterprise/invitations/accept', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`, 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ 
                    action: 'accept', 
                    invitationId: verifiedInvitation.id 
                })
            });

            const result = await response.json();
            
            console.log('Accept response:', { status: response.status, result });
            
            if (!response.ok) {
                const errorInfo = ERROR_MESSAGES[result.code] || {
                    title: "Accept Failed",
                    message: result.error || `Accept failed: ${response.status}`,
                    action: "Try Again",
                    severity: "error"
                };
                
                setError(errorInfo.message);
                setErrorCode(result.code || 'UNKNOWN');
                toast.error(errorInfo.message);
                return;
            }
            
            if (result.success) {
                toast.success("🎉 Welcome to the team!");
                // Small delay to show success message before redirect
                setTimeout(() => {
                    router.push('/dashboard/enterprise');
                }, 1500);
            } else {
                throw new Error('Failed to accept invitation');
            }
            
        } catch (err) {
            console.error('Accept error:', err);
            setError(err.message);
            setErrorCode('NETWORK_ERROR');
            toast.error(err.message);
        } finally {
            setIsAccepting(false);
        }
    };

    // ✅ ADDED: Smart retry logic
    const handleRetry = () => {
        setError('');
        setErrorCode('');
        setVerifiedInvitation(null);
        setRetryCount(prev => prev + 1);
        
        if (errorCode === 'EMAIL_MISMATCH') {
            // Redirect to login to switch accounts
            router.push(`/login?redirect=/join-team?code=${code}`);
        } else if (errorCode === 'ALREADY_ACCEPTED' || errorCode === 'ALREADY_MEMBER') {
            // Go directly to dashboard
            router.push('/dashboard/enterprise');
        } else {
            // Regular retry
            if (verifiedInvitation) {
                handleAccept();
            } else {
                handleVerify();
            }
        }
    };

    // ✅ ADDED: Get appropriate error display info
    const getErrorDisplay = () => {
        const errorInfo = ERROR_MESSAGES[errorCode];
        if (!errorInfo) {
            return {
                title: "Something went wrong",
                message: error || "An unexpected error occurred",
                action: "Try Again",
                severity: "error",
                bgColor: "bg-red-50",
                borderColor: "border-red-200",
                textColor: "text-red-700"
            };
        }
        
        const colorMap = {
            info: { bgColor: "bg-blue-50", borderColor: "border-blue-200", textColor: "text-blue-700" },
            warning: { bgColor: "bg-yellow-50", borderColor: "border-yellow-200", textColor: "text-yellow-700" },
            error: { bgColor: "bg-red-50", borderColor: "border-red-200", textColor: "text-red-700" }
        };
        
        return { ...errorInfo, ...colorMap[errorInfo.severity] };
    };
    
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md">
                {verifiedInvitation ? (
                    <div>
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">Confirm Invitation</h1>
                            <p className="text-gray-600">You're invited to join an amazing team!</p>
                        </div>
                        
                        <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-lg border mb-6">
                            <div className="text-center">
                                <h3 className="font-bold text-xl text-gray-900 mb-2">
                                    {verifiedInvitation.teamName || "Unnamed Team"}
                                </h3>
                                <p className="text-purple-600 font-medium mb-2">
                                    Role: {verifiedInvitation.role}
                                </p>
                                {verifiedInvitation.organizationName && (
                                    <p className="text-gray-600 text-sm">
                                        Organization: {verifiedInvitation.organizationName}
                                    </p>
                                )}
                                {verifiedInvitation.isExpiringSoon && (
                                    <div className="mt-3 px-3 py-2 bg-yellow-100 border border-yellow-300 rounded-md">
                                        <p className="text-yellow-800 text-sm font-medium">
                                            ⚠️ This invitation expires soon!
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {error && (
                            <div className={`${getErrorDisplay().bgColor} border ${getErrorDisplay().borderColor} ${getErrorDisplay().textColor} px-4 py-3 rounded-lg mb-4`}>
                                <div className="flex items-center">
                                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    <div>
                                        <h4 className="font-medium">{getErrorDisplay().title}</h4>
                                        <p className="text-sm">{getErrorDisplay().message}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        <div className="space-y-3">
                            <button 
                                onClick={handleAccept} 
                                disabled={isAccepting} 
                                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white p-3 rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
                            >
                                {isAccepting ? (
                                    <span className="flex items-center justify-center">
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Joining Team...
                                    </span>
                                ) : '🚀 Join Team Now'}
                            </button>
                            
                            {error && (
                                <button 
                                    onClick={handleRetry} 
                                    className="w-full text-purple-600 hover:text-purple-700 text-sm font-medium"
                                >
                                    {getErrorDisplay().action}
                                </button>
                            )}
                            
                            <button 
                                onClick={() => {
                                    setVerifiedInvitation(null);
                                    setError('');
                                    setErrorCode('');
                                    setCode('');
                                }} 
                                className="w-full text-gray-500 hover:text-gray-700 text-sm"
                            >
                                Enter a different code
                            </button>
                        </div>
                    </div>
                ) : (
                    <div>
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">Join Your Team</h1>
                            <p className="text-gray-600">
                                Enter the 6-character invitation code from your email.
                            </p>
                        </div>
                        
                        <form onSubmit={handleVerify} className="space-y-4">
                            <div>
                                <label htmlFor="invite-code" className="block font-medium text-gray-700 mb-2">
                                    Invitation Code
                                </label>
                                <input 
                                    id="invite-code" 
                                    type="text" 
                                    value={code} 
                                    onChange={(e) => {
                                        setCode(e.target.value.toUpperCase());
                                        if (error) setError(''); // Clear error when user types
                                    }}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-center text-lg font-mono tracking-wider"
                                    placeholder="ABC123" 
                                    maxLength={6}
                                    required 
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Check your email for the invitation code
                                </p>
                            </div>
                            
                            {error && (
                                <div className={`${getErrorDisplay().bgColor} border ${getErrorDisplay().borderColor} ${getErrorDisplay().textColor} px-4 py-3 rounded-lg`}>
                                    <div className="flex">
                                        <svg className="w-5 h-5 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                        <div>
                                            <h4 className="font-medium text-sm">{getErrorDisplay().title}</h4>
                                            <p className="text-sm">{getErrorDisplay().message}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            <div className="space-y-3">
                                <button 
                                    type="submit" 
                                    disabled={isVerifying || !code.trim()} 
                                    className="w-full bg-purple-600 text-white p-3 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                                >
                                    {isVerifying ? (
                                        <span className="flex items-center justify-center">
                                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Verifying...
                                        </span>
                                    ) : '🔍 Verify Code'}
                                </button>
                                
                                {error && retryCount < 3 && (
                                    <button 
                                        type="button"
                                        onClick={handleRetry}
                                        className="w-full text-purple-600 hover:text-purple-700 text-sm font-medium"
                                    >
                                        {getErrorDisplay().action}
                                    </button>
                                )}
                            </div>
                        </form>
                        
                        <div className="mt-6 text-center text-sm text-gray-500 space-y-2">
                            <p>Don't have an invitation code?</p>
                            <button 
                                onClick={() => router.push('/dashboard')}
                                className="text-purple-600 hover:text-purple-700 hover:underline font-medium"
                            >
                                Return to Dashboard
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function JoinTeamPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading invitation...</p>
                </div>
            </div>
        }>
            <JoinTeamContent />
        </Suspense>
    );
}