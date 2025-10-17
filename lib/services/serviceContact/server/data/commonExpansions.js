// lib/services/serviceContact/server/data/commonExpansions.js
// Common query expansions for instant cache hits
// Separated from service logic for easier maintenance and expansion

/**
 * Static cache for common business terms
 * Provides instant responses for frequently searched terms
 * 
 * Format:
 * {
 *   'searchTerm': {
 *     enhancedQuery: 'expanded terms with synonyms',
 *     language: 'language code (eng, fra, spa, etc.)',
 *     cached: true
 *   }
 * }
 */
export const COMMON_EXPANSIONS = {
  // ============================================================================
  // EXECUTIVE ROLES - ENGLISH
  // ============================================================================
  'CEO': {
    enhancedQuery: 'CEO, Chief Executive Officer, President, Managing Director, Executive Director, Company Leader',
    language: 'eng',
    cached: true
  },
  'CTO': {
    enhancedQuery: 'CTO, Chief Technology Officer, VP Engineering, Head of Technology, Tech Lead, Technology Director',
    language: 'eng',
    cached: true
  },
  'CFO': {
    enhancedQuery: 'CFO, Chief Financial Officer, Finance Director, VP Finance, Financial Controller',
    language: 'eng',
    cached: true
  },
  'COO': {
    enhancedQuery: 'COO, Chief Operating Officer, VP Operations, Operations Director',
    language: 'eng',
    cached: true
  },
  'CMO': {
    enhancedQuery: 'CMO, Chief Marketing Officer, VP Marketing, Marketing Director, Head of Marketing',
    language: 'eng',
    cached: true
  },
  'CISO': {
    enhancedQuery: 'CISO, Chief Information Security Officer, Security Director, Head of Security, VP Security',
    language: 'eng',
    cached: true
  },
  'CIO': {
    enhancedQuery: 'CIO, Chief Information Officer, IT Director, Head of IT, VP Information Technology',
    language: 'eng',
    cached: true
  },
  'CPO': {
    enhancedQuery: 'CPO, Chief Product Officer, VP Product, Product Director, Head of Product',
    language: 'eng',
    cached: true
  },
  'CHRO': {
    enhancedQuery: 'CHRO, Chief Human Resources Officer, HR Director, VP Human Resources, People Director',
    language: 'eng',
    cached: true
  },
  'CDO': {
    enhancedQuery: 'CDO, Chief Data Officer, Data Director, Head of Data, VP Data',
    language: 'eng',
    cached: true
  },

  // ============================================================================
  // EXECUTIVE ROLES - FRENCH
  // ============================================================================
  'PDG': {
    enhancedQuery: 'PDG, Président Directeur Général, CEO, Directeur Général, Dirigeant, Chef d\'entreprise',
    language: 'fra',
    cached: true
  },
  'DG': {
    enhancedQuery: 'DG, Directeur Général, General Manager, Managing Director, Directeur',
    language: 'fra',
    cached: true
  },
  'DAF': {
    enhancedQuery: 'DAF, Directeur Administratif et Financier, CFO, Directeur Financier',
    language: 'fra',
    cached: true
  },
  'DRH': {
    enhancedQuery: 'DRH, Directeur des Ressources Humaines, CHRO, Responsable RH, HR Director',
    language: 'fra',
    cached: true
  },
  'DSI': {
    enhancedQuery: 'DSI, Directeur des Systèmes d\'Information, CIO, IT Director, Responsable Informatique',
    language: 'fra',
    cached: true
  },

  // ============================================================================
  // COMMON ROLES - ENGLISH
  // ============================================================================
  'founder': {
    enhancedQuery: 'Founder, Co-Founder, Startup Founder, Entrepreneur, Business Owner, Company Founder',
    language: 'eng',
    cached: true
  },
  'engineer': {
    enhancedQuery: 'Engineer, Software Engineer, Developer, Programmer, Software Developer, Tech Engineer',
    language: 'eng',
    cached: true
  },
  'manager': {
    enhancedQuery: 'Manager, Project Manager, Team Lead, Department Manager, Program Manager',
    language: 'eng',
    cached: true
  },
  'developer': {
    enhancedQuery: 'Developer, Software Developer, Engineer, Programmer, Coder, Software Engineer',
    language: 'eng',
    cached: true
  },
  'designer': {
    enhancedQuery: 'Designer, UX Designer, UI Designer, Product Designer, Graphic Designer, Creative Designer',
    language: 'eng',
    cached: true
  },
  'analyst': {
    enhancedQuery: 'Analyst, Business Analyst, Data Analyst, Financial Analyst, Systems Analyst',
    language: 'eng',
    cached: true
  },
  'consultant': {
    enhancedQuery: 'Consultant, Business Consultant, Strategy Consultant, Management Consultant, Advisor',
    language: 'eng',
    cached: true
  },
  'director': {
    enhancedQuery: 'Director, Senior Director, Managing Director, Executive Director, Department Director',
    language: 'eng',
    cached: true
  },
  'VP': {
    enhancedQuery: 'VP, Vice President, Senior Vice President, Executive Vice President, SVP, EVP',
    language: 'eng',
    cached: true
  },
  'lead': {
    enhancedQuery: 'Lead, Team Lead, Tech Lead, Project Lead, Development Lead, Engineering Lead',
    language: 'eng',
    cached: true
  },

  // ============================================================================
  // COMMON ROLES - FRENCH
  // ============================================================================
  'fondateur': {
    enhancedQuery: 'Fondateur, Co-Fondateur, Entrepreneur, Créateur, Chef d\'entreprise, Founder',
    language: 'fra',
    cached: true
  },
  'ingénieur': {
    enhancedQuery: 'Ingénieur, Engineer, Développeur, Developer, Technicien, Ingénieur logiciel',
    language: 'fra',
    cached: true
  },
  'développeur': {
    enhancedQuery: 'Développeur, Developer, Programmeur, Ingénieur logiciel, Codeur, Software Engineer',
    language: 'fra',
    cached: true
  },
  'responsable': {
    enhancedQuery: 'Responsable, Manager, Chef de projet, Directeur, Team Lead, Superviseur',
    language: 'fra',
    cached: true
  },
  'directeur': {
    enhancedQuery: 'Directeur, Director, Manager, Responsable, Chef de service, Dirigeant',
    language: 'fra',
    cached: true
  },

  // ============================================================================
  // TECHNOLOGIES & DOMAINS
  // ============================================================================
  'AI': {
    enhancedQuery: 'AI, Artificial Intelligence, Machine Learning, ML, Deep Learning, Neural Networks',
    language: 'eng',
    cached: true
  },
  'blockchain': {
    enhancedQuery: 'Blockchain, Crypto, Web3, Cryptocurrency, DeFi, Distributed Ledger',
    language: 'eng',
    cached: true
  },
  'cloud': {
    enhancedQuery: 'Cloud, Cloud Computing, AWS, Azure, GCP, Cloud Infrastructure, SaaS',
    language: 'eng',
    cached: true
  },
  'data science': {
    enhancedQuery: 'Data Science, Data Analytics, Machine Learning, Big Data, Data Engineering, AI',
    language: 'eng',
    cached: true
  },
  'cybersecurity': {
    enhancedQuery: 'Cybersecurity, Security, InfoSec, Information Security, Network Security, Cyber Defense',
    language: 'eng',
    cached: true
  },
  'fintech': {
    enhancedQuery: 'Fintech, Financial Technology, Digital Banking, Payments, Finance Innovation, Banking Tech',
    language: 'eng',
    cached: true
  },
  'marketing': {
    enhancedQuery: 'Marketing, Digital Marketing, Growth Marketing, Marketing Strategy, Brand Marketing, Content Marketing',
    language: 'eng',
    cached: true
  },
  'sales': {
    enhancedQuery: 'Sales, Business Development, Account Manager, Sales Manager, Commercial, Revenue',
    language: 'eng',
    cached: true
  },
  'product': {
    enhancedQuery: 'Product, Product Manager, Product Management, Product Development, Product Strategy',
    language: 'eng',
    cached: true
  },
  'startup': {
    enhancedQuery: 'Startup, Tech Startup, Entrepreneur, Early Stage, Venture, Innovation',
    language: 'eng',
    cached: true
  },

  // ============================================================================
  // PROGRAMMING LANGUAGES & FRAMEWORKS
  // ============================================================================
  'javascript': {
    enhancedQuery: 'JavaScript, JS, Node.js, React, Vue, Angular, TypeScript, Frontend, Backend',
    language: 'eng',
    cached: true
  },
  'python': {
    enhancedQuery: 'Python, Django, Flask, Data Science, Machine Learning, Backend, Automation',
    language: 'eng',
    cached: true
  },
  'java': {
    enhancedQuery: 'Java, Spring, Spring Boot, Enterprise, Backend, J2EE, Android',
    language: 'eng',
    cached: true
  },
  'react': {
    enhancedQuery: 'React, React.js, ReactJS, Frontend, JavaScript, Web Development, UI Development',
    language: 'eng',
    cached: true
  },
  'nodejs': {
    enhancedQuery: 'Node.js, NodeJS, JavaScript, Backend, Express, API Development, Server-side',
    language: 'eng',
    cached: true
  },

  // ============================================================================
  // INDUSTRIES
  // ============================================================================
  'healthcare': {
    enhancedQuery: 'Healthcare, Health Tech, Medical, Pharma, Biotech, Digital Health, MedTech',
    language: 'eng',
    cached: true
  },
  'ecommerce': {
    enhancedQuery: 'E-commerce, Online Retail, Digital Commerce, Retail Tech, Shopping, Marketplace',
    language: 'eng',
    cached: true
  },
  'education': {
    enhancedQuery: 'Education, EdTech, E-Learning, Online Learning, Training, Academic, Teaching',
    language: 'eng',
    cached: true
  },
  'real estate': {
    enhancedQuery: 'Real Estate, Property, PropTech, Housing, Construction, Commercial Real Estate',
    language: 'eng',
    cached: true
  },
  'logistics': {
    enhancedQuery: 'Logistics, Supply Chain, Transportation, Delivery, Warehouse, Distribution',
    language: 'eng',
    cached: true
  }
};
