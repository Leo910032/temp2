// app/dashboard/(dashboard pages)/contacts/components/PhoneNumberField.jsx
"use client"
import { useState, useEffect } from 'react';

// Country flag emoji mapping
const countryFlags = {
    'US': '🇺🇸', 'CA': '🇨🇦', 'GB': '🇬🇧', 'FR': '🇫🇷', 'DE': '🇩🇪',
    'IT': '🇮🇹', 'ES': '🇪🇸', 'NL': '🇳🇱', 'BE': '🇧🇪', 'CH': '🇨🇭',
    'AT': '🇦🇹', 'PL': '🇵🇱', 'SE': '🇸🇪', 'NO': '🇳🇴', 'DK': '🇩🇰',
    'FI': '🇫🇮', 'IE': '🇮🇪', 'PT': '🇵🇹', 'GR': '🇬🇷', 'CZ': '🇨🇿',
    'AU': '🇦🇺', 'NZ': '🇳🇿', 'JP': '🇯🇵', 'CN': '🇨🇳', 'KR': '🇰🇷',
    'IN': '🇮🇳', 'BR': '🇧🇷', 'MX': '🇲🇽', 'AR': '🇦🇷', 'CL': '🇨🇱'
};

// Country code to country mapping
const countryCodeMap = {
    '1': 'US', '33': 'FR', '44': 'GB', '49': 'DE', '39': 'IT',
    '34': 'ES', '31': 'NL', '32': 'BE', '41': 'CH', '43': 'AT',
    '48': 'PL', '46': 'SE', '47': 'NO', '45': 'DK', '358': 'FI',
    '353': 'IE', '351': 'PT', '30': 'GR', '420': 'CZ', '61': 'AU',
    '64': 'NZ', '81': 'JP', '86': 'CN', '82': 'KR', '91': 'IN',
    '55': 'BR', '52': 'MX', '54': 'AR', '56': 'CL'
};

function getCountryFromPhone(phoneNumber) {
    // Manual parsing - extract country code
    const cleaned = phoneNumber.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+')) {
        // Try 3-digit codes first
        const code3 = cleaned.substring(1, 4);
        if (countryCodeMap[code3]) return countryCodeMap[code3];
        
        // Try 2-digit codes
        const code2 = cleaned.substring(1, 3);
        if (countryCodeMap[code2]) return countryCodeMap[code2];
        
        // Try 1-digit codes
        const code1 = cleaned.substring(1, 2);
        if (countryCodeMap[code1]) return countryCodeMap[code1];
    }
    
    return null;
}

export default function PhoneNumberField({ value, onChange, index, onRemove, isPremium }) {
    const [country, setCountry] = useState(null);
    const [flag, setFlag] = useState('📞');

    useEffect(() => {
        if (value && isPremium) {
            const detectedCountry = getCountryFromPhone(value);
            setCountry(detectedCountry);
            setFlag(detectedCountry ? countryFlags[detectedCountry] || '📞' : '📞');
        }
    }, [value, isPremium]);

    return (
        <div className="flex items-center gap-2">
            {/* Country Flag (Premium only) */}
            {isPremium && (
                <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg border border-gray-200">
                    <span className="text-2xl" title={country || 'Unknown'}>
                        {flag}
                    </span>
                </div>
            )}
            
            {/* Phone Input */}
            <input
                type="tel"
                value={value}
                onChange={(e) => onChange(index, e.target.value)}
                placeholder={`Phone ${index + 1}${isPremium ? ' (with country code, e.g., +33...)' : ''}`}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            />
            
            {/* Remove Button (only show if more than 1 phone) */}
            {index > 0 && (
                <button
                    type="button"
                    onClick={() => onRemove(index)}
                    className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            )}
        </div>
    );
}