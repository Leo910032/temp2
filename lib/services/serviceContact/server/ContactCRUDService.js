// lib/services/serviceContact/server/ContactCRUDService.js
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { ContactValidationService } from './contactValidationService';
import { VectorService } from './vectorService'; // For updating vectors on change

/**
 * A dedicated server-side service for all core Create, Read, Update, Delete (CRUD)
 * operations on individual contact records.
 */
export class ContactCRUDService {

    /**
     * Fetches all contacts for a given user.
     * @param {{ session: object }} { session } The authenticated user session.
     * @returns {Promise<Array>} The user's contacts.
     */
  static async getAllContacts({ session }) {
        console.log('🔍 ContactCRUDService.getAllContacts - User:', session.userId);
        
        try {
            const contactsDoc = await adminDb.collection('Contacts').doc(session.userId).get();
            
            console.log('📄 Document exists:', contactsDoc.exists);
            
            if (!contactsDoc.exists) {
                console.log('⚠️ No contacts document found for user:', session.userId);
                return [];
            }
            
            const data = contactsDoc.data();
            const contacts = data?.contacts || [];
            
            console.log('✅ Found contacts:', contacts.length);
            if (contacts.length > 0) {
                console.log('📊 Sample contact:', {
                    id: contacts[0].id,
                    name: contacts[0].name,
                    status: contacts[0].status
                });
            }
            
            return contacts;
        } catch (error) {
            console.error('❌ Error in getAllContacts:', error);
            throw error;
        }
    }


    /**
     * Creates a new contact for a user.
     * @param {{ contactData: object, session: object }} { contactData, session }
     * @returns {Promise<object>} The newly created contact.
     */
    static async createContact({ contactData, session }) {
        const validation = ContactValidationService.validateContactData(contactData);
        if (!validation.isValid) {
            throw new Error(`Invalid contact data: ${validation.errors.join(', ')}`);
        }

        const newContact = {
            ...contactData,
            id: `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            createdBy: session.userId,
            submittedAt: new Date().toISOString(),
            lastModified: new Date().toISOString(),
        };

        const contactsRef = adminDb.collection('Contacts').doc(session.userId);
        await contactsRef.update({
            contacts: FieldValue.arrayUnion(newContact)
        });

        // Trigger vector update in the background (fire-and-forget)
        VectorService.upsertContactVector(newContact, session.subscriptionLevel)
            .catch(err => console.error("Background vector update failed on create:", err));

        return newContact;
    }

    /**
     * Updates an existing contact.
     * @param {{ contactId: string, updates: object, session: object }} { contactId, updates, session }
     * @returns {Promise<object>} The updated contact data.
     */
    static async updateContact({ contactId, updates, session }) {
        const contactsRef = adminDb.collection('Contacts').doc(session.userId);
        const contactsDoc = await contactsRef.get();
        if (!contactsDoc.exists) throw new Error("User contacts not found.");

        const allContacts = contactsDoc.data().contacts || [];
        let contactToUpdate = null;
        const updatedContacts = allContacts.map(contact => {
            if (contact.id === contactId) {
                contactToUpdate = { 
                    ...contact, 
                    ...updates, 
                    lastModified: new Date().toISOString() 
                };
                return contactToUpdate;
            }
            return contact;
        });

        if (!contactToUpdate) throw new Error(`Contact with ID ${contactId} not found.`);

        await contactsRef.update({ contacts: updatedContacts });

        // Trigger vector update in the background
        VectorService.upsertContactVector(contactToUpdate, session.subscriptionLevel)
            .catch(err => console.error("Background vector update failed on update:", err));

        return contactToUpdate;
    }

    /**
     * Deletes a contact.
     * @param {{ contactId: string, session: object }} { contactId, session }
     * @returns {Promise<{success: boolean}>}
     */
    static async deleteContact({ contactId, session }) {
        const contactsRef = adminDb.collection('Contacts').doc(session.userId);
        const contactsDoc = await contactsRef.get();
        if (!contactsDoc.exists) return { success: true }; // Already gone

        const allContacts = contactsDoc.data().contacts || [];
        const updatedContacts = allContacts.filter(contact => contact.id !== contactId);

        if (allContacts.length === updatedContacts.length) {
            console.warn(`Attempted to delete non-existent contact ${contactId} for user ${session.userId}`);
            return { success: true };
        }

        await contactsRef.update({ contacts: updatedContacts });

        // Trigger vector deletion in the background
        VectorService.deleteContactVector(contactId, session.userId)
            .catch(err => console.error("Background vector deletion failed:", err));

        return { success: true };
    }
}