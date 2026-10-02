/**
 * Post-to-Card E2E Test Suite Runner
 * Orchestrates Tiers 1-4 execution natively in Node.js 24 with high-precision reporting.
 */

import { runTier1 } from './tiers/tier1_features.test.ts';
import { runTier2 } from './tiers/tier2_boundaries.test.ts';
import { runTier3 } from './tiers/tier3_interactions.test.ts';
import { runTier4 } from './tiers/tier4_workloads.test.ts';
import { runTierI18n } from './tiers/tier_i18n.test.ts';
import { runTierGraphQL } from './tiers/tier_graphql.test.ts';

async function main() {
  const args = process.argv.slice(2);
  const targetTier = args[0]?.toLowerCase();

  console.log('\n===============================================================');
  console.log('       POST-TO-CARD OPAQUE-BOX E2E TEST SUITE RUNNER            ');
  console.log('===============================================================\n');

  const startTime = Date.now();
  let grandTotal = 0;
  let grandPassed = 0;
  let grandFailed = 0;

  const tiersToRun: Array<{ name: string; run: () => Promise<any> }> = [];

  if (!targetTier || targetTier === 'tier1' || targetTier === '1') {
    tiersToRun.push({ name: 'Tier 1: Feature Coverage (F1 to F26)', run: runTier1 });
  }
  if (!targetTier || targetTier === 'tier2' || targetTier === '2') {
    tiersToRun.push({ name: 'Tier 2: Boundary & Corner Cases', run: runTier2 });
  }
  if (!targetTier || targetTier === 'tier3' || targetTier === '3') {
    tiersToRun.push({ name: 'Tier 3: Cross-Feature Interactions', run: runTier3 });
  }
  if (!targetTier || targetTier === 'tier4' || targetTier === '4') {
    tiersToRun.push({ name: 'Tier 4: Real-World Scenarios & Workflows', run: runTier4 });
  }
  if (!targetTier || targetTier === 'i18n') {
    tiersToRun.push({ name: 'Tier i18n: Internationalization & Localization', run: runTierI18n });
  }
  if (!targetTier || targetTier === 'graphql') {
    tiersToRun.push({ name: 'Tier GraphQL: Structured Response Parsing', run: runTierGraphQL });
  }

  for (const tier of tiersToRun) {
    console.log(`\n▶ Running ${tier.name}...`);
    const tierStart = Date.now();
    const result = await tier.run();
    const tierElapsed = Date.now() - tierStart;

    grandTotal += result.total;
    grandPassed += result.passed;
    grandFailed += result.failed;

    for (const r of result.results) {
      if (r.passed) {
        // Output concise dot or tick
      } else {
        console.error(`  ✖ FAIL: ${r.name}`);
        if (r.error) {
          console.error(`    Error: ${r.error}`);
        }
      }
    }

    if (result.failed === 0) {
      console.log(`  ✔ PASSED: ${result.passed}/${result.total} tests (${tierElapsed}ms)`);
    } else {
      console.error(`  ✖ FAILED: ${result.failed}/${result.total} tests failed (${tierElapsed}ms)`);
    }
  }

  const totalElapsed = Date.now() - startTime;
  console.log('\n===============================================================');
  console.log('                      TEST SUITE SUMMARY                       ');
  console.log('===============================================================');
  console.log(`  Total Tests Run: ${grandTotal}`);
  console.log(`  Passed:          ${grandPassed}`);
  console.log(`  Failed:          ${grandFailed}`);
  console.log(`  Duration:        ${totalElapsed}ms`);
  console.log('===============================================================\n');

  if (grandFailed > 0) {
    console.error(`❌ Suite failed with ${grandFailed} test failure(s).`);
    process.exit(1);
  } else {
    console.log('✨ All E2E test suites passed with 100% success rate!\n');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
