#!/usr/bin/env node

/**
 * Rate Limit Testing Script
 *
 * Tests the analytics rate limiting system by sending multiple requests
 * and analyzing the responses.
 *
 * Usage:
 *   node test-rate-limit.js [test-type]
 *
 * Test types:
 *   - normal: Normal usage (should all succeed)
 *   - burst: Convention burst scenario (should use burst allowance)
 *   - spam: Spam scenario (should trigger rate limit)
 *   - bot: Bot attack scenario (rapid fire, should trigger HIGH severity)
 */

const TEST_CONFIG = {
  // Update these values for your test
  SERVER_URL: 'http://localhost:3000',
  USER_ID: 'rfGX8GX9Y3gv3SKbkiERPFym72r1', // Replace with actual userId
  USERNAME: 'leozul', // Replace with actual username

  // Test scenarios
  scenarios: {
    normal: {
      name: 'Normal Usage',
      requests: 3,
      delayMs: 2000, // 2 seconds between requests
      description: 'Should all succeed (within limit)',
      expectedSuccess: 3,
      expectedRateLimit: 0
    },
    burst: {
      name: 'Convention Burst',
      requests: 5,
      delayMs: 500, // 500ms between requests
      description: 'Should use burst allowance, then rate limit',
      expectedSuccess: 4, // 3 normal + 1 burst
      expectedRateLimit: 1
    },
    spam: {
      name: 'Spam Scenario',
      requests: 15,
      delayMs: 500, // 500ms between requests
      description: 'Should trigger rate limit (MEDIUM severity)',
      expectedSuccess: 4,
      expectedRateLimit: 11
    },
    bot: {
      name: 'Bot Attack Simulation',
      requests: 20,
      delayMs: 50, // 50ms between requests (very fast!)
      description: 'Should trigger bot attack (HIGH severity)',
      expectedSuccess: 4,
      expectedRateLimit: 16
    }
  }
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendAnalyticsRequest(eventType = 'view') {
  const payload = {
    eventType,
    userId: TEST_CONFIG.USER_ID,
    username: TEST_CONFIG.USERNAME,
    sessionData: {
      sessionId: `test_session_${Date.now()}`,
      startTime: Date.now(),
      lastActivityTime: Date.now(),
      originalReferrer: 'test',
      trafficSource: {
        source: 'test',
        medium: 'automated',
        type: 'test'
      },
      utm: null,
      pageUrl: 'http://localhost:3000/test',
      userAgent: 'RateLimitTestScript/1.0',
      screenResolution: '1920x1080',
      language: 'en',
      timeZone: 'UTC'
    },
    timestamp: new Date().toISOString()
  };

  try {
    const response = await fetch(`${TEST_CONFIG.SERVER_URL}/api/user/analytics/track-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    return {
      status: response.status,
      success: response.ok,
      data,
      headers: {
        remaining: response.headers.get('X-RateLimit-Remaining'),
        reset: response.headers.get('X-RateLimit-Reset'),
        retryAfter: response.headers.get('Retry-After')
      }
    };
  } catch (error) {
    return {
      status: 0,
      success: false,
      error: error.message
    };
  }
}

async function runTest(scenarioName) {
  const scenario = TEST_CONFIG.scenarios[scenarioName];

  if (!scenario) {
    log(`❌ Unknown test scenario: ${scenarioName}`, 'red');
    log('\nAvailable scenarios:', 'yellow');
    Object.keys(TEST_CONFIG.scenarios).forEach(key => {
      log(`  - ${key}: ${TEST_CONFIG.scenarios[key].description}`, 'cyan');
    });
    return;
  }

  log('\n' + '='.repeat(70), 'bright');
  log(`🧪 Testing: ${scenario.name}`, 'bright');
  log('='.repeat(70), 'bright');
  log(`📝 ${scenario.description}`, 'cyan');
  log(`📊 Requests: ${scenario.requests}`, 'cyan');
  log(`⏱️  Delay: ${scenario.delayMs}ms between requests`, 'cyan');
  log('='.repeat(70) + '\n', 'bright');

  const results = {
    success: 0,
    rateLimit: 0,
    error: 0,
    responses: []
  };

  const startTime = Date.now();

  for (let i = 1; i <= scenario.requests; i++) {
    const requestStart = Date.now();
    log(`[${i}/${scenario.requests}] Sending request...`, 'blue');

    const result = await sendAnalyticsRequest('view');
    const requestDuration = Date.now() - requestStart;

    results.responses.push(result);

    if (result.status === 200) {
      results.success++;
      log(`  ✅ Success (${requestDuration}ms) - Remaining: ${result.headers.remaining}`, 'green');
    } else if (result.status === 429) {
      results.rateLimit++;
      const retryAfter = result.headers.retryAfter || result.data.retryAfter;
      log(`  🚫 Rate Limited (${requestDuration}ms) - Retry after: ${retryAfter}s`, 'yellow');
    } else {
      results.error++;
      log(`  ❌ Error ${result.status}: ${result.error || JSON.stringify(result.data)}`, 'red');
    }

    // Wait before next request (except for last one)
    if (i < scenario.requests) {
      await sleep(scenario.delayMs);
    }
  }

  const totalDuration = Date.now() - startTime;

  // Print summary
  log('\n' + '='.repeat(70), 'bright');
  log('📊 Test Results', 'bright');
  log('='.repeat(70), 'bright');
  log(`✅ Successful: ${results.success}/${scenario.requests}`, results.success === scenario.expectedSuccess ? 'green' : 'yellow');
  log(`🚫 Rate Limited: ${results.rateLimit}/${scenario.requests}`, results.rateLimit === scenario.expectedRateLimit ? 'green' : 'yellow');
  log(`❌ Errors: ${results.error}/${scenario.requests}`, results.error === 0 ? 'green' : 'red');
  log(`⏱️  Total Duration: ${(totalDuration / 1000).toFixed(2)}s`, 'cyan');
  log(`📈 Requests/sec: ${(scenario.requests / (totalDuration / 1000)).toFixed(2)}`, 'cyan');
  log('='.repeat(70), 'bright');

  // Verify expectations
  log('\n✅ Expected vs Actual:', 'bright');
  const successMatch = results.success === scenario.expectedSuccess;
  const rateLimitMatch = results.rateLimit >= scenario.expectedRateLimit; // >= because timing can vary

  log(`  Success: ${results.success} / ${scenario.expectedSuccess} ${successMatch ? '✅' : '⚠️'}`, successMatch ? 'green' : 'yellow');
  log(`  Rate Limited: ${results.rateLimit} / ${scenario.expectedRateLimit} ${rateLimitMatch ? '✅' : '⚠️'}`, rateLimitMatch ? 'green' : 'yellow');

  // Overall result
  if (successMatch && rateLimitMatch) {
    log('\n🎉 Test PASSED! Rate limiting is working as expected.', 'green');
  } else {
    log('\n⚠️  Test results differ from expectations. This may be due to timing variations.', 'yellow');
  }

  log('\n💡 Next steps:', 'cyan');
  log('  1. Check Firestore RateLimits collection for logged events', 'cyan');
  log('  2. Check server logs for rate limit messages', 'cyan');
  log('  3. Verify fingerprints and severity levels\n', 'cyan');
}

async function runAllTests() {
  log('\n🚀 Running ALL rate limit tests...', 'bright');
  log('⚠️  Warning: This will trigger multiple rate limits!\n', 'yellow');

  for (const scenarioName of Object.keys(TEST_CONFIG.scenarios)) {
    await runTest(scenarioName);

    // Wait 70 seconds between scenarios to let rate limits reset
    if (scenarioName !== Object.keys(TEST_CONFIG.scenarios).slice(-1)[0]) {
      log('\n⏳ Waiting 70 seconds for rate limit reset...', 'yellow');
      for (let i = 70; i > 0; i -= 10) {
        process.stdout.write(`\r⏳ ${i} seconds remaining...`);
        await sleep(10000);
      }
      console.log('\n');
    }
  }

  log('\n✨ All tests completed!', 'bright');
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const testType = args[0] || 'help';

  log('\n🧪 Rate Limit Testing Script', 'bright');
  log('━'.repeat(70), 'bright');

  if (testType === 'help' || testType === '--help' || testType === '-h') {
    log('\nUsage: node test-rate-limit.js [test-type]\n', 'cyan');
    log('Available test types:', 'bright');
    Object.entries(TEST_CONFIG.scenarios).forEach(([key, scenario]) => {
      log(`  ${key.padEnd(10)} - ${scenario.description}`, 'cyan');
    });
    log(`  ${'all'.padEnd(10)} - Run all tests sequentially`, 'cyan');
    log(`  ${'help'.padEnd(10)} - Show this help message\n`, 'cyan');

    log('Example:', 'bright');
    log('  node test-rate-limit.js burst\n', 'green');

    log('⚠️  Important:', 'yellow');
    log('  - Make sure your dev server is running (npm run dev)', 'yellow');
    log('  - Update USER_ID and USERNAME in the script', 'yellow');
    log('  - Check Firestore RateLimits collection after testing\n', 'yellow');
    return;
  }

  if (testType === 'all') {
    await runAllTests();
  } else {
    await runTest(testType);
  }
}

// Run the script
main().catch(error => {
  log(`\n❌ Error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
