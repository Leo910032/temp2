'use client';

import { useState } from 'react';
import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import { initializeApp, getApps } from 'firebase/app';

// Model pricing configuration
const MODEL_PRICING = {
  'gemini-2.5-flash-preview-09-2025': {
    input: 0.30,
    output: 2.50,
    name: 'Gemini 2.5 Flash Preview',
    shortName: '2.5 Preview'
  },
  'gemini-2.5-flash-lite': {
    input: 0.10,
    output: 0.40,
    name: 'Gemini 2.5 Flash-Lite',
    shortName: '2.5 Lite'
  },
  'gemini-2.0-flash': {
    input: 0.10,
    output: 0.40,
    name: 'Gemini 2.0 Flash',
    shortName: '2.0 Flash'
  },
  'gemini-2.0-flash-lite': {
    input: 0.075,
    output: 0.30,
    name: 'Gemini 2.0 Flash-Lite',
    shortName: '2.0 Lite'
  }
};

const MODEL_IDS = Object.keys(MODEL_PRICING);

// Canonical company list for matching - EXPANDED
const CANONICAL_COMPANIES = [
  // Tech giants
  "Tesla",
  "Microsoft",
  "Apple",
  "Amazon",
  "Google",
  "Meta",
  "Netflix",
  "Facebook", // Keep for legacy matching
  "Twitter",
  "LinkedIn",
  "GitHub",
  "YouTube",
  "Instagram",
  "WhatsApp",

  // Telecom & Infrastructure
  "AT&T",
  "Verizon",

  // Traditional tech
  "IBM",
  "International Business Machines",
  "Hewlett-Packard",
  "HP",
  "Oracle",
  "Salesforce",
  "Adobe",
  "Intel",
  "Cisco",
  "Dell",

  // Food & Retail
  "Kentucky Fried Chicken",
  "KFC",
  "McDonald's",
  "Coca-Cola",
  "PepsiCo",
  "Starbucks",
  "Walmart",
  "Target",
  "Whole Foods",
  "Zappos",

  // Retail & Department Stores
  "Macy's",
  "Lowe's",
  "Kohl's",
  "Wendy's",
  "Dillard's",
  "Barnes & Noble",

  // Fashion & Apparel
  "Nike",
  "Adidas",
  "H&M",

  // Automotive
  "Toyota",
  "Toyota Motor Corporation",
  "Honda",
  "Honda Motor Company",
  "Nissan",
  "Nissan Motor Company",
  "General Motors",
  "Ford",
  "BMW",
  "Rolls-Royce",

  // Asian Tech Giants
  "Samsung",
  "Samsung Electronics",
  "Sony",
  "Sony Corporation",
  "Alibaba Group",
  "Tencent Holdings",
  "Baidu",

  // Services & Logistics
  "Federal Express",
  "FedEx",
  "United Parcel Service",
  "UPS",
  "PayPal",
  "Airbnb",
  "Uber",

  // Entertainment & Media
  "Spotify",
  "Disney",

  // Industrial & Manufacturing
  "Boeing",
  "General Electric",
  "3M",

  // Consumer Goods
  "Procter & Gamble",
  "Johnson & Johnson",

  // Pharmaceuticals
  "Pfizer",
  "Moderna",

  // Financial Services
  "Visa",
  "Mastercard",
  "American Express",
  "JPMorgan Chase",
  "Bank of America",
  "Wells Fargo",
  "Goldman Sachs",
  "Morgan Stanley",

  // Cloud & Enterprise
  "Amazon Web Services",
  "AWS",

  // Other
  "BP",
  "CVS"
];

