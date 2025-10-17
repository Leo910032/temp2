// lib/services/serviceContact/server/documentBuilderService.js
// Server-side service for building searchable contact documents
// UPDATED: Balanced approach - emphasis on factual fields, reduced noise

import { SEMANTIC_ENHANCEMENT } from '@/lib/services/serviceContact/client/constants/contactConstants';

/**
 * DocumentBuilderService
 *
 * Architecture:
 * - Server-side only (used during vector upsert)
 * - Builds rich, searchable documents from contact data
 * - Balances factual accuracy with semantic understanding
 * - Premium/Business/Enterprise: ALL get full enhancement
 * - Basic: Not supported for semantic search
 */
export class DocumentBuilderService {
  /**
   * Build searchable document for a contact
   *
   * @param {object} contact - Contact object
   * @param {string} subscriptionLevel - User's subscription level
   * @returns {string} Formatted document for embedding
   */
  static buildContactDocument(contact, subscriptionLevel) {
    const buildStartTime = Date.now();
    const fieldsUsed = [];

    console.log(`📄 [DocumentBuilder] Building document for: ${contact.name} (${subscriptionLevel})`);

    // Start with structured contact information
    let document = `[Contact Name]: ${contact.name || 'Unknown'}\n`;
    fieldsUsed.push('name');

    document += `[Email Address]: ${contact.email || 'No email provided'}\n`;
    fieldsUsed.push('email');

    // ✅ CHANGE 1: Repeat company name for higher weight
    document += `[Company]: ${contact.company || 'No company listed'}\n`;
    fieldsUsed.push('company');
    
    if (contact.company) {
      document += `[Organization]: ${contact.company}\n`;
      fieldsUsed.push('company (repeated for emphasis)');
      console.log(`   - Company emphasized: ${contact.company}`);
    }

    // Add job title with enhanced context
    if (contact.jobTitle) {
      document += `[Job Title]: ${contact.jobTitle}\n`;
      fieldsUsed.push('jobTitle');
      console.log(`   - Added job title: ${contact.jobTitle}`);

      // ✅ KEEP: Enhanced job title semantics (useful for role-based queries)
      const enhancedJobContext = this.enhanceJobTitleSemantics(contact.jobTitle);
      if (enhancedJobContext) {
        document += `[Professional Role]: ${enhancedJobContext}\n`;
        fieldsUsed.push('jobTitle (enhanced semantics)');
        console.log(`   - Enhanced job semantics: ${enhancedJobContext}`);
      }
    }

    // ✅ CHANGE 2: Add explicit department field (from details or dynamicFields)
    const department = this.extractDepartment(contact);
    if (department) {
      document += `[Department]: ${department}\n`;
      fieldsUsed.push('department');
      console.log(`   - Added department: ${department}`);
    }

    // ✅ CHANGE 3: Add explicit venue and event fields
    if (contact.location?.venue) {
      document += `[Venue]: ${contact.location.venue}\n`;
      fieldsUsed.push('location.venue');
      console.log(`   - Added venue: ${contact.location.venue}`);
    }

    if (contact.location?.address) {
      document += `[Location]: ${contact.location.address}\n`;
      fieldsUsed.push('location.address');
      console.log(`   - Added location: ${contact.location.address}`);
    }

    const event = this.extractEvent(contact);
    if (event) {
      document += `[Event]: ${event}\n`;
      fieldsUsed.push('event');
      console.log(`   - Added event: ${event}`);
    }

    // Premium+ tier - Enhanced semantic processing
    const isPremiumOrHigher = ['premium', 'business', 'enterprise'].includes(subscriptionLevel);
    if (isPremiumOrHigher) {
      console.log(`   - Building enhanced Premium+ document with semantic extraction`);

      // ✅ KEEP: Enhanced notes processing with keyword extraction
      if (contact.notes) {
        document += `[Personal Notes about contact]: ${contact.notes}\n`;
        fieldsUsed.push('notes');
        console.log(`   - Added notes (${contact.notes.length} chars)`);

        // Extract and highlight key professional terms
        const extractedKeywords = this.extractProfessionalKeywords(contact.notes);
        if (extractedKeywords.length > 0) {
          document += `[Key Professional Areas]: ${extractedKeywords.join(', ')}\n`;
          fieldsUsed.push('notes (extracted keywords)');
          console.log(`   - Extracted keywords: ${extractedKeywords.join(', ')}`);
        }

        // ✅ KEEP: Extract startup/founder context if present
        const startupContext = this.extractStartupContext(contact.notes);
        if (startupContext) {
          document += `[Entrepreneurial Background]: ${startupContext}\n`;
          fieldsUsed.push('notes (startup context)');
          console.log(`   - Startup context: ${startupContext}`);
        }
      }

      // ✅ CHANGE 4: Simplified message processing (remove intent extraction)
      if (contact.message) {
        document += `[Last Message or Communication]: ${contact.message}\n`;
        fieldsUsed.push('message');
        console.log(`   - Added message`);
        // ❌ REMOVED: extractMessageIntent() - too much noise
      }

      // Enhanced details processing
      if (contact.details && Array.isArray(contact.details)) {
        contact.details.forEach(detail => {
          document += `[${detail.label}]: ${detail.value}\n`;
        });
        fieldsUsed.push(`details (${contact.details.length} fields)`);
        console.log(`   - Added ${contact.details.length} detail fields`);
      }

      // Dynamic fields processing
      if (contact.dynamicFields && Array.isArray(contact.dynamicFields)) {
        contact.dynamicFields.forEach(field => {
          if (field.value && field.value.trim()) {
            document += `[${field.label}]: ${field.value}\n`;
          }
        });

        const dynamicFieldCount = contact.dynamicFields.length;
        if (dynamicFieldCount > 0) {
          document += `[Additional Fields Count]: ${dynamicFieldCount} custom fields detected\n`;
          fieldsUsed.push(`dynamicFields (${dynamicFieldCount} fields)`);

          const categories = [...new Set(contact.dynamicFields.map(f => f.category).filter(Boolean))];
          if (categories.length > 0) {
            document += `[Field Categories]: ${categories.join(', ')}\n`;
            fieldsUsed.push('dynamicFields (categories)');
          }
        }
        console.log(`   - Added ${dynamicFieldCount} dynamic fields`);
      }

      // ❌ CHANGE 5: REMOVED comprehensive semantic profile (most diluting)
      // This was adding too much generic noise like "Technology Professional, Business Executive"
      // The specific fields above (Professional Role, Keywords, Startup Context) are enough
    }

    const finalDocument = document.trim();
    const duration = Date.now() - buildStartTime;
    console.log(`✅ [DocumentBuilder] Document complete (${finalDocument.length} chars, ${duration}ms)`);
    console.log(`📊 [DocumentBuilder] Fields used for VECTOR SEARCH: [${fieldsUsed.join(', ')}]`);

    return finalDocument;
  }

