# Semantic Search & Vector Database Guide

**Last Updated:** October 16, 2025
**Version:** 2.3 (With Contextual Field Enrichment)

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Components](#core-components)
4. [Data Flow](#data-flow)
5. [Threshold-Based Filtering](#threshold-based-filtering)
6. [Vector Database (Pinecone)](#vector-database-pinecone)
7. [AI Integration](#ai-integration)
8. [Configuration & Constants](#configuration--constants)
9. [Cost Tracking](#cost-tracking)
10. [API Reference](#api-reference)
11. [Error Handling](#error-handling)
12. [Troubleshooting](#troubleshooting)
13. [Next Steps & Future Features](#next-steps--future-features)
14. [Quick Reference](#quick-reference)

---

## Overview

### What is Semantic Search?

Semantic search allows users to find contacts based on **meaning and context** rather than exact keyword matches. It uses AI embeddings to understand the intent behind queries like:

- "Who can help me with machine learning?"
- "Find contacts in the healthcare industry"
- "People I met at conferences in 2024"
- **NEW (v2.3)**: "Find me CTOs I met at security conferences"
- **NEW (v2.3)**: "Show me everyone from business card scans at tech events"

### Tech Stack

| Technology | Purpose | Model/Version |
|------------|---------|---------------|
| **Google Gemini** | Text embeddings | `text-embedding-004` |
| **Pinecone** | Vector database | Serverless index |
| **Cohere** | Result reranking | `rerank-multilingual-v3.0` |
| **Google Gemini** | AI enhancement | `gemini-2.5-flash` / `gemini-2.5-pro` |
| **Firebase Firestore** | Contact storage | N/A |

### The Three-Stage Pipeline

```
┌─────────────┐      ┌──────────┐      ┌────────────────┐
│   Vector    │ ───> │ Rerank   │ ───> │ AI Enhancement │
│   Search    │      │ (Cohere) │      │   (Gemini)     │
└─────────────┘      └──────────┘      └────────────────┘
    Step 1              Step 2             Step 3
  (Threshold)        (Threshold)         (Future)
```

1. **Vector Search**: Find relevant contacts using embeddings (Pinecone) → Filter by similarity threshold
2. **Reranking**: Improve relevance with AI reranking (Cohere) → Filter by relevance threshold
3. **AI Enhancement**: Generate explanations and insights (Gemini) → Used for context-driven features (future)

### Intelligent Filtering & Context Enrichment (v2.2-2.3)

**Threshold-Based Filtering (v2.2)**:
- **Vector Search**: Filters by minimum similarity score (varies by subscription tier)
- **Reranking**: Filters by minimum relevance score (5% minimum)
- **Quality over Quantity**: Returns only high-confidence matches, even if fewer results
- **Comprehensive Logging**: Every filtration step logs input, output, and filtered counts

**Contextual Field Enrichment (v2.3)**:
- **Event Information**: Captures where/when you met contacts (conference names, event types, venues)
- **Meeting Context**: Adds "How We Met" field from originalSource (business card scan, exchange form, manual)
- **Enhanced Location**: Builds complete addresses from city/state/country, not just GPS coordinates
- **Field Extraction**: Robust helpers extract data from multiple sources (top-level, details array, dynamicFields)
- **Query-Adaptive Documents**: Minimal mode for simple queries, rich mode for semantic queries

---

## Architecture

### Clean Architecture Pattern

```
┌─────────────────────────────────────────────────────────┐
│                    Client Layer                          │
│  SemanticSearchService.js (Browser)                     │
│  - API calls via ContactApiClient                       │
│  - localStorage caching                                 │
│  - Result categorization                                │
└───────────────────┬─────────────────────────────────────┘
                    │ HTTPS
┌───────────────────▼─────────────────────────────────────┐
│                    API Layer                             │
│  /api/user/contacts/semantic-search/route.js            │
│  /api/user/contacts/rerank/route.js                     │
│  /api/user/contacts/ai-enhance-results/route.js         │
│  - Authentication (Firebase Admin)                      │
│  - Input validation                                     │
│  - Subscription checks                                  │
│  - Cost affordability checks                            │
└───────────────────┬─────────────────────────────────────┘
                    │ Function calls
┌───────────────────▼─────────────────────────────────────┐
│                  Server Services Layer                   │
│  semanticSearchService.js                               │
│  rerankService.js                                       │
│  aiEnhanceService.js                                    │
│  vectorService.js (index management)                    │
│  - Business logic                                       │
│  - External API calls (Pinecone, Cohere, Gemini)       │
│  - Data transformation                                  │
└───────────────────┬─────────────────────────────────────┘
                    │ Database/API calls
┌───────────────────▼─────────────────────────────────────┐
│                External Services Layer                   │
│  - Pinecone (vector queries)                            │
│  - Firebase Firestore (contact data)                    │
│  - Google Gemini API (embeddings & generation)          │
│  - Cohere API (reranking)                               │
└─────────────────────────────────────────────────────────┘
```

### Key Design Principles

1. **Separation of Concerns**: Each layer has a single responsibility
2. **No Business Logic in APIs**: API routes only handle HTTP concerns
3. **Server Services Own Business Logic**: All AI/database logic in server services
4. **Client Service is Thin**: Only API calls and localStorage management
5. **Centralized Constants**: All config in `contactConstants.js`, `aiCosts.js`, `apiCosts.js`

---

## Core Components

### 1. Client Service

**Location**: `lib/services/serviceContact/client/services/SemanticSearchService.js`

**Responsibilities**:
- Make API calls to backend via ContactApiClient
- Manage search history in localStorage
- Categorize results by similarity tiers
- Handle streaming vs batch modes
- Cache search results

**Key Methods**:
```javascript
// Main search method
static async search(query, options = {})

// Reranking
static async rerankContacts(query, contacts, options = {})

// AI enhancement (batch)
static async enhanceResultsWithBatch(query, contacts, options = {})

// AI enhancement (streaming)
static enhanceResultsWithStreaming(query, contacts, options = {})

// Search history
static loadSearchHistory()
static saveSearchJob(searchData)
static clearSearchCache()
```

**Does NOT**:
- ❌ Access Firestore directly
- ❌ Call AI APIs directly
- ❌ Contain business logic
- ❌ Import BaseContactService or contactCache

**Only Imports**:
- ✅ `ContactApiClient` (for API calls)
- ✅ Constants from `contactConstants.js`

---

### 2. API Routes

#### A. Semantic Search API

**Location**: `app/api/user/contacts/semantic-search/route.js`

**Endpoint**: `POST /api/user/contacts/semantic-search`

**Flow**:
```javascript
1. Extract Bearer token from Authorization header
2. Verify Firebase ID token → get userId
3. Validate request body (query, maxResults, etc.)
4. Check user's subscription level from Firestore
5. Verify subscription includes semantic search
6. Estimate cost and check affordability
7. Call SemanticSearchService.search()
8. Record usage costs
9. Return results with metadata
```

**Does NOT**:
- ❌ Generate embeddings
- ❌ Query Pinecone
- ❌ Retrieve contacts from Firestore
- ❌ Contain any business logic

---

#### B. Rerank API

**Location**: `app/api/user/contacts/rerank/route.js`

**Endpoint**: `POST /api/user/contacts/rerank`

**Flow**:
```javascript
1. Authenticate user
2. Validate input (query, contacts array)
3. Check subscription (premium+)
4. Estimate Cohere API cost
5. Check affordability
6. Call RerankService.rerankContacts()
7. Record costs
8. Return reranked results
```

---

#### C. AI Enhancement API

**Location**: `app/api/user/contacts/ai-enhance-results/route.js`

**Endpoint**: `POST /api/user/contacts/ai-enhance-results`

**Flow**:
```javascript
1. Authenticate user
2. Validate input (query, contacts, mode)
3. Check subscription (business+)
4. Estimate Gemini API cost
5. Check affordability

IF mode === 'streaming':
  6a. Call AIEnhanceService.createStreamingResponse()
  6b. Wrap stream with cost tracking
  6c. Return ReadableStream

ELSE (batch mode):
  6a. Call AIEnhanceService.enhanceResults()
  6b. Record costs synchronously
  6c. Return JSON results
```

---

### 3. Server Services

#### A. SemanticSearchService

**Location**: `lib/services/serviceContact/server/semanticSearchService.js`

**Responsibilities**:
- Generate query embeddings using Gemini
- Query Pinecone vector database
- Retrieve full contact data from Firestore
- Calculate actual costs

**Key Methods**:

```javascript
/**
 * Perform semantic search
 * @param {string} userId - User ID
 * @param {string} query - Search query
 * @param {Object} options
 * @returns {Object} { results, searchMetadata }
 */
static async search(userId, query, options = {})

/**
 * Estimate search cost
 * @param {string} query - Search query
 * @returns {Object} { estimatedTokens, embeddingCost, searchCost, totalCost }
 */
static estimateCost(query)

/**
 * Retrieve contacts from Firestore
 * @private
 */
static async _retrieveContactData(userId, matches, searchId, namespace)
```

**Algorithm**:
```
1. Generate embedding for query text using Gemini
   - Model: text-embedding-004
   - Returns 768-dimensional vector

2. Query Pinecone index
   - Index: networking-app-contacts
   - Namespace: user_{userId}
   - Returns similarity scores (0-1)

3. Filter by minimum threshold
   - Based on subscription level
   - Enterprise: 0.10, Business: 0.15, etc.

4. Fetch full contact data from Firestore
   - Collection: users/{userId}/contacts
   - Batch retrieval for efficiency

5. Enrich contacts with search metadata
   - Add _vectorScore
   - Add _searchRank
   - Add _similarityTier

6. Calculate actual costs
   - Embedding cost = (tokens / 1M) * $0.10
   - Pinecone cost = $0.0001 per query

7. Return results with metadata
```

---

#### B. RerankService

**Location**: `lib/services/serviceContact/server/rerankService.js`

**Responsibilities**:
- Build rich document representations
- Call Cohere Rerank API
- Calculate hybrid scores (vector + rerank)
- Format reranked results

**Key Methods**:

```javascript
/**
 * Rerank contacts using Cohere
 * @param {string} query - Original query
 * @param {Array} contacts - Contacts to rerank
 * @param {Object} options
 * @returns {Object} { results, metadata }
 */
static async rerankContacts(query, contacts, options = {})

/**
 * Estimate reranking cost
 * @param {number} contactCount - Number of contacts
 * @returns {Object} { baseCost, perDocumentCost, totalCost }
 */
static estimateCost(contactCount)

/**
 * Build document string for reranking
 * @private
 */
static _buildRerankDocument(contact, subscriptionLevel)
```

**Document Building Strategy**:

The system uses **two document building modes** based on query complexity:

1. **Minimal Mode** (for simple factual queries like "Show me everyone at Stripe"):
   - Only essential fields: Name, Company, Job Title
   - Reduces token usage and prevents confusing the reranker
   - Example: `"Name: John Doe. Company: Stripe. Title: Engineer."`

2. **Rich Mode** (for semantic/complex queries like "Find CTOs at security conferences"):
   - All available fields based on subscription level
   - Includes contextual information for better matching

**Rich Mode Field Strategy by Subscription Tier**:

```javascript
// FREE tier: Basic contact info
"[Contact Name]: John Doe
[Email]: john@acme.com
[Company]: Acme Corp
[Job Title]: Engineer"

// PREMIUM+ (Premium/Business/Enterprise): Full contextual enrichment
"[Contact Name]: John Doe
[Email]: john@acme.com
[Company]: Acme Corp
[Job Title]: Engineer
[Notes]: Expert in cloud security architecture
[Message]: Great meeting at the conference
[Website]: https://johndoe.com
[Event]: Security Conference 2025
[Event Type]: security_conference
[Venue]: Tech Summit Center
[Event Dates]: October 20-23, 2025
[Location]: San Francisco, California, USA
[How We Met]: Business Card Scan"
```

**Key Improvements (v2.3)**:
- ✅ **Event Context**: Includes `eventInfo` fields (eventName, eventType, venue, dates) for queries like "people I met at conferences"
- ✅ **Enhanced Location**: Builds complete addresses from city/state/country components, not just GPS coordinates
- ✅ **Source Context**: Adds `originalSource` as "How We Met" for queries about meeting context
- ✅ **Field Extraction Helpers**: Robust extraction from `details` array, `dynamicFields`, and top-level fields
- ✅ **Unified Premium+**: All Premium/Business/Enterprise users get the same rich fields (no artificial limitations)

**Important**: Job titles and company names are extracted using helper functions that check multiple locations:
1. Top-level fields (`contact.jobTitle`, `contact.company`)
2. Details array (`contact.details.find(d => d.label === "Job Title")`)
3. Dynamic fields (`contact.dynamicFields`)

This ensures accurate matching even when data structure varies across contact sources.

**Hybrid Scoring**:
```javascript
// Combine vector and rerank scores
hybridScore = (vectorScore * 0.3) + (rerankScore * 0.7)

// Why 30/70 split?
// - Vector search provides broad recall
// - Rerank provides precise relevance
// - Heavier weight on rerank for better UX
```

---

#### C. AIEnhanceService

**Location**: `lib/services/serviceContact/server/aiEnhanceService.js`

**Responsibilities**:
- Generate similarity-aware prompts
- Call Gemini API (Flash or Pro based on subscription)
- Support batch and streaming modes
- Generate strategic questions for outreach
- Calculate token usage and costs

**Key Methods**:

```javascript
/**
 * Enhance search results with AI insights (batch mode)
 * @param {string} query - Original query
 * @param {Array} contacts - Contacts to enhance
 * @param {Object} options
 * @returns {Object} { insights, billing }
 */
static async enhanceResults(query, contacts, options = {})

/**
 * Create streaming response for AI enhancement
 * @param {string} query - Original query
 * @param {Array} contacts - Contacts to enhance
 * @param {Object} options
 * @returns {ReadableStream}
 */
static createStreamingResponse(query, contacts, options = {})

/**
 * Estimate enhancement cost
 * @param {number} contactCount - Number of contacts
 * @param {string} subscriptionLevel - User's subscription
 * @returns {Object} Cost estimate
 */
static estimateCost(contactCount, subscriptionLevel)

/**
 * Generate similarity-aware prompt
 * @private
 */
static _generateSimilarityAwarePrompt(query, contact, queryLanguage)
```

**Similarity-Aware Prompting**:

The AI enhancement uses different prompt strategies based on similarity tiers:

```javascript
// HIGH similarity (>0.35 for enterprise)
"This contact is HIGHLY relevant. Explain the strong connections..."

// MEDIUM similarity (0.25-0.35)
"This contact is MODERATELY relevant. Identify the key alignments..."

// LOW similarity (0.15-0.25)
"This contact is SOMEWHAT relevant. Find the potential connections..."

// MINIMUM similarity (<0.15)
"This contact is MINIMALLY relevant. Look for any possible connections..."
```

**Strategic Questions Feature**:

Instead of generic suggestions, the AI generates 3 strategic research questions:

```json
{
  "strategicQuestions": [
    "What specific machine learning projects has John worked on recently?",
    "How does John's healthcare AI experience align with your medical imaging project?",
    "What is John's current availability for consulting opportunities?"
  ]
}
```

**Model Selection**:

```javascript
// Enterprise users
model = 'gemini-2.5-pro'  // Higher quality, $1.25 input / $10 output per 1M tokens

// Business users
model = 'gemini-2.5-flash'  // Fast & cost-effective, $0.30 input / $2.50 output per 1M tokens
```

---

#### D. VectorService

**Location**: `lib/services/serviceContact/server/vectorService.js`

**Responsibilities**:
- Manage Pinecone index lifecycle
- Create index if it doesn't exist
- Upsert contact vectors
- Delete vectors
- Namespace management

**Key Methods**:

```javascript
/**
 * Get or create Pinecone index
 * @returns {Promise<Index>} Pinecone index instance
 */
static async getIndex()

/**
 * Upsert contact vectors to Pinecone
 * @param {string} userId - User ID
 * @param {Array} contacts - Contacts with embeddings
 */
static async upsertContacts(userId, contacts)

/**
 * Delete contact from vector index
 * @param {string} userId - User ID
 * @param {string} contactId - Contact ID
 */
static async deleteContact(userId, contactId)
```

**Index Configuration**:

```javascript
{
  name: 'networking-app-contacts',
  dimension: 768,  // Gemini text-embedding-004 dimension
  metric: 'cosine',  // Cosine similarity for semantic search
  spec: {
    serverless: {
      cloud: 'aws',
      region: 'us-east-1'
    }
  }
}
```

**Namespace Strategy**:

```
user_abc123/  ← All vectors for user abc123
user_xyz789/  ← All vectors for user xyz789
```

Each user's contacts are isolated in their own namespace for:
- Data privacy
- Query performance
- Independent scaling

---

## Data Flow

### End-to-End Search Flow

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. USER ACTION                                                   │
│    User types: "Find machine learning experts"                   │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│ 2. CLIENT SERVICE (SemanticSearchService.js)                     │
│    - Sanitize query                                              │
│    - Check localStorage cache                                    │
│    - Call: ContactApiClient.post('/api/.../semantic-search')     │
└────────────────────────────┬─────────────────────────────────────┘
                             │ HTTPS POST
┌────────────────────────────▼─────────────────────────────────────┐
│ 3. API ROUTE (semantic-search/route.js)                          │
│    ✓ Verify Firebase auth token                                 │
│    ✓ Validate input (query, maxResults)                          │
│    ✓ Check subscription level (Firestore: users/{userId})        │
│    ✓ Verify has semantic search access                           │
│    ✓ Estimate cost: SemanticSearchService.estimateCost()         │
│    ✓ Check affordability: CostTrackingService.canAffordOperation()│
└────────────────────────────┬─────────────────────────────────────┘
                             │ Function call
┌────────────────────────────▼─────────────────────────────────────┐
│ 4. SERVER SERVICE (semanticSearchService.js)                     │
│    A. Generate embedding                                         │
│       - Gemini API: text-embedding-004                           │
│       - Input: "Find machine learning experts"                   │
│       - Output: [0.023, -0.15, 0.87, ... ] (768 dims)           │
│                                                                  │
│    B. Query Pinecone                                             │
│       - Index: networking-app-contacts                           │
│       - Namespace: user_{userId}                                 │
│       - Vector: embedding from step A                            │
│       - TopK: 10 (or maxResults)                                 │
│       - Returns: [                                               │
│           { id: 'contact_1', score: 0.89, metadata: {...} },    │
│           { id: 'contact_2', score: 0.76, metadata: {...} },    │
│           ...                                                    │
│         ]                                                        │
│                                                                  │
│    C. Retrieve full contact data                                 │
│       - Firestore: users/{userId}/contacts                       │
│       - Batch get by contact IDs from Pinecone                   │
│       - Enrich with _vectorScore, _searchRank, _similarityTier   │
│                                                                  │
│    D. Calculate costs                                            │
│       - Embedding: $0.000012 (120 tokens)                        │
│       - Pinecone query: $0.0001                                  │
│       - Total: $0.000112                                         │
└────────────────────────────┬─────────────────────────────────────┘
                             │ Return results
┌────────────────────────────▼─────────────────────────────────────┐
│ 5. API ROUTE (continued)                                         │
│    - Record usage: CostTrackingService.recordSeparatedUsage()    │
│    - Format response with billing metadata                       │
│    - Return JSON                                                 │
└────────────────────────────┬─────────────────────────────────────┘
                             │ HTTPS Response
┌────────────────────────────▼─────────────────────────────────────┐
│ 6. CLIENT SERVICE (continued)                                    │
│    - Categorize by similarity tiers                              │
│    - Save to localStorage                                        │
│    - Return to UI component                                      │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│ 7. UI RENDERS RESULTS                                            │
│    HIGH (5 contacts) | MEDIUM (3) | LOW (2)                      │
└──────────────────────────────────────────────────────────────────┘
```

---

### Reranking Flow (Optional Step)

```
┌──────────────────────────────────────────────────────────────────┐
│ IF user has Premium+ subscription AND enabled reranking          │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│ CLIENT: Call rerankContacts()                                    │
└────────────────────────────┬─────────────────────────────────────┘
                             │ HTTPS POST
┌────────────────────────────▼─────────────────────────────────────┐
│ API: /api/user/contacts/rerank                                   │
│ - Auth, validate, check subscription, affordability              │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│ SERVER: RerankService.rerankContacts()                           │
│    A. Build documents                                            │
│       For each contact, create rich text:                        │
│       "Name: John. Company: Acme. Bio: ML expert..."             │
│                                                                  │
│    B. Call Cohere API                                            │
│       Model: rerank-multilingual-v3.0                            │
│       Input: query + documents array                             │
│       Output: [                                                  │
│         { index: 3, relevanceScore: 0.95 },                      │
│         { index: 0, relevanceScore: 0.87 },                      │
│         ...                                                      │
│       ]                                                          │
│                                                                  │
│    C. Calculate hybrid scores                                    │
│       hybridScore = (vectorScore * 0.3) + (rerankScore * 0.7)    │
│                                                                  │
│    D. Reorder contacts by hybrid score                           │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│ RESULT: Contacts reordered for better relevance                  │
└──────────────────────────────────────────────────────────────────┘
```

---

### AI Enhancement Flow (Optional Step)

```
┌──────────────────────────────────────────────────────────────────┐
│ IF user has Business+ subscription AND enabled AI enhancement    │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Choose Mode?    │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
     ┌────────▼────────┐         ┌─────────▼──────────┐
     │ BATCH MODE      │         │ STREAMING MODE     │
     └────────┬────────┘         └─────────┬──────────┘
              │                             │
              │                             │
┌─────────────▼────────────┐  ┌─────────────▼────────────────┐
│ Batch Enhancement        │  │ Streaming Enhancement        │
│                          │  │                              │
│ 1. Process all contacts  │  │ 1. Open streaming connection │
│    at once               │  │                              │
│                          │  │ 2. Process contacts one by   │
│ 2. Wait for all insights │  │    one                       │
│                          │  │                              │
│ 3. Record total cost     │  │ 3. Stream results as ready:  │
│                          │  │    {type: 'result'}          │
│ 4. Return complete JSON  │  │    {type: 'result'}          │
│                          │  │    {type: 'billing'}         │
│                          │  │    {type: 'complete'}        │
│                          │  │                              │
│ PROS: Simple, atomic     │  │ PROS: Immediate feedback,    │
│ CONS: Slower UX          │  │       better UX              │
└──────────────────────────┘  └──────────────────────────────┘
```

#### AI Enhancement Details

For each contact:

```javascript
// 1. Generate similarity-aware prompt
const prompt = `
You are an AI research assistant analyzing why a contact matches a search query.

SEARCH CONTEXT:
- Query: "${query}"
- Similarity Score: ${contact._vectorScore} (${similarityTier} relevance)
- Rerank Score: ${contact.searchMetadata?.rerankScore || 'N/A'}

CONTACT PROFILE:
- Name: ${contact.name}
- Company: ${contact.company}
- Title: ${contact.title}
- Bio: ${contact.bio}
- Tags: ${contact.tags?.join(', ')}
[... more contact data ...]

YOUR TASK:
1. Explain WHY this contact matches the query
2. Identify key relevance factors
3. Generate 3 strategic research questions for outreach
4. Provide confidence score (0-100)

Return JSON:
{
  "explanation": "John is highly relevant because...",
  "factors": ["Machine learning expertise", "Healthcare industry"],
  "strategicQuestions": [
    "What ML projects has John completed?",
    "How does his healthcare experience apply?",
    "Is he available for consulting?"
  ],
  "confidence": 87
}
`;

// 2. Call Gemini API
const model = genAI.getGenerativeModel({
  model: subscriptionLevel === 'enterprise' ? 'gemini-2.5-pro' : 'gemini-2.5-flash'
});
const result = await model.generateContent(prompt);

// 3. Parse JSON response
const analysis = JSON.parse(result.response.text());

// 4. Filter by confidence threshold
if (analysis.confidence >= getConfidenceThreshold(subscriptionLevel)) {
  insights.push({
    contactId: contact.id,
    explanation: analysis.explanation,
    factors: analysis.factors,
    strategicQuestions: analysis.strategicQuestions,
    confidence: analysis.confidence,
    billing: { inputTokens, outputTokens, estimatedCost }
  });
}
```

---

## Threshold-Based Filtering

### Overview

**Version 2.2** introduces intelligent threshold-based filtering that replaces hard-coded result limits with confidence-based filtering. This ensures users only see **high-quality, relevant results** rather than arbitrary counts.

### The Problem with Hard Limits

**Before (v2.1 and earlier)**:
```
Vector Search: Fetch 30 results (hard limit)
Reranking: Return top 10 results (hard limit)
Result: 10 contacts (some may be low quality)
```

**Issues**:
- User sees 10 results even if only 3 are truly relevant
- Low-quality matches dilute the user experience
- No way to know if a match is "good enough"
- Same limits for all subscription tiers

### The Solution: Threshold Filtering

**After (v2.2+)**:
```
Vector Search: Fetch up to 80, filter by 20% similarity → 28 contacts pass
Reranking: Filter by 5% relevance → 12 contacts pass
Result: 12 highly relevant contacts (all above confidence thresholds)
```

**Benefits**:
✅ Only return results that meet quality standards
✅ Different thresholds for different subscription tiers
✅ Transparent: users know why they got X results
✅ Better UX: "5 highly relevant matches" > "10 matches (3 good, 7 mediocre)"

---

### Configuration

**Location**: `lib/services/serviceContact/client/constants/contactConstants.js`

```javascript
export const CONFIDENCE_THRESHOLDS = {
  // Vector similarity minimum thresholds by subscription tier
  VECTOR_MINIMUM: {
    enterprise: 0.10,  // Keep results with 10%+ vector similarity
    business: 0.15,    // Keep results with 15%+ vector similarity
    premium: 0.20,     // Keep results with 20%+ vector similarity
    pro: 0.25,         // Keep results with 25%+ vector similarity
    base: 0.25         // Keep results with 25%+ vector similarity
  },

  // Rerank relevance minimum threshold (applies to all tiers)
  RERANK_MINIMUM: 0.05,  // Keep results with 5%+ rerank relevance score

  // Fallback limits (safety nets to prevent cost explosion)
  FALLBACK_MAX_RESULTS: {
    vectorSearch: 80,   // Max results from vector search
    rerank: 30          // Max results to send to reranking
  }
};
```

**Helper Functions**:
```javascript
// Get minimum vector threshold for a subscription level
const minVectorScore = getMinimumVectorThreshold('premium'); // 0.20

// Get minimum rerank threshold (same for all levels)
const minRerankScore = getMinimumRerankThreshold(); // 0.05
```

---

### How It Works

#### Step 1: Vector Search Filtering

**Server Side** (`semanticSearchService.js`):

```javascript
// Query Pinecone for up to 80 results
const searchResults = await index.query({
  vector: queryEmbedding,
  topK: 80,  // Fetch many results
  includeMetadata: true
});

// Filter by threshold
const rawMatches = searchResults.matches || [];
const filteredMatches = rawMatches.filter(match =>
  match.score >= minVectorScore  // e.g., 0.20 for premium
);

console.log(`📊 Raw Pinecone results: ${rawMatches.length} contacts`);
console.log(`🎯 After threshold filter: ${filteredMatches.length} contacts`);
console.log(`📉 Filtered out: ${rawMatches.length - filteredMatches.length} contacts`);
```

**Example Output**:
```
📊 [SemanticSearchService] [search_123] Pinecone search complete: {
  matches: 80,
  duration: '156ms',
  scoreRange: '0.05 - 0.67'
}
🎯 [SemanticSearchService] [search_123] Applying vector threshold filter: 0.20 (20% minimum similarity)
✅ [SemanticSearchService] [search_123] After threshold filter: {
  kept: 28,
  removed: 52,
  scoreRange: '0.20 - 0.67'
}
📉 [SemanticSearchService] [search_123] Filtered out: 52 contacts below 20% similarity threshold
```

---

#### Step 2: Rerank Filtering

**Server Side** (`rerankService.js`):

```javascript
// Call Cohere with all contacts (not just top N)
const rerankResponse = await cohere.rerank({
  query: query,
  documents: documents,
  topN: contacts.length,  // Get scores for all contacts
  model: 'rerank-multilingual-v3.0'
});

// Filter by threshold
const rawResults = rerankResponse.results || [];
const filteredResults = rawResults.filter(result =>
  result.relevanceScore >= minRerankScore  // e.g., 0.05
);

// Apply fallback limit if too many pass threshold
if (filteredResults.length > 30) {
  filteredResults = filteredResults.slice(0, 30);
  console.log(`⚠️  Fallback limit applied: 30 results`);
}
```

**Example Output**:
```
🔄 [RerankService] [rerank_456] Rerank strategy: {
  useThresholdFiltering: true,
  minRerankScore: 0.05,
  cohereTopN: 28
}
🔄 [RerankService] [rerank_456] Cohere API complete: {
  duration: '234ms',
  resultsReturned: 28,
  scoreRange: '0.01 - 0.89'
}
🎯 [RerankService] [rerank_456] Applying rerank threshold filter: 0.05 (5% minimum relevance)
✅ [RerankService] [rerank_456] After threshold filter: {
  kept: 12,
  removed: 16,
  scoreRange: '0.05 - 0.89'
}
📉 [RerankService] [rerank_456] Filtered out: 16 contacts below 5% relevance threshold
```

---

### Subscription Tier Differences

Higher subscription tiers get **lower thresholds**, meaning more results pass the filter:

| Tier | Vector Threshold | Example Results |
|------|------------------|-----------------|
| **Enterprise** | 10% (0.10) | 45 results |
| **Business** | 15% (0.15) | 35 results |
| **Premium** | 20% (0.20) | 28 results |
| **Pro** | 25% (0.25) | 18 results |

**Why?**
- Enterprise users get the most sensitive matching (finds more subtle connections)
- Pro users get stricter filtering (only very strong matches)
- Balances quality vs. quantity based on subscription value

---

### Fallback Limits (Safety Nets)

To prevent cost explosion, fallback limits are applied if **too many results pass the threshold**:

```javascript
// Example: 100 contacts pass vector threshold
if (filteredMatches.length > 80) {
  filteredMatches = filteredMatches.slice(0, 80);
  console.log(`⚠️  Fallback limit applied: 80 results (was ${originalLength})`);
}
```

**When fallback limits trigger**:
- Very broad queries ("show me everyone")
- Large contact databases (1000+ contacts)
- Very low thresholds (Enterprise tier with lots of contacts)

**Fallback limits prevent**:
- Excessive Cohere API costs (reranking 500 contacts)
- Long processing times
- UI performance issues with too many results

---

### API Integration

**Client Side** (`SemanticSearchService.js`):

```javascript
// Get thresholds based on subscription
const minVectorScore = getMinimumVectorThreshold(subscriptionLevel);
const minRerankScore = getMinimumRerankThreshold();

// Step 1: Vector search with threshold
const vectorSearchResponse = await ContactApiClient.post(
  '/api/user/contacts/semantic-search',
  {
    query: cleanQuery,
    maxResults: 80,  // Fallback limit
    minVectorScore   // Apply threshold filtering
  }
);

// Step 2: Rerank with threshold
const rerankResponse = await ContactApiClient.post(
  '/api/user/contacts/rerank',
  {
    query: cleanQuery,
    contacts: vectorSearchResponse.results,
    minConfidence: minRerankScore  // Apply threshold filtering
  }
);
```

---

### Comprehensive Logging

Every filtration step logs:

1. **Input Count** - How many results came in
2. **Threshold Used** - What confidence threshold is applied
3. **Output Count** - How many passed the threshold
4. **Filtered Count** - How many were removed
5. **Score Ranges** - Min/max scores before and after
6. **Fallback Status** - Whether fallback limit was applied

**Full Example Log**:

```
🔍 [API /semantic-search] [search_123] Request params: {
  queryLength: 45,
  maxResults: 80,
  trackCosts: true,
  minVectorScore: 0.20
}

📊 [SemanticSearchService] [search_123] Pinecone search complete: {
  matches: 80,
  duration: '156ms',
  scoreRange: '0.05 - 0.67'
}

🎯 [SemanticSearchService] [search_123] Applying vector threshold filter: 0.20 (20% minimum similarity)

✅ [SemanticSearchService] [search_123] After threshold filter: {
  kept: 28,
  removed: 52,
  scoreRange: '0.20 - 0.67'
}

📉 [SemanticSearchService] [search_123] Filtered out: 52 contacts below 20% similarity threshold

✅ [API /semantic-search] [search_123] Search complete: {
  resultsFound: 28,
  cost: 0.000234,
  thresholdUsed: 0.20,
  rawResults: 80,
  filteredOut: 52
}

🔄 [API /rerank] [rerank_456] Request params: {
  contactsCount: 28,
  minConfidence: 0.05
}

🔄 [RerankService] [rerank_456] Cohere API complete: {
  duration: '234ms',
  resultsReturned: 28,
  scoreRange: '0.01 - 0.89'
}

🎯 [RerankService] [rerank_456] Applying rerank threshold filter: 0.05 (5% minimum relevance)

✅ [RerankService] [rerank_456] After threshold filter: {
  kept: 12,
  removed: 16,
  scoreRange: '0.05 - 0.89'
}

📉 [RerankService] [rerank_456] Filtered out: 16 contacts below 5% relevance threshold

✅ [API /rerank] [rerank_456] Reranking complete: {
  inputCount: 28,
  outputCount: 12,
  cost: 0.028000,
  thresholdUsed: 0.05,
  filteredOut: 16
}
```

This makes debugging easy: you can see exactly where results were filtered and why.

---

### Metadata in API Responses

API responses now include threshold filtering statistics:

```javascript
// Vector search response
{
  results: [...],
  searchMetadata: {
    thresholdFiltering: {
      thresholdUsed: 0.20,
      rawCount: 80,
      filteredCount: 28,
      removedCount: 52,
      rawScoreRange: { min: 0.05, max: 0.67 },
      filteredScoreRange: { min: 0.20, max: 0.67 }
    }
  }
}

// Rerank response
{
  results: [...],
  metadata: {
    thresholdFiltering: {
      thresholdUsed: 0.05,
      rawCount: 28,
      filteredCount: 12,
      removedCount: 16,
      fallbackApplied: false,
      finalCount: 12
    }
  }
}
```

This allows clients to display insights like:
- "Showing 12 of 80 contacts (68 filtered by quality thresholds)"
- "Found 28 matches above 20% similarity"

---

### Migration from v2.1

**What Changed**:

1. **Vector Search**:
   - Old: `maxResults` was multiplied (e.g., `maxResults * 4`)
   - New: `minVectorScore` parameter filters by quality

2. **Reranking**:
   - Old: `topN` hard limit (always return exactly N results)
   - New: `minConfidence` filters by relevance score

3. **Client Service**:
   - Old: `maxResults: 40` to get 10 after reranking
   - New: `maxResults: 80, minVectorScore: 0.20` for quality filtering

**Backward Compatibility**:
- `topN` still works if `minConfidence` is not provided
- `maxResults` still works as a fallback limit
- No breaking changes to API contracts

---

## Vector Database (Pinecone)

### Index Configuration

```javascript
{
  name: 'networking-app-contacts',
  dimension: 768,           // Gemini text-embedding-004 output size
  metric: 'cosine',         // Cosine similarity (0 = dissimilar, 1 = identical)
  spec: {
    serverless: {
      cloud: 'aws',
      region: 'us-east-1'   // Choose region closest to your users
    }
  }
}
```

### Vector Structure

Each contact is stored as a vector in Pinecone:

```javascript
{
  id: 'contact_abc123',               // Unique contact ID
  values: [0.023, -0.15, ..., 0.87],  // 768-dimensional embedding
  metadata: {
    userId: 'user_xyz',               // For filtering (if needed)
    name: 'John Doe',                 // For quick display
    company: 'Acme Corp',
    title: 'ML Engineer',
    lastUpdated: '2025-10-15T10:30:00Z'
  }
}
```

### Namespace Strategy

```
networking-app-contacts/
├── user_abc123/              ← All vectors for user abc123
│   ├── contact_1
│   ├── contact_2
│   └── contact_3
├── user_xyz789/              ← All vectors for user xyz789
│   ├── contact_1
│   ├── contact_2
│   └── contact_3
```

**Benefits**:
- **Privacy**: Users can only query their own namespace
- **Performance**: Smaller search space = faster queries
- **Deletion**: Easy to delete all data for a user

### Similarity Scores

Pinecone returns cosine similarity scores (0-1 range):

| Score Range | Interpretation | Example |
|-------------|----------------|---------|
| 0.80 - 1.00 | Nearly identical | Same person, duplicate entry |
| 0.60 - 0.80 | Very high similarity | Strong match, highly relevant |
| 0.40 - 0.60 | High similarity | Good match, relevant |
| 0.20 - 0.40 | Moderate similarity | Some relevance |
| 0.10 - 0.20 | Low similarity | Weak connection |
| 0.00 - 0.10 | Very low similarity | Barely related |

### Indexing Workflow

When a new contact is created or updated:

```
1. User creates/updates contact in UI
2. Contact saved to Firestore
3. Trigger generates embedding:
   - Build text representation of contact
   - Call Gemini embedding API
   - Get 768-dim vector
4. Upsert to Pinecone:
   - Namespace: user_{userId}
   - ID: contact_{contactId}
   - Values: embedding vector
   - Metadata: basic contact info
5. Contact is now searchable via semantic search
```

### Best Practices

1. **Update vectors when contact data changes**
   - Bio, tags, skills, etc. affect searchability
   - Use upsert (not insert) to avoid duplicates

2. **Delete vectors when contacts are deleted**
   - Prevents returning stale results
   - Keeps index clean and performant

3. **Monitor index size**
   - Free tier: 100K vectors
   - Paid: Scale as needed

4. **Use metadata sparingly**
   - Metadata is NOT searchable
   - Only store what's needed for display/filtering
   - Full data lives in Firestore

---

## AI Integration

### 1. Google Gemini Embeddings

**Model**: `text-embedding-004`
**Dimension**: 768
**Cost**: $0.10 per 1M input tokens

#### Usage

```javascript
import { genAI } from '@/lib/firebase/admin';

const model = genAI.getGenerativeModel({
  model: 'text-embedding-004'
});

const result = await model.embedContent(text);
const embedding = result.embedding.values; // Array of 768 floats
```

#### Token Estimation

```javascript
// Rough estimation: 1 token ≈ 4 characters
const estimatedTokens = Math.ceil(text.length / 4);
const cost = (estimatedTokens / 1000000) * 0.10;
```

#### What to Embed

For contact embedding, combine:

```javascript
const textToEmbed = `
${contact.name}
${contact.company} ${contact.title}
${contact.bio}
${contact.tags?.join(' ')}
${contact.skills?.join(' ')}
${contact.notes}
${contact.education}
${contact.location}
`.trim();
```

**Tips**:
- Include all searchable text fields
- Don't include IDs, dates, or non-semantic data
- Keep it concise (< 2000 chars recommended)

---

### 2. Cohere Rerank API

**Model**: `rerank-multilingual-v3.0`
**Cost**: $1.00 per 1000 searches (not per document)

#### Usage

```javascript
import { cohere } from '@/lib/cohere';

const response = await cohere.rerank({
  query: "Find machine learning experts",
  documents: [
    "Name: John Doe. Company: Acme. Title: ML Engineer. Bio: 10 years in AI...",
    "Name: Jane Smith. Company: Tech Corp. Title: Developer. Bio: Frontend specialist...",
    // ... more documents
  ],
  topN: 10,                              // Return top 10
  model: 'rerank-multilingual-v3.0',     // Supports 100+ languages
  returnDocuments: false                 // Just return indices & scores
});

// Response:
// {
//   results: [
//     { index: 0, relevanceScore: 0.95 },  ← John is most relevant
//     { index: 3, relevanceScore: 0.87 },
//     ...
//   ]
// }
```

#### Cost Calculation

```javascript
const baseCost = 0.001; // $0.001 per request
const estimatedCost = baseCost; // NOT per document!
```

#### When to Use Reranking

✅ **Use when**:
- User has Premium+ subscription
- Results need high precision
- Query is complex or multi-faceted
- User explicitly enables reranking

❌ **Skip when**:
- Basic subscription (not available)
- Very simple queries ("John Smith")
- < 5 results (not worth the cost)
- User disabled reranking

---

### 3. Google Gemini Generation

**Models**:
- `gemini-2.5-flash`: Fast, cost-effective ($0.30/$2.50 per 1M tokens)
- `gemini-2.5-pro`: Higher quality ($1.25/$10.00 per 1M tokens)

#### Usage

```javascript
import { genAI } from '@/lib/firebase/admin';

const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: {
    temperature: 0.7,       // Balance creativity vs consistency
    topP: 0.9,
    topK: 40,
    maxOutputTokens: 500,   // Limit response length
  }
});

const result = await model.generateContent(prompt);
const text = result.response.text();
const usage = result.response.usageMetadata;

// Calculate cost
const inputCost = (usage.promptTokenCount / 1000000) * 0.30;
const outputCost = (usage.candidatesTokenCount / 1000000) * 2.50;
const totalCost = inputCost + outputCost;
```

#### Prompt Engineering Tips

1. **Be specific about output format**
   ```
   Return JSON with this exact structure:
   { "explanation": string, "factors": string[], ... }
   ```

2. **Use similarity tier in prompt**
   ```
   This contact has a HIGH similarity score (0.87).
   Focus on explaining the strong connections.
   ```

3. **Request strategic questions**
   ```
   Generate 3 strategic questions for researching this contact further.
   Make them specific, actionable, and professional.
   ```

4. **Set confidence threshold**
   ```
   Provide a confidence score (0-100).
   Only return results with confidence >= 70.
   ```

---

## Configuration & Constants

### Location

- **Contact Constants**: `lib/services/serviceContact/client/constants/contactConstants.js`
- **AI Costs**: `lib/services/constants/aiCosts.js`
- **API Costs**: `lib/services/constants/apiCosts.js`

### Contact Constants

```javascript
// Pinecone index configuration
export const SEMANTIC_SEARCH_CONFIG = {
  INDEX_NAME: 'networking-app-contacts',
  EMBEDDING_MODEL: 'text-embedding-004',
  DEFAULT_MAX_RESULTS: 10,
  CACHE_TTL_MS: 10 * 60 * 1000,  // 10 minutes

  RERANK_MODELS: {
    MULTILINGUAL: 'rerank-multilingual-v3.0',
    ENGLISH: 'rerank-english-v3.0'
  },

  DEFAULT_RERANK_MODEL: 'rerank-multilingual-v3.0',
  DEFAULT_RERANK_TOP_N: 10,
};

// Similarity thresholds by subscription level
export const VECTOR_SIMILARITY_THRESHOLDS = {
  enterprise: {
    high: 0.35,
    medium: 0.25,
    low: 0.15,
    minimum: 0.10  // Filter out anything below this
  },
  business: {
    high: 0.40,
    medium: 0.30,
    low: 0.20,
    minimum: 0.15
  },
  premium: {
    high: 0.45,
    medium: 0.35,
    low: 0.25,
    minimum: 0.20
  },
  base: {
    high: 0.50,
    medium: 0.40,
    low: 0.30,
    minimum: 0.25
  }
};

// Helper function
export function getVectorThresholds(subscriptionLevel) {
  const level = subscriptionLevel?.toLowerCase() || 'base';
  return VECTOR_SIMILARITY_THRESHOLDS[level] || VECTOR_SIMILARITY_THRESHOLDS.base;
}

// Rerank thresholds
export const RERANK_SIMILARITY_THRESHOLDS = {
  enterprise: {
    high: 0.70,
    medium: 0.50,
    low: 0.30,
    minimum: 0.20
  },
  // ... similar for other tiers
};

// AI confidence thresholds
export const AI_CONFIDENCE_THRESHOLDS = {
  enterprise: 60,  // Show insights with 60%+ confidence
  business: 65,
  premium: 70,
  base: 75
};
```

### AI Costs

```javascript
// Gemini embedding
export const GEMINI_EMBEDDING_CONFIG = {
  MODEL_NAME: 'text-embedding-004',
  DIMENSION: 768,
  PRICING: {
    INPUT_PER_MILLION: 0.10
  }
};

// Gemini generation
export const GEMINI_PRICING = {
  'gemini-2.5-flash': {
    inputPricePerMillionTokens: 0.30,
    outputPricePerMillionTokens: 2.50,
  },
  'gemini-2.5-pro': {
    inputPricePerMillionTokens: 1.25,
    outputPricePerMillionTokens: 10.00,
  }
};
```

### API Costs

```javascript
// Pinecone
export const PINECONE = {
  QUERY_BASE: 0.0001,  // Per query
};

// Cohere
export const COHERE = {
  RERANK_MULTILINGUAL_V3: {
    PER_1000: 1.00,      // $1 per 1000 searches
    PER_REQUEST: 0.001   // $0.001 per search
  },
};
```

---

## Cost Tracking

### Multi-Step Session Tracking

Semantic search is a **multi-step operation** that uses the `SessionUsage` collection to track all steps together as one logical operation. This follows the same pattern as business card scanning.

#### Session Structure

```
SessionUsage/{userId}/sessions/session_search_1234567890_abcd
{
  feature: 'semantic_search',
  status: 'in-progress' | 'completed',
  totalCost: 0.006,      // Sum of all steps
  totalRuns: 1,          // Counts as 1 search operation
  steps: [
    {
      operationId: 'search_123_abc',
      usageType: 'ApiUsage',
      feature: 'semantic_search_vector',
      provider: 'pinecone+gemini',
      cost: 0.0001,
      isBillableRun: false,  // Only final step counts as billable
      timestamp: '2025-10-16T...',
      metadata: {
        queryLength: 45,
        embeddingTime: 234,
        searchDuration: 156,
        tokens: 12,
        resultsFound: 10
      }
    },
    {
      operationId: 'rerank_456_def',
      usageType: 'ApiUsage',
      feature: 'semantic_search_rerank',
      provider: 'rerank-multilingual-v3.0',
      cost: 0.001,
      isBillableRun: false,
      timestamp: '2025-10-16T...',
      metadata: {
        documentsReranked: 10,
        queryLanguage: 'en',
        topN: 10
      }
    },
    {
      operationId: 'enhance_789_ghi',
      usageType: 'AIUsage',
      feature: 'semantic_search_ai_enhance',
      provider: 'gemini-2.5-flash',
      cost: 0.005,
      isBillableRun: true,  // High confidence results count as billable
      timestamp: '2025-10-16T...',
      metadata: {
        contactId: 'contact_abc',
        confidence: 87,
        subscriptionLevel: 'business'
      }
    }
  ],
  createdAt: Timestamp(2025-10-16T10:30:00Z),
  lastUpdatedAt: Timestamp(2025-10-16T10:30:05Z),
  completedAt: Timestamp(2025-10-16T10:30:05Z)
}
```

### Cost Components

Each semantic search can incur up to 3 costs (all tracked in one session):

```javascript
// Step 1: Vector Search Cost
const vectorCost = embeddingCost + pineconeCost;
// embeddingCost = (tokens / 1M) * $0.10
// pineconeCost = $0.0001

// Step 2: Reranking Cost (if enabled)
const rerankCost = $0.001; // Per search, not per document

// Step 3: AI Enhancement Cost (if enabled)
const aiCost = inputCost + outputCost;
// inputCost = (inputTokens / 1M) * (modelRate)
// outputCost = (outputTokens / 1M) * (modelRate)

// Total (stored in session.totalCost)
const totalCost = vectorCost + rerankCost + aiCost;
```

### Session Tracking Flow

```javascript
// CLIENT: Generate sessionId
const sessionId = `session_search_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

// STEP 1: Vector Search
await ContactApiClient.post('/api/user/contacts/semantic-search', {
  query,
  maxResults,
  // sessionId is generated by API and returned to client
});
// → Records step: 'semantic_search_vector' in SessionUsage

// STEP 2: Rerank (if applicable)
await ContactApiClient.post('/api/user/contacts/rerank', {
  query,
  contacts,
  sessionId  // Pass sessionId from vector search
});
// → Records step: 'semantic_search_rerank' in SAME session

// STEP 3: AI Enhancement (if applicable)
await ContactApiClient.post('/api/user/contacts/ai-enhance-results', {
  query,
  contacts,
  sessionId  // Pass sessionId
});
// → Records step: 'semantic_search_ai_enhance' in SAME session
// → Finalizes session with status: 'completed'
```

### Recording Costs

The system uses `CostTrackingService.recordUsage()` with `sessionId` parameter:

```javascript
// Recording a step in the session
await CostTrackingService.recordUsage({
  userId,
  usageType: 'ApiUsage',  // or 'AIUsage'
  feature: 'semantic_search_vector',
  cost: 0.0001,
  isBillableRun: false,  // Only final step counts as billable
  provider: 'pinecone+gemini',
  sessionId,  // Links this to the session
  metadata: {
    queryLength: 45,
    resultsFound: 10,
    // ... more metadata
  }
});
```

**Key Points:**
- Each step is recorded with `sessionId`
- Steps are automatically added to the session's `steps` array
- Session's `totalCost` and `totalRuns` are auto-incremented
- Only AI enhancement with high confidence counts as `isBillableRun: true`
- Session is finalized when AI enhancement completes

### User Document Updates

In addition to `SessionUsage`, the user document is also updated:

```javascript
users/{userId}
{
  monthlyTotalCost: 0.006,        // Incremented with each step cost
  monthlyBillableRuns: 1,         // Incremented only for billable steps
  monthlyUsageMonth: "2025-10",   // Current month
  monthlyUsageLastUpdated: Timestamp
}
```

This enables:
- Real-time budget tracking
- Pre-flight affordability checks
- Dashboard budget displays

### Cost Estimation vs Actual

```javascript
// BEFORE operation: Check affordability
const estimate = SemanticSearchService.estimateCost(query);
const canAfford = await CostTrackingService.canAffordOperation(
  userId,
  estimate.totalCost,
  1  // Requires 1 billable run
);

if (!canAfford) {
  return error('Insufficient budget');
}

// DURING operation: Record each step with sessionId
await CostTrackingService.recordUsage({
  userId,
  usageType: 'ApiUsage',
  feature: 'semantic_search_vector',
  cost: actualCost,
  isBillableRun: false,
  provider: 'pinecone+gemini',
  sessionId  // Multi-step tracking
});

// AFTER operation: Session is finalized
await SessionTrackingService.finalizeSession({ userId, sessionId });
```

### Budget Management

Users have budget limits based on subscription:

```javascript
const monthlyBudgets = {
  base: 5.00,        // $5/month
  premium: 25.00,    // $25/month
  business: 100.00,  // $100/month
  enterprise: 500.00 // $500/month
};
```

### Benefits of Session Tracking

1. **✅ Unified View**: All costs grouped under one session
2. **✅ Better Analytics**: See which step costs most, which fails most
3. **✅ Atomic Operations**: All steps or none (for critical operations)
4. **✅ Debugging**: Easy to trace full pipeline for a single search
5. **✅ Consistent Pattern**: Same as business card scanning, Google Maps, etc.

### Querying Session Data

```javascript
// Get a specific session
const session = await SessionTrackingService.getSession(userId, sessionId);

// Get all semantic search sessions
const sessions = await SessionTrackingService.getUserSessions(userId, {
  status: 'completed',
  limit: 50
});

// Sessions contain:
sessions.forEach(session => {
  console.log(session.feature);        // 'semantic_search'
  console.log(session.totalCost);      // 0.006
  console.log(session.steps.length);   // 3 (vector, rerank, enhance)
  console.log(session.status);         // 'completed'
});
```

---

## API Reference

### 1. Semantic Search API

**Endpoint**: `POST /api/user/contacts/semantic-search`

**Headers**:
```
Authorization: Bearer <firebase-id-token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "query": "Find machine learning experts",
  "maxResults": 10,
  "includeMetadata": true,
  "trackCosts": true
}
```

**Response**:
```json
{
  "results": [
    {
      "id": "contact_abc123",
      "name": "John Doe",
      "company": "Acme Corp",
      "title": "ML Engineer",
      "bio": "10 years in AI...",
      "tags": ["AI", "Python"],
      "_vectorScore": 0.87,
      "_searchRank": 1,
      "_similarityTier": "high",
      "searchMetadata": {
        "score": 0.87,
        "rank": 1,
        "searchId": "search_123",
        "timestamp": "2025-10-16T10:30:00Z"
      }
    }
  ],
  "sessionId": "session_search_1234567890_abcd",  // NEW: For multi-step tracking
  "searchMetadata": {
    "searchId": "search_123",
    "queryEmbeddingTokens": 8,
    "totalResults": 10,
    "namespace": "user_xyz",
    "timestamp": "2025-10-16T10:30:00Z"
  },
  "billing": {
    "embeddingCost": 0.0000008,
    "searchCost": 0.0001,
    "totalCost": 0.0001008,
    "sessionTracking": true,  // NEW: Indicates SessionUsage tracking
    "tracked": true
  }
}
```

---

### 2. Rerank API

**Endpoint**: `POST /api/user/contacts/rerank`

**Request Body**:
```json
{
  "query": "Find machine learning experts",
  "contacts": [
    { "id": "contact_1", "name": "John", "_vectorScore": 0.87, ... },
    { "id": "contact_2", "name": "Jane", "_vectorScore": 0.76, ... }
  ],
  "model": "rerank-multilingual-v3.0",
  "topN": 10,
  "trackCosts": true,
  "sessionId": "session_search_1234567890_abcd"  // NEW: For multi-step tracking
}
```

**Response**:
```json
{
  "results": [
    {
      "id": "contact_1",
      "name": "John Doe",
      "_vectorScore": 0.87,
      "searchMetadata": {
        "rerankScore": 0.95,
        "hybridScore": 0.926,
        "rerankRank": 1,
        "originalRank": 1,
        "rankChange": 0
      }
    }
  ],
  "metadata": {
    "rerankId": "rerank_456",
    "model": "rerank-multilingual-v3.0",
    "totalReranked": 10,
    "timestamp": "2025-10-15T10:30:05Z"
  },
  "billing": {
    "baseCost": 0.001,
    "totalCost": 0.001,
    "tracked": true
  }
}
```

---

### 3. AI Enhancement API

**Endpoint**: `POST /api/user/contacts/ai-enhance-results`

**Request Body (Batch)**:
```json
{
  "originalQuery": "Find machine learning experts",
  "contacts": [...],
  "mode": "batch",
  "includeStrategicQuestions": true,
  "confidenceThreshold": 70,
  "trackCosts": true,
  "sessionId": "session_search_1234567890_abcd"  // NEW: For multi-step tracking
}
```

**Response (Batch)**:
```json
{
  "insights": [
    {
      "contactId": "contact_1",
      "explanation": "John is highly relevant because he has 10 years of ML experience...",
      "factors": [
        "Machine learning expertise",
        "Healthcare AI projects",
        "Python & TensorFlow skills"
      ],
      "strategicQuestions": [
        "What ML projects has John completed recently?",
        "How does his healthcare experience apply?",
        "Is he available for consulting?"
      ],
      "confidence": 87,
      "billing": {
        "inputTokens": 450,
        "outputTokens": 120,
        "estimatedCost": 0.000435
      }
    }
  ],
  "billing": {
    "totalInputTokens": 4500,
    "totalOutputTokens": 1200,
    "modelUsed": "gemini-2.5-flash",
    "totalCost": 0.00435,
    "tracked": true
  }
}
```

**Request Body (Streaming)**:
```json
{
  "originalQuery": "Find machine learning experts",
  "contacts": [...],
  "mode": "streaming",
  "includeStrategicQuestions": true,
  "trackCosts": true,
  "sessionId": "session_search_1234567890_abcd"  // NEW: For multi-step tracking
}
```

**Response (Streaming)**: Server-Sent Events (SSE)

```
{"type":"result","insight":{...},"progress":{"current":1,"total":10}}

{"type":"result","insight":{...},"progress":{"current":2,"total":10}}

{"type":"billing","data":{...}}

{"type":"complete","summary":{...}}
```

---

## Error Handling

### Common Errors

#### 1. Pinecone Index Not Found (404)

**Error**:
```
PineconeNotFoundError: A call to https://api.pinecone.io/indexes/networking-app-contacts returned HTTP status 404
```

**Cause**: The Pinecone index doesn't exist

**Solution**:
```javascript
// Use VectorService.getIndex() which auto-creates
const index = await VectorService.getIndex();

// Or create manually via Pinecone console
```

---

#### 2. User Not Found

**Error**:
```
ContactApiError: User not found
```

**Cause**: Using wrong Firestore collection (`AccountData` vs `users`)

**Solution**:
```javascript
// WRONG
const userDoc = await adminDb.collection('AccountData').doc(userId).get();

// CORRECT
const userDoc = await adminDb.collection('users').doc(userId).get();
```

---

#### 3. Insufficient Budget

**Error**:
```json
{
  "error": "INSUFFICIENT_BUDGET",
  "message": "Insufficient budget for operation",
  "details": {
    "required": 0.05,
    "available": 0.02,
    "operationType": "semantic_search"
  }
}
```

**Cause**: User has exceeded their monthly budget

**Solution**: User needs to upgrade subscription or wait for next billing cycle

---

#### 4. Unauthorized (401)

**Error**:
```json
{
  "error": "Unauthorized",
  "message": "Missing or invalid authorization header"
}
```

**Cause**: Missing or invalid Firebase ID token

**Solution**:
```javascript
// Ensure Firebase auth is initialized
const idToken = await firebase.auth().currentUser.getIdToken();

// Include in request
headers: {
  'Authorization': `Bearer ${idToken}`
}
```

---

#### 5. Feature Not Available

**Error**:
```json
{
  "error": "FEATURE_NOT_AVAILABLE",
  "message": "AI enhancement requires Business subscription or higher",
  "requiredLevel": "business",
  "currentLevel": "premium"
}
```

**Cause**: User's subscription doesn't include requested feature

**Solution**: Upgrade subscription or disable feature in UI

---

### Error Response Format

All API routes return errors in consistent format:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {
    // Additional context
  }
}
```

---

## Troubleshooting

### Search Returns No Results

**Possible Causes**:

1. **No contacts have been indexed**
   - Check: Do contacts have embeddings in Pinecone?
   - Solution: Run VectorService.upsertContacts() for each contact

2. **Similarity threshold too high**
   - Check: What's the user's subscription level?
   - Solution: Lower threshold or upgrade subscription

3. **Query too specific**
   - Example: "Find iOS developers with 10 years in healthcare who speak French"
   - Solution: Simplify query or expand contact data

4. **Wrong namespace**
   - Check: Is userId correct?
   - Solution: Verify namespace = `user_${userId}`

---

### Reranking Not Improving Results

**Possible Causes**:

1. **Contact documents too short**
   - Documents need rich text for reranking to work
   - Solution: Ensure contacts have bio, tags, notes filled out

2. **Query is too simple**
   - Example: "John Smith"
   - Solution: Reranking helps with complex queries, not name searches

3. **Already high-quality results**
   - Vector search may already be returning best matches
   - Solution: This is actually good! Reranking confirms quality.

---

### Rerank Scores Extremely Low (<5%) Despite Relevant Contacts

**Symptoms**: Query like "Find me CTO I met at a security conference" returns 0 results even though matching contacts exist.

**Root Cause**: Missing contextual fields in rerank documents (v2.3 fixes this).

**Debugging Steps**:

1. **Check rerank document logs**:
   ```
   📋 [RerankDoc] Contact: John Doe | Fields: [name, email, company, jobTitle, ...]
   ```
   - ❌ BAD: Only sees `[name, email, company]` → Missing job title
   - ❌ BAD: No `eventInfo.eventName` → Can't match "security conference"
   - ✅ GOOD: Sees `[name, email, company, jobTitle, eventInfo.eventName, eventInfo.eventType]`

2. **Verify contact data structure**:
   - Job titles may be in `contact.details` array, not top-level `contact.jobTitle`
   - Event info is in `contact.eventInfo` object
   - Check: `console.log(contact.details, contact.eventInfo)`

3. **Check extraction logs**:
   ```
   ℹ️  Extracted job title from details array: CTO
   ℹ️  Extracted company from details array: Stripe
   ```
   - If you see these, extraction helpers are working correctly

**Solutions**:

1. **Update to v2.3**: Includes field extraction helpers and eventInfo support
2. **Populate eventInfo**: When creating contacts from events, include:
   ```javascript
   eventInfo: {
     eventName: "Security Conference 2025",
     eventType: "security_conference",
     venue: "Convention Center",
     eventDates: "October 20-23, 2025"
   }
   ```
3. **Verify originalSource**: Should be "business_card_scan", "exchange_form", or "manual"

**Why This Matters**:
- Query: "CTO at security conference" has TWO criteria: role (CTO) AND context (security conference)
- Without job title: Cohere can't match "CTO"
- Without eventInfo: Cohere can't match "security conference"
- Result: Score drops from 65% to 1.4% → filtered out

---

### AI Enhancement Producing Low-Confidence Results

**Possible Causes**:

1. **Contact profiles incomplete**
   - AI needs rich data to generate insights
   - Solution: Encourage users to fill out contact details

2. **Query mismatch**
   - Contact doesn't actually relate to query
   - Solution: This is working as intended - filter by confidence

3. **Confidence threshold too high**
   - Enterprise: 60%, Business: 65%, Premium: 70%, Base: 75%
   - Solution: Lower threshold or upgrade subscription

---

### High Costs

**Possible Causes**:

1. **Too many results**
   - maxResults = 50 means 50 AI enhancement calls
   - Solution: Limit maxResults to 10-20

2. **Streaming mode overuse**
   - Streaming processes all contacts, even low-confidence ones
   - Solution: Use batch mode which filters by confidence first

3. **Using Pro model unnecessarily**
   - gemini-2.5-pro is 4x more expensive than Flash
   - Solution: Use Flash unless quality is critical

---

### Stale Results

**Possible Causes**:

1. **Client-side caching**
   - localStorage caches results for 10 minutes
   - Solution: Clear cache or wait for TTL expiry

2. **Outdated embeddings**
   - Contact updated but vector not regenerated
   - Solution: Trigger re-embedding on contact update

---

## Next Steps & Future Features

This section outlines planned enhancements and context-driven AI features that will extend the semantic search system into a comprehensive contact intelligence platform.

---

### Phase 1: Context-Driven AI Actions (Planned)

Currently, AI enhancement generates insights during the search flow. The next evolution is **on-demand, context-driven AI features** that users can trigger per contact.

#### Vision

Transform search results from a static list into an **interactive intelligence platform** where users can:
- Get instant icebreakers for outreach
- Research company context before meetings
- Generate personalized message templates
- Analyze relationship opportunities

#### Implementation Location

**UI Component**: `app/dashboard/(dashboard pages)/contacts/components/contacts/ContactCard.jsx`

Each contact card will have action buttons that trigger AI-powered contextual features.

---

### 1. Smart Icebreakers Generator

**Feature**: Generate personalized conversation starters based on contact profile and user's context.

#### UI Design

```jsx
<ContactCard contact={contact}>
  <ActionButtons>
    <Button onClick={() => generateIcebreakers(contact)}>
      💬 Get Icebreakers
    </Button>
  </ActionButtons>
</ContactCard>
```

#### API Endpoint (New)

```
POST /api/user/contacts/ai-icebreakers
```

**Request**:
```json
{
  "contactId": "contact_abc123",
  "userContext": {
    "purpose": "networking",  // or "sales", "partnership", "hiring"
    "tone": "professional",   // or "casual", "friendly"
    "event": "AI Summit 2025" // Optional: where you met
  },
  "sessionId": "search_123"  // If part of search flow
}
```

**Response**:
```json
{
  "icebreakers": [
    {
      "type": "shared_interest",
      "message": "I saw you're working on healthcare ML. I'm currently exploring similar applications in medical imaging.",
      "reasoning": "Both have healthcare + ML background",
      "confidence": 92
    },
    {
      "type": "recent_activity",
      "message": "Congratulations on your recent promotion to VP of Engineering! How has the transition been?",
      "reasoning": "Recent LinkedIn activity shows promotion",
      "confidence": 88
    },
    {
      "type": "mutual_connection",
      "message": "I noticed we both know Jane Smith. How did you two connect?",
      "reasoning": "Shared connection detected",
      "confidence": 85
    }
  ],
  "bestMatch": 0,  // Index of highest confidence icebreaker
  "billing": {
    "cost": 0.002,
    "model": "gemini-2.5-flash"
  }
}
```

#### Prompt Strategy

```javascript
const prompt = `
You are a professional networking coach helping craft genuine icebreakers.

CONTACT PROFILE:
- Name: ${contact.name}
- Company: ${contact.company}
- Title: ${contact.jobTitle}
- Background: ${contact.bio}
- Interests: ${contact.tags?.join(', ')}
- Recent activity: ${contact.recentActivity}

USER CONTEXT:
- Purpose: ${userContext.purpose}
- Tone: ${userContext.tone}
- Meeting context: ${userContext.event || 'Professional networking'}

TASK:
Generate 3 personalized icebreakers that:
1. Reference shared interests or experiences
2. Show genuine curiosity
3. Avoid generic small talk
4. Match the specified tone
5. Are appropriate for the purpose

Return JSON:
{
  "icebreakers": [
    {
      "type": "shared_interest" | "recent_activity" | "mutual_connection" | "industry_insight",
      "message": "Your icebreaker here",
      "reasoning": "Why this icebreaker works",
      "confidence": 0-100
    }
  ]
}
`;
```

#### Use Cases

- **Before networking events**: Prepare conversation starters
- **Cold outreach**: Craft personalized opening lines
- **Follow-ups**: Reference previous interactions
- **Meeting prep**: Break the ice naturally

---

### 2. Company Context Intelligence

**Feature**: Deep-dive research on a contact's company before meetings or outreach.

#### UI Design

```jsx
<ContactCard contact={contact}>
  <ActionButtons>
    <Button onClick={() => getCompanyContext(contact)}>
      🏢 Research Company
    </Button>
  </ActionButtons>
</ContactCard>
```

#### API Endpoint (New)

```
POST /api/user/contacts/ai-company-context
```

**Request**:
```json
{
  "contactId": "contact_abc123",
  "companyName": "Acme Corp",
  "researchDepth": "standard",  // or "deep" for Enterprise
  "focusAreas": ["products", "recent_news", "culture", "funding"]
}
```

**Response**:
```json
{
  "company": {
    "name": "Acme Corp",
    "industry": "Healthcare AI",
    "size": "50-200 employees",
    "founded": "2018",
    "headquarters": "San Francisco, CA"
  },
  "insights": {
    "recentNews": [
      {
        "headline": "Acme Corp raises $20M Series B",
        "date": "2025-09-15",
        "relevance": "high",
        "summary": "Led by Sequoia Capital, funding will expand AI research team"
      },
      {
        "headline": "FDA approves Acme's AI diagnostic tool",
        "date": "2025-08-01",
        "relevance": "high",
        "summary": "First AI-powered diagnostic approved for clinical use"
      }
    ],
    "products": [
      {
        "name": "MedAI Diagnostics",
        "description": "AI-powered medical imaging analysis",
        "stage": "production"
      }
    ],
    "culture": {
      "values": ["Innovation", "Patient-first", "Scientific rigor"],
      "workStyle": "Hybrid (3 days in office)",
      "benefits": "Comprehensive healthcare, unlimited PTO"
    },
    "funding": {
      "totalRaised": "$35M",
      "lastRound": "Series B",
      "investors": ["Sequoia Capital", "Andreessen Horowitz"]
    }
  },
  "conversationTopics": [
    "Ask about their FDA approval process and learnings",
    "Discuss applications of AI in medical diagnostics",
    "Explore their Series B expansion plans",
    "Learn about their approach to clinical validation"
  ],
  "relevanceToYou": {
    "sharedInterests": ["AI", "Healthcare", "Startups"],
    "potentialCollaboration": "Your medical imaging project aligns with their diagnostic platform",
    "confidence": 87
  },
  "billing": {
    "cost": 0.005,
    "model": "gemini-2.5-flash",
    "searchesPerformed": 3  // May include web searches
  }
}
```

#### Features by Subscription Tier

| Feature | Premium | Business | Enterprise |
|---------|---------|----------|------------|
| Basic company info | ✅ | ✅ | ✅ |
| Recent news (last 3 months) | 3 articles | 10 articles | Unlimited |
| Product analysis | Basic | Detailed | Deep analysis |
| Culture insights | ❌ | ✅ | ✅ |
| Funding history | ❌ | ✅ | ✅ |
| Web search integration | ❌ | ❌ | ✅ |
| Competitive analysis | ❌ | ❌ | ✅ |

#### Use Cases

- **Pre-meeting research**: Know who you're talking to
- **Sales preparation**: Understand pain points and opportunities
- **Partnership evaluation**: Assess strategic fit
- **Investment research**: Due diligence before investor meetings

---

### 3. Personalized Message Generator

**Feature**: AI-crafted outreach messages tailored to contact and purpose.

#### UI Design

```jsx
<ContactCard contact={contact}>
  <ActionButtons>
    <Button onClick={() => generateMessage(contact, 'email')}>
      ✉️ Draft Email
    </Button>
    <Button onClick={() => generateMessage(contact, 'linkedin')}>
      💼 LinkedIn Message
    </Button>
  </ActionButtons>
</ContactCard>
```

#### API Endpoint (New)

```
POST /api/user/contacts/ai-message-generator
```

**Request**:
```json
{
  "contactId": "contact_abc123",
  "messageType": "email",  // or "linkedin", "intro_request"
  "purpose": "meeting_request",  // or "collaboration", "advice", "job_inquiry"
  "tone": "professional",  // or "casual", "formal"
  "keyPoints": [
    "Interested in discussing healthcare AI applications",
    "Met at AI Summit 2025",
    "Working on similar medical imaging project"
  ],
  "userProfile": {
    "name": "Your Name",
    "company": "Your Company",
    "title": "Your Title"
  }
}
```

**Response**:
```json
{
  "messages": [
    {
      "variant": "direct",
      "subject": "Following up from AI Summit - Healthcare ML Collaboration",
      "body": "Hi John,\n\nIt was great connecting with you at the AI Summit last week. I was particularly interested in your work on healthcare ML applications at Acme Corp.\n\nI'm currently leading a medical imaging project at [Your Company], and I think there could be some interesting synergies between our approaches. Would you be open to a quick 20-minute call next week to explore potential collaboration?\n\nLooking forward to hearing from you.\n\nBest,\n[Your Name]",
      "confidence": 92,
      "style": "Short, direct, action-oriented"
    },
    {
      "variant": "warm",
      "subject": "Great meeting you at AI Summit!",
      "body": "Hi John,\n\nI really enjoyed our conversation about healthcare AI at the summit. Your insights on FDA approval for ML diagnostics were fascinating!\n\nI've been thinking about what you said regarding clinical validation, and I'd love to continue the discussion. I'm working on a medical imaging project that faces similar challenges.\n\nWould you be interested in grabbing coffee (virtual or in-person) to share learnings? I think we could both benefit from comparing notes.\n\nCheers,\n[Your Name]",
      "confidence": 88,
      "style": "Warm, conversational, relationship-focused"
    },
    {
      "variant": "value_first",
      "subject": "Resource on medical imaging ML you might find useful",
      "body": "Hi John,\n\nI came across this recent paper on AI diagnostic accuracy that made me think of our conversation at the AI Summit: [link]\n\nGiven your work on MedAI Diagnostics, I thought you might find the methodology interesting. The authors achieved 94% sensitivity using a similar approach to what I understood Acme is exploring.\n\nI'd be curious to hear your thoughts if you have a chance to review it. Also happy to discuss our own findings from medical imaging projects if helpful.\n\nBest regards,\n[Your Name]",
      "confidence": 90,
      "style": "Value-first, expertise-driven, consultative"
    }
  ],
  "recommendations": {
    "bestVariant": 2,  // "value_first" variant
    "reasoning": "Contact is senior-level technical person. Value-first approach shows expertise and creates reciprocity without asking immediately.",
    "timing": "Send Tuesday-Thursday morning for best response rate",
    "followUp": "If no response in 7 days, send brief follow-up referencing the paper"
  },
  "billing": {
    "cost": 0.003,
    "model": "gemini-2.5-flash"
  }
}
```

#### Message Types

1. **Email**
   - Subject line optimization
   - Multiple lengths (brief, standard, detailed)
   - Professional formatting

2. **LinkedIn Message**
   - Character limit-optimized
   - LinkedIn-specific etiquette
   - Connection request templates

3. **Introduction Request**
   - Double-opt-in intro format
   - Forwardable templates
   - Value prop for both parties

#### Use Cases

- **Cold outreach**: Personalized first contact
- **Warm introductions**: Request introductions from mutual connections
- **Follow-ups**: Professional post-event/meeting messages
- **Collaboration requests**: Partnership and collaboration proposals

---

### 4. Relationship Intelligence

**Feature**: Analyze relationship strength, shared history, and engagement opportunities.

#### UI Design

```jsx
<ContactCard contact={contact}>
  <ActionButtons>
    <Button onClick={() => analyzeRelationship(contact)}>
      🤝 Relationship Insights
    </Button>
  </ActionButtons>
</ContactCard>
```

#### API Endpoint (New)

```
POST /api/user/contacts/ai-relationship-analysis
```

**Response**:
```json
{
  "relationshipStrength": {
    "score": 7.5,
    "level": "developing",  // "new", "developing", "established", "strong"
    "trend": "improving",    // "new", "improving", "stable", "declining"
    "factors": {
      "interactionFrequency": 6,
      "responseRate": 85,
      "sharedConnections": 12,
      "commonInterests": 8,
      "professionalAlignment": 9
    }
  },
  "engagementHistory": {
    "lastContact": "2025-09-20",
    "daysSinceLastContact": 26,
    "totalInteractions": 8,
    "initiatedByYou": 5,
    "initiatedByThem": 3
  },
  "recommendations": [
    {
      "action": "reach_out",
      "urgency": "medium",
      "reason": "26 days since last contact. Relationship may cool if not maintained.",
      "suggestedMessage": "Quick check-in about their recent FDA approval news"
    },
    {
      "action": "introduce",
      "urgency": "low",
      "reason": "Strong shared interest in healthcare AI. Could benefit from intro to Sarah Chen (ML researcher)",
      "value": "Potential collaboration opportunity"
    },
    {
      "action": "engage_content",
      "urgency": "low",
      "reason": "They recently posted about clinical AI validation. Thoughtful comment could strengthen relationship.",
      "timing": "Within 24 hours of post"
    }
  ],
  "opportunities": [
    {
      "type": "collaboration",
      "description": "Both working on medical imaging ML",
      "potential": "high",
      "nextSteps": "Propose knowledge-sharing call"
    },
    {
      "type": "introduction",
      "description": "Could introduce to your investor network",
      "potential": "medium",
      "nextSteps": "Assess their fundraising status first"
    }
  ]
}
```

#### Use Cases

- **Relationship maintenance**: Know when to reach out
- **Network optimization**: Identify valuable connections
- **Strategic planning**: Prioritize relationship building
- **Introduction matching**: Find mutual value opportunities

---

### 5. Meeting Preparation Assistant

**Feature**: Comprehensive meeting briefing with talking points and context.

#### UI Design

```jsx
<ContactCard contact={contact}>
  <ActionButtons>
    <Button onClick={() => prepareMeeting(contact)}>
      📅 Prep Meeting
    </Button>
  </ActionButtons>
</ContactCard>
```

#### API Endpoint (New)

```
POST /api/user/contacts/ai-meeting-prep
```

**Request**:
```json
{
  "contactId": "contact_abc123",
  "meetingType": "sales_call",  // or "networking", "interview", "partnership"
  "meetingDuration": 30,  // minutes
  "yourGoals": [
    "Understand their ML infrastructure needs",
    "Assess partnership fit",
    "Schedule follow-up technical demo"
  ]
}
```

**Response**:
```json
{
  "briefing": {
    "contactSummary": {
      "name": "John Doe",
      "role": "VP of Engineering at Acme Corp",
      "background": "10 years in healthcare AI, former Google ML engineer",
      "decisionMakingPower": "high",
      "personalityStyle": "analytical, data-driven, values efficiency"
    },
    "companyContext": {
      "recentEvents": [
        "Just raised Series B ($20M)",
        "FDA approval 2 months ago",
        "Hiring 20 engineers"
      ],
      "currentPriorities": [
        "Scaling infrastructure for clinical deployments",
        "Building AI safety and compliance systems",
        "Expanding to European markets"
      ],
      "painPoints": [
        "Need for robust ML infrastructure",
        "Compliance with medical regulations",
        "Scalability challenges"
      ]
    },
    "conversationGuide": {
      "openingTopics": [
        "Congratulate on recent FDA approval",
        "Reference AI Summit conversation",
        "Show knowledge of their medical imaging work"
      ],
      "keyDiscussionPoints": [
        {
          "topic": "Infrastructure needs",
          "questions": [
            "How are you currently handling ML model deployments in clinical settings?",
            "What compliance requirements are most challenging?",
            "How do you ensure model reliability and safety?"
          ],
          "yourValueProp": "Our platform is HIPAA-compliant and used by 3 healthcare unicorns"
        },
        {
          "topic": "Partnership exploration",
          "questions": [
            "What's your technical stack for ML infrastructure?",
            "Where do you see the biggest integration challenges?",
            "What would an ideal partnership look like for Acme?"
          ],
          "yourValueProp": "We specialize in healthcare ML infrastructure with FDA-validated deployment pipelines"
        }
      ],
      "thingsToAvoid": [
        "Don't oversell - they value technical depth over sales pitches",
        "Avoid generic AI buzzwords - be specific",
        "Don't rush to demo - build trust first"
      ]
    },
    "closingStrategy": {
      "objectives": [
        "Schedule technical deep-dive with their ML team",
        "Share case study from similar healthcare company",
        "Get intro to Head of Compliance"
      ],
      "nextSteps": [
        "Send follow-up email within 24 hours",
        "Include promised case study",
        "Propose specific date for technical demo"
      ]
    },
    "timing": {
      "meetingDuration": "30 minutes",
      "recommendedStructure": {
        "rapport": "5 minutes",
        "discovery": "15 minutes",
        "value_presentation": "7 minutes",
        "next_steps": "3 minutes"
      }
    }
  },
  "quickFacts": [
    "Met at AI Summit 2025",
    "Strong interest in healthcare ML infrastructure",
    "Former Google ML engineer (credibility)",
    "Company just raised $20M Series B (budget available)",
    "FDA approval = urgent need for scalable infrastructure"
  ],
  "billing": {
    "cost": 0.008,
    "model": "gemini-2.5-pro"  // Pro model for comprehensive analysis
  }
}
```

#### Use Cases

- **Sales meetings**: Understand prospect needs
- **Networking calls**: Maximize limited time
- **Investor pitches**: Know your audience
- **Partnership discussions**: Identify win-win scenarios

---

### 6. Smart Contact Enrichment

**Feature**: Automatically enhance contact profiles with public data and AI inference.

#### UI Design

```jsx
<ContactCard contact={contact}>
  <ActionButtons>
    <Button onClick={() => enrichContact(contact)}>
      ✨ Enrich Profile
    </Button>
  </ActionButtons>
</ContactCard>
```

**What Gets Enhanced**:
- LinkedIn profile data (job history, skills, education)
- Recent professional activity and posts
- Company information and funding
- Shared connections and mutual interests
- Industry classification and expertise areas
- Inferred personality traits and communication style

---

### Phase 2: Advanced Intelligence Features

#### 1. Network Mapping & Visualization
- Visual relationship graphs
- Identify key connectors
- Find shortest path to target contacts
- Community detection in your network

#### 2. Opportunity Detection
- Automatically identify:
  - Hiring contacts (job openings)
  - Fundraising contacts (investor connections)
  - Partnership opportunities (complementary businesses)
  - Speaking opportunities (event organizers)

#### 3. Automated Follow-ups
- Smart reminder system
- Automated relationship maintenance
- Event-triggered outreach (promotions, funding, news)

#### 4. Competitive Intelligence
- Track when contacts join competitors
- Industry trend analysis from your network
- Early signals of market shifts

#### 5. Team Collaboration
- Share contact intelligence with team
- Collaborative relationship management
- Role-based access to AI features

---

### Technical Implementation Plan

#### Architecture

All features follow the same pattern:

```
ContactCard (UI)
    ↓
Client Service (AI Actions)
    ↓
API Route (/api/user/contacts/ai-[feature])
    ↓
Server Service (AI[Feature]Service.js)
    ↓
Gemini API + Optional Web Search
```

#### Cost Management

Each feature:
- Estimates cost before execution
- Checks affordability via CostTrackingService
- Records actual usage in SessionUsage or AIUsage
- Provides transparent billing to user

#### Caching Strategy

- Cache company research for 24 hours
- Cache relationship analysis for 7 days
- Cache meeting prep until meeting time
- Invalidate on contact profile updates

#### Rate Limiting

- Prevent abuse with per-user rate limits
- Tier-based feature access
- Cost-based throttling

---

### Feature Access Matrix

| Feature | Pro | Premium | Business | Enterprise |
|---------|-----|---------|----------|------------|
| Smart Icebreakers | ❌ | ✅ | ✅ | ✅ |
| Company Context (Basic) | ❌ | ✅ | ✅ | ✅ |
| Company Context (Deep) | ❌ | ❌ | ✅ | ✅ |
| Message Generator | ❌ | ✅ | ✅ | ✅ |
| Relationship Intelligence | ❌ | ❌ | ✅ | ✅ |
| Meeting Prep Assistant | ❌ | ❌ | ✅ | ✅ |
| Contact Enrichment | ❌ | ✅ | ✅ | ✅ |
| Network Mapping | ❌ | ❌ | ❌ | ✅ |
| Opportunity Detection | ❌ | ❌ | ❌ | ✅ |
| Web Search Integration | ❌ | ❌ | ❌ | ✅ |

---

### Development Priority

**Q1 2026**:
1. Smart Icebreakers (Highest ROI, easy to implement)
2. Message Generator (High demand, clear use case)
3. Basic Company Context

**Q2 2026**:
4. Relationship Intelligence
5. Meeting Prep Assistant
6. Contact Enrichment

**Q3 2026**:
7. Network Mapping
8. Opportunity Detection
9. Advanced features

---

### Success Metrics

Track these KPIs for each feature:

- **Usage Rate**: % of users using feature per month
- **Engagement**: Average uses per active user
- **Satisfaction**: Thumbs up/down on AI outputs
- **Impact**: Conversion rate improvements (for sales features)
- **Cost Efficiency**: Average cost per feature use
- **Quality Score**: AI confidence scores distribution

---

### Integration Points

These features integrate with existing systems:

1. **Calendar Integration**: Trigger meeting prep when meeting scheduled
2. **Email Integration**: One-click send generated messages
3. **CRM Sync**: Export intelligence to Salesforce, HubSpot
4. **Slack/Teams**: Get AI insights in chat
5. **Browser Extension**: Context on any page

---

## Quick Reference

### Subscription Feature Matrix

| Feature | Base | Premium | Business | Enterprise |
|---------|------|---------|----------|------------|
| Semantic Search | ✅ | ✅ | ✅ | ✅ |
| Max Results | 5 | 10 | 20 | 50 |
| Reranking | ❌ | ✅ | ✅ | ✅ |
| AI Enhancement | ❌ | ❌ | ✅ | ✅ |
| Streaming Mode | ❌ | ❌ | ✅ | ✅ |
| Model | - | - | Flash | Pro |
| Monthly Budget | $5 | $25 | $100 | $500 |
| Vector Threshold | 0.25 | 0.20 | 0.15 | 0.10 |

---

### Cost Breakdown Examples

#### Example 1: Simple Search (Base)

```
Query: "John Smith"
Results: 5 contacts
Rerank: No
AI Enhancement: No

Costs:
- Embedding: $0.0000008 (8 tokens × $0.10/1M)
- Pinecone: $0.0001
TOTAL: $0.0001008 (~$0.0001)
```

---

#### Example 2: Enhanced Search (Business)

```
Query: "Find machine learning experts in healthcare"
Results: 10 contacts
Rerank: Yes
AI Enhancement: Yes (batch, Flash)

Costs:
- Embedding: $0.000001 (10 tokens)
- Pinecone: $0.0001
- Rerank: $0.001
- AI Enhancement: $0.004 (10 contacts × ~400 tokens each)
TOTAL: $0.005101 (~$0.005)

Monthly usage: 200 searches × $0.005 = $1.00
Budget: $100/month
Usage: 1%
```

---

#### Example 3: Premium Search (Enterprise)

```
Query: "Senior executives with blockchain experience who invested in Web3 startups"
Results: 50 contacts
Rerank: Yes
AI Enhancement: Yes (streaming, Pro)

Costs:
- Embedding: $0.000002 (20 tokens)
- Pinecone: $0.0001
- Rerank: $0.001
- AI Enhancement: $0.050 (50 contacts × ~1000 tokens × Pro model)
TOTAL: $0.051102 (~$0.05)

Monthly usage: 100 searches × $0.05 = $5.00
Budget: $500/month
Usage: 1%
```

---

### API Cost Reference

| Service | Operation | Cost |
|---------|-----------|------|
| Gemini | Embedding | $0.10 per 1M input tokens |
| Pinecone | Query | $0.0001 per query |
| Cohere | Rerank | $1.00 per 1000 searches |
| Gemini Flash | Generation | $0.30 input / $2.50 output per 1M |
| Gemini Pro | Generation | $1.25 input / $10.00 output per 1M |

---

### Threshold Quick Lookup

```javascript
// Vector Similarity
Enterprise: min 0.10, high 0.35+
Business:   min 0.15, high 0.40+
Premium:    min 0.20, high 0.45+
Base:       min 0.25, high 0.50+

// Rerank Relevance
Enterprise: min 0.20, high 0.70+
Business:   min 0.25, high 0.75+
Premium:    min 0.30, high 0.80+
Base:       min 0.35, high 0.85+

// AI Confidence
Enterprise: 60%+
Business:   65%+
Premium:    70%+
Base:       75%+

// Hybrid Score (30% vector + 70% rerank)
hybridScore = (vectorScore * 0.3) + (rerankScore * 0.7)
```

---

### File Locations Cheat Sheet

```
Client Service:
  lib/services/serviceContact/client/services/SemanticSearchService.js

API Routes:
  app/api/user/contacts/semantic-search/route.js
  app/api/user/contacts/rerank/route.js
  app/api/user/contacts/ai-enhance-results/route.js

Server Services:
  lib/services/serviceContact/server/semanticSearchService.js
  lib/services/serviceContact/server/rerankService.js
  lib/services/serviceContact/server/aiEnhanceService.js
  lib/services/serviceContact/server/vectorService.js

Cost Tracking:
  lib/services/serviceContact/server/costTracking/costTrackingService.js
  lib/services/serviceContact/server/costTracking/sessionService.js

Constants:
  lib/services/serviceContact/client/constants/contactConstants.js
  lib/services/constants/aiCosts.js
  lib/services/constants/apiCosts.js

Firebase Setup:
  lib/firebase/admin.js  (Gemini AI, Firestore Admin)
  lib/cohere.js          (Cohere client)
  lib/pinecone.js        (Pinecone client)
```

---

### Common Commands

```bash
# Create Pinecone index manually (if needed)
# Go to Pinecone console: https://app.pinecone.io/
# Create index: networking-app-contacts
# Dimension: 768, Metric: cosine

# Test semantic search locally
curl -X POST http://localhost:3000/api/user/contacts/semantic-search \
  -H "Authorization: Bearer <firebase-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Find machine learning experts",
    "maxResults": 10,
    "trackCosts": true
  }'

# Check environment variables
grep PINECONE .env
grep GEMINI .env
grep COHERE .env

# Clear localStorage cache (browser console)
localStorage.removeItem('semantic_search_history');
localStorage.removeItem('search_results_cache');
```

---

## Appendix: Advanced Topics

### A. Batch Embedding Generation

For initial index creation, use batch embedding:

```javascript
// Process contacts in batches of 100
const BATCH_SIZE = 100;

for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
  const batch = contacts.slice(i, i + BATCH_SIZE);

  // Generate embeddings
  const embeddings = await Promise.all(
    batch.map(contact => generateEmbedding(contact))
  );

  // Upsert to Pinecone
  await VectorService.upsertContacts(userId, batch.map((contact, idx) => ({
    ...contact,
    embedding: embeddings[idx]
  })));

  console.log(`Processed ${i + batch.length} / ${contacts.length}`);
}
```

---

### B. Multilingual Support

Gemini embeddings and Cohere rerank both support 100+ languages:

```javascript
// Embeddings work for any language
const queries = [
  "Find machine learning experts",           // English
  "Encuentra expertos en aprendizaje automático",  // Spanish
  "查找机器学习专家",                        // Chinese
  "機械学習の専門家を見つける",               // Japanese
];

// Rerank model automatically detects language
model: 'rerank-multilingual-v3.0'  // Works for all
```

---

### C. Custom Similarity Metrics

While we use cosine similarity, Pinecone supports others:

```javascript
// Cosine: Best for semantic similarity (default)
metric: 'cosine'

// Euclidean: Best for spatial data
metric: 'euclidean'

// Dot product: Best for speed (if vectors normalized)
metric: 'dotproduct'
```

For semantic search, **always use cosine**.

---

### D. Namespace Isolation Patterns

```javascript
// Per-user namespaces (current approach)
namespace: `user_${userId}`

// Per-organization namespaces
namespace: `org_${orgId}`

// Per-workspace namespaces
namespace: `workspace_${workspaceId}`

// Hybrid: organization + user
namespace: `org_${orgId}_user_${userId}`
```

---

### E. Monitoring & Analytics

Track these metrics:

```javascript
// Search metrics
- Average vector score
- Rerank improvement rate (how much rerank changes order)
- AI confidence distribution
- Results per query (histogram)

// Cost metrics
- Daily spend by user
- Cost per search
- Cost per subscription tier
- Budget utilization %

// Performance metrics
- Embedding latency
- Pinecone query latency
- Rerank latency
- AI generation latency
- Total E2E latency

// Quality metrics
- User engagement (clicks on results)
- Result satisfaction (thumbs up/down)
- Query refinement rate
- Empty result rate
```

---

## Conclusion

This guide provides comprehensive documentation of the semantic search and vector database system. Use it as a reference for:

- Understanding the architecture
- Debugging issues
- Estimating costs
- Adding new features
- Onboarding new developers
- Understanding SessionUsage tracking

For questions or updates, refer to:
- `COMPREHENSIVE_REFACTORING_GUIDE.md` for architecture patterns
- `COST_TRACKING_MIGRATION_GUIDE.md` for cost tracking patterns
- `SESSION_TRACKING_FIX.md` for SessionUsage implementation details
- `ADMIN_*.md` guides for related features
- Pinecone docs: https://docs.pinecone.io/
- Gemini docs: https://ai.google.dev/docs
- Cohere docs: https://docs.cohere.com/

**Version History:**
- **v2.2** (Oct 16, 2025): Added threshold-based filtering + Next Steps section with context-driven AI features
- **v2.1** (Oct 16, 2025): Added SessionUsage tracking for multi-step operations
- **v2.0** (Oct 15, 2025): Post-refactoring with clean architecture
- **v1.0** (Initial): Original implementation

**Last Updated**: October 16, 2025
**Maintained By**: Development Team
