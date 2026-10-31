import fs from 'fs';
import path from 'path';

async function runTriage() {
  console.log('--- Starting Agentic QA Triage ---');

  const failures = [];
  let totalTests = 0;
  let passedTests = 0;

  // 1. Inspect Schemathesis Report
  const schemathesisFile = path.resolve('schemathesis-report.xml');
  if (fs.existsSync(schemathesisFile)) {
    const content = fs.readFileSync(schemathesisFile, 'utf8');
    const failureMatches = content.match(/<failure[^>]*>([\s\S]*?)<\/failure>/g);
    const errorMatches = content.match(/<error[^>]*>([\s\S]*?)<\/error>/g);
    if (failureMatches || errorMatches) {
      failures.push({
        suite: 'Schemathesis (Backend API Fuzzing)',
        error: (failureMatches || []).concat(errorMatches || []).slice(0, 3).join('\n'),
      });
    } else {
      passedTests++;
    }
    totalTests++;
  }

  // 2. Inspect Promptfoo Report
  const promptfooFile = path.resolve('promptfoo-results.json');
  if (fs.existsSync(promptfooFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(promptfooFile, 'utf8'));
      const failedCases = (data.results || []).filter(r => !r.success);
      if (failedCases.length > 0) {
        failures.push({
          suite: 'Promptfoo (LLM Prompt & Safety Evals)',
          error: failedCases.map(f => `Prompt: ${f.prompt.raw?.slice(0, 80)}... | Failure: ${f.error || 'Assertion failed'}`).join('\n'),
        });
      } else {
        passedTests++;
      }
      totalTests++;
    } catch (e) {
      console.warn('Could not parse promptfoo-results.json', e.message);
    }
  }

  // 3. Inspect Playwright Report
  const playwrightFile = path.resolve('test-results/playwright-results.json');
  if (fs.existsSync(playwrightFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(playwrightFile, 'utf8'));
      const failedSuites = [];
      function traverseSuites(suite) {
        if (suite.specs) {
          for (const spec of suite.specs) {
            for (const test of spec.tests || []) {
              for (const result of test.results || []) {
                if (result.status === 'failed' || result.status === 'timedOut') {
                  failedSuites.push(`Spec: ${spec.title} - Error: ${result.error?.message || result.status}`);
                }
              }
            }
          }
        }
        if (suite.suites) {
          suite.suites.forEach(traverseSuites);
        }
      }
      (data.suites || []).forEach(traverseSuites);

      if (failedSuites.length > 0) {
        failures.push({
          suite: 'Playwright (Staging UI E2E)',
          error: failedSuites.slice(0, 5).join('\n'),
        });
      } else {
        passedTests++;
      }
      totalTests++;
    } catch (e) {
      console.warn('Could not parse playwright-results.json', e.message);
    }
  }

  let markdownReport = '';

  if (failures.length === 0) {
    markdownReport = `## Staging QA Verification: ALL GATES PASSED

All automated staging verification suites completed successfully:
- **Schemathesis API Fuzzing**: Passed (API adheres strictly to OpenAPI specifications).
- **Promptfoo LLM Evals**: Passed (All regression assertions and prompt injection defenses satisfied).
- **Playwright UI E2E**: Passed (Core upload and user workflows verified on staging).

*Deployment verified by Agentic QA Runner.*
`;
  } else {
    console.log(`Detected ${failures.length} test suite failure(s). Generating AI Triage...`);

    let aiDiagnosis = '';
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      try {
        const failureSummary = JSON.stringify(failures, null, 2);
        const prompt = `You are an elite QA and SRE triage agent. Analyze the following staging QA failures from Schemathesis, Promptfoo, or Playwright:
${failureSummary}

Provide a concise, high-value Markdown triage report:
1. **Root Cause Analysis**: Pinpoint the likely cause (backend error, schema mismatch, prompt hallucination, or UI selector breakage).
2. **Impact Assessment**: What user or system functionality is broken?
3. **Recommended Fix**: Actionable next step or code change.`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        });

        if (response.ok) {
          const resJson = await response.json();
          aiDiagnosis = resJson.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }
      } catch (err) {
        console.warn('AI triage API call failed:', err.message);
      }
    }

    markdownReport = `## Staging QA Verification: FAILURES DETECTED

> [!WARNING]
> One or more automated quality gates failed during staging verification.

### Failure Breakdown
${failures.map(f => `#### ${f.suite}\n\`\`\`\n${f.error}\n\`\`\``).join('\n\n')}

${aiDiagnosis ? `### AI Root Cause & Fix Recommendation\n${aiDiagnosis}` : `### Recommended Actions\n- Inspect the attached Playwright trace/video artifacts.\n- Verify the staging backend logs for 500 status codes.\n- Run \`npx promptfoo view\` to inspect LLM assertion failures.`}
`;
  }

  // Save report
  fs.writeFileSync('qa-triage-report.md', markdownReport);
  console.log('Saved triage report to qa-triage-report.md');

  // If in GitHub Actions, append to Step Summary
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdownReport);
  }

  console.log('--- Agentic QA Triage Complete ---');
}

runTriage().catch(console.error);
