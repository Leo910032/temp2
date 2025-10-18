# Semantic Search & Rerank System - Complete Architecture Documentation

**Status**: Current Implementation (Analyzed 2025-01-XX)
**Warning**: Documentation files are outdated. This document reflects the ACTUAL codebase.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Complete Data Flow](#complete-data-flow)
3. [Technology Stack](#technology-stack)
4. [Architecture Layers](#architecture-layers)
5. [Cost Tracking System](#cost-tracking-system)
6. [Session Management](#session-management)
7. [Threshold-Based Filtering](#threshold-based-filtering)
8. [Document Building Strategy](#document-building-strategy)
9. [File Reference Guide](#file-reference-guide)
10. [Key Code Examples](#key-code-examples)
11. [Discrepancies from Documentation](#discrepancies-from-documentation)

---

## System Overview

The semantic search system is a **4-step pipeline** that transforms a user's natural language query into ranked, AI-enhanced contact results:

```
User Query → Query Enhancement → Embedding → Vector Search → Reranking → AI Enhancement → Results
```

### Key Characteristics

- **Multi-provider**: Uses Gemini, Pinecone, Cohere, and Redis
- **Multi-tier caching**: 3-tier cache for query enhancement (Static → Redis → AI)
- **Cost-conscious**: Tracks costs per-step with subscription-based limits
- **Session-based tracking**: Groups multi-step operations for analytics
- **Adaptive filtering**: Different thresholds per subscription tier

---

## Complete Data Flow

### Step-by-Step Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│ USER QUERY: "Who works at Tesla?"                                       │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ CLIENT LAYER                                                            │
│ SemanticSearchService.js (client)                                       │
│                                                                         │
│ - Manages localStorage caching (search history, job cache)             │
│ - Makes API calls to backend                                           │
│ - Handles streaming/batch AI enhancement modes                         │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ API LAYER                                                               │
│ /api/user/contacts/semantic-search/route.js                            │
│                                                                         │
│ 1. Authenticates user (createApiSession)                               │
│ 2. Checks PREMIUM_SEMANTIC_SEARCH feature permission                   │
│ 3. Checks affordability (CostTrackingService.canAffordOperation)       │
│ 4. Generates sessionId: "session_search_{timestamp}_{random}"          │
│ 5. Calls SemanticSearchService.search()                                │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 0: QUERY ENHANCEMENT                                               │
│ QueryEnhancementService.enhanceQuery()                                 │
│                                                                         │
│ 3-Tier Caching Strategy:                                                │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ Tier 1: Static Cache (COMMON_EXPANSIONS)                            │ │
│ │ - Instant lookup (~0ms)                                             │ │
│ │ - Pre-defined expansions for common queries                         │ │
│ │ - Example: "Tesla" → "Tesla, employee, worker, staff..."           │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ Tier 2: Redis Cache                                                 │ │
│ │ - Fast lookup (~100-500ms)                                          │ │
│ │ - 24-hour TTL                                                       │ │
│ │ - Stores previous AI enhancements                                   │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ Tier 3: Gemini 2.5 Flash (via Firebase AI)                          │ │
│ │ - AI-powered enhancement (~2s)                                      │ │
│ │ - Language detection                                                │ │
│ │ - Query expansion with synonyms                                     │ │
│ │ - Result stored in Redis for 24h                                    │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ Output:                                                                 │
│ - enhancedQuery: "Tesla, employee, worker, staff, personnel..."        │
│ - language: "eng"                                                       │
│ - metadata: { cached, cacheType, duration, cost }                      │
│                                                                         │
│ Cost: ~$0.000008 (if AI call needed)                                   │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 1: EMBEDDING GENERATION                                            │
│ EmbeddingService.generateEmbedding()                                    │
│                                                                         │
│ Provider: Pinecone Inference API                                        │
│ Model: multilingual-e5-large                                            │
│ Dimension: 1024D                                                        │
│                                                                         │
│ API Call:                                                               │
│   pc.inference.embed(                                                   │
│     'multilingual-e5-large',                                            │
│     [enhancedQuery],                                                    │
│     { inputType: 'passage' }                                            │
│   )                                                                     │
│                                                                         │
│ Output: [0.1234, -0.5678, 0.9012, ...] (1024 floats)                   │
│ Cost: $0.08 per million tokens (~$0.000016 per query)                  │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 2: VECTOR SEARCH                                                   │
│ IndexManagementService + Pinecone                                       │
│                                                                         │
│ Vector Database: Pinecone Serverless                                    │
│ Index: contacts-multilingual-e5-large-1024                              │
│ Namespace: user_{userId}                                                │
│ Metric: cosine similarity                                               │
│                                                                         │
│ Query:                                                                  │
│   index.query({                                                         │
│     vector: embedding,        // 1024D                                  │
│     topK: 100,                // Fallback max                           │
│     includeMetadata: true,                                              │
│     includeValues: false                                                │
│   })                                                                    │
│                                                                         │
│ Threshold Filtering (by subscription):                                  │
│ - Enterprise:  0.10 (≥10% similarity kept)                              │
│ - Business:    0.15 (≥15% similarity kept)                              │
│ - Premium:     0.20 (≥20% similarity kept)                              │
│ - Pro:         0.25 (≥25% similarity kept)                              │
│ - Base:        0.30 (≥30% similarity kept)                              │
│                                                                         │
│ Raw Results: 100 contacts (before filtering)                            │
│ Filtered: 50 contacts (after threshold filter)                          │
│ Score Range: 0.25 - 0.85                                                │
│                                                                         │
│ Firestore Retrieval:                                                    │
│ - Fetches full contact data from Contacts/{userId}                     │
│ - Attaches _vectorScore to each contact                                 │
│                                                                         │
│ Cost: $0.0001 per query                                                 │
│                                                                         │
│ Session Tracking:                                                       │
│ - Records in SessionUsage/{userId}/sessions/{sessionId}                │
│ - Step Label: "Step 0: Vector Search"                                  │
│ - isBillableRun: false                                                  │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ API LAYER                                                               │
│ /api/user/contacts/rerank/route.js                                     │
│                                                                         │
│ 1. Checks RERANK feature permission (Premium+)                          │
│ 2. Query Analysis: isSimpleFactualQuery(query)                         │
│    - Simple query (e.g., "John Smith"): BYPASS reranking               │
│    - Semantic query (e.g., "Who works at Tesla?"): USE reranking       │
│ 3. Checks affordability                                                 │
│ 4. Uses sessionId from vector search                                    │
│ 5. Calls RerankService.rerankContacts()                                │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 3: RERANKING                                                       │
│ RerankService.rerankContacts()                                          │
│                                                                         │
│ Provider: Cohere (Direct API - NOT Pinecone)                            │
│ Model: rerank-v3.5 (ALWAYS - best for all languages)                   │
│ Cost: $0.002 per request                                                │
│                                                                         │
│ Document Building:                                                      │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ Format: YAML (Cohere-optimized)                                     │ │
│ │                                                                     │ │
│ │ Example:                                                            │ │
│ │   name: "Elon Musk"                                                 │ │
│ │   job_title: "Chief Executive Officer"                             │ │
│ │   company: "Tesla, Inc."                                            │ │
│ │   notes: "Met at AI Summit 2024..."                                │ │
│ │   department: "Executive Leadership"                                │ │
│ │   status: "active"                                                  │ │
│ │   email: "elon@tesla.com"                                           │ │
│ │   phone: "+1-650-123-4567"                                          │ │
│ │   linkedin: "linkedin.com/in/elonmusk"                              │ │
│ │   event: "AI Summit 2024"                                           │ │
│ │                                                                     │ │
│ │ Field Extraction:                                                   │ │
│ │ - contact.jobTitle OR details[] OR dynamicFields[]                  │ │
│ │ - contact.company OR details[]                                      │ │
│ │ - contact.department OR details[] OR dynamicFields[]                │ │
│ │                                                                     │ │
│ │ Premium+ Fields:                                                    │ │
│ │ - notes (truncated to 500 chars)                                    │ │
│ │ - message (truncated to 500 chars)                                  │ │
│ │ - eventInfo.eventName                                               │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ Query Preprocessing:                                                    │
│ - Strips command verbs: "Find Tesla" → "Tesla"                         │
│ - Preserves questions: "Who works at..." (unchanged)                   │
│                                                                         │
│ Cohere API Call:                                                        │
│   cohere.rerank({                                                       │
│     query: preprocessedQuery,                                           │
│     documents: [YAML docs for 50 contacts],                             │
│     model: 'rerank-v3.5',                                               │
│     topN: 50,                                                           │
│     returnDocuments: false,                                             │
│     maxTokensPerDoc: 512                                                │
│   })                                                                    │
│                                                                         │
│ Threshold Filtering:                                                    │
│ - minRerankScore: 0.001 (very permissive)                               │
│ - Fallback: If 0 results, use vector scores                             │
│                                                                         │
│ Output:                                                                 │
│ - 10 contacts with rerank scores (0.65-0.92)                            │
│ - hybridScore: (vectorScore × 0.3) + (rerankScore × 0.7)               │
│ - searchMetadata.rerankScore, rerankRank, scoringMethod                │
│                                                                         │
│ Session Tracking:                                                       │
│ - Records in SessionUsage                                               │
│ - Step Label: "Step 1: Rerank"                                         │
│ - isBillableRun: false                                                  │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ API LAYER (OPTIONAL)                                                    │
│ /api/user/contacts/ai-enhance-results/route.js                         │
│                                                                         │
│ 1. Checks AI_ENHANCE_RESULTS permission (Business+)                     │
│ 2. Checks affordability                                                 │
│ 3. Uses sessionId for session tracking                                  │
│ 4. Supports batch/streaming modes                                       │
│ 5. Calls AIEnhanceService.enhanceResults()                             │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 4: AI ENHANCEMENT (Business+ Only)                                │
│ AIEnhanceService.enhanceResults()                                       │
│                                                                         │
│ Provider: Google Gemini                                                 │
│ Model Selection:                                                        │
│ - Business: gemini-2.5-flash                                            │
│ - Enterprise: gemini-2.5-pro                                            │
│                                                                         │
│ Processing (for each contact in top 10):                                │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ 1. Generate similarity-aware prompt                                 │ │
│ │ 2. Call Gemini API                                                  │ │
│ │ 3. Parse JSON response:                                             │ │
│ │    {                                                                │ │
│ │      "explanation": "Why this contact matches the query...",        │ │
│ │      "factors": ["Factor 1", "Factor 2", "Factor 3"],               │ │
│ │      "strategicQuestions": [                                        │ │
│ │        "Question 1?",                                               │ │
│ │        "Question 2?",                                               │ │
│ │        "Question 3?"                                                │ │
│ │      ],                                                             │ │
│ │      "confidence": 8                                                │ │
│ │    }                                                                │ │
│ │                                                                     │ │
│ │ 4. Confidence Threshold Filtering:                                  │ │
│ │    - High similarity tier: ≥5 (permissive)                          │ │
│ │    - Medium similarity tier: ≥7 (standard)                          │ │
│ │    - Low similarity tier: ≥8 (strict)                               │ │
│ │                                                                     │ │
│ │ Logic: High vector score = lower AI confidence needed               │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ Cost: ~$0.0001-0.0002 per contact (Flash)                               │
│       ~$0.0005-0.001 per contact (Pro)                                  │
│                                                                         │
│ Session Tracking:                                                       │
│ - Records EACH contact analysis separately                              │
│ - Step Label: "Step 2: AI Enhancement"                                 │
│ - isBillableRun: true (if confidence ≥ threshold)                       │
│                                                                         │
│ Session Finalization:                                                   │
│ - SessionTrackingService.finalizeSession({ userId, sessionId })        │
│ - Updates status: 'in-progress' → 'completed'                          │
│ - Sets completedAt timestamp                                            │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ FINAL RESULTS                                                           │
│                                                                         │
│ Top 10 Contacts with:                                                   │
│ - vectorScore: 0.75 (original similarity)                               │
│ - rerankScore: 0.89 (Cohere relevance)                                 │
│ - hybridScore: 0.85 (weighted combination)                              │
│ - similarityTier: 'high' | 'medium' | 'low'                             │
│ - aiAnalysis: {                                                         │
│     matchExplanation: "...",                                            │
│     relevanceFactors: [...],                                            │
│     strategicQuestions: [...],                                          │
│     confidenceScore: 8                                                  │
│   }                                                                     │
│                                                                         │
│ Metadata:                                                               │
│ - sessionId                                                             │
│ - costs: { embedding, search, rerank, aiEnhancement, total }           │
│ - enhancementLevel: 'ai_powered_reranked'                               │
│ - timestamp                                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Current Production Stack (Verified from Code)

| Component | Provider | Model/Service | Specs | Cost |
|-----------|----------|---------------|-------|------|
| **Query Enhancement** | Google Gemini (Firebase AI) | gemini-2.5-flash | 3-tier cache (Static→Redis→AI) | ~$0.000008/query (cached) |
| **Embeddings** | Pinecone Inference API | multilingual-e5-large | **1024D** vectors | $0.08/M tokens |
| **Vector Database** | Pinecone | Serverless | Cosine similarity, namespace-isolated | $0.0001/query |
| **Reranking** | **Cohere (Direct API)** | **rerank-v3.5** | YAML docs, multilingual | $0.002/request |
| **AI Enhancement** | Google Gemini | gemini-2.5-flash (Business)<br>gemini-2.5-pro (Enterprise) | Strategic questions, confidence scoring | ~$0.0001-0.001/contact |
| **Caching** | Redis | N/A | 24h TTL for query enhancements | N/A |
| **Session Tracking** | Firestore | SessionUsage collection | Multi-step cost aggregation | N/A |

### Cost Breakdown Example

For query **"Who works at Tesla?"** with 50 vector results → 10 reranked → 10 AI-enhanced:

| Step | Provider | Operation | Cost | Billable? |
|------|----------|-----------|------|-----------|
| Step 0 (Enhancement) | Gemini Flash | Query expansion | $0.000008 | No |
| Step 0 (Embedding) | Pinecone Inference | 1024D vector generation | $0.000016 | No |
| Step 0 (Search) | Pinecone | Vector query | $0.000100 | No |
| Step 1 (Rerank) | Cohere | rerank-v3.5 (50 docs) | $0.002000 | No |
| Step 2 (AI × 10) | Gemini Flash | Contact analysis | $0.001200 | **Yes** |
| **Total** | | | **$0.003324** | **1 run** |

---

## Architecture Layers

### 1. Client Layer

**File**: [`lib/services/serviceContact/client/services/SemanticSearchService.js`](lib/services/serviceContact/client/services/SemanticSearchService.js)

**Responsibilities**:
- Thin client with NO business logic
- Manages localStorage for search history (last 20 queries) and job caching (last 50 jobs, 1h TTL)
- Makes API calls to backend endpoints
- Categorizes results by similarity tier (high/medium/low)
- Handles streaming vs batch AI enhancement modes

**Key Methods**:
```javascript
// Main search method
static async search(query, options)

// Rerank contacts
static async rerankContacts(query, contacts, options)

// AI enhancement (streaming)
static async enhanceResultsWithStreaming(query, contacts, options)

// AI enhancement (batch)
static async enhanceResultsWithBatch(query, contacts, options)

// Categorize by similarity
static categorizeContactsBySimilarity(results, subscriptionLevel)
```

### 2. API Layer

**Files**:
- [`app/api/user/contacts/semantic-search/route.js`](app/api/user/contacts/semantic-search/route.js)
- [`app/api/user/contacts/rerank/route.js`](app/api/user/contacts/rerank/route.js)
- [`app/api/user/contacts/ai-enhance-results/route.js`](app/api/user/contacts/ai-enhance-results/route.js)

**Responsibilities**:
- Authentication via `createApiSession(request)`
- Feature permission checks (`PREMIUM_SEMANTIC_SEARCH`, `RERANK`, `AI_ENHANCE_RESULTS`)
- Affordability checks via `CostTrackingService.canAffordOperation()`
- Session ID generation and management
- Delegates to server services
- Records costs in `SessionUsage` and monthly aggregations
- Returns formatted responses

**Session ID Format**:
```javascript
const sessionId = `session_search_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
// Example: "session_search_1705934567890_x7k2"
```

### 3. Server Services (Business Logic)

#### Query Enhancement Service
**File**: [`lib/services/serviceContact/server/queryEnhancementService.js`](lib/services/serviceContact/server/queryEnhancementService.js)

**Responsibilities**:
- 3-tier caching: Static → Redis → Gemini AI
- Language detection (returned as ISO code, e.g., "eng")
- Query expansion with synonyms
- Cost tracking for AI calls

**Cache Strategy**:
```javascript
// Tier 1: Static Cache (COMMON_EXPANSIONS)
const staticResult = this._checkStaticCache(originalQuery);
if (staticResult) return staticResult; // ~0ms

// Tier 2: Redis Cache (24h TTL)
const redisResult = await this._checkRedisCache(originalQuery);
if (redisResult) return redisResult; // ~100-500ms

// Tier 3: Gemini 2.5 Flash
const aiResult = await this._callGeminiEnhancement(originalQuery);
await this._cacheInRedis(originalQuery, aiResult); // ~2s
return aiResult;
```

#### Embedding Service
**File**: [`lib/services/serviceContact/server/embeddingService.js`](lib/services/serviceContact/server/embeddingService.js)

**Responsibilities**:
- Generates embeddings using Pinecone Inference API
- Model: `multilingual-e5-large` (1024D)
- Validates embedding structure and dimension
- Batch processing support with rate limiting

**API Call**:
```javascript
const response = await pc.inference.embed(
  'multilingual-e5-large',
  [cleanText],
  { inputType: 'passage' }
);

const embedding = response.data[0].values; // 1024D vector
```

#### Semantic Search Service
**File**: [`lib/services/serviceContact/server/semanticSearchService.js`](lib/services/serviceContact/server/semanticSearchService.js)

**Responsibilities**:
- Orchestrates query enhancement, embedding, and vector search
- Queries Pinecone with namespace isolation (`user_{userId}`)
- Applies threshold filtering based on subscription
- Retrieves full contact data from Firestore
- Returns formatted results with metadata

#### Rerank Service
**File**: [`lib/services/serviceContact/server/rerankService.js`](lib/services/serviceContact/server/rerankService.js)

**Responsibilities**:
- Uses **Cohere direct API** (NOT Pinecone rerank)
- Always uses `rerank-v3.5` model
- Builds YAML documents for each contact
- Preprocesses queries (strips command verbs)
- Applies threshold filtering with smart fallback to vector scores
- Calculates hybrid score (30% vector + 70% rerank)

**Document Building**:
```javascript
static _buildYAMLRerankDocument(contact, subscriptionLevel) {
  const yamlParts = [];

  // Always included
  if (contact.name) yamlParts.push(`name: "${escape(contact.name)}"`);

  // Smart extraction from multiple sources
  const jobTitle = this._extractJobTitle(contact);
  const company = this._extractCompany(contact);
  const department = this._extractDepartment(contact);

  // Premium+ only
  if (isPremiumOrHigher && contact.notes) {
    yamlParts.push(`notes: "${escape(truncate(contact.notes, 500))}"`);
  }

  return yamlParts.join('\n');
}
```

#### AI Enhancement Service
**File**: [`lib/services/serviceContact/server/aiEnhanceService.js`](lib/services/serviceContact/server/aiEnhanceService.js)

**Responsibilities**:
- Generates AI insights using Gemini 2.5 Flash/Pro
- Creates strategic questions for each contact
- Filters by confidence threshold (5-8 based on similarity tier)
- Supports batch and streaming modes
- Tracks costs per contact

**Confidence Thresholds**:
```javascript
static _getConfidenceThreshold(similarityTier) {
  return {
    high: 5,    // Lower threshold for high similarity
    medium: 7,  // Standard threshold
    low: 8      // Higher threshold for low similarity
  }[similarityTier] || 7;
}
```

---

## Cost Tracking System

### Architecture Overview

The cost tracking system uses a **dual-write architecture**:

1. **SessionUsage**: Detailed step-by-step tracking for multi-step operations
2. **Monthly Aggregations**: Pre-aggregated summaries for fast dashboard queries

### Database Structure

```
Firestore Database
├── AIUsage
│   └── {userId}
│       ├── monthly
│       │   └── {YYYY-MM}
│       │       ├── totalCost: number
│       │       ├── totalRuns: number (billable)
│       │       ├── totalApiCalls: number
│       │       ├── featureBreakdown: {}
│       │       ├── providerBreakdown: {}
│       │       └── lastUpdated: Timestamp
│       └── operations
│           └── {operationId}
│               ├── timestamp: string
│               ├── feature: string
│               ├── provider: string
│               ├── cost: number
│               ├── isBillableRun: boolean
│               └── metadata: {}
│
├── ApiUsage
│   └── {userId}
│       ├── monthly (same structure as AIUsage)
│       └── operations (same structure as AIUsage)
│
└── SessionUsage
    └── {userId}
        └── sessions
            └── {sessionId}
                ├── feature: string (e.g., 'semantic_search')
                ├── status: 'in-progress' | 'completed' | 'abandoned'
                ├── totalCost: number
                ├── totalRuns: number
                ├── steps: [
                │     {
                │       stepLabel: string,
                │       operationId: string,
                │       usageType: string,
                │       feature: string,
                │       provider: string,
                │       cost: number,
                │       isBillableRun: boolean,
                │       timestamp: string,
                │       metadata: {}
                │     }
                │   ]
                ├── createdAt: Timestamp
                ├── lastUpdatedAt: Timestamp
                └── completedAt: Timestamp (if completed)
```

### Recording Usage

**File**: [`lib/services/serviceContact/server/costTrackingService.js`](lib/services/serviceContact/server/costTrackingService.js)

**Method**: `CostTrackingService.recordUsage(params)`

**Parameters**:
```javascript
{
  userId: string,              // User ID
  usageType: 'AIUsage' | 'ApiUsage',
  feature: string,             // e.g., 'semantic_search_vector'
  cost: number,                // Monetary cost in USD
  isBillableRun: boolean,      // Counts toward monthly quota?
  provider: string,            // e.g., 'pinecone+gemini'
  sessionId: string | null,    // Optional session ID
  stepLabel: string | null,    // e.g., 'Step 0: Vector Search'
  metadata: object             // Additional data
}
```

**Dual-Write Flow**:
```javascript
// If sessionId is provided, write to BOTH:
if (sessionId) {
  // 1. SessionUsage (detailed step tracking)
  await SessionTrackingService.addStepToSession({
    userId,
    sessionId,
    stepData: { stepLabel, operationId, usageType, feature, provider, cost, ... }
  });

  // 2. Monthly aggregation (falls through to code below)
}

// Update monthly aggregation documents (for ALL operations)
const monthlyDocRef = adminDb.collection(usageType)
  .doc(userId)
  .collection('monthly')
  .doc(currentMonth);

await adminDb.runTransaction(async (transaction) => {
  // Update totals
  monthlyData.totalCost += cost;
  monthlyData.totalApiCalls += 1;
  if (isBillableRun) {
    monthlyData.totalRuns += 1;
  }

  // Update feature breakdown
  featureBreakdown[feature].cost += cost;
  featureBreakdown[feature].apiCalls += 1;

  // Update provider breakdown
  providerBreakdown[provider].cost += cost;

  transaction.set(monthlyDocRef, monthlyData, { merge: true });
});
```

### Affordability Checks

**Method**: `CostTrackingService.canAffordOperation(userId, estimatedCost, requireRuns)`

**Logic**:
```javascript
// 1. Get user's monthly usage and subscription limits
const usage = await this.getUserMonthlyUsage(userId, 'AIUsage');

// 2. Enterprise users have unlimited budget
if (usage.subscriptionLevel === 'ENTERPRISE') {
  return { canAfford: true, reason: 'enterprise_unlimited' };
}

// 3. Check if adding this cost would exceed budget
const wouldExceedBudget = (usage.usage.totalCost + estimatedCost) > usage.limits.maxCost;
if (wouldExceedBudget) {
  return { canAfford: false, reason: 'budget_exceeded' };
}

// 4. Check if adding this run would exceed run limit
const wouldExceedRuns = (usage.usage.totalRuns + requireRuns) > usage.limits.maxRuns;
if (wouldExceedRuns) {
  return { canAfford: false, reason: 'runs_exceeded' };
}

// 5. User can afford
return { canAfford: true, reason: 'within_limits' };
```

### Subscription Limits

**File**: [`lib/services/serviceContact/client/constants/contactConstants.js`](lib/services/serviceContact/client/constants/contactConstants.js)

```javascript
export const CONTACT_LIMITS = {
  [SUBSCRIPTION_LEVELS.PRO]: {
    aiCostBudget: 1.5,         // $1.50/month
    maxAiRunsPerMonth: 0,      // No AI operations
    maxApiCallsPerMonth: 50    // API operations only
  },
  [SUBSCRIPTION_LEVELS.PREMIUM]: {
    aiCostBudget: 3.0,         // $3.00/month
    maxAiRunsPerMonth: 30,     // AI operations limit
    maxApiCallsPerMonth: 100
  },
  [SUBSCRIPTION_LEVELS.BUSINESS]: {
    aiCostBudget: 5.0,         // $5.00/month
    maxAiRunsPerMonth: 50,
    maxApiCallsPerMonth: 200
  },
  [SUBSCRIPTION_LEVELS.ENTERPRISE]: {
    aiCostBudget: -1,          // Unlimited
    maxAiRunsPerMonth: -1      // Unlimited
  }
};
```

### What Counts as a "Billable Run"?

| Step | Operation | Billable? | Reason |
|------|-----------|-----------|--------|
| Step 0 | Query Enhancement | ❌ No | Intermediate step |
| Step 0 | Embedding Generation | ❌ No | Intermediate step |
| Step 0 | Vector Search | ❌ No | Intermediate step |
| Step 1 | Reranking | ❌ No | Intermediate step |
| Step 2 | AI Enhancement (per contact) | ✅ **Yes** (if confidence ≥ threshold) | Final output |

**Rationale**: Only the final AI enhancement step counts as a billable run because:
1. It produces the end-user value (strategic questions, match explanations)
2. It has a confidence threshold filter (low-confidence results don't count)
3. The other steps are infrastructure costs, not deliverables

---

## Session Management

### Session Lifecycle

**File**: [`lib/services/serviceContact/server/costTracking/sessionService.js`](lib/services/serviceContact/server/costTracking/sessionService.js)

```
1. CREATE SESSION
   - Generated by API layer: `session_search_{timestamp}_{random}`
   - First step triggers session creation in Firestore
   - Status: 'in-progress'

2. ADD STEPS
   - Each operation calls SessionTrackingService.addStepToSession()
   - Appends to steps[] array
   - Updates totalCost and totalRuns
   - Updates lastUpdatedAt

3. FINALIZE SESSION
   - Last step calls SessionTrackingService.finalizeSession()
   - Status: 'in-progress' → 'completed'
   - Sets completedAt timestamp
```

### Adding Steps to Session

**Method**: `SessionTrackingService.addStepToSession({ userId, sessionId, stepData })`

```javascript
const sessionUpdate = {
  feature: baseFeature,                          // 'semantic_search'
  status: 'in-progress',
  totalCost: FieldValue.increment(cost),
  totalRuns: FieldValue.increment(isBillableRun ? 1 : 0),
  lastUpdatedAt: FieldValue.serverTimestamp(),
  steps: FieldValue.arrayUnion({
    stepLabel: 'Step 0: Vector Search',
    operationId,
    usageType: 'ApiUsage',
    feature: 'semantic_search_vector',
    provider: 'pinecone+gemini',
    cost: 0.000116,
    isBillableRun: false,
    timestamp,
    metadata: { queryLength, embeddingTime, searchDuration, ... }
  })
};

await sessionRef.set(sessionUpdate, { merge: true });
```

### Example Session Document

```json
{
  "feature": "semantic_search",
  "status": "completed",
  "totalCost": 0.003324,
  "totalRuns": 1,
  "steps": [
    {
      "stepLabel": "Step 0: Vector Search",
      "operationId": "usage_1705934567890_x7k2",
      "usageType": "ApiUsage",
      "feature": "semantic_search_vector",
      "provider": "pinecone+gemini",
      "cost": 0.000124,
      "isBillableRun": false,
      "timestamp": "2025-01-22T10:15:00.000Z",
      "metadata": {
        "queryLength": 18,
        "embeddingTime": 250,
        "searchDuration": 120,
        "tokens": 5,
        "resultsFound": 50
      }
    },
    {
      "stepLabel": "Step 1: Rerank",
      "operationId": "usage_1705934568120_p9m4",
      "usageType": "ApiUsage",
      "feature": "semantic_search_rerank",
      "provider": "rerank-v3.5",
      "cost": 0.002,
      "isBillableRun": false,
      "timestamp": "2025-01-22T10:15:01.000Z",
      "metadata": {
        "documentsReranked": 50,
        "detectedLanguage": "eng"
      }
    },
    {
      "stepLabel": "Step 2: AI Enhancement",
      "operationId": "usage_1705934569450_a2n7",
      "usageType": "AIUsage",
      "feature": "semantic_search_ai_enhance",
      "provider": "gemini-2.5-flash",
      "cost": 0.00012,
      "isBillableRun": true,
      "timestamp": "2025-01-22T10:15:02.000Z",
      "metadata": {
        "contactId": "contact_abc123",
        "confidence": 8
      }
    }
  ],
  "createdAt": "2025-01-22T10:15:00.000Z",
  "lastUpdatedAt": "2025-01-22T10:15:05.000Z",
  "completedAt": "2025-01-22T10:15:05.000Z"
}
```

---

## Threshold-Based Filtering

### Vector Similarity Thresholds

**Purpose**: Filter out low-quality vector matches based on subscription tier.

**Implementation**: [`contactConstants.js:620`](lib/services/serviceContact/client/constants/contactConstants.js#L620)

```javascript
CONFIDENCE_THRESHOLDS.VECTOR_MINIMUM = {
  enterprise: 0.10,  // Keep results with ≥10% vector similarity
  business: 0.15,    // Keep results with ≥15% vector similarity
  premium: 0.20,     // Keep results with ≥20% vector similarity
  pro: 0.25,         // Keep results with ≥25% vector similarity
  base: 0.30         // Keep results with ≥30% vector similarity
};
```

**Applied in**: [`semanticSearchService.js:119`](lib/services/serviceContact/server/semanticSearchService.js#L119)

```javascript
if (minVectorScore !== null && minVectorScore > 0) {
  filteredMatches = rawMatches.filter(match => match.score >= minVectorScore);

  console.log(`Applied vector threshold: ${minVectorScore}`);
  console.log(`Kept: ${filteredMatches.length}, Removed: ${rawMatches.length - filteredMatches.length}`);
}
```

### Rerank Confidence Thresholds

**Purpose**: Filter reranked results by minimum relevance score.

**Implementation**: [`contactConstants.js:656`](lib/services/serviceContact/client/constants/contactConstants.js#L656)

```javascript
CONFIDENCE_THRESHOLDS.RERANK_MINIMUM = 0.001; // Very permissive (same for all tiers)
```

**Smart Fallback Logic**: [`rerankService.js:206`](lib/services/serviceContact/server/rerankService.js#L206)

```javascript
if (useThresholdFiltering) {
  filteredResults = rawResults.filter(result => result.score >= minRerankScore);

  // FALLBACK: If zero results, use vector scores instead
  if (filteredResults.length === 0) {
    console.warn('ZERO RESULTS from rerank threshold!');
    console.log('Applying FALLBACK: Using vector scores');

    const vectorSorted = contacts
      .sort((a, b) => b._vectorScore - a._vectorScore)
      .slice(0, topN);

    filteredResults = vectorSorted.map(contact => ({
      ...contact,
      fallbackUsed: true,
      scoringMethod: 'vector'
    }));
  }
}
```

### AI Confidence Thresholds

**Purpose**: Only include AI insights with sufficient confidence.

**Implementation**: [`contactConstants.js:578`](lib/services/serviceContact/client/constants/contactConstants.js#L578)

```javascript
AI_CONFIDENCE_THRESHOLDS = {
  high: 5,    // Lower threshold for high similarity contacts
  medium: 7,  // Standard threshold
  low: 8      // Higher threshold for low similarity contacts
};
```

**Logic**: High-similarity contacts (strong vector match) require less AI confidence to be included. This prevents filtering out good matches where the AI is slightly uncertain.

**Applied in**: [`aiEnhanceService.js:104`](lib/services/serviceContact/server/aiEnhanceService.js#L104)

```javascript
const confidenceThreshold = this._getConfidenceThreshold(contact.similarityTier);

if (analysis.confidence >= confidenceThreshold) {
  successfulRuns++;
  results.push(insight);
} else {
  filteredContacts++;
  console.log(`Filtered: ${contact.name} (${analysis.confidence}/${confidenceThreshold})`);
}
```

---

## Document Building Strategy

### Overview

For reranking, each contact is converted to a **YAML-formatted document** that Cohere's rerank model analyzes.

**Why YAML?** Cohere models are optimized for structured text formats. YAML is more readable than JSON and produces better semantic matching.

### Field Extraction Strategy

**File**: [`rerankService.js:346`](lib/services/serviceContact/server/rerankService.js#L346)

**Approach**: Extract from **multiple sources** to handle different contact structures:

1. Direct properties: `contact.jobTitle`, `contact.company`
2. Details array: `contact.details[]` (legacy structure)
3. Dynamic fields: `contact.dynamicFields[]` (custom fields)

```javascript
static _extractJobTitle(contact) {
  // 1. Check direct property
  if (contact.jobTitle) return contact.jobTitle;

  // 2. Check details array
  if (contact.details && Array.isArray(contact.details)) {
    const jobField = contact.details.find(d =>
      d.label?.toLowerCase() === 'job title' ||
      d.label?.toLowerCase() === 'title' ||
      d.label?.toLowerCase() === 'position'
    );
    if (jobField?.value) return jobField.value;
  }

  return null;
}

static _extractCompany(contact) {
  if (contact.company) return contact.company;

  if (contact.details && Array.isArray(contact.details)) {
    const companyField = contact.details.find(d =>
      d.label?.toLowerCase() === 'company' ||
      d.label?.toLowerCase() === 'organization'
    );
    if (companyField?.value) return companyField.value;
  }

  return null;
}

static _extractDepartment(contact) {
  if (contact.department) return contact.department;

  // Check details array
  if (contact.details && Array.isArray(contact.details)) {
    const deptField = contact.details.find(d =>
      d.label?.toLowerCase().includes('department')
    );
    if (deptField?.value) return deptField.value;
  }

  // Check dynamicFields array
  if (contact.dynamicFields && Array.isArray(contact.dynamicFields)) {
    const deptField = contact.dynamicFields.find(f =>
      f.label?.toLowerCase().includes('department')
    );
    if (deptField?.value) return deptField.value;
  }

  return null;
}
```

### Document Builder

```javascript
static _buildYAMLRerankDocument(contact, subscriptionLevel) {
  const yamlParts = [];
  const isPremiumOrHigher = ['premium', 'business', 'enterprise'].includes(subscriptionLevel);

  // Helper functions
  const escape = (str) => {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, ' ')
      .trim();
  };

  const truncate = (text, maxChars = 500) => {
    if (!text || text.length <= maxChars) return text;
    return text.substring(0, maxChars) + '...';
  };

  // Always included fields
  if (contact.name) {
    yamlParts.push(`name: "${escape(contact.name)}"`);
  }

  const jobTitle = this._extractJobTitle(contact);
  if (jobTitle) {
    yamlParts.push(`job_title: "${escape(jobTitle)}"`);
  }

  const company = this._extractCompany(contact);
  if (company) {
    yamlParts.push(`company: "${escape(company)}"`);
  }

  // Premium+ fields (richer context)
  if (isPremiumOrHigher && contact.notes) {
    yamlParts.push(`notes: "${escape(truncate(contact.notes, 500))}"`);
  }

  if (isPremiumOrHigher && contact.message) {
    yamlParts.push(`message: "${escape(truncate(contact.message, 500))}"`);
  }

  const department = this._extractDepartment(contact);
  if (department) {
    yamlParts.push(`department: "${escape(department)}"`);
  }

  // Additional fields
  if (contact.status) {
    yamlParts.push(`status: "${escape(contact.status)}"`);
  }

  if (contact.email) {
    yamlParts.push(`email: "${escape(contact.email)}"`);
  }

  if (contact.phone) {
    yamlParts.push(`phone: "${escape(contact.phone)}"`);
  }

  if (contact.linkedin) {
    yamlParts.push(`linkedin: "${escape(contact.linkedin)}"`);
  }

  // Event info (Premium+)
  if (isPremiumOrHigher && contact.eventInfo?.eventName) {
    yamlParts.push(`event: "${escape(contact.eventInfo.eventName)}"`);
  }

  return yamlParts.join('\n');
}
```

### Example Output

**Base Tier** (minimal):
```yaml
name: "Elon Musk"
job_title: "Chief Executive Officer"
company: "Tesla, Inc."
status: "active"
email: "elon@tesla.com"
phone: "+1-650-123-4567"
```

**Premium+ Tier** (rich):
```yaml
name: "Elon Musk"
job_title: "Chief Executive Officer"
company: "Tesla, Inc."
notes: "Met at AI Summit 2024. Discussed autonomous driving technology and neural network architectures. Very interested in our AI roadmap. Follow up on..."
message: "Thanks for the great conversation at the summit! I'd love to continue our discussion about neural networks and their application to autonomous systems..."
department: "Executive Leadership"
status: "active"
email: "elon@tesla.com"
phone: "+1-650-123-4567"
linkedin: "linkedin.com/in/elonmusk"
event: "AI Summit 2024"
```

### Key Characteristics

✅ **YAML format**: Optimized for Cohere's rerank model
✅ **Multi-source extraction**: Handles different contact structures
✅ **Subscription-based richness**: Premium+ gets more context
✅ **Truncation**: Limits notes/messages to 500 chars to prevent token bloat
✅ **Escape handling**: Prevents YAML parsing errors from special characters

---

## File Reference Guide

### Client Layer
| File | Purpose |
|------|---------|
| [`lib/services/serviceContact/client/services/SemanticSearchService.js`](lib/services/serviceContact/client/services/SemanticSearchService.js) | Client-side service for API communication, localStorage management, result categorization |
| [`lib/services/serviceContact/client/constants/contactConstants.js`](lib/services/serviceContact/client/constants/contactConstants.js) | Constants for thresholds, subscription limits, feature flags, model configs |

### API Layer
| File | Purpose |
|------|---------|
| [`app/api/user/contacts/semantic-search/route.js`](app/api/user/contacts/semantic-search/route.js) | Vector search endpoint: auth, affordability, session creation |
| [`app/api/user/contacts/rerank/route.js`](app/api/user/contacts/rerank/route.js) | Rerank endpoint: bypass logic, Cohere API calls, session tracking |
| [`app/api/user/contacts/ai-enhance-results/route.js`](app/api/user/contacts/ai-enhance-results/route.js) | AI enhancement endpoint: batch/streaming modes, session finalization |

### Server Services
| File | Purpose |
|------|---------|
| [`lib/services/serviceContact/server/queryEnhancementService.js`](lib/services/serviceContact/server/queryEnhancementService.js) | Query enhancement: 3-tier caching, Gemini 2.5 Flash, language detection |
| [`lib/services/serviceContact/server/embeddingService.js`](lib/services/serviceContact/server/embeddingService.js) | Embedding generation: Pinecone Inference API, 1024D vectors |
| [`lib/services/serviceContact/server/semanticSearchService.js`](lib/services/serviceContact/server/semanticSearchService.js) | Vector search orchestration: embedding + Pinecone query + Firestore retrieval |
| [`lib/services/serviceContact/server/rerankService.js`](lib/services/serviceContact/server/rerankService.js) | Reranking: Cohere rerank-v3.5, YAML docs, query preprocessing, fallback logic |
| [`lib/services/serviceContact/server/aiEnhanceService.js`](lib/services/serviceContact/server/aiEnhanceService.js) | AI enhancement: Gemini 2.5 Flash/Pro, strategic questions, confidence filtering |
| [`lib/services/serviceContact/server/indexManagementService.js`](lib/services/serviceContact/server/indexManagementService.js) | Pinecone index management: namespace handling, index operations |
| [`lib/services/serviceContact/server/costTrackingService.js`](lib/services/serviceContact/server/costTrackingService.js) | Cost tracking: dual-write architecture, affordability checks, monthly aggregations |
| [`lib/services/serviceContact/server/costTracking/sessionService.js`](lib/services/serviceContact/server/costTracking/sessionService.js) | Session tracking: multi-step operations, session lifecycle management |

### Constants & Configuration
| File | Purpose |
|------|---------|
| [`lib/services/constants/apiCosts.js`](lib/services/constants/apiCosts.js) | API pricing constants: Pinecone, Cohere, Gemini, Google Maps |
| [`lib/services/constants/aiCosts.js`](lib/services/constants/aiCosts.js) | AI model pricing: Gemini Flash/Pro token costs |

---

## Key Code Examples

### 1. Query Enhancement (3-Tier Cache)

```javascript
// lib/services/serviceContact/server/queryEnhancementService.js

static async enhanceQuery(originalQuery, options = {}) {
  // Tier 1: Static Cache (~0ms)
  const staticResult = this._checkStaticCache(originalQuery);
  if (staticResult) {
    console.log('⚡ Static cache HIT');
    return {
      enhancedQuery: staticResult.enhancedQuery,
      language: staticResult.language,
      metadata: { cached: true, cacheType: 'static' }
    };
  }

  // Tier 2: Redis Cache (~100-500ms)
  const redisResult = await this._checkRedisCache(originalQuery);
  if (redisResult) {
    console.log('⚡ Redis cache HIT');
    return {
      enhancedQuery: redisResult.enhancedQuery,
      language: redisResult.language,
      metadata: { cached: true, cacheType: 'redis', ttl: redisResult.ttl }
    };
  }

  // Tier 3: Gemini 2.5 Flash (~2s)
  const aiResult = await this._callGeminiEnhancement(originalQuery, enhanceId, sessionId, userId);

  // Cache in Redis for 24h
  await this._cacheInRedis(originalQuery, aiResult);

  return {
    enhancedQuery: aiResult.enhancedQuery,
    language: aiResult.language,
    metadata: { cached: false, cacheType: 'ai', cost: aiResult.cost }
  };
}
```

### 2. Embedding Generation (Pinecone Inference)

```javascript
// lib/services/serviceContact/server/embeddingService.js

static async generateEmbedding(text) {
  const cleanText = text.replace(/\n/g, ' ').trim();

  // Call Pinecone Inference API
  const response = await pc.inference.embed(
    'multilingual-e5-large',  // Model
    [cleanText],              // Input text array
    { inputType: 'passage' }  // Context type
  );

  // Extract 1024D vector
  const embedding = response.data[0].values;

  console.log('Embedding generated:', {
    model: 'multilingual-e5-large',
    dimension: embedding.length,  // 1024
    magnitude: this._calculateMagnitude(embedding)
  });

  return embedding;
}
```

### 3. Vector Search (Pinecone Query)

```javascript
// lib/services/serviceContact/server/semanticSearchService.js

static async search(userId, query, options = {}) {
  // Step 1: Generate embedding
  const queryEmbedding = await EmbeddingService.generateEmbedding(enhancedQuery);

  // Step 2: Query Pinecone
  const namespace = `user_${userId}`;
  const index = await IndexManagementService.getNamespacedIndex(userId);

  const searchResults = await index.query({
    vector: queryEmbedding,      // 1024D vector
    topK: maxResults,            // 100
    includeMetadata: true,
    includeValues: false
  });

  // Step 3: Apply threshold filtering
  let filteredMatches = searchResults.matches;
  if (minVectorScore !== null && minVectorScore > 0) {
    filteredMatches = searchResults.matches.filter(
      match => match.score >= minVectorScore
    );

    console.log(`Threshold filter: kept ${filteredMatches.length}, removed ${searchResults.matches.length - filteredMatches.length}`);
  }

  // Step 4: Retrieve full contact data from Firestore
  const contacts = await this._retrieveContactData(userId, filteredMatches);

  return { results: contacts, searchMetadata: {...} };
}
```

### 4. Reranking (Cohere Direct API)

```javascript
// lib/services/serviceContact/server/rerankService.js

static async rerankContacts(query, contacts, options = {}) {
  // Build YAML documents
  const documents = contacts.map(contact =>
    this._buildYAMLRerankDocument(contact, subscriptionLevel)
  );

  // Preprocess query (strip command verbs)
  const queryPreprocessing = this._preprocessQuery(query);
  const queryToUse = queryPreprocessing.preprocessed;

  // Call Cohere Rerank API
  const rerankResponse = await cohere.rerank({
    query: queryToUse,
    documents: documents,
    model: 'rerank-v3.5',           // ALWAYS v3.5
    topN: Math.min(topN, contacts.length),
    returnDocuments: false,
    maxTokensPerDoc: 512
  });

  // Apply threshold filtering with fallback
  let filteredResults = rerankResponse.results.filter(
    result => result.relevanceScore >= minRerankScore
  );

  // FALLBACK: If zero results, use vector scores
  if (filteredResults.length === 0) {
    console.warn('ZERO RESULTS from rerank! Falling back to vector scores');
    filteredResults = contacts
      .sort((a, b) => b._vectorScore - a._vectorScore)
      .slice(0, topN)
      .map(contact => ({ ...contact, fallbackUsed: true }));
  }

  // Calculate hybrid scores
  const rerankedContacts = filteredResults.map(result => ({
    ...contacts[result.index],
    searchMetadata: {
      rerankScore: result.relevanceScore,
      hybridScore: (vectorScore * 0.3) + (result.relevanceScore * 0.7)
    }
  }));

  return { results: rerankedContacts, metadata: {...} };
}
```

### 5. AI Enhancement (Gemini)

```javascript
// lib/services/serviceContact/server/aiEnhanceService.js

static async enhanceResults(query, contacts, options = {}) {
  const modelName = subscriptionLevel === 'enterprise'
    ? 'gemini-2.5-pro'
    : 'gemini-2.5-flash';

  const model = genAI.getGenerativeModel({ model: modelName });

  for (const contact of contacts) {
    // Generate similarity-aware prompt
    const prompt = this._generateSimilarityAwarePrompt(query, contact, queryLanguage);

    // Call Gemini
    const result = await model.generateContent(prompt);
    const analysis = JSON.parse(result.response.text());

    // Check confidence threshold
    const confidenceThreshold = this._getConfidenceThreshold(contact.similarityTier);

    if (analysis.confidence >= confidenceThreshold) {
      results.push({
        contactId: contact.id,
        explanation: analysis.explanation,
        factors: analysis.factors,
        strategicQuestions: analysis.strategicQuestions,  // 3 questions
        confidence: analysis.confidence,
        billing: { apiCallCost, countsAsRun: true }
      });
    } else {
      console.log(`Filtered: ${contact.name} (${analysis.confidence}/${confidenceThreshold})`);
    }
  }

  return { insights: results, billing: {...} };
}
```

### 6. Cost Recording (Dual-Write)

```javascript
// lib/services/serviceContact/server/costTrackingService.js

static async recordUsage({ userId, usageType, feature, cost, isBillableRun, provider, sessionId, stepLabel, metadata }) {
  // DUAL-WRITE: If sessionId provided, write to BOTH SessionUsage and monthly docs
  if (sessionId) {
    // 1. Write to SessionUsage (detailed step tracking)
    await SessionTrackingService.addStepToSession({
      userId,
      sessionId,
      stepData: {
        stepLabel: 'Step 0: Vector Search',
        operationId,
        usageType,
        feature,
        provider,
        cost,
        isBillableRun,
        timestamp: new Date().toISOString(),
        metadata
      }
    });

    console.log('Session step recorded in SessionUsage');
  }

  // 2. Update monthly aggregation (for ALL operations)
  const currentMonth = new Date().toISOString().slice(0, 7); // '2025-01'
  const monthlyDocRef = adminDb.collection(usageType)
    .doc(userId)
    .collection('monthly')
    .doc(currentMonth);

  await adminDb.runTransaction(async (transaction) => {
    const monthlyDoc = await transaction.get(monthlyDocRef);
    const monthlyData = monthlyDoc.exists ? monthlyDoc.data() : { totalCost: 0, totalRuns: 0, ... };

    // Update totals
    monthlyData.totalCost += cost;
    monthlyData.totalApiCalls += 1;
    if (isBillableRun) {
      monthlyData.totalRuns += 1;
    }

    // Update feature breakdown
    monthlyData.featureBreakdown[feature].cost += cost;

    // Update provider breakdown
    monthlyData.providerBreakdown[provider].cost += cost;

    transaction.set(monthlyDocRef, monthlyData, { merge: true });
  });

  console.log(`Usage recorded in ${sessionId ? 'SessionUsage + monthly docs' : usageType}`);
}
```

### 7. Session Finalization

```javascript
// lib/services/serviceContact/server/costTracking/sessionService.js

static async finalizeSession({ userId, sessionId }) {
  const sessionRef = adminDb
    .collection('SessionUsage')
    .doc(userId)
    .collection('sessions')
    .doc(sessionId);

  await sessionRef.update({
    status: 'completed',
    completedAt: FieldValue.serverTimestamp()
  });

  console.log(`Session finalized: ${sessionId}`);
  return { success: true };
}
```

---

## Discrepancies from Documentation

### Critical Differences

| Documentation Says | Actual Code Does | Impact |
|-------------------|------------------|--------|
| **Embeddings: Google Gemini `text-embedding-004` (768D)** | **Pinecone Inference `multilingual-e5-large` (1024D)** | ⚠️ **CRITICAL** - Completely different provider and vector space |
| **Reranking: Pinecone rerank API** | **Cohere direct API (`rerank-v3.5`)** | ⚠️ **CRITICAL** - Different provider (migrated Jan 2025) |
| 768-dimensional vectors | **1024-dimensional vectors** | ⚠️ **CRITICAL** - Different embedding space |
| Uses `rerank-multilingual-v3.0` | Uses **`rerank-v3.5`** (always) | ⚠️ **MINOR** - Newer model than documented |
| No query enhancement mentioned | **Query enhancement via Gemini 2.5 Flash** (Step 0) | ⚠️ **MAJOR** - Entire missing step |
| No caching system mentioned | **3-tier caching**: Static → Redis (24h) → AI | ⚠️ **MAJOR** - Critical performance optimization |
| Pinecone rerank used | **Never uses Pinecone rerank** (deprecated, poor scores) | ⚠️ **CRITICAL** - Docs reference non-existent service |
| Simple text documents for rerank | **YAML-formatted documents** | ⚠️ **MODERATE** - Different document format |
| No session tracking | **SessionUsage collection** with multi-step tracking | ⚠️ **MAJOR** - Missing cost tracking architecture |

### Why These Changes Happened

**Migration Timeline** (inferred from code comments):

1. **Original**: Google Gemini embeddings (768D) + Pinecone rerank
2. **Jan 2025**: Migrated to Pinecone Inference embeddings (1024D) for better multilingual support
3. **Jan 2025**: Migrated from Pinecone rerank to Cohere due to poor scores (0.0000-0.0121 vs expected 0.6-0.9)
4. **Jan 2025**: Added query enhancement step with 3-tier caching
5. **Jan 2025**: Simplified rerank model to always use `rerank-v3.5` (testing showed it outperforms even language-specific models)

**Evidence from Code**:

```javascript
// lib/services/serviceContact/server/rerankService.js:2
// MIGRATION: Switched from Pinecone rerank to Cohere rerank for better semantic matching

// lib/services/serviceContact/server/rerankService.js:90
// ALWAYS USE RERANK-V3.5 (BEST MODEL)
// Testing showed v3.5 outperforms even rerank-english-v3.0 for English queries
```

---

## Summary

### Current Architecture (Verified)

```
Query Enhancement (Gemini 2.5 Flash + 3-tier cache)
    ↓
Embeddings (Pinecone Inference: multilingual-e5-large, 1024D)
    ↓
Vector Search (Pinecone Serverless: cosine similarity)
    ↓
Reranking (Cohere rerank-v3.5: YAML docs, query preprocessing)
    ↓
AI Enhancement (Gemini 2.5 Flash/Pro: strategic questions)
    ↓
Cost Tracking (Dual-write: SessionUsage + monthly aggregations)
```

### Key Takeaways

✅ **4-step pipeline**: Query enhancement → Embedding → Vector search → Rerank → AI
✅ **Multi-provider**: Gemini (query + AI) + Pinecone (embedding + vector DB) + Cohere (rerank)
✅ **Adaptive filtering**: Different thresholds per subscription tier
✅ **Smart fallbacks**: Rerank falls back to vector scores if no results
✅ **Cost-conscious**: Only final AI step counts as billable run
✅ **Session tracking**: Multi-step operations linked for analytics
✅ **3-tier caching**: Static → Redis → AI for query enhancement

### Documentation Status

⚠️ **Outdated Documentation**: The existing docs describe a previous architecture. This document reflects the **actual current implementation** as of the code analysis date.

---

**End of Documentation**
