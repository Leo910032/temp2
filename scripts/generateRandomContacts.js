// scripts/generateRandomContacts.js - Random Contact Generator with Event Locations
import { adminDb } from '@/lib/firebaseAdmin';

// ✅ REAL EVENT LOCATIONS FROM SEARCH RESULTS
const EVENT_LOCATIONS = [
    // CES 2024/2025 - Las Vegas Convention Center
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
    
    // AWS re:Invent - Las Vegas (Multiple Venues)
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
    
    // SXSW - Austin, Texas
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
    
    // RSA Conference - San Francisco
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
    
    // Cisco Live - Las Vegas
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
    
    // Dell Technologies World
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
    
    // VMware Explore
    {
        name: 'VMware Explore 2024',
        location: { latitude: 36.1316, longitude: -115.1536 },
        venue: 'Las Vegas Convention Center',
        address: '3150 Paradise Rd, Las Vegas, NV 89109',
        dates: 'August 26-29, 2024',
        type: 'virtualization_conference'
    },
    
    // Microsoft Ignite (varies by year)
    {
        name: 'Microsoft Ignite 2024',
        location: { latitude: 41.8781, longitude: -87.6298 },
        venue: 'McCormick Place',
        address: '2301 S Dr Martin Luther King Jr Dr, Chicago, IL 60616',
        dates: 'November 19-22, 2024',
        type: 'microsoft_conference'
    },
    
    // Adobe Summit
    {
        name: 'Adobe Summit 2024',
        location: { latitude: 36.1316, longitude: -115.1536 },
        venue: 'Las Vegas Convention Center',
        address: '3150 Paradise Rd, Las Vegas, NV 89109',
        dates: 'March 25-28, 2024',
        type: 'marketing_conference'
    },
    
    // Google I/O
    {
        name: 'Google I/O 2024',
        location: { latitude: 37.4267, longitude: -122.0802 },
        venue: 'Shoreline Amphitheatre',
        address: '1 Amphitheatre Pkwy, Mountain View, CA 94043',
        dates: 'May 14-15, 2024',
        type: 'developer_conference'
    },
    
    // Dreamforce
    {
        name: 'Dreamforce 2024',
        location: { latitude: 37.7845, longitude: -122.4014 },
        venue: 'Moscone Center',
        address: '747 Howard St, San Francisco, CA 94103',
        dates: 'September 17-19, 2024',
        type: 'crm_conference'
    },
    
    // Oracle CloudWorld
    {
        name: 'Oracle CloudWorld 2024',
        location: { latitude: 36.1316, longitude: -115.1536 },
        venue: 'Las Vegas Convention Center',
        address: '3150 Paradise Rd, Las Vegas, NV 89109',
        dates: 'September 9-12, 2024',
        type: 'database_conference'
    }
];

// ✅ REALISTIC TECH COMPANIES
const TECH_COMPANIES = [
    // Big Tech
    'Google', 'Microsoft', 'Apple', 'Amazon', 'Meta', 'Netflix', 'Tesla',
    'Adobe', 'Salesforce', 'Oracle', 'SAP', 'IBM', 'Intel', 'NVIDIA',
    'Cisco', 'Dell Technologies', 'HPE', 'VMware', 'ServiceNow', 'Workday',
    
    // Cloud & Enterprise
    'AWS', 'Azure', 'Snowflake', 'Databricks', 'MongoDB', 'Redis',
    'Cloudflare', 'Fastly', 'Twilio', 'Stripe', 'Square', 'PayPal',
    'Zoom', 'Slack', 'Atlassian', 'Jira', 'Confluence', 'GitHub',
    
    // Startups & Scale-ups
    'OpenAI', 'Anthropic', 'Hugging Face', 'Stability AI', 'Cohere',
    'DataDog', 'New Relic', 'Splunk', 'Elastic', 'Docker', 'Kubernetes',
    'Terraform', 'Ansible', 'Jenkins', 'GitLab', 'Bitbucket',
    
    // Consulting & Services
    'Accenture', 'Deloitte', 'McKinsey Digital', 'Boston Consulting Group',
    'KPMG Technology', 'PwC Digital', 'Cognizant', 'Infosys', 'TCS',
    'Capgemini', 'Wipro', 'HCL Technologies', 'Tech Mahindra',
    
    // Industry Specific
    'Palantir', 'Snowflake', 'Databricks', 'Unity Technologies',
    'Epic Games', 'Roblox', 'Discord', 'Spotify', 'Uber', 'Lyft',
    'Airbnb', 'DoorDash', 'Instacart', 'Shopify', 'Squarespace',
    
    // Emerging Tech
    'SpaceX', 'Blue Origin', 'Relativity Space', 'Planet Labs',
    'Cruise', 'Waymo', 'Aurora', 'Rivian', 'Lucid Motors',
    'Coinbase', 'Binance', 'FTX', 'Chainlink', 'Polygon'
];