// Complete test case datasets with all 8 categories
const COMPANY_MATCHING_TEST_CASES = {
  // Category 1: Simple typos (1-2 character mistakes)
  misspellings: [
    { input: "Microsft", expected: "Microsoft" },
    { input: "Mircosoft", expected: "Microsoft" },
    { input: "Microsfot", expected: "Microsoft" },
    { input: "Gogle", expected: "Google" },
    { input: "Googel", expected: "Google" },
    { input: "Gooogle", expected: "Google" },
    { input: "Amazn", expected: "Amazon" },
    { input: "Amzon", expected: "Amazon" },
    { input: "Teslas", expected: "Tesla" },
    { input: "Tesl", expected: "Tesla" },
    { input: "Appl", expected: "Apple" },
    { input: "Aple", expected: "Apple" },
    { input: "Netflx", expected: "Netflix" },
    { input: "Netflixx", expected: "Netflix" },
    { input: "Facebok", expected: "Facebook" },
    { input: "Facbook", expected: "Facebook" },
    { input: "Twiter", expected: "Twitter" },
    { input: "Twtter", expected: "Twitter" },
    { input: "Oracl", expected: "Oracle" },
    { input: "Orcale", expected: "Oracle" },
    { input: "Salesfore", expected: "Salesforce" },
    { input: "Saleforce", expected: "Salesforce" },
    { input: "Coca-cola", expected: "Coca-Cola" },
    { input: "Cocacola", expected: "Coca-Cola" },
    { input: "Pepsi Co", expected: "PepsiCo" },
    { input: "Starbcks", expected: "Starbucks" },
    { input: "Starbcuks", expected: "Starbucks" },
    { input: "Mcdonalds", expected: "McDonald's" },
    { input: "McDonalds", expected: "McDonald's" },
    { input: "Targt", expected: "Target" },
    { input: "Addidas", expected: "Adidas" },
    { input: "Addias", expected: "Adidas" },
    { input: "Nikee", expected: "Nike" },
    { input: "Toyata", expected: "Toyota" },
    { input: "Toyotta", expected: "Toyota" }
  ],

  // Category 2: Abbreviations vs full names
  abbreviations: [
    { input: "IBM", expected: "International Business Machines" },
    { input: "ibm", expected: "International Business Machines" },
    { input: "HP", expected: "Hewlett-Packard" },
    { input: "hp", expected: "Hewlett-Packard" },
    { input: "GE", expected: "General Electric" },
    { input: "GM", expected: "General Motors" },
    { input: "AT&T", expected: "AT&T" },
    { input: "att", expected: "AT&T" },
    { input: "at&t", expected: "AT&T" },
    { input: "at and t", expected: "AT&T" },
    { input: "KFC", expected: "Kentucky Fried Chicken" },
    { input: "kfc", expected: "Kentucky Fried Chicken" },
    { input: "BMW", expected: "BMW" },
    { input: "UPS", expected: "United Parcel Service" },
    { input: "ups", expected: "United Parcel Service" },
    { input: "FedEx", expected: "Federal Express" },
    { input: "fedex", expected: "Federal Express" },
    { input: "fed ex", expected: "Federal Express" },
    { input: "3M", expected: "3M" },
    { input: "P&G", expected: "Procter & Gamble" },
    { input: "pg", expected: "Procter & Gamble" },
    { input: "J&J", expected: "Johnson & Johnson" },
    { input: "BP", expected: "BP" },
    { input: "CVS", expected: "CVS" },
    { input: "H&M", expected: "H&M" },
    { input: "MSFT", expected: "Microsoft" },
    { input: "AAPL", expected: "Apple" },
    { input: "AMZN", expected: "Amazon" },
    { input: "GOOGL", expected: "Google" },
    { input: "FB", expected: "Facebook" },
    { input: "TSLA", expected: "Tesla" },
    { input: "NFLX", expected: "Netflix" }
  ],

  // Category 3: Legal suffixes (Inc, LLC, Corp, etc.)
  legalSuffixes: [
    { input: "Tesla Inc", expected: "Tesla" },
    { input: "Tesla, Inc.", expected: "Tesla" },
    { input: "Tesla Inc.", expected: "Tesla" },
    { input: "Tesla Incorporated", expected: "Tesla" },
    { input: "Microsoft Corporation", expected: "Microsoft" },
    { input: "Microsoft Corp", expected: "Microsoft" },
    { input: "Microsoft Corp.", expected: "Microsoft" },
    { input: "Apple Inc", expected: "Apple" },
    { input: "Apple Inc.", expected: "Apple" },
    { input: "Apple Computer Inc", expected: "Apple" },
    { input: "Amazon.com Inc", expected: "Amazon" },
    { input: "Amazon.com, Inc.", expected: "Amazon" },
    { input: "Google LLC", expected: "Google" },
    { input: "Meta Platforms Inc", expected: "Meta" },
    { input: "Meta Platforms, Inc.", expected: "Meta" },
    { input: "Netflix, Inc.", expected: "Netflix" },
    { input: "Starbucks Corporation", expected: "Starbucks" },
    { input: "Walmart Inc", expected: "Walmart" },
    { input: "Target Corporation", expected: "Target" },
    { input: "Nike, Inc.", expected: "Nike" },
    { input: "Coca-Cola Company", expected: "Coca-Cola" },
    { input: "The Coca-Cola Company", expected: "Coca-Cola" },
    { input: "McDonald's Corporation", expected: "McDonald's" }
  ],

  // Category 4: Alternative/historical names
  alternativeNames: [
    { input: "Facebook", expected: "Meta" },
    { input: "Facebook Inc", expected: "Meta" },
    { input: "Instagram", expected: "Meta" },
    { input: "WhatsApp", expected: "Meta" },
    { input: "YouTube", expected: "Google" },
    { input: "LinkedIn", expected: "Microsoft" },
    { input: "GitHub", expected: "Microsoft" },
    { input: "Whole Foods", expected: "Amazon" },
    { input: "Zappos", expected: "Amazon" },
    { input: "AWS", expected: "Amazon Web Services" },
    { input: "Amazon Web Services", expected: "Amazon Web Services" },
    { input: "Mc Donalds", expected: "McDonald's" },
    { input: "Macdonalds", expected: "McDonald's" }
  ],

  // Category 5: Case sensitivity & spacing
  caseSpacing: [
    { input: "microsoft", expected: "Microsoft" },
    { input: "apple", expected: "Apple" },
    { input: "google", expected: "Google" },
    { input: "amazon", expected: "Amazon" },
    { input: "tesla", expected: "Tesla" },
    { input: "netflix", expected: "Netflix" },
    { input: "starbucks", expected: "Starbucks" },
    { input: "walmart", expected: "Walmart" },
    { input: "target", expected: "Target" },
    { input: "MICROSOFT", expected: "Microsoft" },
    { input: "APPLE", expected: "Apple" },
    { input: "GOOGLE", expected: "Google" },
    { input: "TESLA", expected: "Tesla" },
    { input: "MicroSoft", expected: "Microsoft" },
    { input: "FaceBook", expected: "Facebook" },
    { input: "YouTuBe", expected: "YouTube" },
    { input: "Star bucks", expected: "Starbucks" },
    { input: "Star  bucks", expected: "Starbucks" },
    { input: "Face book", expected: "Facebook" },
    { input: "You Tube", expected: "YouTube" },
    { input: "Pay Pal", expected: "PayPal" },
    { input: "Air bnb", expected: "Airbnb" },
    { input: "Air BnB", expected: "Airbnb" },
    { input: "AirBnb", expected: "Airbnb" }
  ],

  // Category 6: Punctuation & special characters
  punctuation: [
    { input: "ATT", expected: "AT&T" },
    { input: "AT T", expected: "AT&T" },
    { input: "AT & T", expected: "AT&T" },
    { input: "Procter and Gamble", expected: "Procter & Gamble" },
    { input: "Johnson and Johnson", expected: "Johnson & Johnson" },
    { input: "Barnes and Noble", expected: "Barnes & Noble" },
    { input: "Macys", expected: "Macy's" },
    { input: "Lowes", expected: "Lowe's" },
    { input: "Kohls", expected: "Kohl's" },
    { input: "Wendys", expected: "Wendy's" },
    { input: "Dillards", expected: "Dillard's" },
    { input: "Coca Cola", expected: "Coca-Cola" },
    { input: "CocaCola", expected: "Coca-Cola" },
    { input: "Hewlett Packard", expected: "Hewlett-Packard" },
    { input: "HewlettPackard", expected: "Hewlett-Packard" },
    { input: "Rolls Royce", expected: "Rolls-Royce" },
    { input: "RollsRoyce", expected: "Rolls-Royce" }
  ],

  // Category 7: International/regional variations
  international: [
    { input: "Alibaba", expected: "Alibaba Group" },
    { input: "Tencent", expected: "Tencent Holdings" },
    { input: "Baidu", expected: "Baidu" },
    { input: "Samsung", expected: "Samsung Electronics" },
    { input: "Sony", expected: "Sony Corporation" },
    { input: "Toyota", expected: "Toyota Motor Corporation" },
    { input: "Honda", expected: "Honda Motor Company" },
    { input: "Nissan", expected: "Nissan Motor Company" }
  ],

  // Category 8: Common autocorrect mistakes
  autocorrect: [
    { input: "Micro soft", expected: "Microsoft" },
    { input: "Amazonian", expected: "Amazon" },
    { input: "Goggle", expected: "Google" },
    { input: "Appel", expected: "Apple" },
    { input: "Nets flix", expected: "Netflix" },
    { input: "Star bicks", expected: "Starbucks" },
    { input: "Tesla's", expected: "Tesla" },
    { input: "Wal mart", expected: "Walmart" },
    { input: "Wal-mart", expected: "Walmart" },
    { input: "Face nook", expected: "Facebook" },
    { input: "You rube", expected: "YouTube" },
    { input: "Lined in", expected: "LinkedIn" },
    { input: "Link din", expected: "LinkedIn" }
  ]
};

