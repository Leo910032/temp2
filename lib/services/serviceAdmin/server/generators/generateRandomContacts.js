// lib/services/serviceAdmin/server/generators/generateRandomContacts.js
// Random Contact Generator - FIXED: Notes now match contact's actual company
// ✅ BUG FIX: All notes now use {COMPANY} and {JOB_TITLE} placeholders

// ✅ REAL EVENT LOCATIONS (unchanged)
const EVENT_LOCATIONS = [
    {
        name: 'CES 2024',
        location: { latitude: 36.1316, longitude: -115.1536 },
        venue: 'Las Vegas Convention Center',
        address: '3150 Paradise Rd, Las Vegas, NV 89109',
        dates: 'January 9-12, 2024',
        type: 'tech_conference'
    },
    {
        name: 'CES 2025',
        location: { latitude: 36.1316, longitude: -115.1536 },
        venue: 'Las Vegas Convention Center',
        address: '3150 Paradise Rd, Las Vegas, NV 89109',
        dates: 'January 7-10, 2025',
        type: 'tech_conference'
    },
    {
        name: 'AWS re:Invent 2024',
        location: { latitude: 36.1215, longitude: -115.1739 },
        venue: 'The Venetian Resort',
        address: '3355 S Las Vegas Blvd, Las Vegas, NV 89109',
        dates: 'December 2-6, 2024',
        type: 'cloud_conference'
    },
    {
        name: 'AWS re:Invent 2024',
        location: { latitude: 36.0955, longitude: -115.1761 },
        venue: 'Mandalay Bay',
        address: '3950 S Las Vegas Blvd, Las Vegas, NV 89119',
        dates: 'December 2-6, 2024',
        type: 'cloud_conference'
    },
    {
        name: 'AWS re:Invent 2024',
        location: { latitude: 36.1023, longitude: -115.1697 },
        venue: 'MGM Grand',
        address: '3799 S Las Vegas Blvd, Las Vegas, NV 89109',
        dates: 'December 2-6, 2024',
        type: 'cloud_conference'
    },
    {
        name: 'SXSW 2024',
        location: { latitude: 30.2635, longitude: -97.7393 },
        venue: 'Austin Convention Center',
        address: '500 E Cesar Chavez St, Austin, TX 78701',
        dates: 'March 8-16, 2024',
        type: 'tech_creative_conference'
    },
    {
        name: 'SXSW 2025',
        location: { latitude: 30.2635, longitude: -97.7393 },
        venue: 'Austin Convention Center',
        address: '500 E Cesar Chavez St, Austin, TX 78701',
        dates: 'March 7-15, 2025',
        type: 'tech_creative_conference'
    },
    {
        name: 'RSA Conference 2024',
        location: { latitude: 37.7845, longitude: -122.4014 },
        venue: 'Moscone Center',
        address: '747 Howard St, San Francisco, CA 94103',
        dates: 'May 6-9, 2024',
        type: 'security_conference'
    },
    {
        name: 'RSA Conference 2025',
        location: { latitude: 37.7845, longitude: -122.4014 },
        venue: 'Moscone Center',
        address: '747 Howard St, San Francisco, CA 94103',
        dates: 'April 28 - May 1, 2025',
        type: 'security_conference'
    },
    {
        name: 'Cisco Live 2024',
        location: { latitude: 36.1316, longitude: -115.1536 },
        venue: 'Las Vegas Convention Center',
        address: '3150 Paradise Rd, Las Vegas, NV 89109',
        dates: 'June 2-6, 2024',
        type: 'networking_conference'
    },
    {
        name: 'Cisco Live 2025',
        location: { latitude: 36.1083, longitude: -115.1751 },
        venue: 'Mandalay Bay',
        address: '3950 S Las Vegas Blvd, Las Vegas, NV 89119',
        dates: 'June 8-12, 2025',
        type: 'networking_conference'
    },
    {
        name: 'Dell Technologies World 2024',
        location: { latitude: 36.1316, longitude: -115.1536 },
        venue: 'Las Vegas Convention Center',
        address: '3150 Paradise Rd, Las Vegas, NV 89109',
        dates: 'May 20-23, 2024',
        type: 'enterprise_conference'
    },
    {
        name: 'Dell Technologies World 2025',
        location: { latitude: 36.1316, longitude: -115.1536 },
        venue: 'Las Vegas Convention Center',
        address: '3150 Paradise Rd, Las Vegas, NV 89109',
        dates: 'May 19-22, 2025',
        type: 'enterprise_conference'
    },
    {
        name: 'VMware Explore 2024',
        location: { latitude: 36.1316, longitude: -115.1536 },
        venue: 'Las Vegas Convention Center',
        address: '3150 Paradise Rd, Las Vegas, NV 89109',
        dates: 'August 26-29, 2024',
        type: 'virtualization_conference'
    },
    {
        name: 'Microsoft Ignite 2024',
        location: { latitude: 41.8781, longitude: -87.6298 },
        venue: 'McCormick Place',
        address: '2301 S Dr Martin Luther King Jr Dr, Chicago, IL 60616',
        dates: 'November 19-22, 2024',
        type: 'microsoft_conference'
    },
    {
        name: 'Adobe Summit 2024',
        location: { latitude: 36.1316, longitude: -115.1536 },
        venue: 'Las Vegas Convention Center',
        address: '3150 Paradise Rd, Las Vegas, NV 89109',
        dates: 'March 25-28, 2024',
        type: 'marketing_conference'
    },
    {
        name: 'Google I/O 2024',
        location: { latitude: 37.4267, longitude: -122.0802 },
        venue: 'Shoreline Amphitheatre',
        address: '1 Amphitheatre Pkwy, Mountain View, CA 94043',
        dates: 'May 14-15, 2024',
        type: 'developer_conference'
    },
    {
        name: 'Dreamforce 2025',
        location: { latitude: 37.7845, longitude: -122.4014 },
        venue: 'Salesforce Tower, San Francisco',
        address: '415 Mission St, San Francisco, CA 94105',
        dates: 'September 16-18, 2025',
        type: 'crm_conference'
    },
    {
        name: 'Oracle CloudWorld 2024',
        location: { latitude: 36.1316, longitude: -115.1536 },
        venue: 'Las Vegas Convention Center',
        address: '3150 Paradise Rd, Las Vegas, NV 89109',
        dates: 'September 9-12, 2024',
        type: 'database_conference'
    }
];

