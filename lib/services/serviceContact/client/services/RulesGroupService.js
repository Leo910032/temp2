// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////
// lib/services/serviceContact/client/services/RulesGroupService.js
// Complete client-side service for rules-based group generation with all functionality restored

"use client"
import { BaseContactService } from '../abstractions/BaseContactService';
import { ContactApiClient } from '../core/contactApiClient';

export class RulesGroupService extends BaseContactService {
  constructor() {
    super('RulesGroupService');
  }

  /**
   * Generate groups using rules-based logic (fast, synchronous)
   */
  async generateRulesBasedGroups(options = {}) {
    console.log("📋 [Client Service] Starting rules-based group generation", { options });
    
    try {
      const result = await ContactApiClient.post(
        '/api/user/contacts/groups/generate-rules-based',
        { options },
        { timeout: 30000 } // 30 second timeout (much faster than AI)
      );
      
      console.log("✅ [Client Service] Rules-based generation completed:", result);
      return result;
    } catch (error) {
      console.error("❌ [Client Service] Rules-based generation failed:", error);
      throw error;
    }
  }

  /**
   * Get available rules-based options for current subscription
   */
  getAvailableRulesOptions(subscriptionLevel = 'base') {
    const level = subscriptionLevel.toLowerCase();
    
    // Rules-based features are available for Pro+ (no Premium requirement)
    if (['pro', 'premium', 'business', 'enterprise'].includes(level)) {
      return {
        groupByCompany: true,
        groupByTime: true,
        groupByLocation: true,
        groupByEvents: true,
        maxGroups: level === 'enterprise' ? 50 : 20,
        minGroupSize: { min: 2, max: 10, default: 2 },
        upgradeRequired: false
      };
    }
    
    return {
      groupByCompany: false,
      groupByTime: false,
      groupByLocation: false,
      groupByEvents: false,
      maxGroups: 0,
      minGroupSize: { min: 2, max: 2, default: 2 },
      upgradeRequired: true,
      requiredLevel: 'pro'
    };
  }

  /**
   * Estimate processing time for rules-based generation
   */
  estimateProcessingTime(contactCount) {
    // Rules-based is much faster than AI
    if (contactCount < 50) return '1-2 seconds';
    if (contactCount < 200) return '2-3 seconds';
    if (contactCount < 500) return '3-5 seconds';
    if (contactCount < 1000) return '5-8 seconds';
    return '8-15 seconds';
  }

  /**
   * Get rules-based feature descriptions
   */
  getRulesFeatureDescriptions() {
    return {
      groupByCompany: {
        name: 'Company Grouping',
        description: 'Groups contacts by company name and business email domains',
        method: 'Text matching and email domain analysis',
        speed: 'Instant',
        accuracy: 'High for exact matches',
        icon: '🏢',
        details: [
          'Matches explicit company names',
          'Analyzes business email domains',
          'Excludes personal email providers',
          'Merges related company groups'
        ]
      },
      groupByTime: {
        name: 'Time-Based Grouping', 
        description: 'Groups contacts added during the same time periods',
        method: 'Submission timestamp analysis',
        speed: 'Instant',
        accuracy: 'High for event detection',
        icon: '⏰',
        details: [
          'Detects contacts added on same day',
          'Identifies 3-hour submission windows',
          'Perfect for conference/event contacts',
          'Handles timezone variations'
        ]
      },
      groupByLocation: {
        name: 'Location Grouping',
        description: 'Groups contacts by geographic proximity',
        method: 'Coordinate clustering',
        speed: 'Instant',
        accuracy: 'Medium (depends on GPS precision)',
        icon: '📍',
        details: [
          'Clusters nearby coordinates (~500m)',
          'Works with GPS data from forms',
          'Identifies venue-based groups',
          'Calculates group radius automatically'
        ]
      },
      groupByEvents: {
        name: 'Event Detection',
        description: 'Detects rapid contact additions (networking events)',
        method: 'Pattern analysis of submission timing',
        speed: 'Instant', 
        accuracy: 'Medium to High',
        icon: '📅',
        details: [
          'Finds rapid submission patterns',
          'Detects networking events',
          'Identifies conference attendees',
          'Analyzes submission velocity'
        ]
      }
    };
  }