// ✅ REALISTIC JOB TITLES
const JOB_TITLES = [
    // Engineering
    'Software Engineer', 'Senior Software Engineer', 'Staff Software Engineer',
    'Principal Software Engineer', 'Engineering Manager', 'Senior Engineering Manager',
    'VP of Engineering', 'CTO', 'Technical Lead', 'Team Lead',
    'Frontend Developer', 'Backend Developer', 'Full Stack Developer',
    'DevOps Engineer', 'Site Reliability Engineer', 'Platform Engineer',
    'Cloud Engineer', 'Cloud Architect', 'Solutions Architect',
    'Data Engineer', 'Data Scientist', 'ML Engineer', 'AI Engineer',
    'Security Engineer', 'Cybersecurity Analyst', 'Security Architect',
    
    // Product & Design
    'Product Manager', 'Senior Product Manager', 'VP of Product', 'CPO',
    'Product Owner', 'Product Designer', 'UX Designer', 'UI Designer',
    'UX Researcher', 'Design Director', 'Head of Design',
    
    // Sales & Marketing
    'Sales Engineer', 'Solutions Consultant', 'Account Executive',
    'Sales Director', 'VP of Sales', 'Chief Revenue Officer',
    'Marketing Manager', 'Product Marketing Manager', 'Growth Manager',
    'Digital Marketing Specialist', 'Content Marketing Manager',
    
    // Executive
    'CEO', 'CTO', 'CIO', 'CISO', 'CFO', 'COO', 'VP of Engineering',
    'VP of Product', 'VP of Sales', 'VP of Marketing', 'Head of Growth',
    
    // Consulting & Services
    'Technical Consultant', 'Solutions Consultant', 'Implementation Specialist',
    'Business Analyst', 'Systems Analyst', 'Project Manager',
    'Program Manager', 'Scrum Master', 'Agile Coach',
    
    // Emerging Roles
    'AI/ML Specialist', 'Blockchain Developer', 'Web3 Engineer',
    'Developer Advocate', 'Developer Relations', 'Technical Writer',
    'Customer Success Manager', 'Implementation Manager'
];

// ✅ REALISTIC FIRST NAMES
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

// ✅ REALISTIC LAST NAMES
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

// ✅ PHONE NUMBER FORMATS
const PHONE_FORMATS = [
    '(###) ###-####',
    '###-###-####',
    '### ### ####',
    '+1 ### ### ####',
    '+1 (###) ###-####'
];

// ✅ EMAIL DOMAINS
const EMAIL_DOMAINS = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
    'protonmail.com', 'company.com', 'work.co', 'tech.io', 'dev.org'
];

// ✅ UTILITY FUNCTIONS
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
    // Add random noise within radius to simulate different locations within same event
    const radiusDeg = radiusKm / 111; // Rough conversion: 1 degree ≈ 111 km
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * radiusDeg;
    
    return {
        latitude: baseLocation.latitude + (Math.cos(angle) * distance),
        longitude: baseLocation.longitude + (Math.sin(angle) * distance),
        accuracy: Math.floor(Math.random() * 100) + 50, // 50-150m accuracy
        timestamp: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString() // Random time in last 90 days
    };
}