// ✅ REALISTIC TECH COMPANIES (unchanged)
const TECH_COMPANIES = [
    'Google', 'Microsoft', 'Apple', 'Amazon', 'Meta', 'Netflix', 'Tesla',
    'Adobe', 'Salesforce', 'Oracle', 'SAP', 'IBM', 'Intel', 'NVIDIA',
    'Cisco', 'Dell Technologies', 'HPE', 'VMware', 'ServiceNow', 'Workday',
    'AWS', 'Azure', 'Snowflake', 'Databricks', 'MongoDB', 'Redis',
    'Cloudflare', 'Fastly', 'Twilio', 'Stripe', 'Square', 'PayPal',
    'Zoom', 'Slack', 'Atlassian', 'Jira', 'Confluence', 'GitHub',
    'OpenAI', 'Anthropic', 'Hugging Face', 'Stability AI', 'Cohere',
    'DataDog', 'New Relic', 'Splunk', 'Elastic', 'Docker', 'Kubernetes',
    'Terraform', 'Ansible', 'Jenkins', 'GitLab', 'Bitbucket',
    'Accenture', 'Deloitte', 'McKinsey Digital', 'Boston Consulting Group',
    'KPMG Technology', 'PwC Digital', 'Cognizant', 'Infosys', 'TCS',
    'Capgemini', 'Wipro', 'HCL Technologies', 'Tech Mahindra',
    'Palantir', 'Unity Technologies', 'Epic Games', 'Roblox', 'Discord',
    'Spotify', 'Uber', 'Lyft', 'Airbnb', 'DoorDash', 'Instacart',
    'Shopify', 'Squarespace', 'SpaceX', 'Blue Origin', 'Relativity Space',
    'Planet Labs', 'Cruise', 'Waymo', 'Aurora', 'Rivian', 'Lucid Motors',
    'Coinbase', 'Binance', 'Chainlink', 'Polygon'
];

