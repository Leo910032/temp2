// app/forgot-password/components/ForgotPasswordForm.jsx
"use client"

import React, { useEffect, useState, useMemo } from "react";
import { useDebounce } from "@/LocalHooks/useDebounce";
import { useTranslation } from "@/lib/translation/useTranslation";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { FaCheck, FaX } from "react-icons/fa6";
import Image from "next/image";
import Link from "next/link";

// Import the new services
import { PasswordResetService } from "@/lib/services/client/passwordResetService";
import { validateEmail } from "@/lib/utilities";

export default function ForgotPasswordForm() {
    const router = useRouter();
    const { t, isInitialized } = useTranslation();

    // Form state management
    const [emailText, setEmailText] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isCheckingEmail, setIsCheckingEmail] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [hasError, setHasError] = useState({
        email: 0 // 0: neutral, 1: error, 2: success
    });
    const [canProceed, setCanProceed] = useState(false);

    // Debounced email for validation
    const debouncedEmail = useDebounce(emailText, 800);

    // Pre-compute translations for performance
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            title: t('forgot_password.title') || 'Request password reset link',
            emailPlaceholder: t('forgot_password.email_placeholder') || 'Provide your email address',
            rememberedPassword: t('forgot_password.remembered_password') || 'Remembered your password?',
            sendRequest: t('forgot_password.send_request') || 'Send request',
            noAccount: t('forgot_password.no_account') || "Don't have an account?",
            signUp: t('forgot_password.sign_up') || 'Sign up',
            // Error messages
            invalidEmailFormat: t('forgot_password.errors.invalid_email') || 'Invalid email format',
            emailNotFound: t('forgot_password.errors.email_not_found') || "You don't have an account with us",
            errorCheckingEmail: t('forgot_password.errors.error_checking') || 'Error checking email',
            rateLimited: t('forgot_password.errors.rate_limited') || 'Too many attempts. Please wait a moment.',
            // Success messages
            resetLinkSent: t('forgot_password.success.link_sent') || 'Password reset link sent to your email',
            checkEmail: t('forgot_password.success.check_email') || 'Please check your email for the reset link'
        };
    }, [t, isInitialized]);

    // Email validation using the new PasswordResetService
    useEffect(() => {
        const validateEmailAddress = async () => {
            if (debouncedEmail === "") {
                setHasError(prev => ({ ...prev, email: 0 }));
                setErrorMessage("");
                return;
            }

            // Client-side validation first
            if (!validateEmail(debouncedEmail)) {
                setHasError(prev => ({ ...prev, email: 1 }));
                setErrorMessage(translations.invalidEmailFormat);
                return;
            }

            // Server-side validation
            setIsCheckingEmail(true);
            setErrorMessage("");
            
            try {
                const result = await PasswordResetService.validateEmailForReset(debouncedEmail);
                
                if (result.exists) {
                    setHasError(prev => ({ ...prev, email: 2 }));
                    setErrorMessage("");
                } else {
                    setHasError(prev => ({ ...prev, email: 1 }));
                    setErrorMessage(translations.emailNotFound);
                }
            } catch (error) {
                console.error("Email validation error:", error);
                setHasError(prev => ({ ...prev, email: 1 }));
                
                // Handle different types of errors
                if (error.message.includes('Too many requests')) {
                    setErrorMessage(translations.rateLimited);
                } else {
                    setErrorMessage(translations.errorCheckingEmail);
                }
            } finally {
                setIsCheckingEmail(false);
            }
        };

        validateEmailAddress();
    }, [debouncedEmail, translations]);

    // Form validation
    useEffect(() => {
        setCanProceed(hasError.email === 2);
        
        // Clear error message when form becomes valid
        if (hasError.email === 2 && errorMessage && !errorMessage.includes('Too many requests')) {
            setErrorMessage("");
        }
    }, [hasError, errorMessage]);

    // Handle input changes with immediate feedback reset
    const handleEmailChange = (e) => {
        setEmailText(e.target.value);
        setHasError(prev => ({ ...prev, email: 0 }));
        setErrorMessage("");
    };

    // Form submission handler
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!canProceed || isLoading) return;
        
        setIsLoading(true);
        setErrorMessage("");
        
        try {
            console.log('Starting password reset request for:', debouncedEmail.substring(0, 3) + '***');
            
            const result = await PasswordResetService.initiatePasswordReset(debouncedEmail.trim());
            
            console.log('Password reset initiated successfully');
            toast.success(translations.resetLinkSent);
            
            // Clear form and redirect after success
            setEmailText("");
            setTimeout(() => {
                setCanProceed(false);
                router.push("/login");
            }, 2000); // Give user time to read the success message
            
        } catch (error) {
            console.error('Password reset error:', error);
            
            // Format error message for user
            const userFriendlyError = PasswordResetService.formatError 
                ? PasswordResetService.formatError(error) 
                : error.message;
            
            setHasError(prev => ({ ...prev, email: 1 }));
            setErrorMessage(userFriendlyError);
            toast.error(userFriendlyError);
        } finally {
            setIsLoading(false);
        }
    };

    // Loading state while translations initialize
    if (!isInitialized) {
        return (
            <div className="flex-1 sm:p-12 px-4 py-8 flex flex-col overflow-y-auto">
                <div className="sm:p-0 p-3">
                    <div className="w-28 h-12 bg-gray-200 rounded animate-pulse"></div>
                </div>
                <section className="mx-auto py-10 w-full sm:w-5/6 md:w-3/4 lg:w-2/3 xl:w-1/2 flex-1 flex flex-col justify-center">
                    <div className="h-12 bg-gray-200 rounded animate-pulse mb-6"></div>
                    <div className="space-y-4">
                        <div className="h-12 bg-gray-200 rounded animate-pulse"></div>
                        <div className="h-12 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                </section>
            </div>
        );
    }
    
    return (
        <div className="flex-1 sm:p-12 px-4 py-8 flex flex-col overflow-y-auto">
            <Link href={'/'} className="sm:p-0 p-3">
                <Image 
                    src={"https://linktree.sirv.com/Images/full-logo.svg"} 
                    alt="logo" 
                    height={150} 
                    width={100} 
                    className="w-[7.05rem]" 
                    priority 
                />
            </Link>
            
            <section className="mx-auto py-10 w-full sm:w-5/6 md:w-3/4 lg:w-2/3 xl:w-1/2 flex-1 flex flex-col justify-center">
                <p className="text-2xl sm:text-5xl md:text-3xl font-extrabold text-center">
                    {translations.title}
                </p>
                
                <form className="py-8 sm:py-12 flex flex-col gap-4 sm:gap-6 w-full" onSubmit={handleSubmit}>
                    {/* Email input */}
                    <div className={`flex items-center py-2 sm:py-3 px-2 sm:px-6 rounded-md myInput ${
                        hasError.email === 1 ? "hasError" : 
                        hasError.email === 2 ? "good" : ""
                    } bg-black bg-opacity-5 text-base sm:text-lg w-full`}>
                        <input
                            type="email"
                            placeholder={translations.emailPlaceholder}
                            className="outline-none border-none bg-transparent ml-1 py-3 flex-1 text-sm sm:text-base"
                            value={emailText}
                            name="email"
                            onChange={handleEmailChange}
                            required
                            disabled={isLoading}
                        />
                        
                        {/* Email validation icons */}
                        {isCheckingEmail ? (
                            <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full"></div>
                        ) : hasError.email === 1 ? (
                            <FaX className="text-red-500 text-sm cursor-pointer" onClick={() => setEmailText("")} />
                        ) : hasError.email === 2 ? (
                            <FaCheck className="text-themeGreen cursor-pointer" />
                        ) : null}
                    </div>

                    {/* Back to login link */}
                    <Link 
                        href={"/login"} 
                        className="w-fit hover:rotate-2 hover:text-themeGreen origin-left"
                    >
                        {translations.rememberedPassword}
                    </Link>

                    {/* Submit button */}
                    <button 
                        type="submit" 
                        disabled={!canProceed || isLoading}
                        className={`rounded-md py-4 sm:py-5 grid place-items-center font-semibold transition-all duration-200 ${
                            canProceed && !isLoading 
                                ? "cursor-pointer active:scale-95 active:opacity-40 hover:scale-[1.025] bg-themeGreen mix-blend-screen" 
                                : "cursor-default opacity-50"
                        }`}
                    >
                        {!isLoading ? (
                            <span className="nopointer">{translations.sendRequest}</span>
                        ) : (
                            <Image 
                                src={"https://linktree.sirv.com/Images/gif/loading.gif"} 
                                width={25} 
                                height={25} 
                                alt="loading" 
                                className="mix-blend-screen" 
                            />
                        )}
                    </button>

                    {/* Error message */}
                    {!isLoading && errorMessage && (
                        <span className="text-sm text-red-500 text-center">
                            {errorMessage}
                        </span>
                    )}
                </form>
                
                {/* Sign up link */}
                <p className="text-center sm:text-base text-sm">
                    <span className="opacity-60">{translations.noAccount}</span> 
                    <Link href={"/signup"} className="text-themeGreen ml-1">
                        {translations.signUp}
                    </Link>
                </p>
            </section>
        </div>
    );
}