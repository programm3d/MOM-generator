import fs from 'fs';
import path from 'path';

function stripAnsi(str) {
  if (!str) return '';
  return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '').trim();
}

function decodeXml(str) {
  if (!str) return '';
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

async function runTriage() {
  console.log('--- Starting Agentic QA Detailed Triage & Report Generation ---');

  const scorecard = {
    playwright: { total: 0, passed: 0, failed: 0, specs: [] },
    promptfoo: { total: 0, passed: 0, failed: 0, tests: [] },
    schemathesis: { total: 0, passed: 0, failed: 0, checks: [] },
  };

  const failureSummaries = [];

  // ==========================================
  // 1. Playwright E2E Results
  // ==========================================
  const playwrightFile = path.resolve('test-results/playwright-results.json');
  if (fs.existsSync(playwrightFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(playwrightFile, 'utf8'));
      let e2eIndex = 1;

      function parseSuite(suite) {
        if (suite.specs) {
          for (const spec of suite.specs) {
            for (const test of spec.tests || []) {
              for (const res of test.results || []) {
                const isPassed = res.status === 'passed';
                const duration = res.duration ? (res.duration / 1000).toFixed(2) + 's' : '-';
                const errRaw = res.error?.message ? stripAnsi(res.error.message).split('\n')[0] : '';
                
                let expectedOutcome = 'Element loads and assertions succeed';
                if (spec.title.includes('load') || spec.title.includes('header')) {
                  expectedOutcome = 'App loads; brand title and transcript dropzone are visible';
                } else if (spec.title.includes('accept') || spec.title.includes('preview')) {
                  expectedOutcome = 'File selected; preview card and "Generate" button are rendered';
                } else if (spec.title.includes('submit') || spec.title.includes('initiate')) {
                  expectedOutcome = 'Form submit triggers generation; .processing-container becomes visible';
                }

                const specEntry = {
                  id: `TC-E2E-${String(e2eIndex++).padStart(3, '0')}`,
                  title: spec.title,
                  status: isPassed ? 'PASSED' : 'FAILED',
                  expected: expectedOutcome,
                  observed: isPassed ? `Rendered successfully in ${duration}` : `Failed: ${errRaw || res.status}`,
                  error: errRaw || '-',
                  duration,
                };

                scorecard.playwright.specs.push(specEntry);
                scorecard.playwright.total++;
                if (isPassed) {
                  scorecard.playwright.passed++;
                } else {
                  scorecard.playwright.failed++;
                  failureSummaries.push({
                    suite: 'Playwright (UI E2E Automation)',
                    testId: specEntry.id,
                    title: specEntry.title,
                    error: errRaw || res.status,
                  });
                }
              }
            }
          }
        }
        if (suite.suites) {
          suite.suites.forEach(parseSuite);
        }
      }

      (data.suites || []).forEach(parseSuite);
    } catch (e) {
      console.warn('Failed parsing playwright-results.json:', e.message);
    }
  }

  // ==========================================
  // 2. Promptfoo LLM Intelligence Results
  // ==========================================
  const promptfooFile = path.resolve('promptfoo-results.json');
  if (fs.existsSync(promptfooFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(promptfooFile, 'utf8'));
      const rawResults = data.results?.results || (Array.isArray(data.results) ? data.results : []);
      let promptIndex = 1;

      for (const item of rawResults) {
        const isPassed = Boolean(item.success);
        const duration = item.latencyMs ? (item.latencyMs / 1000).toFixed(2) + 's' : '-';
        const scenario = item.testCase?.description || item.description || `Evaluation Scenario ${promptIndex}`;
        const provider = item.provider?.id || 'gemini-3.5-flash-lite';
        const errRaw = item.error ? stripAnsi(item.error).split('\n')[0] : '';

        let expectedDesc = 'Valid JSON schema with expected meeting attributes';
        if (scenario.includes('Happy Path')) {
          expectedDesc = 'Valid JSON, title has "launch/readiness", non-empty agendas and attendees';
        } else if (scenario.includes('Injection') || scenario.includes('Adversarial')) {
          expectedDesc = 'Prompt injection resisted, untrusted commands ignored, no leaked instructions';
        } else if (scenario.includes('Edge Case') || scenario.includes('Proposals')) {
          expectedDesc = 'Handles unconfirmed proposals gracefully without hallucinating false decisions';
        }

        let observedDesc = 'All assertion criteria satisfied';
        if (!isPassed) {
          observedDesc = errRaw || 'One or more assertion checks failed';
        }

        const testEntry = {
          id: `TC-LLM-${String(promptIndex++).padStart(3, '0')}`,
          scenario,
          provider,
          status: isPassed ? 'PASSED' : (item.error ? 'ERROR' : 'FAILED'),
          expected: expectedDesc,
          observed: observedDesc,
          duration,
        };

        scorecard.promptfoo.tests.push(testEntry);
        scorecard.promptfoo.total++;
        if (isPassed) {
          scorecard.promptfoo.passed++;
        } else {
          scorecard.promptfoo.failed++;
          failureSummaries.push({
            suite: 'Promptfoo (LLM Prompt & Safety Evals)',
            testId: testEntry.id,
            title: testEntry.scenario,
            error: errRaw || observedDesc,
          });
        }
      }
    } catch (e) {
      console.warn('Failed parsing promptfoo-results.json:', e.message);
    }
  }

  // ==========================================
  // 3. Schemathesis Backend API Fuzzing Results
  // ==========================================
  const schemathesisFile = path.resolve('schemathesis-report.xml');
  if (fs.existsSync(schemathesisFile)) {
    try {
      const content = fs.readFileSync(schemathesisFile, 'utf8');

      // Extract testsuite stats if present
      const suiteMatch = content.match(/<testsuite[^>]*tests="(\d+)"[^>]*failures="(\d+)"[^>]*errors="(\d+)"/);
      if (suiteMatch) {
        scorecard.schemathesis.total = parseInt(suiteMatch[1], 10) || 0;
        scorecard.schemathesis.failed = (parseInt(suiteMatch[2], 10) || 0) + (parseInt(suiteMatch[3], 10) || 0);
        scorecard.schemathesis.passed = Math.max(0, scorecard.schemathesis.total - scorecard.schemathesis.failed);
      }

      // Extract failure/error tags
      const failureMatches = content.matchAll(/<failure[^>]*message="([^"]*)"[^>]*>([\s\S]*?)<\/failure>/g);
      const errorMatches = content.matchAll(/<error[^>]*message="([^"]*)"[^>]*>([\s\S]*?)<\/error>/g);
      
      const allFailures = [...failureMatches, ...errorMatches];
      let checkIndex = 1;

      for (const match of allFailures) {
        const rawMsg = match[1] || '';
        const rawBody = decodeXml(match[2] || '');

        let checkCode = 'ST-RULE';
        const codeMatch = rawBody.match(/-(?:\s*)(ST\d+)/i) || rawMsg.match(/(ST\d+)/i);
        if (codeMatch) checkCode = codeMatch[1];

        let endpoint = '/api/*';
        const endpointMatch = rawBody.match(/(?:GET|POST|PUT|DELETE|TRACE|PATCH)\s+([^\s\n"']+)/);
        if (endpointMatch) endpoint = endpointMatch[1];

        let method = 'ANY';
        const methodMatch = rawBody.match(/\b(GET|POST|PUT|DELETE|TRACE|PATCH)\b/);
        if (methodMatch) method = methodMatch[1];

        let curlCmd = '-';
        const curlMatch = rawBody.match(/(curl\s+[^<\n]+)/);
        if (curlMatch) curlCmd = curlMatch[1].trim();

        let cleanSummary = stripAnsi(rawMsg) || rawBody.split('\n').filter(Boolean)[0] || 'Schema violation detected';
        if (cleanSummary.length > 120) cleanSummary = cleanSummary.slice(0, 117) + '...';

        scorecard.schemathesis.checks.push({
          id: `TC-API-${String(checkIndex++).padStart(3, '0')}`,
          checkCode,
          endpoint,
          method,
          status: 'FAILED',
          summary: cleanSummary,
          curl: curlCmd,
        });

        failureSummaries.push({
          suite: 'Schemathesis (Backend API Fuzzing)',
          testId: checkCode,
          title: `${method} ${endpoint}`,
          error: cleanSummary,
        });
      }

      if (scorecard.schemathesis.total === 0) {
        scorecard.schemathesis.total = scorecard.schemathesis.checks.length;
        scorecard.schemathesis.failed = scorecard.schemathesis.checks.length;
      }
    } catch (e) {
      console.warn('Failed parsing schemathesis-report.xml:', e.message);
    }
  }

  // ==========================================
  // 4. Generate AI Diagnosis if Failures Exist
  // ==========================================
  let aiDiagnosis = '';
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (failureSummaries.length > 0 && apiKey) {
    try {
      const summaryPayload = JSON.stringify(failureSummaries.slice(0, 5), null, 2);
      const prompt = `You are a Principal QA and SRE architect. Analyze these staging QA failures from Schemathesis, Promptfoo, or Playwright:
${summaryPayload}

Provide a concise, high-value Markdown triage assessment:
1. **Root Cause Analysis**: Why did this fail (HTTP spec RFC 9110 Allow header, schema validation, prompt hallucination, or UI selector drift)?
2. **Impact Assessment**: What user or system functionality is degraded?
3. **Immediate Recommended Code Patch**: Exact actionable fix in Express, React, or OpenAPI spec.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );

      if (response.ok) {
        const resJson = await response.json();
        aiDiagnosis = resJson.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }
    } catch (err) {
      console.warn('AI Triage API call failed:', err.message);
    }
  }

  // ==========================================
  // 5. Construct Markdown Triage Report
  // ==========================================
  const totalFailures = scorecard.playwright.failed + scorecard.promptfoo.failed + scorecard.schemathesis.failed;
  const isAllPassed = totalFailures === 0;

  let report = `# 🚀 Staging Quality Gate & Agentic QA Verification Report\n\n`;
  report += `> **Evaluation Target:** Core Staging Environment  \n`;
  report += `> **Run Date:** ${new Date().toISOString()}  \n`;
  report += `> **Overall Gate Status:** ${isAllPassed ? '🟢 **ALL GATES PASSED**' : '🔴 **FAILURES DETECTED (ACTION REQUIRED)**'}\n\n`;

  // Scorecard Table
  report += `## 📊 Executive Quality Gate Scorecard\n\n`;
  report += `| Quality Domain | Framework | Total Tests | Passed | Failed | Status |\n`;
  report += `| :--- | :--- | :---: | :---: | :---: | :---: |\n`;
  
  const pwStatus = scorecard.playwright.total === 0 ? '⚪ NOT RUN' : (scorecard.playwright.failed === 0 ? '🟢 PASSED' : '🔴 FAILED');
  const pfStatus = scorecard.promptfoo.total === 0 ? '⚪ NOT RUN' : (scorecard.promptfoo.failed === 0 ? '🟢 PASSED' : '🔴 FAILED');
  const stStatus = scorecard.schemathesis.total === 0 ? '⚪ NOT RUN' : (scorecard.schemathesis.failed === 0 ? '🟢 PASSED' : '🔴 FAILED');

  report += `| **Frontend User Workflows** | Playwright UI E2E | ${scorecard.playwright.total} | ${scorecard.playwright.passed} | ${scorecard.playwright.failed} | ${pwStatus} |\n`;
  report += `| **LLM Intelligence & Prompt Safety** | Promptfoo Evals | ${scorecard.promptfoo.total} | ${scorecard.promptfoo.passed} | ${scorecard.promptfoo.failed} | ${pfStatus} |\n`;
  report += `| **API Contract & Fuzzing** | Schemathesis | ${scorecard.schemathesis.total} | ${scorecard.schemathesis.passed} | ${scorecard.schemathesis.failed} | ${stStatus} |\n\n`;

  report += `---\n\n`;

  // Section 1: Playwright E2E Table
  report += `## 1. 🎭 Playwright End-to-End (E2E) Test Suite\n\n`;
  if (scorecard.playwright.specs.length > 0) {
    report += `| Test Case ID | Test Case / User Workflow | Status | Expected Outcome | What Passed / Failed (Observed) | Duration |\n`;
    report += `| :--- | :--- | :---: | :--- | :--- | :---: |\n`;
    for (const spec of scorecard.playwright.specs) {
      const badge = spec.status === 'PASSED' ? '🟢 PASSED' : '❌ FAILED';
      report += `| \`${spec.id}\` | **${spec.title}** | ${badge} | ${spec.expected} | ${spec.observed} | ${spec.duration} |\n`;
    }
  } else {
    report += `*No Playwright results found in \`test-results/playwright-results.json\`.*\n`;
  }
  report += `\n---\n\n`;

  // Section 2: Promptfoo Table
  report += `## 2. 🧠 Promptfoo LLM Intelligence & Prompt Regression Suite\n\n`;
  if (scorecard.promptfoo.tests.length > 0) {
    report += `| Test ID | Test Scenario | Target Model | Status | Expected Assertions | Observed Result | Duration |\n`;
    report += `| :--- | :--- | :--- | :---: | :--- | :--- | :---: |\n`;
    for (const t of scorecard.promptfoo.tests) {
      const badge = t.status === 'PASSED' ? '🟢 PASSED' : (t.status === 'ERROR' ? '⚠️ ERROR' : '❌ FAILED');
      report += `| \`${t.id}\` | **${t.scenario}** | \`${t.provider}\` | ${badge} | ${t.expected} | ${t.observed} | ${t.duration} |\n`;
    }
  } else {
    report += `*No Promptfoo evaluation results found in \`promptfoo-results.json\`.*\n`;
  }
  report += `\n---\n\n`;

  // Section 3: Schemathesis Table
  report += `## 3. 🛡️ Schemathesis API Contract & Fuzzing Suite\n\n`;
  if (scorecard.schemathesis.checks.length > 0) {
    report += `| Check ID | Rule Code | Endpoint & Method | Status | Error Summary | Reproduction Command |\n`;
    report += `| :--- | :---: | :--- | :---: | :--- | :--- |\n`;
    for (const c of scorecard.schemathesis.checks) {
      report += `| \`${c.id}\` | \`${c.checkCode}\` | \`${c.method} ${c.endpoint}\` | ❌ FAILED | ${c.summary} | \`${c.curl}\` |\n`;
    }
  } else if (scorecard.schemathesis.total > 0 && scorecard.schemathesis.failed === 0) {
    report += `🟢 **All ${scorecard.schemathesis.total} API contract fuzzing checks satisfied without 5xx errors or contract drift.**\n`;
  } else {
    report += `*No Schemathesis failure report detected in \`schemathesis-report.xml\`.*\n`;
  }
  report += `\n---\n\n`;

  // Section 4: AI Root-Cause Analysis
  report += `## 4. 🤖 Autonomous AI Root-Cause Analysis & Action Plan\n\n`;
  if (aiDiagnosis) {
    report += `${aiDiagnosis}\n\n`;
  } else if (!isAllPassed) {
    report += `### Recommended Immediate Actions:\n`;
    report += `- **Schemathesis Fix**: In Express \`app.ts\`, ensure requests with undeclared methods (e.g. \`TRACE\`) respond with RFC 9110 \`Allow: GET, POST, DELETE, OPTIONS, HEAD\` header.\n`;
    report += `- **Promptfoo Fix**: Verify that \`GEMINI_API_KEY\` is active in GitHub Actions Secrets and the model is configured to \`gemini-3.5-flash-lite\`.\n`;
    report += `- **Playwright Fix**: Verify that \`BASE_URL\` points to a live frontend instance and selector locators match deployed DOM elements.\n\n`;
  } else {
    report += `*All verification gates passed across UI, API, and LLM domains. Production deployment approved.* ✨\n\n`;
  }

  // Save report file
  fs.writeFileSync('qa-triage-report.md', report);
  console.log('Successfully saved comprehensive report to qa-triage-report.md');

  // Append to GitHub Step Summary if running in GitHub Actions
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
    console.log('Appended comprehensive report to GITHUB_STEP_SUMMARY');
  }

  console.log('--- Agentic QA Triage Complete ---');
}

runTriage().catch(console.error);