// Calculate total test count
const TOTAL_TEST_COUNT =
  COMPANY_MATCHING_TEST_CASES.misspellings.length +
  COMPANY_MATCHING_TEST_CASES.abbreviations.length +
  COMPANY_MATCHING_TEST_CASES.legalSuffixes.length +
  COMPANY_MATCHING_TEST_CASES.alternativeNames.length +
  COMPANY_MATCHING_TEST_CASES.caseSpacing.length +
  COMPANY_MATCHING_TEST_CASES.punctuation.length +
  COMPANY_MATCHING_TEST_CASES.international.length +
  COMPANY_MATCHING_TEST_CASES.autocorrect.length;

// Initialize Firebase
let firebaseApp = null;
let ai = null;

function initializeFirebase() {
  if (firebaseApp) return ai;

  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_apiKey,
    authDomain: process.env.NEXT_PUBLIC_authDomain,
    projectId: process.env.NEXT_PUBLIC_projectId,
    storageBucket: process.env.NEXT_PUBLIC_storageBucket,
    messagingSenderId: process.env.NEXT_PUBLIC_messagingSenderId,
    appId: process.env.NEXT_PUBLIC_appId
  };

  const apps = getApps();
  firebaseApp = apps.length > 0 ? apps[0] : initializeApp(firebaseConfig);

  // Initialize AI with Developer API backend
  ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });

  return ai;
}

// Build prompt for company matching
function buildCompanyMatchPrompt(inputName, knownCompanies) {
  return `Given the company name "${inputName}", find the best match from this list:
${knownCompanies.join('\n')}

If there's a clear match (including abbreviations, common names, typos), return the exact canonical name from the list.
If no match, return "NO_MATCH".

Examples:
- Input: "kfc" → Match: "Kentucky Fried Chicken"
- Input: "at&t" → Match: "AT&T"
- Input: "Microsft" → Match: "Microsoft"

Respond with ONLY the canonical name or "NO_MATCH".`;
}

