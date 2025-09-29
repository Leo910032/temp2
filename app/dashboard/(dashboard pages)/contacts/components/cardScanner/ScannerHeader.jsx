// app/dashboard/(dashboard pages)/contacts/components/scanner/ScannerHeader.jsx
export function ScannerHeader({ costEstimate, scanMode, onClose, isProcessing }) {
    return (
        <div className="flex items-center justify-between p-3 sm:p-4 border-b bg-white flex-shrink-0">
            <div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                    Business Card Scanner
                </h3>
                {costEstimate && costEstimate.estimated !== undefined && (
                    <p className="text-xs text-gray-500 mt-1">
                        Est. cost: ${typeof costEstimate.estimated === 'number' 
                            ? `${(scanMode === 'double' ? costEstimate.estimated * 2 : costEstimate.estimated).toFixed(4)}` 
                            : 'Calculating...'}
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
