// app/dashboard/(dashboard pages)/analytics/components/PeriodNavigation
"use client"
import { useTranslation } from "@/lib/translation/useTranslation";

export default function PeriodNavigation({ selectedPeriod, setSelectedPeriod }) {
    const { t } = useTranslation();
    
    const navigationItems = [
        { id: 'today', label: t('analytics.nav.today') || 'Today', icon: '📅' },
        { id: 'week', label: t('analytics.nav.week') || 'Week', icon: '📊' },
        { id: 'month', label: t('analytics.nav.month') || 'Month', icon: '📈' },
        { id: 'all', label: t('analytics.nav.all_time') || 'All Time', icon: '🚀' }
    ];

    return (
        <div className="mb-8">
            <div className="bg-white rounded-xl shadow-sm border p-2">
                <div className="grid grid-cols-4 gap-2">
                    {navigationItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setSelectedPeriod(item.id)}
                            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                                selectedPeriod === item.id
                                    ? 'bg-blue-500 text-white shadow-md'
                                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            }`}
                        >
                            <span className="text-lg">{item.icon}</span>
                            <span className="hidden sm:inline">{item.label}</span>
                            <span className="sm:hidden">{item.label.split(' ')[0]}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