function generateRandomLocation() {
    // Random locations around major tech hubs
    const techHubs = [
        { latitude: 37.4419, longitude: -122.1430, name: 'Palo Alto, CA' }, // Silicon Valley
        { latitude: 47.6062, longitude: -122.3321, name: 'Seattle, WA' }, // Microsoft/Amazon
        { latitude: 40.7484, longitude: -73.9857, name: 'New York, NY' }, // NYC Tech
        { latitude: 42.3601, longitude: -71.0589, name: 'Boston, MA' }, // Boston Tech
        { latitude: 30.2672, longitude: -97.7431, name: 'Austin, TX' }, // Austin Tech
        { latitude: 39.7392, longitude: -104.9903, name: 'Denver, CO' }, // Denver Tech
        { latitude: 33.4484, longitude: -112.0740, name: 'Phoenix, AZ' }, // Phoenix Tech
        { latitude: 25.7617, longitude: -80.1918, name: 'Miami, FL' } // Miami Tech
    ];
    
    const hub = randomChoice(techHubs);
    return addLocationNoise(hub, 25); // 25km radius around tech hubs
}

function generateBusinessCardDetails() {
    // Generate realistic business card-style details
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
    
    // Add some random additional details
    const additionalDetails = [
        { label: 'Website', value: `https://www.${company.toLowerCase().replace(/\s+/g, '')}.com`, type: 'social' },
        { label: 'LinkedIn', value: `https://linkedin.com/in/${firstName.toLowerCase()}-${lastName.toLowerCase()}`, type: 'social' },
        { label: 'Twitter', value: `@${firstName.toLowerCase()}${lastName.toLowerCase()}`, type: 'social' },
        { label: 'Mobile', value: generatePhoneNumber(), type: 'standard' },
        { label: 'Office', value: generatePhoneNumber(), type: 'custom' },
        { label: 'Department', value: randomChoice(['Engineering', 'Product', 'Sales', 'Marketing', 'Operations']), type: 'custom' }
    ];
    
    // Add 1-3 random additional details
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

// ✅ MAIN GENERATION FUNCTIONS
export function generateRandomContact(options = {}) {
    const {
        forceEventLocation = false,
        forceRandomLocation = false,
        eventProbability = 0.4, // 40% chance of being at an event
        source = null
    } = options;
    
    const businessCard = generateBusinessCardDetails();
    const submittedAt = new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(); // Random time in last 90 days
    
    let location = null;
    let locationEvent = null;
    let contactSource = source || randomChoice(['business_card_scan', 'exchange_form', 'manual']);
    
    // Determine if contact has location
    const shouldHaveLocation = forceEventLocation || forceRandomLocation || Math.random() < 0.7; // 70% have location
    
    if (shouldHaveLocation) {
        if (forceEventLocation || (!forceRandomLocation && Math.random() < eventProbability)) {
            // Contact is from an event
            locationEvent = randomChoice(EVENT_LOCATIONS);
            location = addLocationNoise(locationEvent.location, 1); // Within 1km of event venue
            contactSource = 'business_card_scan'; // Most event contacts are from business card scans
        } else {
            // Random location around tech hubs
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
        status: randomChoice(['new', 'new', 'new', 'viewed', 'archived']), // 60% new, 25% viewed, 15% archived
        submittedAt: submittedAt,
        lastModified: submittedAt,
        source: contactSource
    };
    
    if (location) {
        contact.location = location;
    }
    
    // Add metadata for exchange_form contacts
    if (contactSource === 'exchange_form') {
        contact.metadata = {
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
            referrer: 'https://networking-app.com/profile/tech-pro',
            sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            locationStatus: location ? 'granted' : 'denied',
            submissionTime: submittedAt,
            timezone: 'America/Los_Angeles',
            language: 'en-US'
        };
        
        // Add message for exchange form contacts
        const messages = [
            `Met at ${locationEvent?.name || 'networking event'}, excited to connect!`,
            'Great conversation about the future of tech!',
            'Looking forward to collaborating on projects.',
            'Nice meeting you at the conference.',
            'Let\'s stay in touch and explore synergies.',
            `Really enjoyed our discussion about ${randomChoice(['AI', 'cloud computing', 'cybersecurity', 'data analytics', 'mobile development'])}.`,
            'Hope to work together soon!'
        ];
        contact.message = randomChoice(messages);
    }
    
    // Store event information if applicable
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

export function generateRandomContacts(count, options = {}) {
    const contacts = [];
    const {
        eventPercentage = 0.4, // 40% from events
        locationPercentage = 0.7, // 70% have location
        ...otherOptions
    } = options;
    
    for (let i = 0; i < count; i++) {
        const shouldBeFromEvent = Math.random() < eventPercentage;
        const shouldHaveLocation = Math.random() < locationPercentage;
        
        const contactOptions = {
            ...otherOptions,
            forceEventLocation: shouldBeFromEvent && shouldHaveLocation,
            forceRandomLocation: !shouldBeFromEvent && shouldHaveLocation
        };
        
        contacts.push(generateRandomContact(contactOptions));
    }
    
    return contacts;
}

// ✅ FIREBASE INSERTION FUNCTION
export async function insertRandomContactsToFirebase(userId, count = 50, options = {}) {
    try {
        console.log(`🎲 Generating ${count} random contacts for user ${userId}...`);
        
        const contacts = generateRandomContacts(count, options);
        
        // Get existing contacts
        const contactsRef = adminDb.collection('Contacts').doc(userId);
        const contactsDoc = await contactsRef.get();
        
        let existingContacts = [];
        if (contactsDoc.exists) {
            existingContacts = contactsDoc.data().contacts || [];
        }
        
        // Add new contacts to the beginning of the array
        const allContacts = [...contacts, ...existingContacts];
        
        // Calculate statistics
        const statistics = {
            totalSubmissions: allContacts.length,
            newContacts: allContacts.filter(c => c.status === 'new').length,
            viewedContacts: allContacts.filter(c => c.status === 'viewed').length,
            archivedContacts: allContacts.filter(c => c.status === 'archived').length,
            contactsWithLocation: allContacts.filter(c => c.location && c.location.latitude).length,
            lastSubmissionDate: new Date().toISOString(),
            sources: {
                exchange_form: allContacts.filter(c => c.source === 'exchange_form').length,
                business_card_scan: allContacts.filter(c => c.source === 'business_card_scan').length,
                manual: allContacts.filter(c => c.source === 'manual' || !c.source).length,
                import: allContacts.filter(c => c.source === 'import' || c.source === 'import_csv').length
            }
        };
        
        // Save to Firebase
        await contactsRef.set({
            contacts: allContacts,
            lastUpdated: new Date().toISOString(),
            totalContacts: allContacts.length,
            statistics: statistics
        }, { merge: true });
        
        console.log('✅ Random contacts inserted successfully!');
        console.log('📊 Statistics:', {
            totalContacts: allContacts.length,
            newGenerated: contacts.length,
            withEvents: contacts.filter(c => c.eventInfo).length,
            withLocation: contacts.filter(c => c.location).length,
            companies: [...new Set(contacts.map(c => c.company))].length,
            events: [...new Set(contacts.filter(c => c.eventInfo).map(c => c.eventInfo.eventName))]
        });
        
        return {
            success: true,
            generated: contacts.length,
            total: allContacts.length,
            statistics: statistics,
            sampleContacts: contacts.slice(0, 3) // Return first 3 as samples
        };
        
    } catch (error) {
        console.error('❌ Error inserting random contacts:', error);
        throw error;
    }
}

// ✅ USAGE EXAMPLES

/*
// Example 1: Generate 50 random contacts (default mix)
const contacts = generateRandomContacts(50);

// Example 2: Generate 100 contacts with 60% from events
const eventContacts = generateRandomContacts(100, {
    eventPercentage: 0.6,
    locationPercentage: 0.8
});

// Example 3: Generate contacts for testing auto-grouping
const testContacts = generateRandomContacts(30, {
    eventPercentage: 0.8, // 80% from events for better grouping
    locationPercentage: 0.9 // 90% have location
});

// Example 4: Insert directly to Firebase (replace with actual user ID)
await insertRandomContactsToFirebase('YOUR_USER_ID_HERE', 75, {
    eventPercentage: 0.5,
    locationPercentage: 0.8
});

// Example 5: Generate specific scenarios for testing
const cesContacts = generateRandomContacts(20, {
    forceEventLocation: true // All from events
});

const randomLocationContacts = generateRandomContacts(15, {
    forceRandomLocation: true // All have random locations
});
*/

export default {
    generateRandomContact,
    generateRandomContacts,
    insertRandomContactsToFirebase,
    EVENT_LOCATIONS,
    TECH_COMPANIES,
    JOB_TITLES
};