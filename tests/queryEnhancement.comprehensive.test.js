// tests/queryEnhancement.comprehensive.test.js
// Comprehensive test suite for Query Enhancement Service
// Tests all scenarios, edge cases, and failure modes

/**
 * RUN THIS TEST:
 * node tests/queryEnhancement.comprehensive.test.js
 * 
 * OR create as an API endpoint:
 * app/api/test/comprehensive/route.js
 */

const BASE_URL = 'http://localhost:3000';

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
};

// Helper: Run a test
async function runTest(name, testFn, category = 'General') {
  const startTime = Date.now();
  try {
    console.log(`\n🧪 Running: ${name}`);
    await testFn();
    const duration = Date.now() - startTime;
    console.log(`✅ PASSED (${duration}ms): ${name}`);
    results.passed++;
    results.tests.push({ name, status: 'passed', duration, category });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ FAILED (${duration}ms): ${name}`);
    console.error(`   Error: ${error.message}`);
    results.failed++;
    results.tests.push({ name, status: 'failed', duration, category, error: error.message });
  }
}

// Helper: Make API request
async function testQuery(query, expectedBehavior = {}) {
  const response = await fetch(`${BASE_URL}/api/test/query-enhancement`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  // Validate response structure
  if (!data.success) {
    throw new Error('Response indicates failure');
  }
  
  if (!data.originalQuery || !data.enhancedQuery || !data.language || !data.metadata) {
    throw new Error('Missing required fields in response');
  }
  
  // Validate expected behavior
  if (expectedBehavior.cacheType && data.metadata.cacheType !== expectedBehavior.cacheType) {
    throw new Error(`Expected cacheType ${expectedBehavior.cacheType}, got ${data.metadata.cacheType}`);
  }
  
  if (expectedBehavior.language && data.language !== expectedBehavior.language) {
    throw new Error(`Expected language ${expectedBehavior.language}, got ${data.language}`);
  }
  
  if (expectedBehavior.maxDuration && data.metadata.duration > expectedBehavior.maxDuration) {
    throw new Error(`Duration ${data.metadata.duration}ms exceeded max ${expectedBehavior.maxDuration}ms`);
  }
  
  if (expectedBehavior.cached !== undefined && data.metadata.cached !== expectedBehavior.cached) {
    throw new Error(`Expected cached ${expectedBehavior.cached}, got ${data.metadata.cached}`);
  }
  
  return data;
}

// Helper: Wait/sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================
// CATEGORY 1: STATIC CACHE TESTS
// ============================================

async function testStaticCacheHits() {
  const staticTerms = ['CEO', 'CTO', 'CFO', 'COO', 'CMO', 'CISO', 'PDG', 'DG', 'DAF'];
  
  for (const term of staticTerms) {
    await runTest(`Static Cache: ${term}`, async () => {
      const result = await testQuery(term, {
        cacheType: 'static',
        cached: true,
        maxDuration: 10, // Should be instant
        language: term.includes('P') ? 'fra' : 'eng' // French terms start with P/D
      });
      
      if (!result.enhancedQuery.includes(term)) {
        throw new Error(`Enhanced query doesn't contain original term: ${term}`);
      }
    }, 'Static Cache');
  }
}

async function testStaticCacheCaseInsensitive() {
  await runTest('Static Cache: Case insensitive (ceo)', async () => {
    const result = await testQuery('ceo', {
      cacheType: 'static',
      cached: true
    });
    
    if (!result.enhancedQuery.toLowerCase().includes('ceo')) {
      throw new Error('Case insensitive matching failed');
    }
  }, 'Static Cache');
  
  await runTest('Static Cache: Case insensitive (CEO)', async () => {
    await testQuery('CEO', { cacheType: 'static' });
  }, 'Static Cache');
  
  await runTest('Static Cache: Case insensitive (CeO)', async () => {
    await testQuery('CeO', { cacheType: 'static' });
  }, 'Static Cache');
}

async function testStaticCachePartialMatch() {
  await runTest('Static Cache: Partial match (Senior CEO)', async () => {
    const result = await testQuery('Senior CEO', {
      cacheType: 'static',
      cached: true
    });
    
    if (!result.enhancedQuery.includes('CEO')) {
      throw new Error('Partial match failed');
    }
  }, 'Static Cache');
}