// ✅ REALISTIC JOB TITLES (unchanged)
const JOB_TITLES = [
    'Software Engineer', 'Senior Software Engineer', 'Staff Software Engineer',
    'Principal Software Engineer', 'Engineering Manager', 'Senior Engineering Manager',
    'VP of Engineering', 'CTO', 'Technical Lead', 'Team Lead',
    'Frontend Developer', 'Backend Developer', 'Full Stack Developer',
    'DevOps Engineer', 'Site Reliability Engineer', 'Platform Engineer',
    'Cloud Engineer', 'Cloud Architect', 'Solutions Architect',
    'Data Engineer', 'Data Scientist', 'ML Engineer', 'AI Engineer',
    'Security Engineer', 'Cybersecurity Analyst', 'Security Architect',
    'Product Manager', 'Senior Product Manager', 'VP of Product', 'CPO',
    'Product Owner', 'Product Designer', 'UX Designer', 'UI Designer',
    'UX Researcher', 'Design Director', 'Head of Design',
    'Sales Engineer', 'Solutions Consultant', 'Account Executive',
    'Sales Director', 'VP of Sales', 'Chief Revenue Officer',
    'Marketing Manager', 'Product Marketing Manager', 'Growth Manager',
    'Digital Marketing Specialist', 'Content Marketing Manager',
    'CEO', 'CTO', 'CIO', 'CISO', 'CFO', 'COO',
    'Technical Consultant', 'Solutions Consultant', 'Implementation Specialist',
    'Business Analyst', 'Systems Analyst', 'Project Manager',
    'Program Manager', 'Scrum Master', 'Agile Coach',
    'AI/ML Specialist', 'Blockchain Developer', 'Web3 Engineer',
    'Developer Advocate', 'Developer Relations', 'Technical Writer',
    'Customer Success Manager', 'Implementation Manager'
];

// ✅ NAMES, PHONE, EMAIL (unchanged)
const FIRST_NAMES = [
    'Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Avery', 'Quinn',
    'Sarah', 'Emily', 'Jessica', 'Ashley', 'Amanda', 'Jennifer', 'Michelle', 'Lisa',
    'Michael', 'David', 'John', 'James', 'Robert', 'William', 'Christopher', 'Matthew',
    'Daniel', 'Andrew', 'Joshua', 'Nathan', 'Ryan', 'Brandon', 'Jason', 'Justin',
    'Priya', 'Raj', 'Amit', 'Anisha', 'Vikram', 'Neha', 'Arjun', 'Kavya',
    'Wei', 'Li', 'Zhang', 'Wang', 'Liu', 'Chen', 'Yang', 'Huang',
    'Maria', 'Jose', 'Luis', 'Carlos', 'Ana', 'Sofia', 'Diego', 'Isabella',
    'Aiden', 'Emma', 'Oliver', 'Charlotte', 'Lucas', 'Amelia', 'Mason', 'Harper',
    'Ethan', 'Evelyn', 'Sebastian', 'Abigail', 'Jack', 'Grace', 'Luke', 'Zoe'
];

const LAST_NAMES = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
    'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
    'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
    'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker',
    'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill',
    'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell',
    'Mitchell', 'Carter', 'Roberts', 'Phillips', 'Evans', 'Turner', 'Parker',
    'Patel', 'Sharma', 'Singh', 'Kumar', 'Agarwal', 'Gupta', 'Jain', 'Bansal',
    'Chen', 'Li', 'Wang', 'Zhang', 'Liu', 'Yang', 'Wu', 'Xu', 'Huang', 'Zhou',
    'Kim', 'Park', 'Lee', 'Choi', 'Jung', 'Kang', 'Yoon', 'Lim',
    'Ahmed', 'Khan', 'Ali', 'Hassan', 'Rahman', 'Ibrahim', 'Mohamed', 'Abdullah'
];

const PHONE_FORMATS = [
    '(###) ###-####',
    '###-###-####',
    '### ### ####',
    '+1 ### ### ####',
    '+1 (###) ###-####'
];

