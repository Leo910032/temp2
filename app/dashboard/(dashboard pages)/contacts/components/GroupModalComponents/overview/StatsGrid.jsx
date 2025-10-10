// app/dashboard/(dashboard pages)/contacts/components/GroupModalComponents/StatsGrid.jsx
"use client"

export default function StatsGrid({ groupStats }) {
    const stats = [
        {
            value: groupStats.total,
            label: 'Total Groups',
            color: 'blue',
            bgColor: 'bg-blue-50',
            textColor: 'text-blue-600',
            borderColor: 'border-blue-200'
        },
        {
            value: groupStats.custom,
            label: 'Custom Groups',
            color: 'purple',
            bgColor: 'bg-purple-50',
            textColor: 'text-purple-600',
            borderColor: 'border-purple-200'
        },
        {
            value: groupStats.auto,
            label: 'Auto Groups',
            color: 'green',
            bgColor: 'bg-green-50',
            textColor: 'text-green-600',
            borderColor: 'border-green-200'
        },
        {
            value: groupStats.event,
            label: 'Event Groups',
            color: 'orange',
            bgColor: 'bg-orange-50',
            textColor: 'text-orange-600',
            borderColor: 'border-orange-200'
        }
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, index) => (
                <StatCard key={index} {...stat} />
            ))}
        </div>
    );
}

function StatCard({ value, label, bgColor, textColor, borderColor }) {
    return (
        <div className={`${bgColor} rounded-lg p-4 border ${borderColor}`}>
            <div className={`text-2xl font-bold ${textColor}`}>
                {value}
            </div>
            <div className={`text-sm ${textColor.replace('600', '800')}`}>
                {label}
            </div>
        </div>
    );
}