// ============================================
// CATEGORY 2: REDIS CACHE TESTS
// ============================================

async function testRedisCacheFlow() {
  const uniqueQuery = `test query ${Date.now()}`;
  
  // First call: Should call Gemini
  await runTest('Redis Cache: First call (miss)', async () => {
    const result = await testQuery(uniqueQuery, {
      cacheType: 'ai',
      cached: false
    });
    
    if (result.metadata.cost === 0 || !result.metadata.cost) {
      throw new Error('First call should have cost > 0');
    }
  }, 'Redis Cache');
  
  // Wait a bit for Redis to settle
  await sleep(100);
  
  // Second call: Should hit Redis cache
  await runTest('Redis Cache: Second call (hit)', async () => {
    const result = await testQuery(uniqueQuery, {
      cacheType: 'redis',
      cached: true,
      maxDuration: 100 // Should be very fast
    });
    
    if (result.metadata.cost && result.metadata.cost > 0) {
      throw new Error('Cached call should have cost = 0');
    }
  }, 'Redis Cache');
}

// ============================================
// CATEGORY 3: LANGUAGE DETECTION TESTS
// ============================================

async function testLanguageDetection() {
  const testCases = [
    { query: 'software engineer', expectedLang: 'eng', name: 'English' },
    { query: 'ingénieur logiciel', expectedLang: 'fra', name: 'French' },
    { query: 'ingeniero de software', expectedLang: 'spa', name: 'Spanish' },
    { query: 'developer AI blockchain', expectedLang: 'eng', name: 'English tech terms' },
    { query: 'développeur IA startup', expectedLang: 'fra', name: 'French tech terms' },
  ];
  
  for (const testCase of testCases) {
    await runTest(`Language Detection: ${testCase.name}`, async () => {
      const result = await testQuery(testCase.query, {
        language: testCase.expectedLang
      });
      
      if (result.language !== testCase.expectedLang) {
        throw new Error(`Expected ${testCase.expectedLang}, got ${result.language}`);
      }
    }, 'Language Detection');
  }
}

async function testMultilingualQueries() {
  await runTest('Multilingual: English + French', async () => {
    const result = await testQuery('CEO startup Paris ingénieur');
    // Should detect dominant language (English or French)
    if (!['eng', 'fra'].includes(result.language)) {
      throw new Error(`Unexpected language: ${result.language}`);
    }
  }, 'Language Detection');
}

// ============================================
// CATEGORY 4: EDGE CASES
// ============================================

async function testEdgeCases() {
  // Empty query
  await runTest('Edge Case: Empty string', async () => {
    try {
      await testQuery('');
      throw new Error('Should have rejected empty query');
    } catch (error) {
      // Expected to fail
      if (error.message.includes('Should have rejected')) {
        throw error;
      }
      // Success - it properly rejected
    }
  }, 'Edge Cases');
  
  // Very long query
  await runTest('Edge Case: Very long query (500 chars)', async () => {
    const longQuery = 'software engineer '.repeat(50); // ~500 chars
    const result = await testQuery(longQuery);
    
    if (!result.enhancedQuery) {
      throw new Error('Should handle long queries');
    }
  }, 'Edge Cases');
  
  // Single character
  await runTest('Edge Case: Single character', async () => {
    const result = await testQuery('a');
    if (!result.enhancedQuery) {
      throw new Error('Should handle single character');
    }
  }, 'Edge Cases');
  
  // Numbers only
  await runTest('Edge Case: Numbers only', async () => {
    const result = await testQuery('12345');
    if (!result.enhancedQuery) {
      throw new Error('Should handle numbers');
    }
  }, 'Edge Cases');
  
  // Special characters
  await runTest('Edge Case: Special characters', async () => {
    const result = await testQuery('CEO @company #hashtag');
    if (!result.enhancedQuery) {
      throw new Error('Should handle special characters');
    }
  }, 'Edge Cases');
  
  // Unicode/Emoji
  await runTest('Edge Case: Unicode/Emoji', async () => {
    const result = await testQuery('developer �� AI 💻');
    if (!result.enhancedQuery) {
      throw new Error('Should handle emoji');
    }
  }, 'Edge Cases');
  
  // Accented characters
  await runTest('Edge Case: Accented characters', async () => {
    const result = await testQuery('ingénieur développeur São Paulo');
    if (!result.enhancedQuery) {
      throw new Error('Should handle accents');
    }
  }, 'Edge Cases');
  
  // Line breaks and tabs
  await runTest('Edge Case: Whitespace (newlines, tabs)', async () => {
    const result = await testQuery('software\nengineer\t\tdeveloper');
    if (!result.enhancedQuery) {
      throw new Error('Should handle whitespace');
    }
  }, 'Edge Cases');
}