const EMAIL_DOMAINS = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
    'protonmail.com', 'company.com', 'work.co', 'tech.io', 'dev.org'
];

// ✅ FIXED NOTE TEMPLATES - Now use {COMPANY} and {JOB_TITLE} placeholders
const NOTE_TEMPLATES = {
    // Vector-optimized notes for semantic search testing
    vectorOptimized: {
        companyContext: [
            "Works at {COMPANY} - seems senior in cloud division",
            "{COMPANY} employee, mentioned Azure partnerships",
            "Works at {COMPANY} - specializes in container orchestration",
            "{COMPANY} employee, leads the platform engineering team",
            "Senior role at {COMPANY}, focuses on infrastructure automation",
            "{COMPANY} {JOB_TITLE}, working on next-generation cloud solutions"
        ],
        industrySpecific: [
            "Fintech startup founder, building payment solutions",
            "Healthcare AI company, FDA approval process",
            "Cybersecurity consultant, penetration testing",
            "Expert in container orchestration and cloud-native technologies",
            "Specializes in distributed systems and microservices architecture",
            "Leading edge AI research in natural language processing"
        ],
        professionalContext: [
            "Interested in our API services.",
            "Schedule a follow-up call next week.",
            "Sent them our latest whitepaper.",
            "Follow up regarding their new product launch.",
            "Potential for collaboration in Q3.",
            "Seems like a valuable connection for the future."
        ]
    },

    // Business intelligence notes
    businessIntelligence: {
        strategic: [
            "Key decision maker at {COMPANY} for enterprise software procurement. Budget cycle starts Q1.",
            "{JOB_TITLE} at {COMPANY}, evaluating new technology partnerships for H2 roadmap.",
            "Works at {COMPANY} in strategic initiatives. Strong relationship with CTO.",
            "{COMPANY} is exploring partnerships in our space. Follow up within 2 weeks."
        ],
        relationship: [
            "Introduced me to another {JOB_TITLE} at {COMPANY}",
            "Worked with team at {COMPANY} on previous project",
            "Vendor relationship with {COMPANY}, provides consulting services",
            "Client from Q3 project at {COMPANY}, very satisfied"
        ]
    },

    // General mixed notes
    mixed: [
        "Met at conference, great conversation about {COMPANY}'s tech stack.",
        "Works at {COMPANY} as {JOB_TITLE}. Interested in collaboration opportunities.",
        "{JOB_TITLE} at {COMPANY}, discussed industry trends.",
        "Impressive work at {COMPANY}! Looking forward to staying in touch.",
        "Interested in our API services.",
        "Schedule a follow-up call next week.",
        "Sent them our latest whitepaper.",
        "Seems like a valuable connection for the future."
    ]
};

