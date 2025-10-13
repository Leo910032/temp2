// app/[userId]/components/ExchangeModal.jsx - Updated with pre-verified props
"use client"
import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useTranslation } from '@/lib/translation/useTranslation';
import { toast } from 'react-hot-toast';

// Import the enhanced service (instead of the old mixed approach)
import { EnhancedExchangeService } from '@/lib/services/serviceContact/client/services/EnhancedExchangeService';

// Import the working BusinessCardScanner component from contacts
import BusinessCardScanner from '@/app/dashboard/(dashboard pages)/contacts/components/BusinessCardScanner';
import ContactReviewModal from '@/app/dashboard/(dashboard pages)/contacts/components/ContactReviewModal';

export default function ExchangeModal({ 
    isOpen, 
    onClose, 
    profileOwnerUsername, 
    profileOwnerId = null,
    // NEW: Pre-verified props from server-side
    preVerified = false,
    scanToken = null,
    scanAvailable = false
}) {
    const { t, locale } = useTranslation();
    
    // Enhanced service instance
    const exchangeService = useRef(new EnhancedExchangeService());
    
    // Form state
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        company: '',
        jobTitle: '',
        website: '',
        message: ''
    });
    
    // Core modal states
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState({});
    const [location, setLocation] = useState(null);
    const [locationPermission, setLocationPermission] = useState({ 
        state: 'unavailable', 
        supported: false 
    });
    
    // Use pre-verified status instead of verifying on open
    const [profileVerified, setProfileVerified] = useState(preVerified);
    
    // Enhanced scanning states
    const [dynamicFields, setDynamicFields] = useState([]);
    const [scanMetadata, setScanMetadata] = useState(null);
    const [personalizedMessage, setPersonalizedMessage] = useState(null);

    // Scanner UI state - simplified to just toggle the BusinessCardScanner modal
    const [showScanner, setShowScanner] = useState(false);
    const [scanResult, setScanResult] = useState(null);

    // Review modal state
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [reviewData, setReviewData] = useState(null);

    const requestLocation = useCallback(async () => {
        try {
            console.log("Requesting location...");

            const userLocation = await exchangeService.current.getCurrentLocation({
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000
            });

            setLocation(userLocation);
            setLocationPermission(prev => ({ ...prev, state: 'granted' }));

            toast.success(t('exchange.location_obtained') || 'Location obtained successfully!');

            return userLocation;

        } catch (error) {
            console.error("Error getting location:", error);

            if (error.message.includes('denied')) {
                setLocationPermission(prev => ({ ...prev, state: 'denied' }));
                toast.error(t('exchange.location_permission_denied') || 'Location permission denied');
            } else {
                toast.error(t('exchange.location_retrieval_failed') || 'Failed to get location');
            }

            return null;
        }
    }, [t]);

    const initializeModal = useCallback(async () => {
    try {
        const permission = await exchangeService.current.checkLocationPermission();
        setLocationPermission(permission);
        
        if (permission.state === 'granted') {
            await requestLocation();
        }

        setProfileVerified(preVerified);
        
        if (!preVerified) {
            toast.error(t('exchange.profile_unavailable') || 'This profile is not available for contact exchange');
        }

        if (scanToken && scanAvailable) {
            const tokenCached = exchangeService.current.usePreGeneratedScanToken(
                scanToken, 
                new Date(Date.now() + 3600000).toISOString()
            );
            
            if (tokenCached) {
                console.log("✅ Pre-generated scan token cached successfully");
            } else {
                console.warn("⚠️ Failed to cache pre-generated scan token");
            }
        }
    } catch (error) {
        console.error("Error initializing enhanced modal:", error);
    }
}, [preVerified, scanToken, scanAvailable, t, requestLocation]);

    // ==================== BUSINESS CARD SCANNING CALLBACK ====================

    /**
     * Callback when BusinessCardScanner completes and returns parsed data
     *
     * Note: Cost tracking is automatically handled by the BusinessCardService
     * via CostTrackingService.recordSeparatedUsage() on the server side.
     * The scan cost is charged to the current user's account.
     */
    const handleContactParsed = useCallback((parsedData) => {
        console.log('Card scan complete, received data:', parsedData);

        // Store the parsed data for review
        setReviewData(parsedData);
        setScanMetadata(parsedData.metadata);
        setScanResult(parsedData);

        // Close the scanner and open the review modal
        setShowScanner(false);
        setShowReviewModal(true);
    }, []);

    /**
     * Process enhanced scan results that include both standard and dynamic fields
     */
    const processEnhancedScanResults = useCallback((standardFields = [], dynamicFields = []) => {
        const processedStandardFields = {
            name: '',
            email: '',
            phone: '',
            company: '',
            jobTitle: '',
            website: '',
            message: ''
        };
        
        const processedDynamicFields = [];
        
        // Process standard fields
        standardFields.forEach(field => {
            const label = field.label.toLowerCase();
            const value = field.value.trim();
            
            if (!value) return;
            
            if (label.includes('name') && !processedStandardFields.name) {
                processedStandardFields.name = value;
            } else if (label.includes('email') && !processedStandardFields.email) {
                processedStandardFields.email = value;
            } else if ((label.includes('phone') || label.includes('tel')) && !processedStandardFields.phone) {
                processedStandardFields.phone = value;
            } else if (label.includes('company') && !processedStandardFields.company) {
                processedStandardFields.company = value;
            } else if ((label.includes('job title') || label.includes('title') || label.includes('position')) && !processedStandardFields.jobTitle) {
                processedStandardFields.jobTitle = value;
            } else if ((label.includes('website') || label.includes('url')) && !processedStandardFields.website) {
                processedStandardFields.website = normalizeWebsiteUrl(value);
            }
        });
        
        // Process dynamic fields
        dynamicFields.forEach(field => {
            if (field.value && field.value.trim()) {
                processedDynamicFields.push({
                    id: field.id || `dynamic_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                    label: field.label,
                    value: field.value.trim(),
                    category: field.category || 'other',
                    type: field.type || 'dynamic',
                    confidence: field.confidence || 0.8,
                    isDynamic: true,
                    source: field.source || 'scan'
                });
            }
        });

        return { standardFields: processedStandardFields, dynamicFields: processedDynamicFields };
    }, []);

    /**
     * Handle save from ContactReviewModal - populate the form with reviewed data
     */
    const handleReviewSave = useCallback(async (reviewedData) => {
        console.log('Review complete, populating form with:', reviewedData);

        // Combine standard and dynamic fields
        const allFields = [
            ...(reviewedData.standardFields || []),
            ...(reviewedData.dynamicFields || [])
        ];

        // Process the reviewed fields
        const processedFields = processEnhancedScanResults(allFields, []);

        // Populate form with reviewed data
        populateFormFromEnhancedScan(processedFields.standardFields, processedFields.dynamicFields);

        // Handle phone numbers separately
        if (reviewedData.phoneNumbers && reviewedData.phoneNumbers.length > 0) {
            // Use the first phone number for the main phone field
            setFormData(prev => ({
                ...prev,
                phone: reviewedData.phoneNumbers[0]
            }));
        }

        const totalFieldCount = allFields.length;
        toast.success(`Form populated with ${totalFieldCount} fields from scan!`, { duration: 3000 });

        // Close the review modal
        setShowReviewModal(false);
    }, [processEnhancedScanResults]);

    /**
     * Normalize website URL to include protocol
     */
    const normalizeWebsiteUrl = (url) => {
        if (!url || typeof url !== 'string') {
            return '';
        }

        const trimmedUrl = url.trim();
        
        if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
            return trimmedUrl;
        }
        
        if (trimmedUrl.startsWith('www.')) {
            return `https://${trimmedUrl}`;
        }
        
        if (trimmedUrl.includes('.') && !trimmedUrl.includes(' ')) {
            return `https://${trimmedUrl}`;
        }
        
        return trimmedUrl;
    };

    const populateFormFromEnhancedScan = (standardFields, dynamicFieldsArray) => {
        // Populate standard form fields
        setFormData(prev => ({
            ...prev,
            ...standardFields
        }));
        
        // Set dynamic fields
        setDynamicFields(dynamicFieldsArray);
    };

    // Dynamic field management
    const updateDynamicField = (fieldId, key, value) => {
        setDynamicFields(prev => prev.map(field => 
            field.id === fieldId ? { ...field, [key]: value } : field
        ));
    };

    const addDynamicField = () => {
        const newField = {
            id: `dynamic_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            label: '',
            value: '',
            category: 'other',
            type: 'custom',
            confidence: 1.0,
            isDynamic: true,
            isEditable: true
        };
        setDynamicFields(prev => [...prev, newField]);
    };

    const removeDynamicField = (fieldId) => {
        setDynamicFields(prev => prev.filter(field => field.id !== fieldId));
    };

    const getCategoryIcon = (category) => {
        switch (category) {
            case 'professional': return '💼';
            case 'social': return '🌐';
            case 'contact': return '📞';
            case 'personal': return '👤';
            default: return '📄';
        }
    };

    // ==================== FORM HANDLING ====================

    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
        
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
        console.log("Submitting enhanced contact form...");
        console.log("🔍 Profile info:", {
            profileOwnerId,
            profileOwnerUsername,
            hasProfileId: !!profileOwnerId,
            hasUsername: !!profileOwnerUsername
        });

        try {
            const exchangeData = {
                targetUserId: profileOwnerId,
                targetUsername: profileOwnerUsername,
                contact: {
                    ...formData,
                    dynamicFields: dynamicFields,
                    location: location
                },
                metadata: {
                    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : '',
                    referrer: typeof window !== 'undefined' ? document.referrer : '',
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    language: navigator.language || 'en',
                    scannedCard: !!scanResult,
                    dynamicFieldCount: dynamicFields.length,
                    enhancedExchange: true,
                    hasPersonalizedMessage: !!personalizedMessage
                }
            };

            console.log("📦 Prepared exchangeData:", {
                targetUserId: exchangeData.targetUserId,
                targetUsername: exchangeData.targetUsername,
                contactName: exchangeData.contact?.name,
                contactEmail: exchangeData.contact?.email
            });

            const result = await exchangeService.current.submitExchangeContact(exchangeData);
            
            console.log("Enhanced contact submitted successfully:", result.contactId);
            
            // Handle personalized message display
            if (personalizedMessage && typeof personalizedMessage === 'object') {
                toast.success(
                    () => (
                        <div style={{ textAlign: 'left' }}>
                            <span className="italic">&ldquo;{personalizedMessage.greeting}&rdquo;</span>
                            <br />
                            <a
                                href={personalizedMessage.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline font-bold text-white hover:opacity-80"
                                onClick={() => toast.dismiss()} 
                            >
                                {personalizedMessage.ctaText}
                            </a>
                            <span className="ml-1">{personalizedMessage.signature}</span>
                        </div>
                    ),
                    {
                        duration: 8000,
                        style: {
                            background: '#10B981',
                            color: 'white',
                            maxWidth: '400px',
                        },
                    }
                );
            } else {
                const successMessage = personalizedMessage || t('exchange.success_message') || 'Contact submitted successfully!';
                toast.success(successMessage, { duration: 4000 });
            }
            
            resetForm();
            onClose();
            
        } catch (error) {
            console.error('Error submitting enhanced contact:', error);
            
            let errorMessage = t('exchange.error_message') || 'Failed to submit contact';
            
            if (error.message?.includes('not found') || error.code === 'PROFILE_NOT_FOUND') {
                errorMessage = t('exchange.profile_not_found') || 'Profile not found';
            } else if (error.message?.includes('validation') || error.code === 'VALIDATION_ERROR') {
                errorMessage = t('exchange.validation_error') || 'Please check your information';
            }
            
            toast.error(errorMessage);
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
            jobTitle: '',
            website: '',
            message: ''
        });
        setDynamicFields([]);
        setLocation(null);
        setLocationPermission({ state: 'unavailable', supported: false });
        setErrors({});
        setScanResult(null);
        setPersonalizedMessage(null);
        setScanMetadata(null);
        setShowScanner(false);
    };

    const resetModalState = useCallback(() => {
        setShowScanner(false);
        setScanResult(null);
        setDynamicFields([]);
        setScanMetadata(null);
        setPersonalizedMessage(null);
    }, []);

  // After
useEffect(() => {
    if (isOpen) {
        console.log("Enhanced exchange modal opened for:", profileOwnerUsername);
        console.log("Pre-verified:", preVerified, "Scan available:", scanAvailable);
        initializeModal();
    } else {
        resetModalState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, [isOpen, profileOwnerUsername, profileOwnerId, preVerified, scanAvailable]);

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
        <>
            {/* BusinessCardScanner Component - Only render when needed */}
            {showScanner && (
                <BusinessCardScanner
                    isOpen={showScanner}
                    onClose={() => setShowScanner(false)}
                    onContactParsed={handleContactParsed}
                />
            )}

            {/* ContactReviewModal - Review scanned data before populating form */}
            {showReviewModal && reviewData && (
                <ContactReviewModal
                    isOpen={showReviewModal}
                    onClose={() => setShowReviewModal(false)}
                    parsedFields={reviewData}
                    onSave={handleReviewSave}
                    hasFeature={() => false} // Public users don't have premium features
                />
            )}

            {/* Main Exchange Modal - Hide when review modal is open */}
            {!showReviewModal && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
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
                                {t('exchange.title') || 'Enhanced Exchange'}
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
                        {personalizedMessage && typeof personalizedMessage === 'object' && (
                    <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <div>
                                <h4 className="font-semibold text-green-800 mb-1">Card Scanned Successfully!</h4>
                                <p className="text-green-700 text-sm">
                                    <span className="italic">&ldquo;{personalizedMessage.greeting}&rdquo;</span>
                                    <br />
                                    <a 
                                        href={personalizedMessage.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="font-semibold underline hover:text-green-900"
                                    >
                                        {personalizedMessage.ctaText}
                                    </a>
                                    <span className="ml-1">{personalizedMessage.signature}</span>
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                    <p className="text-gray-600 mb-6 text-sm">
                        {t('exchange.description') || 'Share your contact information with this profile owner.'}
                    </p>

                    {/* Business Card Scanner Option */}
                    {scanAvailable && !scanResult && (
                        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0118.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                    </svg>
                                    <h4 className="font-semibold text-blue-800">Quick Fill</h4>
                                </div>
                                <button
                                    onClick={() => setShowScanner(true)}
                                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                                >
                                    Scan Card
                                </button>
                            </div>
                            <p className="text-blue-700 text-sm">
                                Scan your business card to automatically fill the form below
                            </p>
                        </div>
                    )}

                    {/* Profile verification status */}
                    {!profileVerified && (
                        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p className="text-yellow-800 text-sm">
                                {t('exchange.profile_unavailable') || 'This profile is not available for contact exchange'}
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

                        {/* Job Title Field */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Job Title
                            </label>
                            <input
                                type="text"
                                value={formData.jobTitle}
                                onChange={(e) => handleInputChange('jobTitle', e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                placeholder="Your job title or position"
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
                        
                        {/* Website Field */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Website
                            </label>
                            <input
                                type="url"
                                value={formData.website}
                                onChange={(e) => handleInputChange('website', e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                placeholder="https://yourwebsite.com"
                                disabled={isSubmitting}
                            />
                        </div>

                        {/* Dynamic Fields Section */}
                        {dynamicFields.length > 0 && (
                            <div className="mt-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-lg font-semibold text-gray-900">Additional Information</h4>
                                    <span className="text-sm text-gray-500">
                                        {dynamicFields.length} field{dynamicFields.length !== 1 ? 's' : ''} detected
                                    </span>
                                </div>
                                
                                <div className="space-y-3">
                                    {dynamicFields.map((field) => (
                                        <div key={field.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border">
                                            <div className="flex-shrink-0 w-8 h-8 bg-white rounded-full flex items-center justify-center text-sm border">
                                                {getCategoryIcon(field.category)}
                                            </div>
                                            <div className="flex-1 space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={field.label}
                                                        onChange={(e) => updateDynamicField(field.id, 'label', e.target.value)}
                                                        placeholder="Field Label"
                                                        className="flex-1 px-3 py-1 border-b border-gray-300 focus:outline-none focus:border-blue-500 text-sm font-medium bg-transparent"
                                                        disabled={isSubmitting}
                                                    />
                                                    <span className="text-xs text-gray-400 px-2 py-1 bg-gray-200 rounded-full">
                                                        {field.category}
                                                    </span>
                                                </div>
                                                <input
                                                    type="text"
                                                    value={field.value}
                                                    onChange={(e) => updateDynamicField(field.id, 'value', e.target.value)}
                                                    placeholder="Field Value"
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                                    disabled={isSubmitting}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeDynamicField(field.id)}
                                                className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                                                disabled={isSubmitting}
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    type="button"
                                    onClick={addDynamicField}
                                    className="w-full mt-3 flex items-center justify-center gap-2 p-3 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                                    disabled={isSubmitting}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                    Add Custom Field
                                </button>
                            </div>
                        )}

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
                                
                                {location && location.accuracy && (
                                    <p className="text-xs text-green-600 mt-1">
                                        {t('exchange.location_accuracy') || 'Accuracy'}: ~{Math.round(location.accuracy)}m
                                    </p>
                                )}
                                
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
            )}
        </>
    );
}