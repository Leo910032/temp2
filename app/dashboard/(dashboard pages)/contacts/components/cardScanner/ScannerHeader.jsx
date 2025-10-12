// app/dashboard/(dashboard pages)/contacts/components/cardScanner/ScannerHeader.jsx
import { useTranslation } from '@/lib/translation/useTranslation';
import { useCallback, useMemo } from 'react';

const formatMessage = (template, replacements = {}) => {
    return Object.entries(replacements).reduce(
        (acc, [key, value]) => acc.split(`{{${key}}}`).join(value ?? ''),
        template
    );
};

export function ScannerHeader({ costEstimate, scanMode, onClose, isProcessing }) {
    const { t } = useTranslation();

    const translateWithFallback = useCallback(
        (key, fallback, replacements = {}) => {
            const template = t(key);
            const resolved = template && template !== key ? template : fallback;
            return formatMessage(resolved, replacements);
        },
        [t]
    );

    const amountText = useMemo(() => {
        if (!costEstimate || costEstimate.estimated === undefined) return null;

        if (typeof costEstimate.estimated === 'number') {
            const amount =
                scanMode === 'double'
                    ? (costEstimate.estimated * 2).toFixed(4)
                    : costEstimate.estimated.toFixed(4);
            const formattedAmount = translateWithFallback(
                'business_card_scanner.header.amount_value',
                '${{amount}}',
                { amount }
            );

            return translateWithFallback(
                'business_card_scanner.header.estimate_text',
                'Est. cost: {{amount}}',
                { amount: formattedAmount }
            );
        }

        const calculating = translateWithFallback(
            'business_card_scanner.header.calculating',
            'Calculating...'
        );

        return translateWithFallback(
            'business_card_scanner.header.estimate_text',
            'Est. cost: {{amount}}',
            { amount: calculating }
        );
    }, [costEstimate, scanMode, translateWithFallback]);

    const headerTitle = translateWithFallback(
        'business_card_scanner.header.title',
        'Business Card Scanner'
    );

    return (
        <div className="flex items-center justify-between p-3 sm:p-4 border-b bg-white flex-shrink-0">
            <div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                    {headerTitle}
                </h3>
                {amountText && (
                    <p className="text-xs text-gray-500 mt-1">
                        {amountText}
                    </p>
                )}
            </div>
            <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                disabled={isProcessing}
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
}

export default ScannerHeader;