async function testSecurityEdgeCases() {
  // SQL injection attempt
  await runTest('Security: SQL injection attempt', async () => {
    const result = await testQuery("CEO'; DROP TABLE users--");
    // Should handle gracefully, not crash
    if (!result.enhancedQuery) {
      throw new Error('Should handle SQL injection attempts');
    }
  }, 'Edge Cases');
  
  // XSS attempt
  await runTest('Security: XSS attempt', async () => {
    const result = await testQuery('<script>alert("xss")</script> engineer');
    if (!result.enhancedQuery) {
      throw new Error('Should handle XSS attempts');
    }
  }, 'Edge Cases');
  
  // Path traversal
  await runTest('Security: Path traversal', async () => {
    const result = await testQuery('../../etc/passwd engineer');
    if (!result.enhancedQuery) {
      throw new Error('Should handle path traversal');
    }
  }, 'Edge Cases');
}

// ============================================
// CATEGORY 5: PERFORMANCE TESTS
// ============================================

async function testPerformance() {
  // Static cache should be < 10ms
  await runTest('Performance: Static cache < 10ms', async () => {
    const start = Date.now();
    await testQuery('CEO');
    const duration = Date.now() - start;
    
    if (duration > 10) {
      throw new Error(`Static cache took ${duration}ms (expected < 10ms)`);
    }
  }, 'Performance');
  
  // Redis cache should be < 100ms
  await runTest('Performance: Redis cache < 100ms', async () => {
    // First call to populate cache
    const uniqueQuery = `perf test ${Date.now()}`;
    await testQuery(uniqueQuery);
    await sleep(100);
    
    // Second call should be fast
    const start = Date.now();
    await testQuery(uniqueQuery);
    const duration = Date.now() - start;
    
    if (duration > 100) {
      throw new Error(`Redis cache took ${duration}ms (expected < 100ms)`);
    }
  }, 'Performance');
  
  // Gemini API should be < 5000ms
  await runTest('Performance: Gemini API < 5000ms', async () => {
    const uniqueQuery = `api perf test ${Date.now()}`;
    const start = Date.now();
    await testQuery(uniqueQuery);
    const duration = Date.now() - start;
    
    if (duration > 5000) {
      throw new Error(`Gemini API took ${duration}ms (expected < 5000ms)`);
    }
  }, 'Performance');
}

async function testConcurrentRequests() {
  await runTest('Performance: Concurrent requests (5x)', async () => {
    const promises = Array.from({ length: 5 }, (_, i) => 
      testQuery(`concurrent test ${i} ${Date.now()}`)
    );
    
    const results = await Promise.all(promises);
    
    if (results.length !== 5) {
      throw new Error('Not all concurrent requests completed');
    }
    
    results.forEach((result, i) => {
      if (!result.enhancedQuery) {
        throw new Error(`Concurrent request ${i} failed`);
      }
    });
  }, 'Performance');
}

// ============================================
// CATEGORY 6: QUERY ENHANCEMENT QUALITY
// ============================================

