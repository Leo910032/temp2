I'll create complete updated versions of all three files with the Pinecone Inference API changes. Due to length limits, I'll create them as separate artifacts.

# 1. SEMANTIC_SEARCH_FILES_REFERENCE.md (Updated)

<artifact identifier="semantic-search-files-ref-updated" type="application/vnd.ant.code" language="markdown" title="SEMANTIC_SEARCH_FILES_REFERENCE.md (Updated)">
# Semantic Search & Reranking - Complete File Reference

**Created:** October 16, 2025
**Updated:** October 16, 2025 (Pinecone Inference API Migration)
**Purpose:** Comprehensive listing of all files involved in semantic search and reranking functionality

---

## Table of Contents

1. [File Structure Overview](#file-structure-overview)
2. [Client-Side Files](#client-side-files)
3. [API Routes](#api-routes)
4. [Server Services](#server-services)
5. [File Relationships](#file-relationships)
6. [Quick Reference Table](#quick-reference-table)

---

## File Structure Overview

```
Semantic Search System
├── Client Layer (Browser)
│   └── lib/services/serviceContact/client/services/
│       └── SemanticSearchService.js
│
├── API Layer (Next.js Routes)
│   └── app/api/user/contacts/
│       ├── semantic-search/route.js
│       ├── rerank/route.js
│       └── ai-enhance-results/route.js
│
└── Server Layer (Business Logic)
    └── lib/services/serviceContact/server/
        ├── semanticSearchService.js (main search orchestration)
        ├── rerankService.js (Pinecone reranking)
        ├── aiEnhanceService.js (AI result enhancement)
        ├── embeddingService.js (generate embeddings via Pinecone Inference)
        ├── vectorStorageService.js (store vectors in Pinecone)
        ├── vectorService.js (legacy - being replaced by vectorStorageService)
        ├── indexManagementService.js (manage Pinecone index)
        └── documentBuilderService.js (build searchable documents)
```

---

## Client-Side Files

### 1. SemanticSearchService.js

**Location:** `lib/services/serviceContact/client/services/SemanticSearchService.js`

**Purpose:** Client-side service for semantic search operations

**Responsibilities:**
- Make API calls to search endpoints
- Manage search history in localStorage
- Categorize results by similarity tiers
- Handle streaming vs batch AI enhancement
- Cache search results

**Key Methods:**
- `search(query, options)` - Main search method
- `rerankContacts(query, contacts, options)` - Rerank results
- `enhanceResultsWithBatch(query, contacts, options)` - Batch AI enhancement
- `enhanceResultsWithStreaming(query, contacts, options)` - Streaming AI enhancement
- `loadSearchHistory()` - Get search history
- `saveSearchJob(searchData)` - Save search to history
- `clearSearchCache()` - Clear cached searches

**Dependencies:**
- `@/lib/services/core/ApiClient` (ContactApiClient)
- `@/lib/services/serviceContact/client/constants/contactConstants`

**API Endpoints Called:**
- `POST /api/user/contacts/semantic-search`
- `POST /api/user/contacts/rerank`
- `POST /api/user/contacts/ai-enhance-results`

**File Size:** ~800 lines

---

## API Routes

### 1. Semantic Search API

**Location:** `app/api/user/contacts/semantic-search/route.js`

**Endpoint:** `POST /api/user/contacts/semantic-search`

**Purpose:** HTTP endpoint for semantic search requests

**Flow:**
1. Authenticate user (`createApiSession`)
2. Check feature access (Premium+ only)
3. Validate input (query, maxResults, etc.)
4. Check affordability (cost tracking)
5. Call `SemanticSearchService.search()` (server)
6. Record usage in SessionUsage
7. Return results with sessionId

**Request Body:**
```javascript
{
  query: string,              // Search query
  maxResults: number,         // Max results (default: 10)
  includeMetadata: boolean,   // Include search metadata
  trackCosts: boolean,        // Track API costs
  minVectorScore: number      // Optional: minimum similarity threshold
}
```

**Response:**
```javascript
{
  results: [...],             // Array of contacts
  sessionId: string,          // Session ID for feedback
  searchMetadata: {
    query: string,
    totalResults: number,
    namespace: string,
    embeddingTime: number,
    searchDuration: number,
    costs: { ... },
    thresholdFiltering: { ... }
  }
}
```

**File Size:** ~216 lines

---

### 2. Rerank API

**Location:** `app/api/user/contacts/rerank/route.js`

**Endpoint:** `POST /api/user/contacts/rerank`

**Purpose:** Rerank search results using Pinecone Rerank API

**Flow:**
1. Authenticate user
2. Validate input (query, contacts array)
3. Check subscription (Premium+)
4. Estimate Pinecone Rerank API cost
5. Check affordability
6. Call `RerankService.rerankContacts()` (server)
7. Record costs in SessionUsage
8. Return reranked results

**Request Body:**
```javascript
{
  query: string,              // Original search query
  contacts: Array<object>,    // Contacts to rerank
  topN: number,               // Number of results to return
  minConfidence: number,      // Optional: minimum relevance threshold
  trackCosts: boolean,        // Track API costs
  sessionId: string           // Session ID for multi-step tracking
}
```

**Response:**
```javascript
{
  results: [...],             // Reranked contacts
  metadata: {
    rerankCost: number,
    provider: "pinecone",
    model: string,
    thresholdFiltering: { ... }
  }
}
```

**File Size:** ~150 lines

---

### 3. AI Enhancement API

**Location:** `app/api/user/contacts/ai-enhance-results/route.js`

**Endpoint:** `POST /api/user/contacts/ai-enhance-results`

**Purpose:** Enhance search results with AI insights (Gemini)

**Flow:**
1. Authenticate user
2. Validate input (query, contacts, mode)
3. Check subscription (Business+)
4. Estimate Gemini API cost
5. Check affordability
6. **If streaming mode:**
   - Call `AIEnhanceService.createStreamingResponse()`
   - Return ReadableStream
   - Record costs asynchronously
7. **If batch mode:**
   - Call `AIEnhanceService.enhanceResults()`
   - Record costs synchronously
   - Return JSON results

**Request Body:**
```javascript
{
  originalQuery: string,      // Search query
  contacts: Array<object>,    // Contacts to enhance
  mode: string,               // "streaming" or "batch"
  subscriptionLevel: string,  // User's subscription
  trackCosts: boolean,        // Track API costs
  queryLanguage: string,      // Query language (for AI)
  sessionId: string           // Session ID for multi-step tracking
}
```

**Response (Batch Mode):**
```javascript
{
  results: [...],             // Enhanced contacts with AI insights
  billing: {
    totalCost: number,
    totalTokens: number,
    model: string
  }
}
```

**Response (Streaming Mode):**
- Returns `ReadableStream` with SSE format
- Each chunk: `data: {"index": 0, "insight": {...}}\n\n`

**File Size:** ~200 lines

---

## Server Services

### 1. semanticSearchService.js

**Location:** `lib/services/serviceContact/server/semanticSearchService.js`

**Purpose:** Main orchestrator for semantic search pipeline

**Responsibilities:**
- Generate query embeddings (via Pinecone Inference API)
- Query Pinecone vector database
- Apply similarity thresholds
- Retrieve full contact data from Firestore
- Calculate costs
- Enrich results with metadata

**Key Methods:**

#### `search(userId, query, options)`
Main search method that orchestrates the entire pipeline.

**Parameters:**
- `userId` (string): User ID
- `query` (string): Search query
- `options` (object):
  - `maxResults` (number): Max results (default: 10)
  - `includeMetadata` (boolean): Include metadata
  - `searchId` (string): Unique search ID
  - `minVectorScore` (number): Threshold filter
  - `subscriptionLevel` (string): For fallback limit

**Returns:**
```javascript
{
  results: [...],             // Contacts with vector scores
  searchMetadata: {
    query: string,
    namespace: string,
    resultsFound: number,
    embeddingTime: number,
    searchDuration: number,
    costs: {
      tokens: number,
      embeddingCost: number,
      searchCost: number,
      total: number
    },
    thresholdFiltering: {
      thresholdUsed: number,
      rawCount: number,
      filteredCount: number,
      removedCount: number
    }
  }
}
```

#### `estimateCost(query)`
Estimate cost of search operation.

**Returns:**
```javascript
{
  estimatedTokens: number,
  embeddingCost: number,
  searchCost: number,
  totalCost: number
}
```

**Dependencies:**
- `@pinecone-database/pinecone` (Pinecone SDK for embeddings and vector search)
- `@/lib/firebaseAdmin` (Firestore)

**File Size:** ~500 lines

---

### 2. rerankService.js

**Location:** `lib/services/serviceContact/server/rerankService.js`

**Purpose:** Rerank contacts using Pinecone Rerank API

**Responsibilities:**
- Build rich document representations
- Call Pinecone Rerank API
- Calculate hybrid scores (vector + rerank)
- Apply relevance thresholds
- Format reranked results

**Key Methods:**

#### `rerankContacts(query, contacts, options)`
Rerank contacts using Pinecone.

**Parameters:**
- `query` (string): Original search query
- `contacts` (Array): Contacts to rerank
- `options` (object):
  - `model` (string): Pinecone rerank model name
  - `topN` (number): Number of results
  - `minConfidence` (number): Relevance threshold
  - `subscriptionLevel` (string): For document building

**Returns:**
```javascript
{
  results: [...],             // Reranked contacts
  metadata: {
    rerankCost: number,
    provider: "pinecone",
    model: string,
    inputCount: number,
    outputCount: number,
    thresholdFiltering: {
      thresholdUsed: number,
      rawCount: number,
      filteredCount: number,
      removedCount: number
    }
  }
}
```

#### `estimateCost(contactCount)`
Estimate reranking cost.

**Returns:**
```javascript
{
  baseCost: number,
  perDocumentCost: number,
  totalCost: number
}
```

**Document Building Strategy:**
- **Minimal Mode**: Only name, company, title (for simple queries)
- **Rich Mode**: All fields including notes, location, events (for complex queries)

**Hybrid Scoring:**
```javascript
hybridScore = (vectorScore * 0.3) + (rerankScore * 0.7)
```

**Dependencies:**
- `@pinecone-database/pinecone` (Pinecone SDK)
- `DocumentBuilderService`

**File Size:** ~450 lines

---

### 3. aiEnhanceService.js

**Location:** `lib/services/serviceContact/server/aiEnhanceService.js`

**Purpose:** Enhance search results with AI-generated insights

**Responsibilities:**
- Generate similarity-aware prompts
- Call Gemini API (Flash or Pro)
- Support batch and streaming modes
- Generate strategic questions for outreach
- Calculate token usage and costs

**Key Methods:**

#### `enhanceResults(query, contacts, options)`
Batch mode AI enhancement.

**Parameters:**
- `query` (string): Original search query
- `contacts` (Array): Contacts to enhance
- `options` (object):
  - `subscriptionLevel` (string): Business/Enterprise
  - `trackCosts` (boolean): Track API costs
  - `queryLanguage` (string): Query language

**Returns:**
```javascript
{
  insights: [...],            // AI insights per contact
  billing: {
    totalCost: number,
    totalTokens: number,
    model: string,
    inputTokens: number,
    outputTokens: number
  }
}
```

#### `createStreamingResponse(query, contacts, options)`
Streaming mode AI enhancement.

**Returns:** `ReadableStream`

**Similarity-Aware Prompting:**
- HIGH similarity (>0.35): "This contact is HIGHLY relevant"
- MEDIUM similarity (0.25-0.35): "This contact is MODERATELY relevant"
- LOW similarity (0.15-0.25): "This contact is SOMEWHAT relevant"
- MINIMUM similarity (<0.15): "This contact is MINIMALLY relevant"

**Output Format:**
```javascript
{
  relevanceExplanation: string,  // Why this contact matches
  strategicQuestions: [          // 3 research questions
    "What specific ML projects has John worked on?",
    "Has John published any papers on neural networks?",
    "What is John's experience with MLOps?"
  ]
}
```

**Dependencies:**
- `@google/generative-ai` (Gemini SDK)

**File Size:** ~550 lines

---

### 4. embeddingService.js

**Location:** `lib/services/serviceContact/server/embeddingService.js`

**Purpose:** Generate text embeddings using Pinecone Inference API

**Responsibilities:**
- Generate embeddings for text
- Handle API errors gracefully
- Calculate embedding costs
- Support batch operations

**Key Methods:**

#### `generateEmbedding(text)`
Generate embedding for a single text.

**Parameters:**
- `text` (string): Text to embed

**Returns:** `Promise<Array<number>>` - 1024-dimensional vector

**Cost Calculation:**
```javascript
// Tokens = ceil(text.length / 4)
// Cost = (tokens / 1,000,000) * $0.08
```

#### `generateBatchEmbeddings(texts)`
Generate embeddings for multiple texts.

**Parameters:**
- `texts` (Array<string>): Array of texts

**Returns:** `Promise<Array<Array<number>>>`

**Configuration:**
- Model: `multilingual-e5-large`
- Dimensions: 1024
- Task type: `RETRIEVAL_QUERY` or `RETRIEVAL_DOCUMENT`

**Dependencies:**
- `@pinecone-database/pinecone`

**File Size:** ~200 lines

---

### 5. vectorStorageService.js

**Location:** `lib/services/serviceContact/server/vectorStorageService.js`

**Purpose:** Store and manage contact vectors in Pinecone

**Responsibilities:**
- Upsert contact vectors
- Delete contact vectors
- Batch operations with rate limiting
- Build comprehensive metadata
- Handle graceful errors

**Key Methods:**

#### `upsertContactVector(contact, ownerSubscriptionLevel)`
Upsert single contact vector to Pinecone.

**Flow:**
1. Validate input (contact ID, subscription level)
2. Build document (DocumentBuilderService)
3. Generate embedding (EmbeddingService)
4. Get Pinecone index (IndexManagementService)
5. Prepare metadata (comprehensive)
6. Upsert to Pinecone namespace

**Metadata Fields:**
```javascript
{
  // Core identification
  userId: string,
  name: string,
  email: string,
  phone: string,
  company: string,
  jobTitle: string,

  // Status
  status: string,
  submittedAt: string,
  lastModified: string,
  lastUpdated: string,

  // Source
  source: string,
  originalSource: string,

  // Content (truncated)
  notes: string,
  message: string,
  hasNotes: boolean,
  noteLength: number,

  // Location
  hasLocation: boolean,
  latitude: number,
  longitude: number,

  // System
  subscriptionTier: string,
  embeddingModel: string,

  // Custom fields (from details array)
  linkedin: string,
  website: string,
  department: string,
  industry: string,
  specialty: string,

  // Dynamic fields (flattened)
  companyTagline: string,
  // ... other dynamic fields
}
```

#### `deleteContactVector(contactId, userId)`
Delete contact vector from Pinecone.

#### `batchUpsertVectors(contacts, subscriptionLevel, options)`
Batch upsert with rate limiting.

**Options:**
- `batchSize` (default: 100)
- `delayMs` (default: 1000)
- `onProgress` (callback)

#### `rebuildUserVectors(userId, newSubscriptionLevel)`
Rebuild all vectors for a user (e.g., after subscription change).

**Dependencies:**
- `IndexManagementService`
- `EmbeddingService`
- `DocumentBuilderService`

**File Size:** ~427 lines

---

### 6. indexManagementService.js

**Location:** `lib/services/serviceContact/server/indexManagementService.js`

**Purpose:** Manage Pinecone index lifecycle

**Responsibilities:**
- Create Pinecone index if not exists
- Get index instance
- Monitor index status
- Handle initialization delays

**Key Methods:**

#### `getOrCreateIndex()`
Get existing index or create new one.

**Returns:** Pinecone Index instance

**Index Configuration:**
- Name: `networking-app-contacts`
- Dimensions: 1024
- Metric: `cosine`
- Spec: `serverless` (AWS us-east-1)

**Initialization:**
- Checks if index exists
- Creates if missing
- Waits for index to be ready
- Returns index instance

**Dependencies:**
- `@pinecone-database/pinecone`

**File Size:** ~150 lines

---

### 7. documentBuilderService.js

**Location:** `lib/services/serviceContact/server/documentBuilderService.js`

**Purpose:** Build searchable text documents from contact objects

**Responsibilities:**
- Extract data from contact fields
- Handle multiple data sources (top-level, details array, dynamic fields)
- Build tier-appropriate documents
- Support both minimal and rich modes

**Key Methods:**

#### `buildContactDocument(contact, subscriptionLevel)`
Build searchable document for a contact.

**Document Strategy:**
- **Free tier**: Name, email, company, title only
- **Premium+**: Full document with all fields

**Field Extraction:**
```javascript
// Checks multiple locations
1. Top-level fields (contact.jobTitle)
2. Details array (contact.details.find(d => d.label === "Job Title"))
3. Dynamic fields (contact.dynamicFields)
```

**Document Format:**
```
[Contact Name]: John Doe
[Email]: john@acme.com
[Company]: Acme Corp
[Job Title]: Senior Engineer
[Notes]: Expert in cloud security
[Location]: San Francisco, CA, USA
[Event]: Security Conference 2025
[How We Met]: Business Card Scan
```

**Dependencies:**
- None (pure data transformation)

**File Size:** ~300 lines

---

### 8. vectorService.js (Legacy)

**Location:** `lib/services/serviceContact/server/vectorService.js`

**Purpose:** Legacy vector management service

**Status:** Being replaced by `vectorStorageService.js`

**Note:** This file is still present but most functionality has been migrated to the new service architecture (vectorStorageService, embeddingService, documentBuilderService, indexManagementService).

**File Size:** ~600 lines

---

## File Relationships

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Action                              │
│              (SearchBar component triggers search)               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  CLIENT: SemanticSearchService                   │
│  - Calls API with query                                         │
│  - Caches results in localStorage                               │
│  - Returns results with sessionId                               │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP POST
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│            API: /api/user/contacts/semantic-search              │
│  - Authenticates user                                           │
│  - Validates input                                              │
│  - Checks affordability                                         │
└────────────────────────┬────────────────────────────────────────┘
                         │ Function call
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│           SERVER: semanticSearchService.search()                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Step 1: Generate embedding (embeddingService)            │  │
│  │   - Calls Pinecone Inference API                         │  │
│  │   - Returns 1024-dim vector                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Step 2: Query Pinecone (indexManagementService)          │  │
│  │   - Gets index instance                                  │  │
│  │   - Queries namespace: user_{userId}                     │  │
│  │   - Returns matches with similarity scores               │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Step 3: Apply threshold filtering                        │  │
│  │   - Filters by minVectorScore                            │  │
│  │   - Removes low-quality matches                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Step 4: Retrieve full contacts (Firestore)               │  │
│  │   - Batch fetch from Contacts/{userId}                   │  │
│  │   - Enriches with search metadata                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │ Return results
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              OPTIONAL: Reranking Pipeline                        │
│  If user has Premium+ and >5 results                            │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP POST
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                API: /api/user/contacts/rerank                   │
│  - Validates input                                              │
│  - Checks affordability                                         │
└────────────────────────┬────────────────────────────────────────┘
                         │ Function call
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│             SERVER: rerankService.rerankContacts()              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Step 1: Build documents (documentBuilderService)         │  │
│  │   - Creates rich text representations                    │  │
│  │   - Includes context (notes, events, location)           │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Step 2: Call Pinecone Rerank API                         │  │
│  │   - Sends query + documents                              │  │
│  │   - Returns relevance scores                             │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Step 3: Calculate hybrid scores                          │  │
│  │   - Combines vector (30%) + rerank (70%)                 │  │
│  │   - Sorts by hybrid score                                │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Step 4: Apply relevance threshold                        │  │
│  │   - Filters by minConfidence                             │  │
│  │   - Returns top N results                                │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │ Return reranked results
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              OPTIONAL: AI Enhancement Pipeline                   │
│  If user has Business+ subscription                             │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP POST
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│          API: /api/user/contacts/ai-enhance-results             │
│  - Validates input                                              │
│  - Checks affordability                                         │
│  - Supports streaming or batch mode                             │
└────────────────────────┬────────────────────────────────────────┘
                         │ Function call
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│         SERVER: aiEnhanceService.enhanceResults()               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Step 1: Generate similarity-aware prompts                │  │
│  │   - Adapts based on vector score                         │  │
│  │   - Includes contact context                             │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Step 2: Call Gemini API (Flash or Pro)                   │  │
│  │   - Batch or streaming mode                              │  │
│  │   - Returns AI insights                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Step 3: Calculate costs and tokens                       │  │
│  │   - Tracks input/output tokens                           │  │
│  │   - Calculates API cost                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │ Return enhanced results
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Display to User                              │
│  - Shows enhanced contacts with AI insights                     │
│  - Includes feedback button (SearchFeedbackButton)              │
└─────────────────────────────────────────────────────────────────┘
```

### Vector Storage Flow (Contact Creation)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Contact Created/Updated                       │
│              (ContactCRUDService operation)                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│        SERVER: vectorStorageService.upsertContactVector()       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Step 1: Build document (documentBuilderService)          │  │
│  │   - Extracts all contact fields                          │  │
│  │   - Creates searchable text                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Step 2: Generate embedding (embeddingService)            │  │
│  │   - Calls Pinecone multilingual-e5-large                 │  │
│  │   - Returns 1024-dim vector                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Step 3: Get Pinecone index (indexManagementService)      │  │
│  │   - Gets or creates index                                │  │
│  │   - Returns index instance                               │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Step 4: Prepare metadata                                 │  │
│  │   - Extracts 30+ fields from contact                     │  │
│  │   - Includes custom and dynamic fields                   │  │
│  │   - Truncates long text fields                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Step 5: Upsert to Pinecone                               │  │
│  │   - Namespace: user_{userId}                             │  │
│  │   - ID: contactId                                        │  │
│  │   - Values: 1024-dim embedding                           │  │
│  │   - Metadata: 30+ fields                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Reference Table

| File | Type | Lines | Purpose | Dependencies |
|------|------|-------|---------|--------------|
| **SemanticSearchService.js** | Client | ~800 | Main client service | ContactApiClient, constants |
| **semantic-search/route.js** | API | ~216 | Search endpoint | createApiSession, SemanticSearchService |
| **rerank/route.js** | API | ~150 | Rerank endpoint | createApiSession, RerankService |
| **ai-enhance-results/route.js** | API | ~200 | AI enhancement endpoint | createApiSession, AIEnhanceService |
| **semanticSearchService.js** | Server | ~500 | Search orchestration | Pinecone, Firestore |
| **rerankService.js** | Server | ~450 | Pinecone reranking | Pinecone SDK, DocumentBuilder |
| **aiEnhanceService.js** | Server | ~550 | AI insights | Gemini SDK |
| **embeddingService.js** | Server | ~200 | Generate embeddings | Pinecone SDK |
| **vectorStorageService.js** | Server | ~427 | Store vectors | EmbeddingService, IndexManagement |
| **indexManagementService.js** | Server | ~150 | Manage Pinecone index | Pinecone SDK |
| **documentBuilderService.js** | Server | ~300 | Build search documents | None |
| **vectorService.js** | Server | ~600 | Legacy service | (Being replaced) |

---

## Key Concepts

### 1. Three-Stage Pipeline

```
Stage 1: Vector Search (REQUIRED)
  ├─ Generate query embedding
  ├─ Search Pinecone
  ├─ Apply similarity threshold
  └─ Return initial results

Stage 2: Reranking (OPTIONAL - Premium+)
  ├─ Build rich documents
  ├─ Call Pinecone Rerank API
  ├─ Calculate hybrid scores
  └─ Apply relevance threshold

Stage 3: AI Enhancement (OPTIONAL - Business+)
  ├─ Generate similarity-aware prompts
  ├─ Call Gemini API
  ├─ Generate insights & questions
  └─ Return enhanced results
```

### 2. Threshold-Based Filtering

**Vector Search Thresholds** (by subscription):
- Enterprise: 0.10 (most permissive)
- Business: 0.15
- Premium: 0.20
- Lower tiers: 0.25 (most strict)

**Reranking Thresholds:**
- Minimum: 5% relevance score
- Recommended: 10-20% for high-quality results

**Benefits:**
- Quality over quantity
- Reduces noise in results
- Improves user satisfaction
- Comprehensive logging

### 3. Cost Tracking

All operations track costs in **SessionUsage** collection:

```javascript
SessionUsage/{userId}/sessions/{sessionId}
{
  feature: "semantic_search",
  steps: [
    {
      stepLabel: "Step 0: Vector Search",
      cost: 0.000434,
      provider: "pinecone"
    },
    {
      stepLabel: "Step 1: Reranking",
      cost: 0.0007,
      provider: "pinecone"
    },
    {
      stepLabel: "Step 2: AI Enhancement",
      cost: 0.002,
      provider: "gemini"
    }
  ],
  totalCost: 0.003134,
  feedback: { ... }  // From feedback loop
}
```

### 4. Subscription Tiers

| Feature | Free | Premium | Business | Enterprise |
|---------|------|---------|----------|------------|
| Vector Search | ❌ | ✅ | ✅ | ✅ |
| Reranking | ❌ | ✅ | ✅ | ✅ |
| AI Enhancement | ❌ | ❌ | ✅ | ✅ |
| Vector Storage | ❌ | ✅ | ✅ | ✅ |
| Max Results | - | 10 | 20 | 50 |
| Similarity Threshold | - | 0.20 | 0.15 | 0.10 |

---

## Related Documentation

- **[SEMANTIC_SEARCH_VECTOR_DATABASE_GUIDE.md](./SEMANTIC_SEARCH_VECTOR_DATABASE_GUIDE.md)** - Complete implementation guide
- **[SEARCH_FEEDBACK_LOOP_GUIDE.md](./SEARCH_FEEDBACK_LOOP_GUIDE.md)** - Feedback system reference
- **[COMPREHENSIVE_REFACTORING_GUIDE.md](./COMPREHENSIVE_REFACTORING_GUIDE.md)** - Architecture patterns

---

## File Locations Summary

```
Client-Side:
  lib/services/serviceContact/client/services/SemanticSearchService.js

API Routes:
  app/api/user/contacts/semantic-search/route.js
  app/api/user/contacts/rerank/route.js
  app/api/user/contacts/ai-enhance-results/route.js

Server Services:
  lib/services/serviceContact/server/semanticSearchService.js
  lib/services/serviceContact/server/rerankService.js
  lib/services/serviceContact/server/aiEnhanceService.js
  lib/services/serviceContact/server/embeddingService.js
  lib/services/serviceContact/server/vectorStorageService.js
  lib/services/serviceContact/server/indexManagementService.js
  lib/services/serviceContact/server/documentBuilderService.js
  lib/services/serviceContact/server/vectorService.js (legacy)
```

---

**Document Version:** 2.0
**Last Updated:** October 16, 2025 (Pinecone Inference API Migration)
**Total Files Documented:** 12
**Embedding Provider:** Pinecone Inference API (multilingual-e5-large, 1024D)
</artifact>

