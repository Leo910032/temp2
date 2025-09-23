// //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////// 

//app/dashboard/(dashboard pages)/contacts/components/ContactReviewModal.jsx - FIXED
"use client"
import { useState, useEffect } from 'react';
import { useTranslation } from "@/lib/translation/useTranslation";
import { toast } from 'react-hot-toast';

// Enhanced field icon component with more categories
const FieldIcon = ({ label, category }) => {
    const l = label.toLowerCase();
    
    // Check category first for better categorization
    if (category) {
        switch (category) {
            case 'professional': return <span className="text-blue-500">💼</span>;
            case 'social': return <span className="text-purple-500">🌐</span>;
            case 'contact': return <span className="text-green-500">📞</span>;
            case 'personal': return <span className="text-orange-500">👤</span>;
            case 'other': return <span className="text-gray-400">📄</span>;
        }
    }
    
    // Fallback to label-based detection
    if (l.includes('name')) return <span className="text-gray-600">👤</span>;
    if (l.includes('email')) return <span className="text-blue-500">✉️</span>;
    if (l.includes('phone') || l.includes('mobile')) return <span className="text-green-500">📞</span>;
    if (l.includes('company') || l.includes('organization')) return <span className="text-blue-600">🏢</span>;
    if (l.includes('website') || l.includes('url')) return <span className="text-purple-500">🌐</span>;
    if (l.includes('job') || l.includes('title') || l.includes('position')) return <span className="text-blue-400">💼</span>;
    if (l.includes('address') || l.includes('location')) return <span className="text-red-500">📍</span>;
    if (l.includes('linkedin')) return <span className="text-blue-700">💼</span>;
    if (l.includes('twitter')) return <span className="text-blue-400">🐦</span>;
    if (l.includes('instagram')) return <span className="text-pink-500">📷</span>;
    if (l.includes('facebook')) return <span className="text-blue-600">👥</span>;
    if (l.includes('education') || l.includes('degree')) return <span className="text-green-600">🎓</span>;
    if (l.includes('certification') || l.includes('certificate')) return <span className="text-yellow-600">🏆</span>;
    if (l.includes('experience') || l.includes('years')) return <span className="text-indigo-500">⏱️</span>;
    if (l.includes('skill')) return <span className="text-purple-600">🛠️</span>;
    if (l.includes('language')) return <span className="text-red-400">🗣️</span>;
    if (l.includes('tagline') || l.includes('motto')) return <span className="text-yellow-500">💭</span>;
    if (l.includes('qr')) return <span className="text-gray-400">🔳</span>;
    
    return <span className="text-gray-400">📄</span>;
};

