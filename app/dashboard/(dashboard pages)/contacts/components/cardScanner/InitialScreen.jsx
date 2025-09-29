
// ================================================================
// app/dashboard/(dashboard pages)/contacts/components/scanner/InitialScreen.jsx
export function InitialScreen({ scanMode, setScanMode, startCamera, fileInputRef, isProcessing }) {
    return (
        <div className="p-4 sm:p-6 flex flex-col items-center justify-center min-h-full">
            {/* Scan mode selection */}
            <div className="w-full max-w-sm mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Scan Mode
                </label>
                <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                    <button
                        onClick={() => setScanMode('single')}
                        className={`flex-1 px-3 py-2 text-sm font-medium ${
                            scanMode === 'single'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        Single Side
                    </button>
                    <button
                        onClick={() => setScanMode('double')}
                        className={`flex-1 px-3 py-2 text-sm font-medium ${
                            scanMode === 'double'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        Both Sides
                    </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                    {scanMode === 'double' ? 'Scan front and back for complete information' : 'Scan one side only'}
                </p>
            </div>

            <div className="text-center mb-6 sm:mb-8">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                    <svg className="w-8 h-8 sm:w-10 sm:h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
                    {scanMode === 'double' ? 'Scan Both Sides' : 'Scan Business Card'}
                </h3>
                <p className="text-gray-600 text-sm sm:text-base max-w-sm">
                    {scanMode === 'double' 
                        ? 'Capture front and back for complete contact information'
                        : 'Extract contact information automatically from business cards using AI'
                    }
                </p>
            </div>
            
            <div className="w-full max-w-sm space-y-3 sm:space-y-4">
                <button
                    onClick={startCamera}
                    className="w-full flex flex-col items-center gap-3 p-4 sm:p-6 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                    disabled={isProcessing}
                >
                    <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="font-medium text-sm sm:text-base">Take Photo</span>
                    <span className="text-xs text-blue-100">Use device camera</span>
                </button>

                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex flex-col items-center gap-3 p-4 sm:p-6 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
                    disabled={isProcessing}
                >
                    <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="font-medium text-sm sm:text-base">Upload Image{scanMode === 'double' ? 's' : ''}</span>
                    <span className="text-xs text-gray-500">From device gallery</span>
                </button>
            </div>
        </div>
    );
}

export default InitialScreen;