  /**
   * Compare rules vs AI features
   */
  getFeatureComparison() {
    return {
      processing: {
        rules: 'Immediate (1-5 seconds)',
        ai: 'Background job (30-180 seconds)'
      },
      cost: {
        rules: 'Free',
        ai: 'Usage-based pricing ($0.001-0.02 per contact)'
      },
      subscription: {
        rules: 'Pro+ required',
        ai: 'Premium+ required'  
      },
      groupQuality: {
        rules: 'Good (pattern-based)',
        ai: 'Excellent (AI-enhanced)'
      },
      features: {
        rules: [
          'Company name matching', 
          'Email domain analysis', 
          'Time pattern detection', 
          'Location clustering',
          'Event detection'
        ],
        ai: [
          'Smart company matching', 
          'Industry detection', 
          'Relationship analysis', 
          'Deep contextual insights',
          'Advanced entity recognition'
        ]
      },
      limitations: {
        rules: [
          'Requires exact name matches',
          'Limited to business email domains',
          'Basic location clustering',
          'Simple time windows'
        ],
        ai: [
          'Costs money per operation',
          'Requires internet connection',
          'Monthly usage limits',
          'Longer processing time'
        ]
      }
    };
  }

  /**
   * Get rules-based grouping strategies and tips
   */
  getGroupingStrategies() {
    return {
      companyStrategy: {
        title: 'Company Grouping Strategy',
        description: 'Maximize company group detection',
        tips: [
          'Ensure contacts have company names filled in',
          'Use consistent company naming (avoid abbreviations)',
          'Business email addresses improve detection',
          'Clean up company names before grouping'
        ],
        bestFor: ['B2B networking', 'Conference attendees', 'Industry events']
      },
      timeStrategy: {
        title: 'Time-Based Strategy',
        description: 'Detect event-based contact additions',
        tips: [
          'Best for contacts added during events',
          'Works well with rapid form submissions',
          'Ideal for conference/networking scenarios',
          'Groups contacts within 3-hour windows'
        ],
        bestFor: ['Conferences', 'Networking events', 'Trade shows', 'Meetups']
      },
      locationStrategy: {
        title: 'Location Strategy',
        description: 'Group contacts by geographic proximity',
        tips: [
          'Requires location data from contact forms',
          'Works best with GPS-enabled submissions',
          'Groups contacts within ~500m radius',
          'Perfect for venue-based events'
        ],
        bestFor: ['Local events', 'Venue-based networking', 'Regional conferences']
      },
      eventStrategy: {
        title: 'Event Detection Strategy',
        description: 'Identify rapid contact addition patterns',
        tips: [
          'Detects burst patterns in submissions',
          'Identifies networking event timeframes',
          'Works across multiple days',
          'Finds conference-style contact exchanges'
        ],
        bestFor: ['Multi-day conferences', 'Rapid networking', 'Speed networking events']
      }
    };
  }