export default function ContactReviewModal({ isOpen, onClose, parsedFields, onSave }) {
    const { t } = useTranslation();
    const [fields, setFields] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [fieldCategories, setFieldCategories] = useState({});
    const [activeCategory, setActiveCategory] = useState('all');

    useEffect(() => {
        if (parsedFields) {
            console.log('📊 Processing enhanced parsed fields:', parsedFields);
            
            let allFields = [];
            
            // Handle new enhanced structure
            if (parsedFields.standardFields || parsedFields.dynamicFields) {
                const standardFields = parsedFields.standardFields || [];
                const dynamicFields = parsedFields.dynamicFields || [];
                allFields = [...standardFields, ...dynamicFields];
            } else {
                // Fallback for old structure (array of fields)
                allFields = Array.isArray(parsedFields) ? parsedFields : [];
            }
            
            // Process fields and categorize them
            const processedFields = allFields.map((field, index) => ({
                id: field.id || `field_${index}`,
                label: field.label || '',
                value: field.value || '',
                category: field.category || inferCategory(field.label, field.value),
                type: field.type || 'custom',
                confidence: field.confidence || 0.5,
                isDynamic: field.isDynamic || false,
                source: field.source || 'scan'
            }));

            setFields(processedFields);
            
            // Calculate category counts
            const categories = processedFields.reduce((acc, field) => {
                const cat = field.category || 'other';
                acc[cat] = (acc[cat] || 0) + 1;
                return acc;
            }, {});
            
            setFieldCategories(categories);
        }
    }, [parsedFields]);

    // Infer category if not provided
    const inferCategory = (label, value) => {
        const l = label.toLowerCase();
        
        if (l.includes('name') && !l.includes('company')) return 'personal';
        if (l.includes('email') || l.includes('phone') || l.includes('address')) return 'contact';
        if (l.includes('company') || l.includes('job') || l.includes('title') || 
            l.includes('experience') || l.includes('certification') || l.includes('education')) return 'professional';
        if (l.includes('linkedin') || l.includes('twitter') || l.includes('instagram') || 
            l.includes('facebook') || l.includes('social')) return 'social';
        if (l.includes('language') || l.includes('hobby')) return 'personal';
        
        return 'other';
    };

    // Handle changes in any input (label, value, or category)
    const handleFieldChange = (index, key, value) => {
        const newFields = [...fields];
        newFields[index][key] = value;
        
        // If changing category, update category counts
        if (key === 'category') {
            const updatedCategories = newFields.reduce((acc, field) => {
                const cat = field.category || 'other';
                acc[cat] = (acc[cat] || 0) + 1;
                return acc;
            }, {});
            setFieldCategories(updatedCategories);
        }
        
        setFields(newFields);
    };

    // Add a new, empty field
    const addNewField = () => {
        const newField = {
            id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            label: '',
            value: '',
            category: 'other',
            type: 'custom',
            confidence: 1.0,
            isDynamic: true,
            source: 'manual'
        };
        setFields([...fields, newField]);
    };

    // Remove a field
    const removeField = (index) => {
        const newFields = fields.filter((_, i) => i !== index);
        setFields(newFields);
        
        // Update category counts
        const updatedCategories = newFields.reduce((acc, field) => {
            const cat = field.category || 'other';
            acc[cat] = (acc[cat] || 0) + 1;
            return acc;
        }, {});
        setFieldCategories(updatedCategories);
    };

    // Filter fields by category
    const getFilteredFields = () => {
        if (activeCategory === 'all') return fields;
        return fields.filter(field => field.category === activeCategory);
    };
const handleSave = async () => {
    // Enhanced validation
    const hasNameOrEmail = fields.some(f => 
        (f.label.toLowerCase().includes('name') || f.label.toLowerCase().includes('email')) && 
        f.value.trim() !== ''
    );

    if (!hasNameOrEmail) {
        toast.error('Please ensure the contact has at least a Name or Email.');
        return;
    }

    // Remove empty fields before saving
    const fieldsToSave = fields.filter(f => f.value && f.value.trim().length > 0);

    if (fieldsToSave.length === 0) {
        toast.error('Please add at least one field with a value.');
        return;
    }

    setIsSaving(true);
    try {
        // ✅ STRUCTURE THE DATA PROPERLY FOR THE CONTACT SERVICE
        const structuredContactData = {
            // Separate standard and dynamic fields
            standardFields: fieldsToSave.filter(f => !f.isDynamic),
            dynamicFields: fieldsToSave.filter(f => f.isDynamic),
            metadata: {
                totalFields: fieldsToSave.length,
                source: 'business_card_scan_review',
                processedAt: new Date().toISOString()
            }
        };

        await onSave(structuredContactData);
        toast.success(`Contact saved with ${fieldsToSave.length} fields!`);
        onClose();
    } catch (error) {
        console.error('Error saving enhanced contact:', error);
        toast.error('Failed to save contact.');
    } finally {
        setIsSaving(false);
    }
};

    const getCategoryCount = (category) => fieldCategories[category] || 0;
    const getTotalFields = () => Object.values(fieldCategories).reduce((sum, count) => sum + count, 0);

    if (!isOpen) return null;

    const filteredFields = getFilteredFields();

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                {/* Enhanced Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Review & Refine Contact</h3>
                        <p className="text-sm text-gray-500 mt-1">
                            {getTotalFields()} fields detected • {Object.keys(fieldCategories).length} categories
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 rounded-lg hover:bg-gray-100">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Category Filter Tabs */}
                <div className="px-6 py-4 border-b bg-gray-50">
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setActiveCategory('all')}
                            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                                activeCategory === 'all'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            All ({getTotalFields()})
                        </button>
                        
                        {Object.entries(fieldCategories).map(([category, count]) => (
                            <button
                                key={category}
                                onClick={() => setActiveCategory(category)}
                                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                                    activeCategory === category
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white text-gray-600 hover:bg-gray-100'
                                }`}
                            >
                                {category.charAt(0).toUpperCase() + category.slice(1)} ({count})
                            </button>
                        ))}
                    </div>
                </div>

                {/* Fields List */}
                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                    {filteredFields.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            {activeCategory === 'all' 
                                ? 'No fields detected. Click "Add Custom Field" to start.'
                                : `No ${activeCategory} fields found.`
                            }
                        </div>
                    ) : (
                        filteredFields.map((field, index) => {
                            const originalIndex = fields.findIndex(f => f.id === field.id);
                            return (
                                <div key={field.id} className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border">
                                    {/* Field Icon */}
                                    <div className="flex-shrink-0 w-10 text-center">
                                        <FieldIcon label={field.label} category={field.category} />
                                    </div>
                                    
                                    {/* Field Content */}
                                    <div className="flex-1 space-y-2">
                                        {/* Label and Category Row */}
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={field.label}
                                                onChange={(e) => handleFieldChange(originalIndex, 'label', e.target.value)}
                                                placeholder="Field Label (e.g., LinkedIn Profile)"
                                                className="flex-1 px-3 py-1 border-b border-gray-300 focus:outline-none focus:border-blue-500 text-sm font-medium bg-transparent"
                                            />
                                            
                                            {/* Category Selector */}
                                            <select
                                                value={field.category}
                                                onChange={(e) => handleFieldChange(originalIndex, 'category', e.target.value)}
                                                className="px-2 py-1 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:border-blue-500"
                                            >
                                                <option value="personal">Personal</option>
                                                <option value="professional">Professional</option>
                                                <option value="contact">Contact</option>
                                                <option value="social">Social</option>
                                                <option value="other">Other</option>
                                            </select>
                                            
                                            {/* Confidence Indicator */}
                                            {field.confidence && field.confidence < 1.0 && (
                                                <div className="flex items-center gap-1">
                                                    <div className="w-2 h-2 rounded-full bg-yellow-400" title={`Confidence: ${Math.round(field.confidence * 100)}%`}></div>
                                                    <span className="text-xs text-gray-400">{Math.round(field.confidence * 100)}%</span>
                                                </div>
                                            )}
                                            
                                            {/* Dynamic Field Badge */}
                                            {field.isDynamic && (
                                                <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                                                    AI Detected
                                                </span>
                                            )}
                                        </div>
                                        
                                        {/* Value Input */}
                                        <input
                                            type="text"
                                            value={field.value}
                                            onChange={(e) => handleFieldChange(originalIndex, 'value', e.target.value)}
                                            placeholder="Field Value"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                        />
                                    </div>
                                    
                                    {/* Remove Button */}
                                    <button 
                                        onClick={() => removeField(originalIndex)} 
                                        className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            );
                        })
                    )}
                    
                    {/* Add New Field Button */}
                    <button
                        onClick={addNewField}
                        className="w-full mt-4 flex items-center justify-center gap-2 p-4 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border-2 border-dashed border-blue-200"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Add Custom Field
                    </button>
                </div>

                {/* Enhanced Footer with Statistics */}
                <div className="p-6 border-t bg-gray-50">
                    {/* Field Statistics */}
                    <div className="mb-4 flex flex-wrap gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                            <span>Standard: {fields.filter(f => !f.isDynamic).length}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                            <span>AI Detected: {fields.filter(f => f.isDynamic).length}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span>With Values: {fields.filter(f => f.value && f.value.trim()).length}</span>
                        </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSave} 
                            disabled={isSaving} 
                            className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                        >
                            {isSaving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                            {isSaving ? 'Saving...' : `Save Contact (${fields.filter(f => f.value && f.value.trim()).length} fields)`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}