// Test a single model
async function testModel(modelId, inputName, knownCompanies) {
  const startTime = performance.now();

  try {
    // Initialize Firebase AI
    const ai = initializeFirebase();

    // Create model
    const model = getGenerativeModel(ai, { model: modelId });

    // Build prompt
    const prompt = buildCompanyMatchPrompt(inputName, knownCompanies);
    const sentPrompt = prompt;

    // Call API
    const result = await model.generateContent(prompt);
    const response = result.response;
    const responseText = response.text();

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Estimate tokens (Firebase AI doesn't provide token counts)
    const estimatedInputTokens = Math.ceil(prompt.length / 4);
    const estimatedOutputTokens = Math.ceil(responseText.length / 4);

    // Calculate actual cost
    const pricing = MODEL_PRICING[modelId];
    const inputCost = (estimatedInputTokens / 1000000) * pricing.input;
    const outputCost = (estimatedOutputTokens / 1000000) * pricing.output;
    const totalCost = inputCost + outputCost;

    return {
      success: true,
      modelId,
      modelName: pricing.name,
      match: responseText.trim(),
      duration: duration.toFixed(2),
      inputTokens: estimatedInputTokens,
      outputTokens: estimatedOutputTokens,
      inputCost: inputCost.toFixed(8),
      outputCost: outputCost.toFixed(8),
      totalCost: totalCost.toFixed(8),
      sentPrompt,
      receivedResponse: responseText,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    const endTime = performance.now();
    return {
      success: false,
      modelId,
      modelName: MODEL_PRICING[modelId].name,
      error: error.message,
      duration: (endTime - startTime).toFixed(2),
      timestamp: new Date().toISOString()
    };
  }
}

// Helper functions
const getAccuracyColor = (percentage) => {
  if (percentage >= 90) return 'text-green-600';
  if (percentage >= 80) return 'text-yellow-600';
  if (percentage >= 70) return 'text-orange-600';
  return 'text-red-600';
};

const getMedalEmoji = (rank) => {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return '';
};

// Category Breakdown Component
function CategoryBreakdown({ detailedResults }) {
  // Map results back to categories with their lengths
  const categoryMapping = [
    { key: 'misspellings', name: 'Typos & Misspellings', start: 0, length: COMPANY_MATCHING_TEST_CASES.misspellings.length },
    { key: 'abbreviations', name: 'Abbreviations', start: COMPANY_MATCHING_TEST_CASES.misspellings.length, length: COMPANY_MATCHING_TEST_CASES.abbreviations.length },
    { key: 'legalSuffixes', name: 'Legal Suffixes', start: COMPANY_MATCHING_TEST_CASES.misspellings.length + COMPANY_MATCHING_TEST_CASES.abbreviations.length, length: COMPANY_MATCHING_TEST_CASES.legalSuffixes.length },
    { key: 'alternativeNames', name: 'Alternative/Historical Names', start: COMPANY_MATCHING_TEST_CASES.misspellings.length + COMPANY_MATCHING_TEST_CASES.abbreviations.length + COMPANY_MATCHING_TEST_CASES.legalSuffixes.length, length: COMPANY_MATCHING_TEST_CASES.alternativeNames.length },
    { key: 'caseSpacing', name: 'Case & Spacing', start: COMPANY_MATCHING_TEST_CASES.misspellings.length + COMPANY_MATCHING_TEST_CASES.abbreviations.length + COMPANY_MATCHING_TEST_CASES.legalSuffixes.length + COMPANY_MATCHING_TEST_CASES.alternativeNames.length, length: COMPANY_MATCHING_TEST_CASES.caseSpacing.length },
    { key: 'punctuation', name: 'Punctuation & Special Chars', start: COMPANY_MATCHING_TEST_CASES.misspellings.length + COMPANY_MATCHING_TEST_CASES.abbreviations.length + COMPANY_MATCHING_TEST_CASES.legalSuffixes.length + COMPANY_MATCHING_TEST_CASES.alternativeNames.length + COMPANY_MATCHING_TEST_CASES.caseSpacing.length, length: COMPANY_MATCHING_TEST_CASES.punctuation.length },
    { key: 'international', name: 'International/Regional', start: COMPANY_MATCHING_TEST_CASES.misspellings.length + COMPANY_MATCHING_TEST_CASES.abbreviations.length + COMPANY_MATCHING_TEST_CASES.legalSuffixes.length + COMPANY_MATCHING_TEST_CASES.alternativeNames.length + COMPANY_MATCHING_TEST_CASES.caseSpacing.length + COMPANY_MATCHING_TEST_CASES.punctuation.length, length: COMPANY_MATCHING_TEST_CASES.international.length },
    { key: 'autocorrect', name: 'Autocorrect Mistakes', start: COMPANY_MATCHING_TEST_CASES.misspellings.length + COMPANY_MATCHING_TEST_CASES.abbreviations.length + COMPANY_MATCHING_TEST_CASES.legalSuffixes.length + COMPANY_MATCHING_TEST_CASES.alternativeNames.length + COMPANY_MATCHING_TEST_CASES.caseSpacing.length + COMPANY_MATCHING_TEST_CASES.punctuation.length + COMPANY_MATCHING_TEST_CASES.international.length, length: COMPANY_MATCHING_TEST_CASES.autocorrect.length }
  ];

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mt-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Results by Category</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categoryMapping.map((category) => {
          const tests = detailedResults.slice(category.start, category.start + category.length);
          const totalTests = tests.length;

          // Calculate accuracy for each model
          const modelAccuracies = MODEL_IDS.map(modelId => {
            const modelIndex = MODEL_IDS.indexOf(modelId);
            const correct = tests.filter(test =>
              test.results[modelIndex]?.isCorrect
            ).length;
            return {
              modelId,
              accuracy: totalTests > 0 ? (correct / totalTests) * 100 : 0
            };
          });

          return (
            <div key={category.key} className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-bold text-lg mb-3">{category.name}</h3>
              <p className="text-sm text-gray-600 mb-3">{totalTests} test cases</p>

              <div className="space-y-2">
                {modelAccuracies.map(({ modelId, accuracy }) => (
                  <div key={modelId} className="flex items-center justify-between">
                    <span className="text-sm">{MODEL_PRICING[modelId].shortName}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            accuracy >= 90 ? 'bg-green-500' :
                            accuracy >= 80 ? 'bg-yellow-500' :
                            accuracy >= 70 ? 'bg-orange-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${accuracy}%` }}
                        />
                      </div>
                      <span className={`text-sm font-semibold ${getAccuracyColor(accuracy)}`}>
                        {accuracy.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Detailed Test Results Table Component
function DetailedResultsTable({ detailedResults, currentPage, setCurrentPage }) {
  const ROWS_PER_PAGE = 20;
  const totalPages = Math.ceil(detailedResults.length / ROWS_PER_PAGE);
  const startIdx = currentPage * ROWS_PER_PAGE;
  const endIdx = startIdx + ROWS_PER_PAGE;
  const pageResults = detailedResults.slice(startIdx, endIdx);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mt-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Detailed Test Results</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-300">
              <th className="text-left p-3 font-bold">Input</th>
              <th className="text-left p-3 font-bold">Expected</th>
              {MODEL_IDS.map(modelId => (
                <th key={modelId} className="text-left p-3 font-bold">
                  {MODEL_PRICING[modelId].shortName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageResults.map((test, idx) => (
              <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="p-3 font-mono text-xs">{test.input}</td>
                <td className="p-3 font-mono text-xs">{test.expected}</td>
                {test.results.map((result, ridx) => (
                  <td key={ridx} className="p-3">
                    <div className={`rounded p-2 ${result.isCorrect ? 'bg-green-100 border border-green-300' : 'bg-red-100 border border-red-300'}`}>
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-lg">{result.isCorrect ? '✓' : '✗'}</span>
                        <span className="font-mono text-xs truncate max-w-[100px]" title={result.actual}>
                          {result.actual}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600">
                        {result.duration}ms
                      </div>
                      <div className="text-xs text-gray-600">
                        ${result.cost}
                      </div>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-6">
          <button
            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
          >
            Previous
          </button>
          <span className="text-gray-700">
            Page {currentPage + 1} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
            disabled={currentPage === totalPages - 1}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

// Model Summary Card Component
function ModelSummaryCard({ modelId, stats, rank }) {
  const [showErrors, setShowErrors] = useState(false);
  const accuracy = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
  const avgTime = stats.times.length > 0 ? stats.times.reduce((a, b) => a + b, 0) / stats.times.length : 0;
  const avgCost = stats.costs.length > 0 ? stats.costs.reduce((a, b) => a + b, 0) / stats.costs.length : 0;
  const totalCost = stats.costs.reduce((a, b) => a + b, 0);
  const minTime = stats.times.length > 0 ? Math.min(...stats.times) : 0;
  const maxTime = stats.times.length > 0 ? Math.max(...stats.times) : 0;
  const minCost = stats.costs.length > 0 ? Math.min(...stats.costs) : 0;
  const maxCost = stats.costs.length > 0 ? Math.max(...stats.costs) : 0;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-800">{MODEL_PRICING[modelId].name}</h3>
        <span className="text-3xl">{getMedalEmoji(rank)}</span>
      </div>

      <div className="space-y-4">
        {/* Accuracy */}
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm font-semibold text-gray-600 mb-1">Accuracy:</p>
          <p className={`text-2xl font-bold ${getAccuracyColor(accuracy)}`}>
            {stats.correct}/{stats.total} ({accuracy.toFixed(1)}%)
          </p>
        </div>

        {/* Response Times */}
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm font-semibold text-gray-600 mb-2">Response Times:</p>
          <div className="space-y-1 text-sm">
            <p className="text-gray-700">Min: {minTime.toFixed(0)} ms</p>
            <p className="text-gray-700">Max: {maxTime.toFixed(0)} ms</p>
            <p className="text-gray-700 font-bold">Avg: {avgTime.toFixed(0)} ms</p>
          </div>
        </div>

        {/* Cost Analysis */}
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm font-semibold text-gray-600 mb-2">Cost Analysis:</p>
          <div className="space-y-1 text-sm font-mono">
            <p className="text-gray-700">Min: ${minCost.toFixed(8)}</p>
            <p className="text-gray-700">Max: ${maxCost.toFixed(8)}</p>
            <p className="text-gray-700 font-bold">Avg: ${avgCost.toFixed(8)}</p>
            <p className="text-green-700 font-bold text-base mt-2">Total: ${totalCost.toFixed(8)}</p>
          </div>
        </div>

        {/* Errors */}
        {stats.errors.length > 0 && (
          <div className="bg-red-50 rounded-lg p-4">
            <button
              onClick={() => setShowErrors(!showErrors)}
              className="text-sm font-semibold text-red-700 hover:text-red-900 flex items-center justify-between w-full"
            >
              <span>Common Errors ({stats.errors.length} failures)</span>
              <span>{showErrors ? '▲' : '▼'}</span>
            </button>

            {showErrors && (
              <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                {stats.errors.slice(0, 10).map((error, idx) => (
                  <div key={idx} className="text-xs bg-white rounded p-2 border border-red-200">
                    <p className="font-mono text-red-800">
                      &ldquo;{error.input}&rdquo; → &ldquo;{error.actual}&rdquo;
                    </p>
                    <p className="text-gray-600">Expected: &ldquo;{error.expected}&rdquo;</p>
                    {error.error && <p className="text-red-600 mt-1">Error: {error.error}</p>}
                  </div>
                ))}
                {stats.errors.length > 10 && (
                  <p className="text-xs text-gray-600 italic">
                    ... and {stats.errors.length - 10} more errors
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Comparison Matrix Component
function ComparisonMatrix({ modelResults }) {
  // Calculate rankings for each metric
  const modelStats = MODEL_IDS.map(modelId => {
    const stats = modelResults[modelId];
    const accuracy = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
    const avgTime = stats.times.length > 0 ? stats.times.reduce((a, b) => a + b, 0) / stats.times.length : 999999;
    const avgCost = stats.costs.length > 0 ? stats.costs.reduce((a, b) => a + b, 0) / stats.costs.length : 999999;
    const totalCost = stats.costs.reduce((a, b) => a + b, 0);
    const minTime = stats.times.length > 0 ? Math.min(...stats.times) : 999999;
    const maxTime = stats.times.length > 0 ? Math.max(...stats.times) : 999999;
    const errorRate = stats.total > 0 ? (stats.incorrect / stats.total) * 100 : 100;

    return {
      modelId,
      accuracy,
      avgTime,
      avgCost,
      totalCost,
      minTime,
      maxTime,
      errorRate
    };
  });

  // Rank each metric
  const rankByMetric = (metric, ascending = false) => {
    const sorted = [...modelStats].sort((a, b) =>
      ascending ? a[metric] - b[metric] : b[metric] - a[metric]
    );
    return sorted.map(s => s.modelId);
  };

  const accuracyRanks = rankByMetric('accuracy');
  const avgTimeRanks = rankByMetric('avgTime', true);
  const avgCostRanks = rankByMetric('avgCost', true);
  const totalCostRanks = rankByMetric('totalCost', true);
  const minTimeRanks = rankByMetric('minTime', true);
  const maxTimeRanks = rankByMetric('maxTime', true);
  const errorRateRanks = rankByMetric('errorRate', true);

  // Calculate overall winner (accuracy 50%, speed 30%, cost 20%)
  const overallScores = modelStats.map(stats => {
    const accuracyScore = (stats.accuracy / 100) * 0.5;
    const speedScore = (1 - (stats.avgTime / Math.max(...modelStats.map(s => s.avgTime)))) * 0.3;
    const costScore = (1 - (stats.avgCost / Math.max(...modelStats.map(s => s.avgCost)))) * 0.2;
    return {
      modelId: stats.modelId,
      score: accuracyScore + speedScore + costScore
    };
  });
  const overallRanks = overallScores.sort((a, b) => b.score - a.score).map(s => s.modelId);

  const getRankForModel = (modelId, ranks) => ranks.indexOf(modelId) + 1;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mt-8 overflow-x-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Model Comparison Matrix</h2>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-gray-300">
            <th className="text-left p-3 font-bold">Metric</th>
            {MODEL_IDS.map(modelId => (
              <th key={modelId} className="text-center p-3 font-bold">
                {MODEL_PRICING[modelId].shortName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-gray-200">
            <td className="p-3 font-semibold">Accuracy</td>
            {MODEL_IDS.map(modelId => {
              const stats = modelResults[modelId];
              const accuracy = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
              const rank = getRankForModel(modelId, accuracyRanks);
              return (
                <td key={modelId} className="p-3 text-center">
                  <span className={getAccuracyColor(accuracy)}>
                    {accuracy.toFixed(1)}% {getMedalEmoji(rank)}
                  </span>
                </td>
              );
            })}
          </tr>

          <tr className="border-b border-gray-200 bg-gray-50">
            <td className="p-3 font-semibold">Avg Time</td>
            {MODEL_IDS.map(modelId => {
              const stats = modelResults[modelId];
              const avgTime = stats.times.length > 0 ? stats.times.reduce((a, b) => a + b, 0) / stats.times.length : 0;
              const rank = getRankForModel(modelId, avgTimeRanks);
              return (
                <td key={modelId} className="p-3 text-center">
                  {avgTime.toFixed(0)}ms {getMedalEmoji(rank)}
                </td>
              );
            })}
          </tr>

          <tr className="border-b border-gray-200">
            <td className="p-3 font-semibold">Avg Cost</td>
            {MODEL_IDS.map(modelId => {
              const stats = modelResults[modelId];
              const avgCost = stats.costs.length > 0 ? stats.costs.reduce((a, b) => a + b, 0) / stats.costs.length : 0;
              const rank = getRankForModel(modelId, avgCostRanks);
              return (
                <td key={modelId} className="p-3 text-center font-mono text-xs">
                  ${avgCost.toFixed(8)} {getMedalEmoji(rank)}
                </td>
              );
            })}
          </tr>

          <tr className="border-b border-gray-200 bg-gray-50">
            <td className="p-3 font-semibold">Total Cost</td>
            {MODEL_IDS.map(modelId => {
              const stats = modelResults[modelId];
              const totalCost = stats.costs.reduce((a, b) => a + b, 0);
              const rank = getRankForModel(modelId, totalCostRanks);
              return (
                <td key={modelId} className="p-3 text-center font-mono text-xs">
                  ${totalCost.toFixed(8)} {getMedalEmoji(rank)}
                </td>
              );
            })}
          </tr>

          <tr className="border-b border-gray-200">
            <td className="p-3 font-semibold">Fastest Time</td>
            {MODEL_IDS.map(modelId => {
              const stats = modelResults[modelId];
              const minTime = stats.times.length > 0 ? Math.min(...stats.times) : 0;
              const rank = getRankForModel(modelId, minTimeRanks);
              return (
                <td key={modelId} className="p-3 text-center">
                  {minTime.toFixed(0)}ms {getMedalEmoji(rank)}
                </td>
              );
            })}
          </tr>

          <tr className="border-b border-gray-200 bg-gray-50">
            <td className="p-3 font-semibold">Slowest Time</td>
            {MODEL_IDS.map(modelId => {
              const stats = modelResults[modelId];
              const maxTime = stats.times.length > 0 ? Math.max(...stats.times) : 0;
              const rank = getRankForModel(modelId, maxTimeRanks);
              return (
                <td key={modelId} className="p-3 text-center">
                  {maxTime.toFixed(0)}ms {getMedalEmoji(rank)}
                </td>
              );
            })}
          </tr>

          <tr className="border-b border-gray-200">
            <td className="p-3 font-semibold">Error Rate</td>
            {MODEL_IDS.map(modelId => {
              const stats = modelResults[modelId];
              const errorRate = stats.total > 0 ? (stats.incorrect / stats.total) * 100 : 0;
              const rank = getRankForModel(modelId, errorRateRanks);
              return (
                <td key={modelId} className="p-3 text-center">
                  {errorRate.toFixed(1)}% {getMedalEmoji(rank)}
                </td>
              );
            })}
          </tr>

          <tr className="border-t-2 border-gray-300 bg-blue-50">
            <td className="p-3 font-bold text-lg">Overall Winner</td>
            {MODEL_IDS.map(modelId => {
              const rank = getRankForModel(modelId, overallRanks);
              return (
                <td key={modelId} className="p-3 text-center">
                  <span className="text-2xl font-bold">
                    {getMedalEmoji(rank)}
                  </span>
                  <p className="text-xs text-gray-600 mt-1">
                    {rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : '4th'}
                  </p>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// Result Card Component (for manual testing)
function ResultCard({ result, onTogglePrompt, onToggleResponse, showPrompt, showResponse }) {
  if (!result) return null;

  if (!result.success) {
    return (
      <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-red-700">{result.modelName}</h3>
          <span className="text-2xl">❌</span>
        </div>
        <div className="space-y-2">
          <p className="text-red-600">
            <span className="font-semibold">Error:</span> {result.error}
          </p>
          <p className="text-sm text-gray-600">
            <span className="font-semibold">Time:</span> {result.duration} ms
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-green-50 border-2 border-green-300 rounded-lg p-6 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-green-700">{result.modelName}</h3>
        <span className="text-2xl">✅</span>
      </div>

      <div className="space-y-4">
        {/* Match Result */}
        <div className="bg-white rounded-lg p-4">
          <p className="text-sm text-gray-600 font-semibold mb-1">Match Result:</p>
          <p className="text-lg font-mono text-gray-900">{result.match}</p>
        </div>

        {/* Response Time */}
        <div className="bg-white rounded-lg p-4">
          <p className="text-sm text-gray-600 font-semibold mb-1">Response Time:</p>
          <p className="text-lg text-gray-900">{result.duration} ms</p>
        </div>

        {/* Token Usage */}
        <div className="bg-white rounded-lg p-4">
          <p className="text-sm text-gray-600 font-semibold mb-2">Token Usage:</p>
          <div className="space-y-1 font-mono text-sm">
            <p className="text-gray-700">📥 Input:  {result.inputTokens.toLocaleString()} tokens</p>
            <p className="text-gray-700">📤 Output: {result.outputTokens.toLocaleString()} tokens</p>
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="bg-white rounded-lg p-4">
          <p className="text-sm text-gray-600 font-semibold mb-2">Cost Breakdown:</p>
          <div className="space-y-1 font-mono text-sm">
            <p className="text-gray-700">
              📥 Input:  ${result.inputCost} ({result.inputTokens} × ${MODEL_PRICING[result.modelId].input}/M)
            </p>
            <p className="text-gray-700">
              📤 Output: ${result.outputCost} ({result.outputTokens} × ${MODEL_PRICING[result.modelId].output}/M)
            </p>
            <p className="text-green-700 font-bold text-base mt-2">
              💰 Total:  ${result.totalCost}
            </p>
          </div>
        </div>

        {/* Expandable Prompt/Response */}
        <div className="flex gap-2">
          <button
            onClick={onTogglePrompt}
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors"
          >
            {showPrompt ? '▲ Hide Prompt' : '▼ Show Prompt'}
          </button>
          <button
            onClick={onToggleResponse}
            className="flex-1 bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded transition-colors"
          >
            {showResponse ? '▲ Hide Response' : '▼ Show Response'}
          </button>
        </div>

        {/* Expandable Content */}
        {showPrompt && (
          <div className="bg-gray-900 text-green-400 rounded-lg p-4 transition-all duration-300">
            <p className="text-sm font-semibold mb-2 text-gray-300">Prompt Sent to Model:</p>
            <pre className="text-xs whitespace-pre-wrap font-mono">{result.sentPrompt}</pre>
          </div>
        )}

        {showResponse && (
          <div className="bg-gray-900 text-blue-400 rounded-lg p-4 transition-all duration-300">
            <p className="text-sm font-semibold mb-2 text-gray-300">Response Received from Model:</p>
            <pre className="text-xs whitespace-pre-wrap font-mono">{result.receivedResponse}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

// Summary Component (for manual testing)
function SummaryComparison({ results }) {
  if (!results || results.length === 0) return null;

  const successfulResults = results.filter(r => r.success);

  if (successfulResults.length === 0) {
    return (
      <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6 mt-8">
        <h2 className="text-2xl font-bold text-yellow-700 mb-4">Summary Comparison</h2>
        <p className="text-yellow-600">No successful results to compare.</p>
      </div>
    );
  }

  // Find fastest
  const fastest = successfulResults.reduce((min, r) =>
    parseFloat(r.duration) < parseFloat(min.duration) ? r : min
  );

  // Find cheapest
  const cheapest = successfulResults.reduce((min, r) =>
    parseFloat(r.totalCost) < parseFloat(min.totalCost) ? r : min
  );

  // Calculate total cost
  const totalCost = successfulResults.reduce((sum, r) =>
    sum + parseFloat(r.totalCost), 0
  );

  return (
    <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-6 mt-8">
      <h2 className="text-2xl font-bold text-blue-700 mb-6">📊 Summary Comparison</h2>
      <div className="space-y-3 text-lg">
        <div className="bg-white rounded-lg p-4">
          <span className="font-semibold text-gray-700">⚡ Fastest Model:</span>
          <span className="ml-2 text-blue-600 font-bold">
            {fastest.modelName} ({fastest.duration} ms)
          </span>
        </div>

        <div className="bg-white rounded-lg p-4">
          <span className="font-semibold text-gray-700">💵 Cheapest Model:</span>
          <span className="ml-2 text-green-600 font-bold">
            {cheapest.modelName} (${cheapest.totalCost})
          </span>
        </div>

        <div className="bg-white rounded-lg p-4">
          <span className="font-semibold text-gray-700">💰 Total Cost:</span>
          <span className="ml-2 text-purple-600 font-bold">
            ${totalCost.toFixed(8)}
          </span>
        </div>
      </div>
    </div>
  );
}

// Main Component
export default function CompanyMatcherTest() {
  // Manual testing state
  const [inputName, setInputName] = useState('kfc');
  const [companyList, setCompanyList] = useState(
    'Tesla\nMicrosoft\nKentucky Fried Chicken\nApple\nAmazon\nAT&T\nGoogle\nMeta\nNetflix'
  );
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedPrompts, setExpandedPrompts] = useState({});
  const [expandedResponses, setExpandedResponses] = useState({});

  // Comprehensive testing state
  const [comprehensiveLoading, setComprehensiveLoading] = useState(false);
  const [testProgress, setTestProgress] = useState({ current: 0, total: 0, currentTest: '' });
  const [modelResults, setModelResults] = useState(null);
  const [detailedResults, setDetailedResults] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [testError, setTestError] = useState(null);

  // Run comprehensive tests
  const runComprehensiveTests = async () => {
    setComprehensiveLoading(true);
    setTestError(null);
    setTestProgress({ current: 0, total: 0, currentTest: '' });

    // Flatten ALL test categories into one array
    const allTestCases = [
      ...COMPANY_MATCHING_TEST_CASES.misspellings,
      ...COMPANY_MATCHING_TEST_CASES.abbreviations,
      ...COMPANY_MATCHING_TEST_CASES.legalSuffixes,
      ...COMPANY_MATCHING_TEST_CASES.alternativeNames,
      ...COMPANY_MATCHING_TEST_CASES.caseSpacing,
      ...COMPANY_MATCHING_TEST_CASES.punctuation,
      ...COMPANY_MATCHING_TEST_CASES.international,
      ...COMPANY_MATCHING_TEST_CASES.autocorrect
    ];

    console.log(`🧪 Running ${allTestCases.length} total test cases across ${MODEL_IDS.length} models`);

    const modelStats = {};
    MODEL_IDS.forEach(modelId => {
      modelStats[modelId] = {
        correct: 0,
        incorrect: 0,
        total: 0,
        times: [],
        costs: [],
        errors: []
      };
    });

    const detailed = [];

    setTestProgress({ current: 0, total: allTestCases.length, currentTest: '' });

    try {
      for (let i = 0; i < allTestCases.length; i++) {
        const testCase = allTestCases[i];

        setTestProgress({
          current: i + 1,
          total: allTestCases.length,
          currentTest: testCase.input
        });

        // Test all models for this input
        const modelPromises = MODEL_IDS.map(modelId =>
          testModel(modelId, testCase.input, CANONICAL_COMPANIES)
        );

        const testResults = await Promise.all(modelPromises);

        // Process results for each model
        const testResultsForTable = [];
        testResults.forEach((result, index) => {
          const modelId = MODEL_IDS[index];
          const stats = modelStats[modelId];

          stats.total++;

          if (result.success) {
            const actualMatch = result.match.trim();
            const expectedMatch = testCase.expected.trim();
            const isCorrect = actualMatch.toLowerCase() === expectedMatch.toLowerCase();

            if (isCorrect) {
              stats.correct++;
            } else {
              stats.incorrect++;
              stats.errors.push({
                input: testCase.input,
                expected: expectedMatch,
                actual: actualMatch
              });
            }

            stats.times.push(parseFloat(result.duration));
            stats.costs.push(parseFloat(result.totalCost));

            testResultsForTable.push({
              modelId,
              actual: actualMatch,
              isCorrect,
              duration: result.duration,
              cost: result.totalCost,
              error: null
            });
          } else {
            stats.incorrect++;
            stats.errors.push({
              input: testCase.input,
              expected: testCase.expected,
              actual: 'ERROR',
              error: result.error
            });

            testResultsForTable.push({
              modelId,
              actual: 'ERROR',
              isCorrect: false,
              duration: result.duration,
              cost: '0',
              error: result.error
            });
          }
        });

        detailed.push({
          input: testCase.input,
          expected: testCase.expected,
          results: testResultsForTable
        });

        // Small delay to prevent overwhelming the API
        if (i < allTestCases.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      setModelResults(modelStats);
      setDetailedResults(detailed);
      setComprehensiveLoading(false);

    } catch (error) {
      console.error('Comprehensive testing failed:', error);
      setTestError(`Testing failed: ${error.message}`);
      setComprehensiveLoading(false);

      // Still show partial results if available
      if (detailed.length > 0) {
        setModelResults(modelStats);
        setDetailedResults(detailed);
      }
    }
  };

  // Export as CSV
  const exportAsCSV = () => {
    if (!detailedResults || detailedResults.length === 0) return;

    const headers = [
      'Input',
      'Expected',
      ...MODEL_IDS.flatMap(modelId => [
        `${MODEL_PRICING[modelId].shortName} Result`,
        `${MODEL_PRICING[modelId].shortName} Correct`,
        `${MODEL_PRICING[modelId].shortName} Time (ms)`,
        `${MODEL_PRICING[modelId].shortName} Cost ($)`
      ])
    ];

    const rows = detailedResults.map(test => [
      test.input,
      test.expected,
      ...test.results.flatMap(r => [
        r.actual,
        r.isCorrect ? 'TRUE' : 'FALSE',
        r.duration,
        r.cost
      ])
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `model-comparison-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export as JSON
  const exportAsJSON = () => {
    if (!modelResults || !detailedResults) return;

    const exportData = {
      timestamp: new Date().toISOString(),
      summary: modelResults,
      detailedResults: detailedResults
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `model-comparison-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Manual testing handlers
  const handleTestAll = async () => {
    setLoading(true);
    setResults([]);
    setExpandedPrompts({});
    setExpandedResponses({});

    const companies = companyList.split('\n').filter(c => c.trim());

    // Test all models in parallel
    const testPromises = MODEL_IDS.map(modelId =>
      testModel(modelId, inputName, companies)
    );

    const testResults = await Promise.all(testPromises);
    setResults(testResults);
    setLoading(false);
  };

  const handleClear = () => {
    setResults([]);
    setExpandedPrompts({});
    setExpandedResponses({});
  };

  const handleExport = () => {
    const exportData = {
      testConfig: {
        inputName,
        companies: companyList.split('\n').filter(c => c.trim()),
        timestamp: new Date().toISOString()
      },
      results
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `company-matcher-test-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const togglePrompt = (modelId) => {
    setExpandedPrompts(prev => ({
      ...prev,
      [modelId]: !prev[modelId]
    }));
  };

  const toggleResponse = (modelId) => {
    setExpandedResponses(prev => ({
      ...prev,
      [modelId]: !prev[modelId]
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2 text-center">
            Company Matcher Model Comparison
          </h1>
          <p className="text-gray-600 text-center">
            Test and compare 4 different Gemini models for company name matching
          </p>
        </div>

        {/* Comprehensive Testing Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Comprehensive Model Testing</h2>
          <p className="text-gray-600 mb-4">
            Run {TOTAL_TEST_COUNT} test cases across all 4 models (8 categories)
          </p>

          <div className="flex gap-4 mb-4">
            <button
              onClick={runComprehensiveTests}
              disabled={comprehensiveLoading}
              className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              {comprehensiveLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Running Tests...
                </span>
              ) : (
                `Run Comprehensive Tests (${TOTAL_TEST_COUNT} test cases)`
              )}
            </button>

            {modelResults && (
              <>
                <button
                  onClick={exportAsCSV}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  Export CSV
                </button>
                <button
                  onClick={exportAsJSON}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  Export JSON
                </button>
              </>
            )}
          </div>

          {/* Progress Bar */}
          {comprehensiveLoading && (
            <div className="mb-4">
              <p className="text-sm text-gray-700 mb-2">
                Testing {testProgress.current}/{testProgress.total} cases...
                {testProgress.currentTest && ` (Current: "${testProgress.currentTest}")`}
              </p>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-purple-600 h-4 rounded-full transition-all duration-300"
                  style={{ width: `${(testProgress.current / testProgress.total) * 100}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {testError && (
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-4">
              <p className="text-red-700 font-semibold">Error:</p>
              <p className="text-red-600">{testError}</p>
            </div>
          )}
        </div>

        {/* Comprehensive Test Results */}
        {modelResults && detailedResults.length > 0 && (
          <>
            {/* Model Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {MODEL_IDS.map((modelId, index) => (
                <ModelSummaryCard
                  key={modelId}
                  modelId={modelId}
                  stats={modelResults[modelId]}
                  rank={index + 1}
                />
              ))}
            </div>

            {/* Category Breakdown */}
            <CategoryBreakdown detailedResults={detailedResults} />

            {/* Comparison Matrix */}
            <ComparisonMatrix modelResults={modelResults} />

            {/* Detailed Results Table */}
            <DetailedResultsTable
              detailedResults={detailedResults}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
            />
          </>
        )}

        {/* Manual Testing Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8 mt-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Manual Testing</h2>
          <p className="text-gray-600 mb-4">Test a single custom input</p>

          <div className="space-y-4">
            {/* Input Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Input Company Name:
              </label>
              <input
                type="text"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                placeholder="e.g., kfc, at&t, microsft"
              />
            </div>

            {/* Company List */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Known Companies (one per line):
              </label>
              <textarea
                value={companyList}
                onChange={(e) => setCompanyList(e.target.value)}
                className="w-full h-48 px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none font-mono text-sm"
                placeholder="Tesla&#10;Microsoft&#10;Apple"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-4">
              <button
                onClick={handleTestAll}
                disabled={loading || !inputName.trim() || !companyList.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Testing All Models...
                  </span>
                ) : (
                  'Test All Models'
                )}
              </button>
              <button
                onClick={handleClear}
                disabled={loading || results.length === 0}
                className="bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                Clear Results
              </button>
              {results.length > 0 && (
                <button
                  onClick={handleExport}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  Export JSON
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Manual Test Results Section */}
        {results.length > 0 && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
                📊 Manual Test Results
              </h2>

              {results.map((result) => (
                <ResultCard
                  key={result.modelId}
                  result={result}
                  onTogglePrompt={() => togglePrompt(result.modelId)}
                  onToggleResponse={() => toggleResponse(result.modelId)}
                  showPrompt={expandedPrompts[result.modelId]}
                  showResponse={expandedResponses[result.modelId]}
                />
              ))}
            </div>

            {/* Summary */}
            <SummaryComparison results={results} />
          </div>
        )}
      </div>
    </div>
  );
}
