// app/admin/layout.jsx
import { redirect } from 'next/navigation';
import AdminProtection from './components/AdminProtection';

export default function AdminLayout({ children }) {
    return (
        <AdminProtection>
            <div className="min-h-screen bg-gray-50">
                <div className="bg-red-600 text-white p-4 shadow-md">
                    <div className="max-w-7xl mx-auto flex items-center justify-between">
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                            TapIt Admin Panel
                        </h1>
                        <div className="text-sm opacity-90">
                            Admin Access Only
                        </div>
                    </div>
                </div>
                <div className="max-w-7xl mx-auto p-6">
                    {children}
                </div>
            </div>
        </AdminProtection>
    );
}
