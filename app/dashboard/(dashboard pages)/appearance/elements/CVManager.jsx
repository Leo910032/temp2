//app/dashboard/(dashboard pages)/appearance/elements/CVManager.jsx
"use client"

import React, { useContext, useMemo } from 'react';
import { FaPlus, FaToggleOn, FaToggleOff } from 'react-icons/fa6';
import { toast } from 'react-hot-toast';
import { AppearanceContext } from '../AppearanceContext';
import { useTranslation } from '@/lib/translation/useTranslation';
import { LinksService } from '@/lib/services/serviceLinks/client/LinksService.js';
import { generateRandomId } from '@/lib/utilities';
import CVItemCard from './CVItemCard';

export default function CVManager() {
    const { t, isInitialized } = useTranslation();
    const { appearance, updateAppearance, isSaving } = useContext(AppearanceContext);

    // Derive CV state from appearance
    const cvEnabled = appearance?.cvEnabled || false;
const cvItems = useMemo(() => appearance?.cvItems || [], [appearance]);

    // Migration: Create missing links for existing CV items (runs once on mount)
    const [hasMigrated, setHasMigrated] = React.useState(false);

    React.useEffect(() => {
        if (!cvItems.length || hasMigrated) return;

        const migrateExistingCvItems = async () => {
            try {
                console.log('📄 [CVManager] Checking for missing links...');
                const response = await LinksService.getLinks();
                const currentLinks = response?.links || [];
                const cvLinks = currentLinks.filter(link => link.type === 3);
                const linkedCvItemIds = new Set(cvLinks.map(link => link.cvItemId));

                // Find CV items without corresponding links
                const orphanedCvItems = cvItems.filter(cv => !linkedCvItemIds.has(cv.id));

                if (orphanedCvItems.length > 0) {
                    console.log('📄 [CVManager] Found', orphanedCvItems.length, 'CV items without links. Creating links...');

                    const newLinks = orphanedCvItems.map(cv => ({
                        id: generateRandomId(),
                        title: cv.displayTitle || "CV / Document",
                        isActive: true,
                        type: 3,
                        cvItemId: cv.id
                    }));

                    const updatedLinks = [...newLinks, ...currentLinks];
                    await LinksService.saveLinks(updatedLinks);
                    console.log('📄 [CVManager] Created', newLinks.length, 'missing links');
                    toast.success(`Created ${newLinks.length} missing link(s) for existing CV items`);
                }

                setHasMigrated(true);
            } catch (error) {
                console.error('📄 [CVManager] Migration error:', error);
                setHasMigrated(true); // Don't retry
            }
        };

        migrateExistingCvItems();
    }, [cvItems, hasMigrated]);

    // Pre-compute translations
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            title: t('dashboard.appearance.cv.title') || 'Curriculum / Documents',
            enabled: t('dashboard.appearance.cv.enabled') || 'Enabled',
            disabled: t('dashboard.appearance.cv.disabled') || 'Disabled',
            description: t('dashboard.appearance.cv.description') || 'Manage multiple CV documents and resumes.',
            addItem: t('dashboard.appearance.cv.add_item') || 'Add CV Item',
            noItems: t('dashboard.appearance.cv.no_items') || 'No CV items yet. Add your first document to get started!',
        };
    }, [t, isInitialized]);

    // Toggle CV enabled/disabled
    const handleToggleCV = () => {
        updateAppearance('cvEnabled', !cvEnabled);
        toast.success(cvEnabled ? 'CV disabled' : 'CV enabled');
    };

    // Add new CV item
    const handleAddItem = async () => {
        const cvItemId = `cv_${Date.now()}`;
        console.log('📄 [CVManager] Creating new CV item with ID:', cvItemId);

        const newItem = {
            id: cvItemId,
            url: '',
            fileName: '',
            displayTitle: 'New CV Document',
            uploadDate: null,
            fileSize: 0,
            fileType: '',
            order: cvItems.length
        };

        // Update cvItems in appearance
        const updatedItems = [...cvItems, newItem];
        updateAppearance('cvItems', updatedItems);

        // Also create the corresponding link
        try {
            console.log('📄 [CVManager] Fetching current links...');
            const response = await LinksService.getLinks();
            const currentLinks = response?.links || [];
            console.log('📄 [CVManager] Current links count:', currentLinks.length);

            const newLink = {
                id: generateRandomId(),
                title: "CV / Document",
                isActive: true,
                type: 3,
                cvItemId: cvItemId // Link to the CV item we just created
            };

            console.log('📄 [CVManager] Creating link with cvItemId:', cvItemId);
            const updatedLinks = [newLink, ...currentLinks];
            await LinksService.saveLinks(updatedLinks);
            console.log('📄 [CVManager] Link created successfully');

            toast.success('CV item and link added successfully');
        } catch (error) {
            console.error('📄 [CVManager] Error creating link:', error);
            toast.error('CV item added but failed to create link: ' + error.message);
        }
    };

    // Update a CV item
    const handleUpdateItem = (itemId, updatedData) => {
        const updatedItems = cvItems.map(item =>
            item.id === itemId ? { ...item, ...updatedData } : item
        );
        updateAppearance('cvItems', updatedItems);
    };

    // Delete a CV item
    const handleDeleteItem = async (itemId) => {
        // Update cvItems in appearance
        const updatedItems = cvItems
            .filter(item => item.id !== itemId)
            .map((item, index) => ({ ...item, order: index })); // Re-order
        updateAppearance('cvItems', updatedItems);

        // Also delete the corresponding link
        try {
            const response = await LinksService.getLinks();
            const currentLinks = response?.links || [];
            const updatedLinks = currentLinks.filter(link => link.cvItemId !== itemId);

            if (updatedLinks.length !== currentLinks.length) {
                await LinksService.saveLinks(updatedLinks);
                toast.success('CV item and link deleted');
            } else {
                toast.success('CV item deleted');
            }
        } catch (error) {
            console.error('Error deleting link:', error);
            toast.success('CV item deleted (link may still exist)');
        }
    };

    // Loading state
    if (!appearance || !isInitialized) {
        return (
            <div className="w-full bg-gray-200 rounded-3xl my-3 p-6 h-36 animate-pulse"></div>
        );
    }

    return (
        <div className="w-full bg-white rounded-3xl my-3 flex flex-col p-6">
            {/* Header with enable/disable toggle */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <h3 className="text-xl font-semibold">{translations.title}</h3>
                    <button
                        onClick={handleToggleCV}
                        disabled={isSaving}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                            cvEnabled
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        {cvEnabled ? <FaToggleOn className="text-xl" /> : <FaToggleOff className="text-xl" />}
                        <span className="text-sm font-medium">
                            {cvEnabled ? translations.enabled : translations.disabled}
                        </span>
                    </button>
                </div>
            </div>

            {/* Description */}
            <p className="text-sm text-gray-600 mb-6">
                {translations.description}
            </p>

            {/* CV items list */}
            {cvEnabled && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-gray-700">
                            CV Items ({cvItems.length})
                        </h4>
                        <button
                            onClick={handleAddItem}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                            <FaPlus />
                            <span className="text-sm font-medium">{translations.addItem}</span>
                        </button>
                    </div>

                    {cvItems.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                            <p className="text-gray-500">{translations.noItems}</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {cvItems
                                .sort((a, b) => a.order - b.order)
                                .map((item) => (
                                    <CVItemCard
                                        key={item.id}
                                        item={item}
                                        onUpdate={(updatedData) => handleUpdateItem(item.id, updatedData)}
                                        onDelete={() => handleDeleteItem(item.id)}
                                        disabled={isSaving}
                                    />
                                ))}
                        </div>
                    )}
                </div>
            )}

            {/* Disabled state message */}
            {!cvEnabled && (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <p className="text-gray-500">
                        Enable the CV feature to start managing your documents.
                    </p>
                </div>
            )}
        </div>
    );
}