  /**
   * Extract department from contact details or dynamic fields
   * @private
   */
  static extractDepartment(contact) {
    // Check details array
    if (contact.details && Array.isArray(contact.details)) {
      const deptDetail = contact.details.find(d => 
        d.label?.toLowerCase().includes('department') || 
        d.label?.toLowerCase().includes('dept')
      );
      if (deptDetail?.value) return deptDetail.value;
    }

    // Check dynamic fields
    if (contact.dynamicFields && Array.isArray(contact.dynamicFields)) {
      const deptField = contact.dynamicFields.find(f => 
        f.label?.toLowerCase().includes('department') || 
        f.label?.toLowerCase().includes('dept')
      );
      if (deptField?.value) return deptField.value;
    }

    return null;
  }

  /**
   * Extract event name from contact details or dynamic fields
   * @private
   */
  static extractEvent(contact) {
    // Check details array
    if (contact.details && Array.isArray(contact.details)) {
      const eventDetail = contact.details.find(d => 
        d.label?.toLowerCase().includes('event') || 
        d.label?.toLowerCase().includes('conference')
      );
      if (eventDetail?.value) return eventDetail.value;
    }

    // Check dynamic fields
    if (contact.dynamicFields && Array.isArray(contact.dynamicFields)) {
      const eventField = contact.dynamicFields.find(f => 
        f.label?.toLowerCase().includes('event') || 
        f.label?.toLowerCase().includes('conference')
      );
      if (eventField?.value) return eventField.value;
    }

    return null;
  }