// ✅ UTILITY FUNCTIONS (unchanged)
function randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function randomChoices(array, count) {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

function generatePhoneNumber() {
    const format = randomChoice(PHONE_FORMATS);
    return format.replace(/#/g, () => Math.floor(Math.random() * 10));
}

function generateEmail(firstName, lastName) {
    const domain = randomChoice(EMAIL_DOMAINS);
    const formats = [
        `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`,
        `${firstName.toLowerCase()}${lastName.toLowerCase()}@${domain}`,
        `${firstName.charAt(0).toLowerCase()}${lastName.toLowerCase()}@${domain}`,
        `${firstName.toLowerCase()}${Math.floor(Math.random() * 99)}@${domain}`
    ];
    return randomChoice(formats);
}

function addLocationNoise(baseLocation, radiusKm = 2) {
    const radiusDeg = radiusKm / 111;
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * radiusDeg;

    return {
        latitude: baseLocation.latitude + (Math.cos(angle) * distance),
        longitude: baseLocation.longitude + (Math.sin(angle) * distance),
        accuracy: Math.floor(Math.random() * 100) + 50,
        timestamp: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString()
    };
}

function generateRandomLocation() {
    const techHubs = [
        { latitude: 37.4419, longitude: -122.1430, name: 'Palo Alto, CA' },
        { latitude: 47.6062, longitude: -122.3321, name: 'Seattle, WA' },
        { latitude: 40.7484, longitude: -73.9857, name: 'New York, NY' },
        { latitude: 42.3601, longitude: -71.0589, name: 'Boston, MA' },
        { latitude: 30.2672, longitude: -97.7431, name: 'Austin, TX' },
        { latitude: 39.7392, longitude: -104.9903, name: 'Denver, CO' },
        { latitude: 33.4484, longitude: -112.0740, name: 'Phoenix, AZ' },
        { latitude: 25.7617, longitude: -80.1918, name: 'Miami, FL' }
    ];

    const hub = randomChoice(techHubs);
    return addLocationNoise(hub, 25);
}

function generateBusinessCardDetails() {
    const firstName = randomChoice(FIRST_NAMES);
    const lastName = randomChoice(LAST_NAMES);
    const company = randomChoice(TECH_COMPANIES);
    const jobTitle = randomChoice(JOB_TITLES);
    const phone = generatePhoneNumber();
    const email = generateEmail(firstName, lastName);

    const details = [
        { label: 'Name', value: `${firstName} ${lastName}`, type: 'standard' },
        { label: 'Email', value: email, type: 'standard' },
        { label: 'Phone', value: phone, type: 'standard' },
        { label: 'Company', value: company, type: 'standard' },
        { label: 'Job Title', value: jobTitle, type: 'custom' }
    ];

    const additionalDetails = [
        { label: 'Website', value: `https://www.${company.toLowerCase().replace(/\s+/g, '')}.com`, type: 'social' },
        { label: 'LinkedIn', value: `https://linkedin.com/in/${firstName.toLowerCase()}-${lastName.toLowerCase()}`, type: 'social' },
        { label: 'Twitter', value: `@${firstName.toLowerCase()}${lastName.toLowerCase()}`, type: 'social' },
        { label: 'Mobile', value: generatePhoneNumber(), type: 'standard' },
        { label: 'Office', value: generatePhoneNumber(), type: 'custom' },
        { label: 'Department', value: randomChoice(['Engineering', 'Product', 'Sales', 'Marketing', 'Operations']), type: 'custom' }
    ];

    const numAdditional = Math.floor(Math.random() * 3) + 1;
    const selectedAdditional = randomChoices(additionalDetails, numAdditional);

    return {
        firstName,
        lastName,
        company,
        jobTitle,
        phone,
        email,
        details: [...details, ...selectedAdditional]
    };
}

/**
 * ✅ FIXED: Generate notes that match the contact's actual company and job title
 * @param {string} scenario - The type of notes to generate
 * @param {string} complexity - The complexity level
 * @param {string} company - The contact's ACTUAL company name
 * @param {string} jobTitle - The contact's ACTUAL job title
 * @returns {string} A note with correct company/job title
 */
function generateContactNote(scenario = 'mixed', complexity = 'medium', company = 'Company', jobTitle = 'Professional') {
    let notePool = [];

    // Select appropriate note templates based on scenario
    if (scenario === 'vectorOptimized') {
        // Mix all vector-optimized templates
        notePool = [
            ...NOTE_TEMPLATES.vectorOptimized.companyContext,
            ...NOTE_TEMPLATES.vectorOptimized.industrySpecific,
            ...NOTE_TEMPLATES.vectorOptimized.professionalContext
        ];
    } else if (scenario === 'businessIntelligence') {
        notePool = [
            ...NOTE_TEMPLATES.businessIntelligence.strategic,
            ...NOTE_TEMPLATES.businessIntelligence.relationship
        ];
    } else if (scenario === 'semanticSearchStress' || scenario === 'vectorPerformance') {
        // Use rich, detailed notes for stress testing
        notePool = [
            ...NOTE_TEMPLATES.vectorOptimized.companyContext,
            ...NOTE_TEMPLATES.businessIntelligence.strategic
        ];
    } else {
        // Default mixed notes
        notePool = NOTE_TEMPLATES.mixed;
    }

    // Pick a random note template
    const noteTemplate = randomChoice(notePool);

    // ✅ CRITICAL FIX: Replace placeholders with ACTUAL contact data
    const finalNote = noteTemplate
        .replace(/{COMPANY}/g, company)
        .replace(/{JOB_TITLE}/g, jobTitle);

    return finalNote;
}

/**
 * Generate a single random contact
 * @param {Object} options - Generation options
 * @returns {Object} Generated contact object
 */
export function generateRandomContact(options = {}) {
    const {
        forceEventLocation = false,
        forceRandomLocation = false,
        eventProbability = 0.4,
        source = null,
        includeNotes = true,
        noteScenario = 'mixed',
        noteComplexity = 'medium',
        noteProbability = 0.7,
        includeMessages = false,
        messageProbability = 0.7,
        forceExchangeForm = false
    } = options;

    const businessCard = generateBusinessCardDetails();
    const submittedAt = new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString();

    let location = null;
    let locationEvent = null;
    let contactSource = source || randomChoice(['business_card_scan', 'exchange_form', 'manual']);

    if (forceExchangeForm || (includeMessages && Math.random() < messageProbability)) {
        contactSource = 'exchange_form';
    }

    const shouldHaveLocation = forceEventLocation || forceRandomLocation || Math.random() < 0.7;

    if (shouldHaveLocation) {
        if (forceEventLocation || (!forceRandomLocation && Math.random() < eventProbability)) {
            locationEvent = randomChoice(EVENT_LOCATIONS);
            location = addLocationNoise(locationEvent.location, 1);
            contactSource = forceExchangeForm ? 'exchange_form' : 'business_card_scan';
        } else {
            location = generateRandomLocation();
        }
    }

    const contact = {
        id: `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: `${businessCard.firstName} ${businessCard.lastName}`,
        email: businessCard.email,
        phone: businessCard.phone,
        company: businessCard.company,
        details: businessCard.details,
        status: randomChoice(['new', 'new', 'new', 'viewed', 'archived']),
        submittedAt: submittedAt,
        lastModified: submittedAt,
        source: contactSource
    };

    if (location) {
        contact.location = location;
    }

    // ✅ FIXED: Pass actual company and job title to note generator
    if (includeNotes && Math.random() < noteProbability) {
        contact.notes = generateContactNote(
            noteScenario,
            noteComplexity,
            businessCard.company,  // ← Pass ACTUAL company
            businessCard.jobTitle   // ← Pass ACTUAL job title
        );
        contact.hasNotes = true;
        contact.noteLength = contact.notes.length;
        contact.noteComplexity = noteComplexity;
        contact.noteScenario = noteScenario;
    }

    const shouldHaveMessage = includeMessages || contactSource === 'exchange_form';

    if (shouldHaveMessage) {
        contact.metadata = {
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
            referrer: 'https://networking-app.com/profile/tech-pro',
            sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            locationStatus: location ? 'granted' : 'denied',
            submissionTime: submittedAt,
            timezone: 'America/Los_Angeles',
            language: 'en-US'
        };

        const messages = [
            `Met at ${locationEvent?.name || 'networking event'}, excited to connect!`,
            'Great conversation about the future of tech!',
            'Looking forward to collaborating on projects.',
            'Nice meeting you at the conference.',
            'Let\'s stay in touch and explore synergies.',
            `Really enjoyed our discussion about ${randomChoice(['AI', 'cloud computing', 'cybersecurity', 'data analytics', 'mobile development'])}.`,
            'Hope to work together soon!',
            'Great insights on industry trends.',
            'Excited about potential collaboration.',
            'Thanks for the business card exchange!',
            'Looking forward to our follow-up.',
            `Impressive work at ${businessCard.company}!`,
            'Let\'s schedule a call next week.',
            'Valuable networking connection.',
            'Shared interesting perspectives on tech.'
        ];
        contact.message = randomChoice(messages);
    }

    if (locationEvent) {
        contact.eventInfo = {
            eventName: locationEvent.name,
            venue: locationEvent.venue,
            eventType: locationEvent.type,
            eventDates: locationEvent.dates
        };
    }

    return contact;
}

/**
 * Generate multiple random contacts
 */
export function generateRandomContacts(count, options = {}) {
    const contacts = [];
    const {
        eventPercentage = 0.4,
        locationPercentage = 0.7,
        includeNotes = false,
        noteScenario = 'mixed',
        noteComplexity = 'medium',
        noteProbability = 0.7,
        includeMessages = false,
        messageProbability = 1.0,
        forceExchangeForm = false,
        ...otherOptions
    } = options;

    for (let i = 0; i < count; i++) {
        const shouldBeFromEvent = Math.random() < eventPercentage;
        const shouldHaveLocation = Math.random() < locationPercentage;

        const contactOptions = {
            ...otherOptions,
            forceEventLocation: shouldBeFromEvent && shouldHaveLocation,
            forceRandomLocation: !shouldBeFromEvent && shouldHaveLocation,
            includeNotes,
            noteScenario,
            noteComplexity,
            noteProbability,
            includeMessages,
            messageProbability,
            forceExchangeForm
        };

        contacts.push(generateRandomContact(contactOptions));
    }

    return contacts;
}

/**
 * Generate contacts for tier testing
 */
export function generateContactsForTierTesting(tier, count = 50) {
    const tierConfigs = {
        'base': { includeNotes: true, noteProbability: 0.1, noteComplexity: 'basic' },
        'pro': { includeNotes: true, noteProbability: 0.3, noteComplexity: 'pro' },
        'premium': { includeNotes: true, noteProbability: 0.5, noteComplexity: 'premium' },
        'business': { includeNotes: true, noteProbability: 0.8, noteComplexity: 'business' },
        'enterprise': { includeNotes: true, noteProbability: 1.0, noteComplexity: 'strategic' }
    };

    const config = tierConfigs[tier] || tierConfigs['pro'];

    return generateRandomContacts(count, {
        eventPercentage: 0.6,
        locationPercentage: 0.8,
        ...config
    });
}

/**
 * Generate test dataset for AI
 */
export function generateAITestDataset() {
    const testSets = {
        companyMatching: generateRandomContacts(25, {
            includeNotes: true,
            noteScenario: 'vectorOptimized',
            noteComplexity: 'pro',
            noteProbability: 1.0,
            eventPercentage: 0.3,
            locationPercentage: 0.6
        }),

        industryDetection: generateRandomContacts(30, {
            includeNotes: true,
            noteScenario: 'vectorOptimized',
            noteComplexity: 'premium',
            noteProbability: 1.0,
            eventPercentage: 0.5,
            locationPercentage: 0.7
        }),

        relationshipDetection: generateRandomContacts(35, {
            includeNotes: true,
            noteScenario: 'businessIntelligence',
            noteComplexity: 'business',
            noteProbability: 1.0,
            eventPercentage: 0.7,
            locationPercentage: 0.8
        }),

        strategicAnalysis: generateRandomContacts(20, {
            includeNotes: true,
            noteScenario: 'businessIntelligence',
            noteComplexity: 'strategic',
            noteProbability: 1.0,
            eventPercentage: 0.8,
            locationPercentage: 0.9
        })
    };

    const allTestContacts = [
        ...testSets.companyMatching,
        ...testSets.industryDetection,
        ...testSets.relationshipDetection,
        ...testSets.strategicAnalysis
    ];

    return {
        testSets,
        allTestContacts,
        statistics: {
            total: allTestContacts.length,
            withNotes: allTestContacts.filter(c => c.hasNotes).length,
            byComplexity: {
                pro: allTestContacts.filter(c => c.noteComplexity === 'pro').length,
                premium: allTestContacts.filter(c => c.noteComplexity === 'premium').length,
                business: allTestContacts.filter(c => c.noteComplexity === 'business').length,
                strategic: allTestContacts.filter(c => c.noteComplexity === 'strategic').length
            },
            avgNoteLength: allTestContacts.filter(c => c.notes).reduce((sum, c) => sum + c.noteLength, 0) / allTestContacts.filter(c => c.notes).length
        }
    };
}

export {
    EVENT_LOCATIONS,
    TECH_COMPANIES,
    JOB_TITLES,
    NOTE_TEMPLATES
};

const contactGenerator = {
    generateRandomContact,
    generateRandomContacts,
    generateContactsForTierTesting,
    generateAITestDataset,
    EVENT_LOCATIONS,
    TECH_COMPANIES,
    JOB_TITLES,
    NOTE_TEMPLATES
};

export default contactGenerator;