// lib/services/serviceContact/server/documentBuilderService.js
// Server-side service for building searchable contact documents
// Handles semantic enhancement and keyword extraction

import { SEMANTIC_ENHANCEMENT } from '@/lib/services/serviceContact/client/constants/contactConstants';

/**
 * DocumentBuilderService
 *
 * Architecture:
 * - Server-side only (used during vector upsert)
 * - Builds rich, searchable documents from contact data
 * - Enhances documents with semantic context based on subscription tier
 * - UPDATED: Premium/Business/Enterprise: ALL get full enhancement (notes, keywords, semantic profile, etc.)
 * - Basic: Not supported for semantic search
 */
export class DocumentBuilderService {
  /**
   * Build searchable document for a contact
   * UPDATED: All Premium+ users (Premium, Business, Enterprise) get ALL fields
   *
   * @param {object} contact - Contact object
   * @param {string} subscriptionLevel - User's subscription level (premium, business, or enterprise)
   * @returns {string} Formatted document for embedding
   */
  static buildContactDocument(contact, subscriptionLevel) {
    const buildStartTime = Date.now();
    const fieldsUsed = []; // Track which fields are included

    console.log(`📄 [DocumentBuilder] Building document for: ${contact.name} (${subscriptionLevel})`);

    // Start with structured contact information
    let document = `[Contact Name]: ${contact.name || 'Unknown'}\n`;
    fieldsUsed.push('name');

    document += `[Email Address]: ${contact.email || 'No email provided'}\n`;
    fieldsUsed.push('email');

    document += `[Company]: ${contact.company || 'No company listed'}\n`;
    fieldsUsed.push('company');

    // Add job title with enhanced context
    if (contact.jobTitle) {
      document += `[Job Title]: ${contact.jobTitle}\n`;
      fieldsUsed.push('jobTitle');
      console.log(`   - Added job title: ${contact.jobTitle}`);

      // Extract and enhance job title semantics
      const enhancedJobContext = this.enhanceJobTitleSemantics(contact.jobTitle);
      if (enhancedJobContext) {
        document += `[Professional Role]: ${enhancedJobContext}\n`;
        fieldsUsed.push('jobTitle (enhanced semantics)');
        console.log(`   - Enhanced job semantics: ${enhancedJobContext}`);
      }
    }

    // UPDATED: Premium+ tier (Premium, Business, Enterprise) - ALL users get full enhancement
    const isPremiumOrHigher = ['premium', 'business', 'enterprise'].includes(subscriptionLevel);
    if (isPremiumOrHigher) {
      console.log(`   - Building enhanced Premium+ document with semantic extraction (all fields available)`);

      // Enhanced notes processing with keyword extraction
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

        // Extract startup/founder context if present
        const startupContext = this.extractStartupContext(contact.notes);
        if (startupContext) {
          document += `[Entrepreneurial Background]: ${startupContext}\n`;
          fieldsUsed.push('notes (startup context)');
          console.log(`   - Startup context: ${startupContext}`);
        }
      }

      // Enhanced message processing
      if (contact.message) {
        document += `[Last Message or Communication]: ${contact.message}\n`;
        fieldsUsed.push('message');
        console.log(`   - Added message`);

        // Extract intent from message
        const messageIntent = this.extractMessageIntent(contact.message);
        if (messageIntent) {
          document += `[Communication Context]: ${messageIntent}\n`;
          fieldsUsed.push('message (intent extracted)');
          console.log(`   - Message intent: ${messageIntent}`);
        }
      }

      // Enhanced details processing
      if (contact.details && Array.isArray(contact.details)) {
        contact.details.forEach(detail => {
          document += `[${detail.label}]: ${detail.value}\n`;
        });
        fieldsUsed.push(`details (${contact.details.length} fields)`);
        console.log(`   - Added ${contact.details.length} detail fields`);
      }

      // Enhanced location context
      if (contact.location?.address) {
        document += `[Location]: ${contact.location.address}\n`;
        fieldsUsed.push('location.address');
        console.log(`   - Added location: ${contact.location.address}`);
      }

      // Dynamic fields processing
      if (contact.dynamicFields && Array.isArray(contact.dynamicFields)) {
        contact.dynamicFields.forEach(field => {
          if (field.value && field.value.trim()) {
            document += `[${field.label}]: ${field.value}\n`;
          }
        });

        // Add dynamic field summary for better search
        const dynamicFieldCount = contact.dynamicFields.length;
        if (dynamicFieldCount > 0) {
          document += `[Additional Fields Count]: ${dynamicFieldCount} custom fields detected\n`;
          fieldsUsed.push(`dynamicFields (${dynamicFieldCount} fields)`);

          // Extract categories for better semantic search
          const categories = [...new Set(contact.dynamicFields.map(f => f.category).filter(Boolean))];
          if (categories.length > 0) {
            document += `[Field Categories]: ${categories.join(', ')}\n`;
            fieldsUsed.push('dynamicFields (categories)');
          }
        }
        console.log(`   - Added ${dynamicFieldCount} dynamic fields`);
      }

      // Build comprehensive semantic profile
      const comprehensiveProfile = this.buildComprehensiveSemanticProfile(contact);
      if (comprehensiveProfile) {
        document += `[Professional Summary]: ${comprehensiveProfile}\n`;
        fieldsUsed.push('comprehensive semantic profile');
        console.log(`   - Added comprehensive profile: ${comprehensiveProfile}`);
      }
    }

