"use client"
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { doc, onSnapshot } from 'firebase/firestore';
import { fireApp } from '@/important/firebase';

export default function PreviewModal({ isOpen, onClose }) {
    const { currentUser } = useAuth();
    const [username, setUsername] = useState("");
    const [userAppearance, setUserAppearance] = useState(null);

    // Listen to user data changes
    useEffect(() => {
        if (!currentUser || !isOpen) {
            setUsername("");
            setUserAppearance(null);
            return;
        }

        console.log('🔍 PreviewModal: Setting up listener for user:', currentUser.uid);

        const docRef = doc(fireApp, "users", currentUser.uid);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const userData = docSnap.data();
                const fetchedUsername = userData?.username || "";
                const appearance = userData?.appearance || {};

                console.log('📱 PreviewModal: User data fetched:', { fetchedUsername, appearance });
                setUsername(fetchedUsername);
                setUserAppearance(appearance);
            } else {
                console.warn('⚠️ PreviewModal: User document not found');
                setUsername("");
                setUserAppearance(null);
            }
        }, (error) => {
            console.error('❌ PreviewModal: Error listening to user document:', error);
            setUsername("");
            setUserAppearance(null);
        });

        return () => {
            console.log('🧹 PreviewModal: Cleaning up listener');
            unsubscribe();
        };
    }, [currentUser, isOpen]);

    // Generate preview background style
    const getPreviewBackgroundStyle = () => {
        if (!userAppearance) return {};

        const {
            backgroundType,
            backgroundColor,
            gradientDirection,
            gradientColorStart,
            gradientColorEnd
        } = userAppearance;

        switch (backgroundType) {
            case 'Gradient':
                const direction = gradientDirection === 1 ? 'to top' : 'to bottom';
                return {
                    background: `linear-gradient(${direction}, ${gradientColorStart || '#FFFFFF'}, ${gradientColorEnd || '#000000'})`
                };
            case 'Color':
                return {
                    backgroundColor: backgroundColor || '#FFFFFF'
                };
            default:
                return {
                    backgroundColor: '#FFFFFF'
                };
        }
    };

    // Close modal on escape key and hide navbars
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            // Prevent body scroll when modal is open
            document.body.style.overflow = 'hidden';
            // Add class to hide navbars
            document.body.classList.add('preview-modal-open');
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
            // Remove class to show navbars again
            document.body.classList.remove('preview-modal-open');
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-3 sm:p-4"
            onClick={onClose}
        >
            <div
                className="relative bg-white rounded-3xl shadow-2xl w-full h-full max-w-md flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 sm:-top-4 sm:-right-4 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition-colors z-10"
                    aria-label="Close preview"
                >
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Phone mockup */}
                <div className="p-4 sm:p-6 flex flex-col h-full">
                    <h2 className="text-lg sm:text-xl font-semibold text-center mb-3 sm:mb-4 text-gray-800 flex-shrink-0">Preview</h2>
                    <div className="flex justify-center flex-1 min-h-0">
                        <div className="h-full w-full max-w-[340px] bg-black rounded-[2.5rem] grid place-items-center shadow-2xl">
                            <div className="h-[98%] w-[96%] bg-white bg-opacity-[.1] grid place-items-center rounded-[2rem] overflow-hidden relative border-2 border-gray-700">
                                {/* Notch */}
                                <div className='absolute h-[20px] w-[20px] rounded-full top-2 bg-black z-10'></div>

                                {/* Loading indicator */}
                                <div className='top-6 left-6 absolute pointer-events-none z-10'>
                                    <Image
                                        src={"https://linktree.sirv.com/Images/gif/loading.gif"}
                                        width={25}
                                        height={25}
                                        alt="loading"
                                        className="mix-blend-screen"
                                    />
                                </div>

                                {/* Preview iframe */}
                                <div className="h-full w-full">
                                    {username ? (
                                        <iframe
                                            key={`preview-modal-${username}`}
                                            id="preview-modal-iframe"
                                            src={`/${username}?preview=true`}
                                            frameBorder="0"
                                            className='h-full w-full'
                                            style={getPreviewBackgroundStyle()}
                                            title="User Profile Preview"
                                            onLoad={() => console.log('🎯 PreviewModal iframe loaded for:', username)}
                                            onError={() => console.error('❌ PreviewModal iframe failed to load for:', username)}
                                        ></iframe>
                                    ) : (
                                        <div
                                            className="h-full w-full flex items-center justify-center"
                                            style={getPreviewBackgroundStyle()}
                                        >
                                            <div className="text-center p-4">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
                                                <p className="text-gray-600 text-sm">Loading preview...</p>
                                                {!currentUser && <p className="text-red-500 text-xs mt-1">No user logged in</p>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