  /**
   * Validate rules-based grouping options
   */
  validateGroupingOptions(options, subscriptionLevel = 'base') {
    const errors = [];
    const warnings = [];
    const availableOptions = this.getAvailableRulesOptions(subscriptionLevel);

    // Check subscription requirements
    if (availableOptions.upgradeRequired) {
      errors.push({
        field: 'subscription',
        message: `Rules-based grouping requires ${availableOptions.requiredLevel} subscription or higher`,
        code: 'SUBSCRIPTION_REQUIRED'
      });
      return { isValid: false, errors, warnings };
    }

    // Validate individual options
    if (options.groupByCompany && !availableOptions.groupByCompany) {
      errors.push({
        field: 'groupByCompany',
        message: 'Company grouping not available in current subscription',
        code: 'FEATURE_NOT_AVAILABLE'
      });
    }

    if (options.groupByTime && !availableOptions.groupByTime) {
      errors.push({
        field: 'groupByTime',
        message: 'Time-based grouping not available in current subscription',
        code: 'FEATURE_NOT_AVAILABLE'
      });
    }

    if (options.groupByLocation && !availableOptions.groupByLocation) {
      errors.push({
        field: 'groupByLocation',
        message: 'Location grouping not available in current subscription',
        code: 'FEATURE_NOT_AVAILABLE'
      });
    }

    if (options.groupByEvents && !availableOptions.groupByEvents) {
      errors.push({
        field: 'groupByEvents',
        message: 'Event detection not available in current subscription',
        code: 'FEATURE_NOT_AVAILABLE'
      });
    }

    // Validate numeric options
    if (options.minGroupSize !== undefined) {
      const min = availableOptions.minGroupSize.min;
      const max = availableOptions.minGroupSize.max;
      
      if (options.minGroupSize < min || options.minGroupSize > max) {
        errors.push({
          field: 'minGroupSize',
          message: `Minimum group size must be between ${min} and ${max}`,
          code: 'INVALID_RANGE'
        });
      }
    }

    if (options.maxGroups !== undefined) {
      if (options.maxGroups > availableOptions.maxGroups) {
        warnings.push({
          field: 'maxGroups',
          message: `Maximum groups will be limited to ${availableOptions.maxGroups} for your subscription`,
          code: 'VALUE_CAPPED'
        });
      }
    }

    // Check if at least one grouping method is selected
    const hasAnyMethod = options.groupByCompany || options.groupByTime || 
                        options.groupByLocation || options.groupByEvents;
    
    if (!hasAnyMethod) {
      errors.push({
        field: 'methods',
        message: 'At least one grouping method must be selected',
        code: 'NO_METHODS_SELECTED'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get recommended options based on contact data analysis
   */
  getRecommendedOptions(contacts = []) {
    const analysis = this.analyzeContactDataForRecommendations(contacts);
    const recommendations = {
      groupByCompany: false,
      groupByTime: false,
      groupByLocation: false,
      groupByEvents: false,
      minGroupSize: 2,
      maxGroups: 15,
      reasoning: []
    };

    // Company grouping recommendation
    if (analysis.contactsWithCompany > contacts.length * 0.3) {
      recommendations.groupByCompany = true;
      recommendations.reasoning.push({
        method: 'groupByCompany',
        reason: `${analysis.contactsWithCompany} contacts (${Math.round(analysis.contactsWithCompany/contacts.length*100)}%) have company information`,
        confidence: 'high'
      });
    }

    // Time-based grouping recommendation
    if (analysis.hasRecentBurstActivity) {
      recommendations.groupByTime = true;
      recommendations.reasoning.push({
        method: 'groupByTime',
        reason: 'Detected rapid contact additions suggesting event-based submissions',
        confidence: 'high'
      });
    }

    // Location grouping recommendation
    if (analysis.contactsWithLocation > Math.max(contacts.length * 0.2, 5)) {
      recommendations.groupByLocation = true;
      recommendations.reasoning.push({
        method: 'groupByLocation',
        reason: `${analysis.contactsWithLocation} contacts have location data`,
        confidence: analysis.contactsWithLocation > contacts.length * 0.5 ? 'high' : 'medium'
      });
    }

    // Event detection recommendation
    if (analysis.hasTimePatterns) {
      recommendations.groupByEvents = true;
      recommendations.reasoning.push({
        method: 'groupByEvents',
        reason: 'Time patterns suggest networking events or conferences',
        confidence: 'medium'
      });
    }

    // Adjust group size based on total contacts
    if (contacts.length < 20) {
      recommendations.minGroupSize = 2;
    } else if (contacts.length < 100) {
      recommendations.minGroupSize = 3;
    } else {
      recommendations.minGroupSize = 4;
    }

    return recommendations;
  }

  /**
   * Analyze contact data to provide grouping recommendations
   */
  analyzeContactDataForRecommendations(contacts) {
    const analysis = {
      totalContacts: contacts.length,
      contactsWithCompany: 0,
      contactsWithLocation: 0,
      contactsWithBusinessEmail: 0,
      hasRecentBurstActivity: false,
      hasTimePatterns: false,
      submissionTimeSpread: 0
    };

    if (contacts.length === 0) return analysis;

    // Analyze company data
    analysis.contactsWithCompany = contacts.filter(c => 
      c.company && c.company.trim().length > 0
    ).length;

    // Analyze location data
    analysis.contactsWithLocation = contacts.filter(c => 
      c.location?.latitude && c.location?.longitude
    ).length;

    // Analyze email domains
    analysis.contactsWithBusinessEmail = contacts.filter(c => {
      if (!c.email) return false;
      const domain = c.email.split('@')[1]?.toLowerCase();
      const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
      return domain && !personalDomains.includes(domain);
    }).length;

    // Analyze submission timing
    const timestamps = contacts
      .filter(c => c.submittedAt || c.createdAt)
      .map(c => new Date(c.submittedAt || c.createdAt).getTime())
      .sort((a, b) => a - b);

    if (timestamps.length > 1) {
      analysis.submissionTimeSpread = (timestamps[timestamps.length - 1] - timestamps[0]) / (1000 * 60 * 60 * 24); // days

      // Check for burst activity (many contacts in short time)
      let burstCount = 0;
      for (let i = 1; i < timestamps.length; i++) {
        const timeDiff = (timestamps[i] - timestamps[i-1]) / (1000 * 60 * 60); // hours
        if (timeDiff <= 4) { // Within 4 hours
          burstCount++;
        }
      }
      analysis.hasRecentBurstActivity = burstCount > Math.max(contacts.length * 0.3, 3);

      // Check for time patterns
      const hourCounts = {};
      timestamps.forEach(timestamp => {
        const hour = new Date(timestamp).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });
      
      const maxHourCount = Math.max(...Object.values(hourCounts));
      analysis.hasTimePatterns = maxHourCount > Math.max(contacts.length * 0.2, 3);
    }

    return analysis;
  }

  /**
   * Get success metrics and statistics for rules-based grouping
   */
  calculateSuccessMetrics(groupingResult, originalContacts) {
    if (!groupingResult || !groupingResult.success) {
      return {
        success: false,
        error: 'Grouping failed'
      };
    }

    const groups = groupingResult.groups || [];
    const metrics = {
      totalGroups: groups.length,
      totalContactsGrouped: 0,
      averageGroupSize: 0,
      groupingRate: 0,
      groupsByType: {},
      largestGroup: null,
      smallestGroup: null,
      processingTime: groupingResult.stats?.processingTimeMs || 0,
      efficiency: 'excellent' // Rules-based is always efficient
    };

    if (groups.length === 0) {
      metrics.groupingRate = 0;
      return metrics;
    }

    // Calculate grouped contacts
    const groupedContactIds = new Set();
    groups.forEach(group => {
      group.contactIds.forEach(id => groupedContactIds.add(id));
    });
    metrics.totalContactsGrouped = groupedContactIds.size;

    // Calculate grouping rate
    metrics.groupingRate = originalContacts.length > 0 
      ? Math.round((metrics.totalContactsGrouped / originalContacts.length) * 100)
      : 0;

    // Calculate average group size
    const groupSizes = groups.map(g => g.contactIds.length);
    metrics.averageGroupSize = groupSizes.length > 0
      ? Math.round((groupSizes.reduce((a, b) => a + b, 0) / groupSizes.length) * 10) / 10
      : 0;

    // Find largest and smallest groups
    if (groupSizes.length > 0) {
      const maxSize = Math.max(...groupSizes);
      const minSize = Math.min(...groupSizes);
      
      metrics.largestGroup = {
        size: maxSize,
        name: groups.find(g => g.contactIds.length === maxSize)?.name
      };
      
      metrics.smallestGroup = {
        size: minSize,
        name: groups.find(g => g.contactIds.length === minSize)?.name
      };
    }

    // Group by type
    groups.forEach(group => {
      const type = group.type || 'unknown';
      metrics.groupsByType[type] = (metrics.groupsByType[type] || 0) + 1;
    });

    return metrics;
  }
}