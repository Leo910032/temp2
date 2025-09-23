////////////////////////////////////////////////////////////////////////////////////////////
"use client"
import { useState } from 'react';

/**
 * A modal form for creating a new team.
 * @param {object} props
 * @param {boolean} props.isOpen - Controls whether the modal is visible.
 * @param {function} props.onClose - Function to call to close the modal.
 * @param {function} props.onSubmit - Async function to call with (name, description) on submission.
 */
export default function CreateTeamModal({ isOpen, onClose, onSubmit }) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            alert("Team Name is required."); // Basic validation
            return;
        }

        setIsSubmitting(true);
        // The onSubmit function (handleCreateTeam) is passed from the parent.
        // It should return true on success to signal the modal to reset and close.
        const success = await onSubmit(name, description);
        setIsSubmitting(false);

        if (success) {
            // Clear fields and close on successful submission
            setName('');
            setDescription('');
            onClose();
        }
    };

    // Render nothing if the modal is not open
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 transition-opacity duration-300">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md transform transition-all duration-300 scale-100">
                <form onSubmit={handleSubmit}>
                    {/* Modal Header */}
                    <div className="p-6 border-b">
                        <h2 className="text-xl font-bold text-gray-900">Create a New Team</h2>
                        <p className="text-sm text-gray-500 mt-1">Teams help you organize and manage members.</p>
                    </div>

                    {/* Modal Body */}
                    <div className="p-6 space-y-4">
                        <div>
                            <label htmlFor="teamName" className="block text-sm font-medium text-gray-700 mb-1">Team Name *</label>
                            <input
                                id="teamName"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., Q4 Marketing"
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                disabled={isSubmitting}
                            />
                        </div>
                        <div>
                            <label htmlFor="teamDescription" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea
                                id="teamDescription"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows="3"
                                placeholder="A brief description of this team's purpose."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 rounded-b-lg">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !name.trim()}
                            className="px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isSubmitting && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                            {isSubmitting ? 'Creating...' : 'Create Team'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}