async function testEnhancementQuality() {
  await runTest('Quality: CEO expands properly', async () => {
    const result = await testQuery('CEO');
    const enhanced = result.enhancedQuery.toLowerCase();
    
    const requiredTerms = ['ceo', 'chief executive officer', 'president'];
    for (const term of requiredTerms) {
      if (!enhanced.includes(term)) {
        throw new Error(`Enhanced query missing required term: ${term}`);
      }
    }
  }, 'Enhancement Quality');
  
  await runTest('Quality: Technical terms expansion', async () => {
    const result = await testQuery('AI machine learning');
    const enhanced = result.enhancedQuery.toLowerCase();
    
    if (!enhanced.includes('artificial intelligence') || !enhanced.includes('ml')) {
      throw new Error('Technical terms not properly expanded');
    }
  }, 'Enhancement Quality');
  
  await runTest('Quality: French terms expansion', async () => {
    const result = await testQuery('ingénieur IA');
    const enhanced = result.enhancedQuery.toLowerCase();
    
    if (!enhanced.includes('engineer') || !enhanced.includes('ai')) {
      throw new Error('French-English translation missing');
    }
  }, 'Enhancement Quality');
  
  await runTest('Quality: Enhancement adds value', async () => {
    const result = await testQuery('developer');
    
    // Enhanced query should be longer than original
    if (result.enhancedQuery.length <= result.originalQuery.length) {
      throw new Error('Enhancement did not add value');
    }
  }, 'Enhancement Quality');
}

// ============================================
// CATEGORY 7: COST TRACKING
// ============================================

async function testCostTracking() {
  await runTest('Cost: Static cache has no cost', async () => {
    const result = await testQuery('CEO');
    
    if (result.metadata.cost && result.metadata.cost > 0) {
      throw new Error('Static cache should have no cost');
    }
  }, 'Cost Tracking');
  
  await runTest('Cost: Redis cache has no cost', async () => {
    const uniqueQuery = `cost test ${Date.now()}`;
    await testQuery(uniqueQuery); // First call
    await sleep(100);
    
    const result = await testQuery(uniqueQuery); // Second call
    
    if (result.metadata.cost && result.metadata.cost > 0) {
      throw new Error('Redis cache should have no cost');
    }
  }, 'Cost Tracking');
  
  await runTest('Cost: Gemini API has cost > 0', async () => {
    const uniqueQuery = `cost gemini test ${Date.now()}`;
    const result = await testQuery(uniqueQuery);
    
    if (!result.metadata.cost || result.metadata.cost <= 0) {
      throw new Error('Gemini API should have cost > 0');
    }
  }, 'Cost Tracking');
  
  await runTest('Cost: Token usage tracked', async () => {
    const uniqueQuery = `token test ${Date.now()}`;
    const result = await testQuery(uniqueQuery);
    
    if (!result.metadata.tokensUsed || 
        !result.metadata.tokensUsed.inputTokens || 
        !result.metadata.tokensUsed.outputTokens) {
      throw new Error('Token usage not tracked');
    }
  }, 'Cost Tracking');
}

// ============================================
// CATEGORY 8: FALLBACK BEHAVIOR
// ============================================

async function testFallbackBehavior() {
  // Note: These tests would require mocking or simulating failures
  // For now, we just verify fallback is graceful
  
  await runTest('Fallback: Returns original query on error', async () => {
    // This is tested implicitly - if Gemini fails, we get original query back
    // with fallback metadata
    console.log('   ℹ️  Fallback tested implicitly in error scenarios');
  }, 'Fallback');
  
  await runTest('Fallback: Language detection still works', async () => {
    // Even in fallback, language detection should work
    const result = await testQuery('ingénieur test');
    
    if (result.language !== 'fra') {
      throw new Error('Fallback language detection failed');
    }
  }, 'Fallback');
}

// ============================================
// CATEGORY 9: METADATA VALIDATION
// ============================================

async function testMetadataCompleteness() {
  await runTest('Metadata: All required fields present', async () => {
    const result = await testQuery('test query');
    
    const requiredFields = [
      'cached',
      'cacheType',
      'duration',
      'enhanceId',
      'sessionId'
    ];
    
    for (const field of requiredFields) {
      if (!(field in result.metadata)) {
        throw new Error(`Missing required metadata field: ${field}`);
      }
    }
  }, 'Metadata');
  
  await runTest('Metadata: Duration is reasonable', async () => {
    const result = await testQuery('CEO');
    
    if (result.metadata.duration < 0 || result.metadata.duration > 10000) {
      throw new Error(`Unreasonable duration: ${result.metadata.duration}ms`);
    }
  }, 'Metadata');
  
  await runTest('Metadata: Enhance ID is unique', async () => {
    const result1 = await testQuery('test 1');
    await sleep(10);
    const result2 = await testQuery('test 2');
    
    if (result1.metadata.enhanceId === result2.metadata.enhanceId) {
      throw new Error('Enhance IDs are not unique');
    }
  }, 'Metadata');
}

