// ================================================================
// app/dashboard/(dashboard pages)/contacts/components/scanner/PreviewScreen.jsx
import { toast } from 'react-hot-toast';

export function PreviewScreen({
    scanMode,
    currentSide,
    setCurrentSide,
    cardData,
    canProcess,
    handleRetake,
    startCamera,
    fileInputRef,
    processImages,
    isProcessing,
    processingStatus,
    costEstimate
}) {
    const getCurrentImage = () => cardData[currentSide];

    return (
        <div className="p-3 sm:p-4 flex flex-col items-center min-h-full">
            <div className="w-full max-w-2xl">
                {scanMode === 'double' && (
                    <div className="flex mb-4 bg-gray-100 rounded-lg p-1">
                        <button
                            onClick={() => setCurrentSide('front')}
                            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                                currentSide === 'front'
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-800'
                            }`}
                        >
                            Front {cardData.front.image ? '✅' : '❌'}
                        </button>
                        <button
                            onClick={() => setCurrentSide('back')}
                            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                                currentSide === 'back'
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-800'
                            }`}
                        >
                            Back {cardData.back.image ? '✅' : '❌'}
                        </button>
                    </div>
                )}

                <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 text-center">
                    {canProcess() ? 'Ready to Scan' : 'Add Images to Continue'}
                </h4>
                
                {getCurrentImage().previewUrl && (
                    <div className="bg-gray-100 rounded-lg sm:rounded-xl p-2 sm:p-4 mb-3 sm:mb-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={getCurrentImage().previewUrl}
                            alt={`Business card ${currentSide} side`}
                            className="w-full h-auto max-h-[300px] sm:max-h-[400px] object-contain rounded-lg shadow-sm"
                            onError={() => toast.error(`${currentSide} image display failed`)}
                        />
                        {scanMode === 'double' && (
                            <p className="text-center text-sm text-gray-600 mt-2">
                                {currentSide} side
                            </p>
                        )}
                    </div>
                )}

                {scanMode === 'double' && !getCurrentImage().image && (
                    <div className="mb-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                        <div className="flex items-center justify-center">
                            <svg className="w-5 h-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <span className="text-sm text-yellow-800">
                                {currentSide} side image needed
                            </span>
                        </div>
                        <div className="flex gap-2 mt-3">
                            <button
                                onClick={startCamera}
                                className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Take Photo
                            </button>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
                            >
                                Upload
                            </button>
                        </div>
                    </div>
                )}
                
                {isProcessing && (
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-3">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-blue-900">Processing with AI...</p>
                                <p className="text-xs text-blue-700">
                                    {processingStatus || 'Extracting text and QR codes from your business card'}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
                
                <div className="flex gap-2 sm:gap-3">
                    <button
                        onClick={handleRetake}
                        disabled={isProcessing}
                        className="flex-1 px-3 sm:px-4 py-2 sm:py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors font-medium text-sm sm:text-base"
                    >
                        <span className="hidden sm:inline">
                            {scanMode === 'double' ? `Retake ${currentSide}` : 'Retake Photo'}
                        </span>
                        <span className="sm:hidden">Retake</span>
                    </button>

                    {scanMode === 'double' && !canProcess() && (
                        <button
                            onClick={startCamera}
                            disabled={isProcessing}
                            className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm sm:text-base"
                        >
                            Add {currentSide}
                        </button>
                    )}

                    <button
                        onClick={processImages}
                        disabled={isProcessing || !canProcess()}
                        className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-medium text-sm sm:text-base"
                    >
                        {isProcessing ? (
                            <>
                                <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white"></div>
                                <span>{processingStatus || 'Processing...'}</span>
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <span className="hidden sm:inline">
                                    Scan Card{scanMode === 'double' ? 's' : ''}
                                </span>
                                <span className="sm:hidden">Scan</span>
                            </>
                        )}
                    </button>
                </div>

                {!isProcessing && canProcess() && (
                    <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                        <div className="flex">
                            <svg className="w-5 h-5 text-yellow-400 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <div className="text-sm text-yellow-800">
                                <p className="font-medium mb-1">Pro Tip</p>
                                <p className="text-xs">
                                    {scanMode === 'double' 
                                        ? 'Scanning both sides captures more complete contact information and social media links!'
                                        : 'For best results, ensure the card is well-lit and text is clearly visible. Our AI can detect QR codes too!'
                                    }
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {costEstimate && canProcess() && !isProcessing && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center">
                            <svg className="w-5 h-5 text-blue-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                            </svg>
                            <div className="text-sm text-blue-800">
                                <p className="font-medium">
                                    Estimated cost: ${scanMode === 'double' ? (costEstimate.estimated * 2).toFixed(4) : costEstimate.estimated.toFixed(4)}
                                </p>
                                <p className="text-xs text-blue-600">
                                    {scanMode === 'double' ? 'Processing both sides' : 'Single card scan'}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default PreviewScreen;