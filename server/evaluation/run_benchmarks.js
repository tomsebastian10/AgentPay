import { BENCHMARK_SCENARIOS } from './scenarios.js';

async function runAllBenchmarks() {
  console.log(`\n===============================================================`);
  console.log(`🛡️  AGENTPAY EVALUATION SUITE: 10 SYNTHETIC COMMERCE SCENARIOS`);
  console.log(`===============================================================\n`);

  let passedCount = 0;
  const results = [];
  const startTime = Date.now();

  for (let i = 0; i < BENCHMARK_SCENARIOS.length; i++) {
    const scenario = BENCHMARK_SCENARIOS[i];
    const scenarioStart = Date.now();
    
    try {
      const outcome = await scenario.run();
      const durationMs = Date.now() - scenarioStart;

      if (outcome.passed) {
        passedCount++;
        console.log(`✅ [PASS] #${i + 1} ${scenario.name} (${durationMs}ms)`);
        results.push({ id: scenario.id, name: scenario.name, status: 'PASSED', durationMs });
      } else {
        console.log(`❌ [FAIL] #${i + 1} ${scenario.name} (${durationMs}ms) — Reason: ${outcome.reason}`);
        results.push({ id: scenario.id, name: scenario.name, status: 'FAILED', reason: outcome.reason, durationMs });
      }
    } catch (err) {
      const durationMs = Date.now() - scenarioStart;
      console.log(`💥 [ERROR] #${i + 1} ${scenario.name} (${durationMs}ms) — Exception: ${err.message}`);
      results.push({ id: scenario.id, name: scenario.name, status: 'ERROR', error: err.message, durationMs });
    }
  }

  const totalDuration = Date.now() - startTime;
  const passRate = Math.round((passedCount / BENCHMARK_SCENARIOS.length) * 100);

  console.log(`\n---------------------------------------------------------------`);
  console.log(`📊 BENCHMARK SUMMARY:`);
  console.log(`   Total Scenarios: ${BENCHMARK_SCENARIOS.length}`);
  console.log(`   Passed:          ${passedCount}`);
  console.log(`   Failed:          ${BENCHMARK_SCENARIOS.length - passedCount}`);
  console.log(`   Pass Rate:       ${passRate}%`);
  console.log(`   Total Time:      ${totalDuration}ms`);
  console.log(`---------------------------------------------------------------\n`);

  return {
    total: BENCHMARK_SCENARIOS.length,
    passed: passedCount,
    failed: BENCHMARK_SCENARIOS.length - passedCount,
    passRate,
    durationMs: totalDuration,
    results
  };
}

// Add API endpoint to router as well
if (process.argv[1]?.endsWith('run_benchmarks.js')) {
  runAllBenchmarks().then(summary => {
    if (summary.failed > 0) process.exit(1);
  });
}

export { runAllBenchmarks };