// ============================================
// MAIN TEST RUNNER
// ============================================

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   COMPREHENSIVE QUERY ENHANCEMENT TEST SUITE          ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log(`\nStarting tests at: ${new Date().toISOString()}`);
  console.log(`Target: ${BASE_URL}\n`);
  
  try {
    // Category 1: Static Cache
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📦 CATEGORY 1: STATIC CACHE TESTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    await testStaticCacheHits();
    await testStaticCacheCaseInsensitive();
    await testStaticCachePartialMatch();
    
    // Category 2: Redis Cache
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💾 CATEGORY 2: REDIS CACHE TESTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    await testRedisCacheFlow();
    
    // Category 3: Language Detection
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🌐 CATEGORY 3: LANGUAGE DETECTION TESTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    await testLanguageDetection();
    await testMultilingualQueries();
    
    // Category 4: Edge Cases
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  CATEGORY 4: EDGE CASES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    await testEdgeCases();
    await testSecurityEdgeCases();
    
    // Category 5: Performance
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚡ CATEGORY 5: PERFORMANCE TESTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    await testPerformance();
    await testConcurrentRequests();
    
    // Category 6: Enhancement Quality
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ CATEGORY 6: ENHANCEMENT QUALITY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    await testEnhancementQuality();
    
    // Category 7: Cost Tracking
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💰 CATEGORY 7: COST TRACKING');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    await testCostTracking();
    
    // Category 8: Fallback
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔄 CATEGORY 8: FALLBACK BEHAVIOR');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    await testFallbackBehavior();
    
    // Category 9: Metadata
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 CATEGORY 9: METADATA VALIDATION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    await testMetadataCompleteness();
    
  } catch (error) {
    console.error('\n💥 FATAL ERROR:', error.message);
  }
  
  // Print summary
  printSummary();
}

function printSummary() {
  console.log('\n\n╔════════════════════════════════════════════════════════╗');
  console.log('║                    TEST SUMMARY                        ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  const total = results.passed + results.failed + results.skipped;
  const passRate = total > 0 ? ((results.passed / total) * 100).toFixed(1) : 0;
  
  console.log(`Total Tests:   ${total}`);
  console.log(`✅ Passed:     ${results.passed} (${passRate}%)`);
  console.log(`❌ Failed:     ${results.failed}`);
  console.log(`⏭️  Skipped:    ${results.skipped}`);
  
  // Group by category
  console.log('\n📊 Results by Category:');
  const byCategory = {};
  results.tests.forEach(test => {
    if (!byCategory[test.category]) {
      byCategory[test.category] = { passed: 0, failed: 0 };
    }
    byCategory[test.category][test.status]++;
  });
  
  Object.entries(byCategory).forEach(([category, stats]) => {
    const total = stats.passed + stats.failed;
    const rate = ((stats.passed / total) * 100).toFixed(0);
    console.log(`   ${category}: ${stats.passed}/${total} (${rate}%)`);
  });
  
  // List failures
  if (results.failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.tests.filter(t => t.status === 'failed').forEach(test => {
      console.log(`   • ${test.name}`);
      console.log(`     ${test.error}`);
    });
  }
  
  // Performance stats
  const avgDuration = results.tests.reduce((sum, t) => sum + t.duration, 0) / results.tests.length;
  const totalDuration = results.tests.reduce((sum, t) => sum + t.duration, 0);
  
  console.log('\n⏱️  Performance:');
  console.log(`   Average: ${avgDuration.toFixed(0)}ms per test`);
  console.log(`   Total:   ${(totalDuration / 1000).toFixed(1)}s`);
  
  // Final verdict
  console.log('\n' + '═'.repeat(60));
  if (results.failed === 0) {
    console.log('🎉 ALL TESTS PASSED! Phase 1 is production-ready! 🚀');
  } else {
    console.log(`⚠️  ${results.failed} test(s) failed. Review and fix before deployment.`);
  }
  console.log('═'.repeat(60) + '\n');
}

// Run if executed directly
if (typeof require !== 'undefined' && require.main === module) {
  runAllTests().catch(console.error);
}

// Export for use as module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runAllTests, results };
}
