import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SANDBOX_TIMEOUT = 30000;
const MAX_OUTPUT = 1024 * 100;
const ALLOWED_DOMAINS = ["arxiv.org", "api.openalex.org", "api.semanticscholar.org", "api.crossref.org", "export.arxiv.org"];

/**
 * Run user code in a sandboxed child process.
 * Writes output to a temp file to avoid stdout parsing issues.
 */
export async function runInSandbox(code, options = {}) {
  const { timeout = SANDBOX_TIMEOUT, allowedDomains = ALLOWED_DOMAINS } = options;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sandbox-"));
  const outFile = path.join(tmpDir, "output.json");
  const scriptFile = path.join(tmpDir, "script.cjs");

  // Build the wrapper: capture all console output, write to file on completion
  const wrapper = `
const fs = require('fs');
const outFile = ${JSON.stringify(outFile)};

// Capture all console output
const __lines = [];
const __orig = { log: console.log, error: console.error, warn: console.warn };
console.log = (...a) => __lines.push(a.map(String).join(' '));
console.error = (...a) => __lines.push('[ERR] ' + a.map(String).join(' '));
console.warn = (...a) => __lines.push('[WARN] ' + a.map(String).join(' '));

// Provide https alongside http for convenience
const https = require('https');
const http = require('http');
// Auto-upgrade http to https for known domains
const _httpGet = http.get;
http.get = function(url, ...args) {
  const urlStr = typeof url === 'string' ? url : url?.href || '';
  if (urlStr.startsWith('http://') && (urlStr.includes('arxiv.org') || urlStr.includes('openalex.org') || urlStr.includes('semanticscholar.org'))) {
    const httpsUrl = urlStr.replace('http://', 'https://');
    return https.get(httpsUrl, ...args);
  }
  return _httpGet.call(http, url, ...args);
};

// Timeout
const __timer = setTimeout(() => {
  fs.writeFileSync(outFile, JSON.stringify({ output: __lines.join('\\n'), error: 'TIMEOUT', status: 'timeout' }));
  process.exit(124);
}, ${timeout});

// Run user code, wait for async completion
let __completed = false;
function __finish() {
  if (__completed) return;
  __completed = true;
  clearTimeout(__timer);
  fs.writeFileSync(outFile, JSON.stringify({ output: __lines.join('\\n'), status: 'completed' }));
}

// Extra grace period for callback-based async (http.get etc.)
const __graceTimer = setTimeout(__finish, 12000);

try {
  const __result = (() => {
    ${code}
  })();

  if (__result && typeof __result.then === 'function') {
    __result.then(() => {
      // Give event loop one more tick for any pending microtasks
      setTimeout(__finish, 500);
    }).catch((e) => {
      __lines.push('[ERR] ' + e.message);
      setTimeout(__finish, 500);
    });
  }
  // Note: if code is callback-based (http.get), the graceTimer handles completion
} catch (err) {
  __lines.push('[ERR] ' + err.message);
  __finish();
}
`;

  fs.writeFileSync(scriptFile, wrapper);

  return new Promise((resolve) => {
    const child = spawn("node", [scriptFile], {
      cwd: tmpDir,
      timeout: timeout + 5000,
      env: { ...process.env, NODE_ENV: "sandbox" },
    });

    let stderr = "";

    child.stderr.on("data", (data) => {
      stderr += data.toString();
      if (stderr.length > MAX_OUTPUT) stderr = stderr.slice(-MAX_OUTPUT);
    });

    child.on("close", (code) => {
      // Read output file
      let output = "";
      let status = code === 0 ? "completed" : "error";

      try {
        if (fs.existsSync(outFile)) {
          const raw = fs.readFileSync(outFile, "utf-8");
          const parsed = JSON.parse(raw);
          output = (parsed.output || "").slice(0, MAX_OUTPUT);
          status = parsed.status || status;
        }
      } catch {
        output = stderr.slice(0, 500);
        status = "error";
      }

      // Cleanup
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}

      resolve({
        status,
        output,
        error: stderr.slice(0, 500),
        duration: 0,
      });
    });

    child.on("error", (err) => {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
      resolve({ status: "error", output: "", error: err.message, duration: 0 });
    });
  });
}

export function validateCrawlerOutput(output, schema) {
  if (!output) return { valid: false, errors: ["No output"] };
  const errors = [];
  if (schema?.requiredFields) {
    for (const field of schema.requiredFields) {
      if (!(field in output)) errors.push(`Missing required field: ${field}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export async function testCrawlerPlugin(plugin) {
  const results = [];
  for (const test of plugin.tests || []) {
    const startTime = Date.now();
    const result = await runInSandbox(plugin.parserCode, { timeout: 15000 });
    const passed = result.status === "completed" && result.output.includes(test.expectedOutput);
    results.push({
      runAt: new Date(),
      status: passed ? "passed" : "failed",
      output: result.output.slice(0, 500),
      error: result.error,
      duration: Date.now() - startTime,
    });
  }
  return results;
}

export default { runInSandbox, validateCrawlerOutput, testCrawlerPlugin };