  /**
   * Enhance job title with semantic context
   * @private
   */
  static enhanceJobTitleSemantics(jobTitle) {
    if (!jobTitle) return null;

    const title = jobTitle.toLowerCase();
    const enhancements = [];

    // Founder/Entrepreneur patterns
    if (title.includes('founder') || title.includes('co-founder')) {
      enhancements.push('Startup Founder', 'Entrepreneur', 'Business Leader');
    }

    if (title.includes('ceo') || title.includes('chief executive')) {
      enhancements.push('Executive Leadership', 'Chief Executive Officer', 'Company Leader');
    }

    if (title.includes('cto') || title.includes('chief technology')) {
      enhancements.push('Technology Leadership', 'Technical Executive', 'Engineering Leader');
    }

    if (title.includes('ciso') || title.includes('chief information security')) {
      enhancements.push('Chief Information Security Officer', 'Security Leadership', 'Cybersecurity Executive');
    }

    // Technology roles
    if (title.includes('engineer') || title.includes('developer')) {
      enhancements.push('Software Development', 'Technology Professional', 'Engineering Expert');
    }

    if (title.includes('ai') || title.includes('artificial intelligence') || title.includes('machine learning')) {
      enhancements.push('Artificial Intelligence', 'Machine Learning', 'AI Technology');
    }

    // Business roles
    if (title.includes('manager') || title.includes('director')) {
      enhancements.push('Management Professional', 'Business Leadership');
    }

    if (title.includes('scrum master') || title.includes('agile')) {
      enhancements.push('Agile Leadership', 'Project Management Professional');
    }

    if (title.includes('consultant')) {
      enhancements.push('Business Consultant', 'Advisory Services', 'Professional Services');
    }

    if (title.includes('vp') || title.includes('vice president')) {
      enhancements.push('Executive Leadership', 'Senior Management');
    }

    return enhancements.length > 0 ? enhancements.join(', ') : null;
  }

  /**
   * Extract professional keywords from notes
   * @private
   */
  static extractProfessionalKeywords(notes) {
    if (!notes) return [];

    const text = notes.toLowerCase();
    const keywords = [];

    // Check for all keyword categories from constants
    const allKeywords = [
      ...SEMANTIC_ENHANCEMENT.TECH_KEYWORDS,
      ...SEMANTIC_ENHANCEMENT.BUSINESS_KEYWORDS,
      ...SEMANTIC_ENHANCEMENT.INDUSTRY_KEYWORDS
    ];

    allKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        keywords.push(keyword);
      }
    });

    // Remove duplicates and return
    return [...new Set(keywords)];
  }

  /**
   * Extract startup/founder context from notes
   * @private
   */
  static extractStartupContext(notes) {
    if (!notes) return null;

    const text = notes.toLowerCase();
    const context = [];

    // Founder patterns
    if (text.includes('founder') || text.includes('co-founder')) {
      context.push('Startup Founder');
    }

    if (text.includes('startup') || text.includes('start-up')) {
      context.push('Startup Experience');
    }

    if (text.includes('entrepreneur') || text.includes('entrepreneurial')) {
      context.push('Entrepreneurial Background');
    }

    // Funding/business patterns
    if (text.includes('raised funding') || text.includes('venture capital') || text.includes('investor')) {
      context.push('Venture Capital Experience');
    }

    if (text.includes('exit') || text.includes('acquisition') || text.includes('ipo')) {
      context.push('Business Exit Experience');
    }

    // Industry-specific startup terms
    if (text.includes('fintech startup') || text.includes('fintech founder')) {
      context.push('Fintech Startup Founder');
    }

    if (text.includes('healthtech') || text.includes('medtech')) {
      context.push('Healthcare Technology Entrepreneur');
    }

    if (text.includes('saas') || text.includes('software as a service')) {
      context.push('SaaS Entrepreneur');
    }

    return context.length > 0 ? context.join(', ') : null;
  }

  // ❌ REMOVED: extractMessageIntent() - was adding too much noise
  // ❌ REMOVED: buildSemanticProfile() - not used
  // ❌ REMOVED: buildComprehensiveSemanticProfile() - most diluting field
}