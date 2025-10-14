// app/dashboard/(dashboard pages)/contacts/components/contacts/GroupList.jsx
"use client";

import { memo } from 'react';
import { useTranslation } from "@/lib/translation/useTranslation";
import { motion } from "framer-motion";
import GroupCard from './GroupCard';

const GroupList = memo(function GroupList({
    groups,
    contacts,
    onShowMembers,
    onEdit,
    onDelete,
    onShowLocation,
    loading
}) {
    const { t } = useTranslation();

    // Empty state
    if (!groups || groups.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="p-6 sm:p-8 text-center bg-white rounded-lg border"
            >
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                </div>
                <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
                    {t('contacts.groups.no_groups') || 'No groups found'}
                </h3>
                <p className="text-gray-500 text-sm">
                    {t('contacts.groups.create_first') || 'Create your first group to organize contacts'}
                </p>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4 pb-24 sm:pb-6"
        >
            <div className="space-y-3">
                {groups.map((group, index) => (
                    <motion.div
                        key={group.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                    >
                        <GroupCard
                            group={group}
                            groups={groups}
                            contacts={contacts}
                            onShowMembers={onShowMembers}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onShowLocation={onShowLocation}
                            compact={false}
                        />
                    </motion.div>
                ))}
            </div>

            {/* Loading state */}
            {loading && (
                <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
            )}
        </motion.div>
    );
});

export default GroupList;