    const finalDocument = document.trim();
    const duration = Date.now() - buildStartTime;
    console.log(`✅ [DocumentBuilder] Document complete (${finalDocument.length} chars, ${duration}ms)`);
    console.log(`📊 [DocumentBuilder] Fields used for VECTOR SEARCH: [${fieldsUsed.join(', ')}]`);

    return finalDocument;
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

    if (title.includes('consultant')) {
      enhancements.push('Business Consultant', 'Advisory Services', 'Professional Services');
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

  /**
   * Extract communication intent from messages
   * @private
   */
  static extractMessageIntent(message) {
    if (!message) return null;

    const text = message.toLowerCase();
    const intents = [];

    // Professional networking
    if (text.includes('connect') || text.includes('network') || text.includes('collaboration')) {
      intents.push('Professional Networking');
    }

    // Business opportunities
    if (text.includes('opportunity') || text.includes('partnership') || text.includes('business')) {
      intents.push('Business Opportunity');
    }

    // Technical discussions
    if (text.includes('technical') || text.includes('engineering') || text.includes('development')) {
      intents.push('Technical Discussion');
    }

    // Advice/mentorship
    if (text.includes('advice') || text.includes('mentor') || text.includes('guidance')) {
      intents.push('Mentorship or Advice');
    }

    return intents.length > 0 ? intents.join(', ') : null;
  }

  /**
   * Build basic semantic profile for premium tier
   * @private
   */
  static buildSemanticProfile(contact) {
    const profile = [];

    // Company-based inference
    if (contact.company) {
      const company = contact.company.toLowerCase();

      // Tech companies
      if (SEMANTIC_ENHANCEMENT.TECH_COMPANIES.some(tech => company.includes(tech))) {
        profile.push('Technology Professional');
      }

      // Consulting
      if (SEMANTIC_ENHANCEMENT.CONSULTING_FIRMS.some(firm => company.includes(firm))) {
        profile.push('Management Consultant');
      }

      // Finance
      if (SEMANTIC_ENHANCEMENT.FINANCIAL_FIRMS.some(firm => company.includes(firm))) {
        profile.push('Finance Professional');
      }
    }

    // Job title inference
    if (contact.jobTitle) {
      const title = contact.jobTitle.toLowerCase();
      if (title.includes('founder')) profile.push('Entrepreneur');
      if (title.includes('engineer')) profile.push('Engineering Professional');
      if (title.includes('manager') || title.includes('director')) profile.push('Leadership Role');
    }

    return profile.length > 0 ? profile.join(', ') : null;
  }

  /**
   * Build comprehensive semantic profile for business+ tier
   * @private
   */
  static buildComprehensiveSemanticProfile(contact) {
    const profile = [];

    // Combine all available information
    const allText = [
      contact.name,
      contact.jobTitle,
      contact.company,
      contact.notes,
      contact.message
    ].filter(Boolean).join(' ').toLowerCase();

    // Check for professional categories from constants
    Object.entries(SEMANTIC_ENHANCEMENT.PROFESSIONAL_CATEGORIES).forEach(([category, keywords]) => {
      if (keywords.some(keyword => allText.includes(keyword))) {
        profile.push(category);
      }
    });

    // Industry detection from constants
    Object.entries(SEMANTIC_ENHANCEMENT.INDUSTRY_CATEGORIES).forEach(([industry, keywords]) => {
      if (keywords.some(keyword => allText.includes(keyword))) {
        profile.push(`${industry} Professional`);
      }
    });

    return profile.length > 0 ? profile.join(', ') : null;
  }
}
