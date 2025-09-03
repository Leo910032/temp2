// lib/services/serviceContact/server/index.js
// This is the main entry point for ALL server-side contact services.

export { ContactService } from './contactService';
export { ContactGroupService } from './contactService'; // Since it's in the same file
export { ExchangeService } from './exchangeService';
export { ContactSecurityService } from './contactSecurityService';
export { ContactValidationService } from './contactValidationService';