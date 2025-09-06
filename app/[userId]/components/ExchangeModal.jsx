// app/[userId]/components/ExchangeModal.jsx - Modern version using new service architecture
"use client"
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useTranslation } from '@/lib/translation/useTranslation';
import { toast } from 'react-hot-toast';

// Import the new service functions
import {
  submitExchangeContact,
  getCurrentLocation,
  checkLocationPermission,
  verifyProfileByUsername,
  verifyProfileByUserId
} from '@/lib/services/serviceContact';

export default function ExchangeModal({ 
    isOpen, 
    onClose, 
    profileOwnerUsername, 
    profileOwnerId = null
}) {
    const { t } = useTranslation();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        company: '',
        message: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState({});
    const [location, setLocation] = useState(null);
    const [locationPermission, setLocationPermission] = useState({ state: 'unavailable', supported: false });
    const [profileVerified, setProfileVerified] = useState(false);

    useEffect(() => {
        if (isOpen) {
            console.log("🔄 Exchange modal opened for:", profileOwnerUsername);
            initializeModal();
        }
    }, [isOpen, profileOwnerUsername, profileOwnerId]);

    const initializeModal = async () => {
        try {
            // Check location permission status
            const permission = await checkLocationPermission();
            setLocationPermission(permission);
            
            if (permission.state === 'granted') {
                // Automatically get location if permission is already granted
                await requestLocation();
            }

            // Verify profile exists and is available for exchange
            await verifyTargetProfile();

        } catch (error) {
            console.error("❌ Error initializing modal:", error);
        }
    };

    const verifyTargetProfile = async () => {
        try {
            let verification;
            
            if (profileOwnerId) {
                verification = await verifyProfileByUserId(profileOwnerId);
            } else if (profileOwnerUsername) {
                verification = await verifyProfileByUsername(profileOwnerUsername);
            } else {
                throw new Error('No profile identifier provided');
            }

            setProfileVerified(verification.available);
            
            if (!verification.available) {
                toast.error(t('exchange.profile_unavailable') || 'This profile is not available for contact exchange');
            }

        } catch (error) {
            console.error("❌ Error verifying profile:", error);
            setProfileVerified(false);
            toast.error(t('exchange.profile_verification_failed') || 'Unable to verify profile availability');
        }
    };

    const requestLocation = async () => {
        try {
            console.log("🔍 Requesting location...");
            
            const userLocation = await getCurrentLocation({
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000 // 5 minutes
            });
            
            setLocation(userLocation);
            setLocationPermission(prev => ({ ...prev, state: 'granted' }));
            
            toast.success(t('exchange.location_obtained') || 'Location obtained successfully!', {
                style: {
                    border: '1px solid #10B981',
                    padding: '16px',
                    color: '#10B981',
                },
                iconTheme: {
                    primary: '#10B981',
                    secondary: '#FFFAEE',
                },
            });
            
            return userLocation;
            
        } catch (error) {
            console.error("❌ Error getting location:", error);
            
            // Update permission state based on error
            if (error.message.includes('denied')) {
                setLocationPermission(prev => ({ ...prev, state: 'denied' }));
                toast.error(t('exchange.location_permission_denied') || 'Location permission denied');
            } else {
                toast.error(t('exchange.location_retrieval_failed') || 'Failed to get location');
            }
            
            return null;
        }
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
        
        // Clear errors when user starts typing
        if (errors[field]) {
            setErrors(prev => ({
                ...prev,
                [field]: ''
            }));
        }
    };

    const validateForm = () => {
        const newErrors = {};
        
        if (!formData.name.trim()) {
            newErrors.name = t('exchange.name_required') || 'Name is required';
        }
        
        if (!formData.email.trim()) {
            newErrors.email = t('exchange.email_required') || 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = t('exchange.email_invalid') || 'Invalid email format';
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }

        if (!profileVerified) {
            toast.error(t('exchange.profile_not_verified') || 'Profile verification required');
            return;
        }
        
        setIsSubmitting(true);
        console.log("🚀 Submitting contact form...");
        
        try {
            // Prepare exchange data using the new service
            const exchangeData = {
                targetUserId: profileOwnerId,
                targetUsername: profileOwnerUsername,
                contact: {
                    ...formData,
                    location: location
                },
                metadata: {
                    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : '',
                    referrer: typeof window !== 'undefined' ? document.referrer : '',
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    language: navigator.language || 'en'
                }
            };
            
            console.log("📋 Exchange data prepared:", {
                hasLocation: !!location,
                targetUserId: profileOwnerId,
                targetUsername: profileOwnerUsername
            });
            
            // Submit using the new service
            const result = await submitExchangeContact(exchangeData);
            
            console.log("✅ Contact submitted successfully:", result.contactId);
            
            // Enhanced success message
            let successMessage = t('exchange.success_message') || 'Contact submitted successfully!';
            if (location) {
                successMessage += ` ${t('exchange.success_with_location') || 'Location shared.'}`;
            }
            
            toast.success(successMessage, {
                style: {
                    border: '1px solid #10B981',
                    padding: '16px',
                    color: '#10B981',
                },
                iconTheme: {
                    primary: '#10B981',
                    secondary: '#FFFAEE',
                },
                duration: 4000
            });
            
            // Reset form and close modal
            resetForm();
            onClose();
            
        } catch (error) {
            console.error('❌ Error submitting contact:', error);
            
            // Enhanced error handling with specific messages
            let errorMessage = t('exchange.error_message') || 'Failed to submit contact';
            
            if (error.message?.includes('not found') || error.code === 'PROFILE_NOT_FOUND') {
                errorMessage = t('exchange.profile_not_found') || 'Profile not found';
            } else if (error.message?.includes('validation') || error.code === 'VALIDATION_ERROR') {
                errorMessage = t('exchange.validation_error') || 'Please check your information';
            } else if (error.message?.includes('rate limit') || error.code === 'RATE_LIMIT_EXCEEDED') {
                errorMessage = t('exchange.rate_limit_error') || 'Too many requests. Please try again in a moment.';
            } else if (error.code === 'EXCHANGE_DISABLED') {
                errorMessage = t('exchange.exchange_disabled') || 'Contact exchange is not enabled for this profile';
            }
            
            toast.error(errorMessage, {
                style: {
                    border: '1px solid #EF4444',
                    padding: '16px',
                    color: '#EF4444',
                },
                iconTheme: {
                    primary: '#EF4444',
                    secondary: '#FFFAEE',
                },
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            email: '',
            phone: '',
            company: '',
            message: ''
        });
        setLocation(null);
        setLocationPermission({ state: 'unavailable', supported: false });
        setProfileVerified(false);
        setErrors({});
    };

    if (!isOpen) return null;

    // Location status display helper
    const getLocationStatusDisplay = () => {
        switch (locationPermission.state) {
            case 'granted':
                return {
                    color: 'text-green-600',
                    message: location 
                        ? (t('exchange.location_shared') || 'Location shared') 
                        : (t('exchange.location_granted') || 'Location access granted'),
                    icon: '✓'
                };
            case 'denied':
                return {
                    color: 'text-red-600',
                    message: t('exchange.location_denied') || 'Location access denied',
                    icon: '✗'
                };
            case 'prompt':
                return {
                    color: 'text-yellow-600',
                    message: t('exchange.location_prompt_available') || 'Location permission available',
                    icon: '?'
                };
            default:
                return {
                    color: 'text-gray-600',
                    message: t('exchange.location_unavailable') || 'Location unavailable',
                    icon: '-'
                };
        }
    };

    const locationDisplay = getLocationStatusDisplay();

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-bold text-gray-900">
                            {t('exchange.title') || 'Exchange Contact'}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        aria-label={t('exchange.close_modal') || 'Close modal'}
                    >
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                    <p className="text-gray-600 mb-6 text-sm">
                        {t('exchange.description') || 'Share your contact information with this profile owner.'}
                    </p>

                    {/* Profile verification status */}
                    {!profileVerified && (
                        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p className="text-yellow-800 text-sm">
                                {t('exchange.verifying_profile') || 'Verifying profile availability...'}
                            </p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Name Field */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t('exchange.name_label') || 'Name'} *
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => handleInputChange('name', e.target.value)}
                                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                                    errors.name ? 'border-red-500' : 'border-gray-300'
                                }`}
                                placeholder={t('exchange.name_placeholder') || 'Your full name'}
                                disabled={isSubmitting}
                            />
                            {errors.name && (
                                <p className="text-red-500 text-xs mt-1">{errors.name}</p>
                            )}
                        </div>

                        {/* Email Field */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t('exchange.email_label') || 'Email'} *
                            </label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => handleInputChange('email', e.target.value)}
                                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                                    errors.email ? 'border-red-500' : 'border-gray-300'
                                }`}
                                placeholder={t('exchange.email_placeholder') || 'your.email@example.com'}
                                disabled={isSubmitting}
                            />
                            {errors.email && (
                                <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                            )}
                        </div>

                        {/* Phone Field */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t('exchange.phone_label') || 'Phone'}
                            </label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => handleInputChange('phone', e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                placeholder={t('exchange.phone_placeholder') || '+1 (555) 123-4567'}
                                disabled={isSubmitting}
                            />
                        </div>

                        {/* Company Field */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t('exchange.company_label') || 'Company'}
                            </label>
                            <input
                                type="text"
                                value={formData.company}
                                onChange={(e) => handleInputChange('company', e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                placeholder={t('exchange.company_placeholder') || 'Your company or organization'}
                                disabled={isSubmitting}
                            />
                        </div>

                        {/* Message Field */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t('exchange.message_label') || 'Message'}
                            </label>
                            <textarea
                                value={formData.message}
                                onChange={(e) => handleInputChange('message', e.target.value)}
                                rows={3}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors resize-none"
                                placeholder={t('exchange.message_placeholder') || 'Optional message or note...'}
                                disabled={isSubmitting}
                            />
                        </div>
                        
                        {/* Location Sharing Section */}
                        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border">
                            <svg className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <div className="flex-1">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-medium text-gray-800">
                                        {t('exchange.location_share_title') || 'Share Location'}
                                    </h4>
                                    <span className={`text-xs font-medium ${locationDisplay.color}`}>
                                        {locationDisplay.icon} {locationDisplay.message}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    {t('exchange.location_share_description') || 'Optional: Share your current location to help with networking and follow-ups.'}
                                </p>
                                
                                {/* Location accuracy display */}
                                {location && location.accuracy && (
                                    <p className="text-xs text-green-600 mt-1">
                                        {t('exchange.location_accuracy') || 'Accuracy'}: ~{Math.round(location.accuracy)}m
                                    </p>
                                )}
                                
                                {/* Location request button */}
                                {(locationPermission.state === 'prompt' || locationPermission.state === 'unavailable') && locationPermission.supported && (
                                    <button
                                        type="button"
                                        onClick={requestLocation}
                                        disabled={isSubmitting}
                                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 mt-2 flex items-center gap-1 disabled:opacity-50"
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        </svg>
                                        {t('exchange.share_location_button') || 'Share Location'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-4">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                                {t('exchange.cancel') || 'Cancel'}
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || !profileVerified}
                                className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Image 
                                            src="https://linktree.sirv.com/Images/gif/loading.gif" 
                                            width={16} 
                                            height={16} 
                                            alt="loading" 
                                            className="filter invert" 
                                        />
                                        {t('exchange.submitting') || 'Submitting...'}
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                        </svg>
                                        {t('exchange.submit') || 'Submit'}
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}