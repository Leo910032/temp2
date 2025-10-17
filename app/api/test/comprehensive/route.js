// app/api/test/comprehensive/route.js
// API endpoint to run comprehensive test suite
// Access: GET http://localhost:3000/api/test/comprehensive

import { QueryEnhancementService } from '@/lib/services/serviceContact/server/queryEnhancementService';

export async function GET(req) {
  const results = {
    passed: 0,
    failed: 0,
    tests: [],
    startTime: new Date().toISOString()
  };
  
  // Helper to run a test
  async function runTest(name, testFn, category = 'General') {
    const startTime = Date.now();
    try {
      await testFn();
      const duration = Date.now() - startTime;
      results.passed++;
      results.tests.push({ name, status: 'passed', duration, category });
      return { success: true, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      results.failed++;
      results.tests.push({ 
        name, 
        status: 'failed', 
        duration, 
        category, 
        error: error.message 
      });
      return { success: false, duration, error: error.message };
    }
  }
  
  // Helper to test query
  async function testQuery(query, expectedBehavior = {}) {
    const result = await QueryEnhancementService.enhanceQuery(query, {
      userId: 'test-user',
      sessionId: 'comprehensive-test'
    });
    
    // Validate expected behavior
    if (expectedBehavior.cacheType && result.metadata.cacheType !== expectedBehavior.cacheType) {
      throw new Error(`Expected cacheType ${expectedBehavior.cacheType}, got ${result.metadata.cacheType}`);
    }
    
    if (expectedBehavior.language && result.language !== expectedBehavior.language) {
      throw new Error(`Expected language ${expectedBehavior.language}, got ${result.language}`);
    }
    
    if (expectedBehavior.maxDuration && result.metadata.duration > expectedBehavior.maxDuration) {
      throw new Error(`Duration ${result.metadata.duration}ms exceeded max ${expectedBehavior.maxDuration}ms`);
    }
    
    if (expectedBehavior.cached !== undefined && result.metadata.cached !== expectedBehavior.cached) {
      throw new Error(`Expected cached ${expectedBehavior.cached}, got ${result.metadata.cached}`);
    }
    
    return result;
  }
  
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  // ============================================
  // RUN TESTS
  // ============================================
  
  try {
    // 1. Static Cache Tests
    await runTest('Static: CEO', async () => {
      await testQuery('CEO', { cacheType: 'static', cached: true, maxDuration: 10 });
    }, 'Static Cache');
    
    await runTest('Static: CTO', async () => {
      await testQuery('CTO', { cacheType: 'static', cached: true });
    }, 'Static Cache');
    
    await runTest('Static: Case insensitive', async () => {
      await testQuery('ceo', { cacheType: 'static', cached: true });
    }, 'Static Cache');
    
    await runTest('Static: Partial match', async () => {
      const result = await testQuery('Senior CEO', { cacheType: 'static' });
      if (!result.enhancedQuery.includes('CEO')) throw new Error('Partial match failed');
    }, 'Static Cache');
    
    // 2. Redis Cache Tests
    const uniqueQuery1 = `redis test ${Date.now()}`;
    await runTest('Redis: First call (miss)', async () => {
      await testQuery(uniqueQuery1, { cacheType: 'ai', cached: false });
    }, 'Redis Cache');
    
    await sleep(200);
    
    await runTest('Redis: Second call (hit)', async () => {
      await testQuery(uniqueQuery1, { cacheType: 'redis', cached: true, maxDuration: 100 });
    }, 'Redis Cache');
    
    // 3. Language Detection Tests
    await runTest('Language: English', async () => {
      await testQuery('software engineer', { language: 'eng' });
    }, 'Language Detection');
    
    await runTest('Language: French', async () => {
      await testQuery('ingénieur logiciel', { language: 'fra' });
    }, 'Language Detection');
    
    await runTest('Language: Spanish', async () => {
      await testQuery('ingeniero de software', { language: 'spa' });
    }, 'Language Detection');
    
    // 4. Edge Cases
    await runTest('Edge: Very long query', async () => {
      const longQuery = 'software engineer '.repeat(50);
      const result = await testQuery(longQuery);
      if (!result.enhancedQuery) throw new Error('Failed to handle long query');
    }, 'Edge Cases');
    
    await runTest('Edge: Single character', async () => {
      await testQuery('a');
    }, 'Edge Cases');
    
    await runTest('Edge: Numbers only', async () => {
      await testQuery('12345');
    }, 'Edge Cases');
    
    await runTest('Edge: Special characters', async () => {
      await testQuery('CEO @company #hashtag');
    }, 'Edge Cases');
    
    await runTest('Edge: Unicode/Emoji', async () => {
      await testQuery('developer 🚀 AI 💻');
    }, 'Edge Cases');
    
    await runTest('Edge: Accented characters', async () => {
      await testQuery('ingénieur développeur');
    }, 'Edge Cases');
    
    await runTest('Security: SQL injection', async () => {
      await testQuery("CEO'; DROP TABLE users--");
    }, 'Edge Cases');
    
    await runTest('Security: XSS attempt', async () => {
      await testQuery('<script>alert("xss")</script> engineer');
    }, 'Edge Cases');
    
    // 5. Performance Tests
    await runTest('Performance: Static < 10ms', async () => {
      const start = Date.now();
      await testQuery('CEO');
      const duration = Date.now() - start;
      if (duration > 10) throw new Error(`Took ${duration}ms`);
    }, 'Performance');
    
    const uniqueQuery2 = `perf test ${Date.now()}`;
    await testQuery(uniqueQuery2); // Populate cache
    await sleep(100);
    
    await runTest('Performance: Redis < 100ms', async () => {
      const start = Date.now();
      await testQuery(uniqueQuery2);
      const duration = Date.now() - start;
      if (duration > 100) throw new Error(`Took ${duration}ms`);
    }, 'Performance');
    
    // 6. Enhancement Quality
    await runTest('Quality: CEO expands properly', async () => {
      const result = await testQuery('CEO');
      const enhanced = result.enhancedQuery.toLowerCase();
      if (!enhanced.includes('chief executive officer')) {
        throw new Error('Missing CEO expansion');
      }
    }, 'Quality');
    
    await runTest('Quality: Technical terms', async () => {
      const result = await testQuery('AI machine learning');
      const enhanced = result.enhancedQuery.toLowerCase();
      if (!enhanced.includes('artificial intelligence')) {
        throw new Error('Missing AI expansion');
      }
    }, 'Quality');
    
    await runTest('Quality: Enhancement adds value', async () => {
      const result = await testQuery('developer');
      if (result.enhancedQuery.length <= result.originalQuery.length) {
        throw new Error('No value added');
      }
    }, 'Quality');
    
    // 7. Cost Tracking
    await runTest('Cost: Static has no cost', async () => {
      const result = await testQuery('CEO');
      if (result.metadata.cost && result.metadata.cost > 0) {
        throw new Error('Static should have no cost');
      }
    }, 'Cost Tracking');
    
    const uniqueQuery3 = `cost test ${Date.now()}`;
    await testQuery(uniqueQuery3);
    await sleep(100);
    
    await runTest('Cost: Redis has no cost', async () => {
      const result = await testQuery(uniqueQuery3);
      if (result.metadata.cost && result.metadata.cost > 0) {
        throw new Error('Redis should have no cost');
      }
    }, 'Cost Tracking');
    
    await runTest('Cost: Gemini has cost > 0', async () => {
      const uniqueQuery = `gemini cost ${Date.now()}`;
      const result = await testQuery(uniqueQuery);
      if (!result.metadata.cost || result.metadata.cost <= 0) {
        throw new Error('Gemini should have cost > 0');
      }
    }, 'Cost Tracking');
    
    // 8. Metadata Validation
    await runTest('Metadata: All fields present', async () => {
      const result = await testQuery('test');
      const required = ['cached', 'cacheType', 'duration', 'enhanceId', 'sessionId'];
      for (const field of required) {
        if (!(field in result.metadata)) {
          throw new Error(`Missing field: ${field}`);
        }
      }
    }, 'Metadata');
    
    await runTest('Metadata: Duration reasonable', async () => {
      const result = await testQuery('CEO');
      if (result.metadata.duration < 0 || result.metadata.duration > 10000) {
        throw new Error(`Unreasonable duration: ${result.metadata.duration}ms`);
      }
    }, 'Metadata');
    
    await runTest('Metadata: Unique IDs', async () => {
      const result1 = await testQuery('test 1');
      await sleep(10);
      const result2 = await testQuery('test 2');
      if (result1.metadata.enhanceId === result2.metadata.enhanceId) {
        throw new Error('IDs not unique');
      }
    }, 'Metadata');
    
  } catch (fatalError) {
    results.fatalError = fatalError.message;
  }
  
  // Generate summary
  results.endTime = new Date().toISOString();
  results.duration = results.tests.reduce((sum, t) => sum + t.duration, 0);
  results.total = results.passed + results.failed;
  results.passRate = results.total > 0 ? ((results.passed / results.total) * 100).toFixed(1) : 0;
  
  // Group by category
  results.byCategory = {};
  results.tests.forEach(test => {
    if (!results.byCategory[test.category]) {
      results.byCategory[test.category] = { passed: 0, failed: 0, tests: [] };
    }
    results.byCategory[test.category][test.status]++;
    results.byCategory[test.category].tests.push({
      name: test.name,
      status: test.status,
      duration: test.duration,
      error: test.error
    });
  });
  
  // Calculate pass rate by category
  Object.keys(results.byCategory).forEach(category => {
    const cat = results.byCategory[category];
    const total = cat.passed + cat.failed;
    cat.total = total;
    cat.passRate = total > 0 ? ((cat.passed / total) * 100).toFixed(1) : 0;
  });
  
  return Response.json(results, { 
    status: results.failed > 0 ? 500 : 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}
