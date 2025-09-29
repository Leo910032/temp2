// app/(forget password pages)/reset-password/page.jsx
"use client"

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, Suspense, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { validatePassword } from '@/lib/utilities';
import { useTranslation } from "@/lib/translation/useTranslation";
import { FaEye, FaEyeSlash, FaCheck, FaX } from 'react-icons/fa6';
import Image from 'next/image';
import Link from 'next/link';
import { PasswordResetService } from '@/lib/services/client/passwordResetService';

function ResetPasswordContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { t, isInitialized } = useTranslation();
    
    const [token, setToken] = useState('');
    const [email, setEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(true);
    const [showConfirmPassword, setShowConfirmPassword] = useState(true);
    const [error, setError] = useState('');
    const [isValidToken, setIsValidToken] = useState(false);
    const [isCheckingToken, setIsCheckingToken] = useState(true);
    
    // Password validation states
    const [hasError, setHasError] = useState({
        newPassword: 0, // 0: neutral, 1: error, 2: success
        confirmPassword: 0,
    });

    // Pre-compute translations for performance
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            title: t('reset_password.title') || 'Reset Your Password',
            subtitle: t('reset_password.subtitle') || 'Enter your new password below',
            newPasswordPlaceholder: t('reset_password.new_password') || 'New Password',
            confirmPasswordPlaceholder: t('reset_password.confirm_password') || 'Confirm New Password',
            resetButton: t('reset_password.reset_button') || 'Reset Password',
            resettingButton: t('reset_password.resetting') || 'Resetting Password...',
            backToLogin: t('reset_password.back_to_login') || 'Back to Login',
            validatingToken: t('reset_password.validating') || 'Validating reset token...',
            invalidResetLink: t('reset_password.invalid_link') || 'Invalid Reset Link',
            requestNewLink: t('reset_password.request_new') || 'Request a new password reset link',
            // Error messages
            passwordsNotMatch: t('reset_password.passwords_not_match') || 'Passwords do not match',
            resetSuccess: t('reset_password.success') || 'Password reset successfully!',
            resetFailed: t('reset_password.failed') || 'Failed to reset password. Please try again.'
        };
    }, [t, isInitialized]);

    // Extract token and email from URL
    useEffect(() => {
        const tokenParam = searchParams.get('token');
        const emailParam = searchParams.get('email');
        
        if (tokenParam && emailParam) {
            setToken(tokenParam);
            setEmail(emailParam);
            validateToken(tokenParam, emailParam);
        } else {
            setError('Invalid reset link. Missing token or email.');
            setIsCheckingToken(false);
        }
    }, [searchParams]);

    const validateToken = async (tokenParam, emailParam) => {
        try {
            const result = await PasswordResetService.validateResetToken(tokenParam, emailParam);
            
            if (result.valid) {
                setIsValidToken(true);
            } else {
                setError(result.reason || 'Invalid or expired reset token.');
            }
        } catch (error) {
            console.error('Token validation error:', error);
            setError(PasswordResetService.formatError(error));
        } finally {
            setIsCheckingToken(false);
        }
    };

    // Password validation
    useEffect(() => {
        if (newPassword === "") {
            setHasError(prev => ({ ...prev, newPassword: 0 }));
        } else {
            const passwordValidation = validatePassword(newPassword);
            if (passwordValidation !== true) {
                setHasError(prev => ({ ...prev, newPassword: 1 }));
            } else {
                setHasError(prev => ({ ...prev, newPassword: 2 }));
            }
        }
    }, [newPassword]);

    // Confirm password validation
    useEffect(() => {
        if (confirmPassword === "") {
            setHasError(prev => ({ ...prev, confirmPassword: 0 }));
        } else if (newPassword !== confirmPassword) {
            setHasError(prev => ({ ...prev, confirmPassword: 1 }));
        } else {
            setHasError(prev => ({ ...prev, confirmPassword: 2 }));
        }
    }, [confirmPassword, newPassword]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Final validation
        if (newPassword !== confirmPassword) {
            setError(translations.passwordsNotMatch);
            return;
        }

        const passwordValidation = validatePassword(newPassword);
        if (passwordValidation !== true) {
            setError(passwordValidation);
            return;
        }

        if (hasError.newPassword !== 2 || hasError.confirmPassword !== 2) {
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const result = await PasswordResetService.completePasswordReset(token, email, newPassword);

            if (result.success) {
                toast.success(translations.resetSuccess);
                setTimeout(() => {
                    router.push('/login');
                }, 2000);
            } else {
                setError(result.message || translations.resetFailed);
            }
        } catch (error) {
            console.error('Password reset error:', error);
            setError(PasswordResetService.formatError(error));
        } finally {
            setIsLoading(false);
        }
    };

    const handleNewPasswordChange = (e) => {
        setNewPassword(e.target.value);
        setError('');
    };

    const handleConfirmPasswordChange = (e) => {
        setConfirmPassword(e.target.value);
        setError('');
    };

    // Loading state while translations initialize
    if (!isInitialized || isCheckingToken) {
        return (
            <div className="flex-1 sm:p-8 px-4 py-4 flex flex-col overflow-y-auto">
                <div className="sm:p-0 p-3 w-fit">
                    <div className="w-28 h-12 bg-gray-200 rounded animate-pulse"></div>
                </div>
                <section className="mx-auto py-4 w-full sm:w-5/6 md:w-3/4 lg:w-2/3 xl:w-1/2 flex-1 flex flex-col justify-center">
                    <div className="text-center">
                        <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-themeGreen rounded-full mx-auto mb-4"></div>
                        <p>{translations.validatingToken}</p>
                    </div>
                </section>
            </div>
        );
    }

    if (error && !isValidToken) {
        return (
            <div className="flex-1 sm:p-8 px-4 py-4 flex flex-col overflow-y-auto">
                {/* Logo */}
                <Link href={'/'} className="sm:p-0 p-3 w-fit">
                    <Image 
                        src={"https://firebasestorage.googleapis.com/v0/b/lintre-ffa96.firebasestorage.app/o/Logo%2Fimage-removebg-preview.png?alt=media&token=4ac6b2d0-463e-4ed7-952a-2fed14985fc0"} 
                        alt="logo" 
                        height={70} 
                        width={70} 
                        className="filter invert" 
                        priority 
                    />
                </Link>

                <section className="mx-auto py-4 w-full sm:w-5/6 md:w-3/4 lg:w-2/3 xl:w-1/2 flex-1 flex flex-col justify-center">
                    <div className="text-center">
                        <h1 className="text-2xl sm:text-4xl font-extrabold text-red-500 mb-4">
                            {translations.invalidResetLink}
                        </h1>
                        <p className="text-gray-600 mb-6">{error}</p>
                        <Link 
                            href="/forgot-password" 
                            className="text-themeGreen hover:underline font-semibold"
                        >
                            {translations.requestNewLink}
                        </Link>
                    </div>
                </section>
            </div>
        );
    }

    return (
        <div className="flex-1 sm:p-8 px-4 py-4 flex flex-col overflow-y-auto">
            {/* Logo */}
            <Link href={'/'} className="sm:p-0 p-3 w-fit">
                <Image 
                    src={"https://firebasestorage.googleapis.com/v0/b/lintre-ffa96.firebasestorage.app/o/Logo%2Fimage-removebg-preview.png?alt=media&token=4ac6b2d0-463e-4ed7-952a-2fed14985fc0"} 
                    alt="logo" 
                    height={70} 
                    width={70} 
                    className="filter invert" 
                    priority 
                />
            </Link>

            {/* Main form section */}
            <section className="mx-auto py-4 w-full sm:w-5/6 md:w-3/4 lg:w-2/3 xl:w-1/2 flex-1 flex flex-col justify-center">
                <div className="text-center mb-6">
                    <h1 className="text-2xl sm:text-5xl font-extrabold text-center mb-2">
                        {translations.title}
                    </h1>
                    <p className="text-gray-600">{translations.subtitle}</p>
                    <p className="text-sm text-gray-500 mt-2">
                        Resetting password for: <strong>{email}</strong>
                    </p>
                </div>

                <form className="py-6 sm:py-8 flex flex-col gap-4 w-full" onSubmit={handleSubmit}>
                    {/* New Password Input */}
                    <div className={`flex items-center relative py-1 sm:py-2 px-2 sm:px-6 rounded-md ${
                        hasError.newPassword === 1 ? "hasError" : 
                        hasError.newPassword === 2 ? "good" : ""
                    } bg-black bg-opacity-5 text-base sm:text-lg myInput`}>
                        <input
                            type={showNewPassword ? "password" : "text"}
                            placeholder={translations.newPasswordPlaceholder}
                            className="peer outline-none border-none bg-transparent py-2 ml-1 flex-1 text-sm sm:text-base"
                            value={newPassword}
                            onChange={handleNewPasswordChange}
                            required
                            disabled={isLoading}
                        />
                        
                        {/* Password visibility toggle */}
                        {showNewPassword ? (
                            <FaEyeSlash 
                                className="opacity-60 cursor-pointer ml-2" 
                                onClick={() => setShowNewPassword(!showNewPassword)} 
                            />
                        ) : (
                            <FaEye 
                                className="opacity-60 cursor-pointer text-themeGreen ml-2" 
                                onClick={() => setShowNewPassword(!showNewPassword)} 
                            />
                        )}

                        {/* Validation icon */}
                        {hasError.newPassword === 1 && (
                            <FaX className="text-red-500 text-sm ml-2" />
                        )}
                        {hasError.newPassword === 2 && (
                            <FaCheck className="text-themeGreen ml-2" />
                        )}
                    </div>

                    {/* Confirm Password Input */}
                    <div className={`flex items-center relative py-1 sm:py-2 px-2 sm:px-6 rounded-md ${
                        hasError.confirmPassword === 1 ? "hasError" : 
                        hasError.confirmPassword === 2 ? "good" : ""
                    } bg-black bg-opacity-5 text-base sm:text-lg myInput`}>
                        <input
                            type={showConfirmPassword ? "password" : "text"}
                            placeholder={translations.confirmPasswordPlaceholder}
                            className="peer outline-none border-none bg-transparent py-2 ml-1 flex-1 text-sm sm:text-base"
                            value={confirmPassword}
                            onChange={handleConfirmPasswordChange}
                            required
                            disabled={isLoading}
                        />
                        
                        {/* Password visibility toggle */}
                        {showConfirmPassword ? (
                            <FaEyeSlash 
                                className="opacity-60 cursor-pointer ml-2" 
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)} 
                            />
                        ) : (
                            <FaEye 
                                className="opacity-60 cursor-pointer text-themeGreen ml-2" 
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)} 
                            />
                        )}

                        {/* Validation icon */}
                        {hasError.confirmPassword === 1 && (
                            <FaX className="text-red-500 text-sm ml-2" />
                        )}
                        {hasError.confirmPassword === 2 && (
                            <FaCheck className="text-themeGreen ml-2" />
                        )}
                    </div>

                    {/* Submit button */}
                    <button 
                        type="submit" 
                        disabled={isLoading || hasError.newPassword !== 2 || hasError.confirmPassword !== 2}
                        className={`rounded-md py-3 sm:py-4 grid place-items-center font-semibold transition-all duration-200 ${
                            !isLoading && hasError.newPassword === 2 && hasError.confirmPassword === 2
                                ? "cursor-pointer active:scale-95 active:opacity-40 hover:scale-[1.025] bg-themeGreen mix-blend-screen" 
                                : "cursor-default opacity-50"
                        }`}
                    >
                        {!isLoading ? (
                            <span className="nopointer">{translations.resetButton}</span>
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
                    {!isLoading && error && (
                        <span className="text-sm text-red-500 text-center">
                            {error}
                        </span>
                    )}
                </form>

                {/* Back to login link */}
                <p className="text-center sm:text-base text-sm">
                    <Link href="/login" className="text-themeGreen hover:underline">
                        {translations.backToLogin}
                    </Link>
                </p>
            </section>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-themeGreen rounded-full mx-auto mb-4"></div>
                    <div>Loading...</div>
                </div>
            </div>
        }>
            <ResetPasswordContent />
        </Suspense>
    );
}