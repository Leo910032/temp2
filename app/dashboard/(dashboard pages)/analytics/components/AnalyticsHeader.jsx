// app/dashboard/(dashboard pages)/analytics/components/AnalyticsHeader
"use client"
import Image from "next/image";
import { useTranslation } from "@/lib/translation/useTranslation";

export default function AnalyticsHeader({ username, isConnected }) {
    const { t } = useTranslation();
    
    return (
        <div className="mb-6 lg:mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        {t('analytics.title') || 'Analytics Dashboard'}
                    </h1>
                    <p className="text-gray-600">
                        {t('analytics.subtitle') || 'Track your profile views and link clicks'}
                    </p>
                    {username && (
                        <p className="text-sm text-gray-500 mt-2">
                            {t('analytics.profile') || 'Profile:'} @{username}
                        </p>
                    )}
                </div>
                
                {/* Real-time connection indicator */}
                <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className="text-sm text-gray-500">
                        {isConnected ? 
                            (t("analytics.live_connection") || "Live") : 
                            (t("analytics.disconnected") || "Disconnected")
                        }
                    </span>
                </div>
            </div>
        </div>
    );
}
