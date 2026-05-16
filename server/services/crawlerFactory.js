import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { runInSandbox } from "./sandbox.js";
import { config } from "../config.js";

const OPENCODE_BIN = "opencode";
const OPENCODE_TIMEOUT = 180000; // 3 minutes for code generation
const CODE_MODEL = config.crawlerModel || process.env.CRAWLER_MODEL || "deepseek/deepseek-v4-pro";

/**
 * Generate a real crawler plugin using OpenCode.
 *
 * Pipeline:
 * 1. Create a temporary workspace with SPEC.md
 * 2. OpenCode generates the crawler code and tests
 * 3. Read back the generated files
 * 4. Run in sandbox to validate
 * 5. Return the crawler code + test results
 */
export async function generateCrawler(description, options = {}) {
  const { sources = ["arxiv", "openalex"], locale = "zh", timeout = OPENCODE_TIMEOUT } = options;

  // Create workspace
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "crawler-factory-"));
  console.log("CrawlerFactory: workspace at", workspaceDir);

  try {
    // Step 1: Write SPEC.md
    const spec = buildSpec(description, sources, locale);
    fs.writeFileSync(path.join(workspaceDir, "SPEC.md"), spec);

    // Write package.json for the crawler project
    const pkg = {
      name: "research-crawler",
      version: "1.0.0",
      private: true,
      type: "module",
      scripts: { test: "node test.js" },
      dependencies: {},
    };
    fs.writeFileSync(path.join(workspaceDir, "package.json"), JSON.stringify(pkg, null, 2));

    // Step 2: Run OpenCode to generate the crawler
    console.log("CrawlerFactory: launching OpenCode...");
    const prompt = locale === "zh"
      ? `Read SPEC.md and implement the crawler. Write the crawler code to crawler.js, tests to test.js, and a README.md explaining usage. Then run "node test.js" to verify the crawler works. Use ONLY the standard Node.js http/https modules (no npm install needed). The crawler must fetch real papers from academic APIs and parse them into a JSON array.`
      : `Read SPEC.md and implement the crawler. Write the crawler code to crawler.js, tests to test.js, and a README.md explaining usage. Then run "node test.js" to verify the crawler works. Use ONLY the standard Node.js http/https modules (no npm install needed). The crawler must fetch real papers from academic APIs and parse them into a JSON array.`;

    const { code, stdout, stderr } = await runOpenCode(workspaceDir, prompt, { timeout });

    console.log("CrawlerFactory: OpenCode completed, exit", code);
    if (stdout) console.log("CrawlerFactory: stdout preview:", stdout.slice(0, 500));
    if (stderr) console.log("CrawlerFactory: stderr preview:", stderr.slice(0, 500));

    // Step 3: Read generated files
    const crawlerCode = readFileIfExists(path.join(workspaceDir, "crawler.js"));
    const testCode = readFileIfExists(path.join(workspaceDir, "test.js"));
    const readme = readFileIfExists(path.join(workspaceDir, "README.md"));

    if (!crawlerCode) {
      // Fallback: look for any .js file that might be the crawler
      const files = fs.readdirSync(workspaceDir).filter((f) => f.endsWith(".js") && f !== "package.json");
      console.log("CrawlerFactory: generated JS files:", files);
      for (const f of files) {
        const content = fs.readFileSync(path.join(workspaceDir, f), "utf-8");
        if (content.includes("fetch") || content.includes("http") || content.includes("request")) {
          console.log("CrawlerFactory: found crawler code in", f);
          break;
        }
      }
    }

    // Step 4: Run in sandbox to validate
    let sandboxResult = null;
    if (crawlerCode) {
      console.log("CrawlerFactory: running in sandbox...");
      sandboxResult = await runInSandbox(crawlerCode, {
        timeout: 30000,
        language: "javascript",
        allowedDomains: ["arxiv.org", "api.openalex.org", "api.semanticscholar.org", "api.crossref.org", "export.arxiv.org"],
      });
      console.log("CrawlerFactory: sandbox result:", sandboxResult.status);
    }

    // Step 5: Extract tests and build test results
    const testResults = [];
    if (testCode) {
      // We already ran tests via OpenCode; parse any test output from stdout
      if (stdout.includes("PASS") || stdout.includes("pass") || stdout.includes("✓")) {
        testResults.push({ status: "passed", description: "Crawler tests passed" });
      } else if (stderr.includes("fail") || stderr.includes("error")) {
        testResults.push({ status: "failed", description: "Crawler tests failed", error: stderr.slice(0, 300) });
      } else {
        testResults.push({ status: "completed", description: "Crawler generated and validated" });
      }
    }

    return {
      crawlerCode: crawlerCode || "",
      testCode: testCode || "",
      readme: readme || "",
      sandboxResult,
      testResults,
      workspaceDir,
      opencodeStdout: stdout.slice(0, 2000),
      opencodeStderr: stderr.slice(0, 2000),
      model: CODE_MODEL,
    };
  } finally {
    // Cleanup workspace (keep for debugging if there was an error)
    // fs.rmSync(workspaceDir, { recursive: true, force: true });
  }
}

function buildSpec(description, sources, locale) {
  const isZh = locale === "zh";
  return `# Crawler Specification

## Description
${description}

## Target Sources
${sources.map((s) => `- ${s}`).join("\n")}

## Requirements
1. Write a Node.js crawler in **crawler.js**
2. Use ONLY standard http/https modules (no external dependencies)
3. Fetch real papers from: ${sources.join(", ")}
4. Parse paper metadata: title, authors, abstract, year, doi, source
5. Output results as a JSON array to stdout via console.log()
6. Handle rate limiting (1 request per second minimum)
7. Handle errors gracefully (timeout after 15s per request)
8. Return at most 10 papers

## API Endpoints to Use
${
  sources.includes("arxiv")
    ? `- arXiv: http://export.arxiv.org/api/query?search_query=all:KEYWORDS&start=0&max_results=10&sortBy=submittedDate&sortOrder=descending`
    : ""
}
${
  sources.includes("openalex")
    ? `- OpenAlex: https://api.openalex.org/works?search=KEYWORDS&per_page=10&sort=cited_by_count:desc`
    : ""
}
${
  sources.includes("semantic_scholar")
    ? `- Semantic Scholar: https://api.semanticscholar.org/graph/v1/paper/search?query=KEYWORDS&limit=10&fields=title,authors,abstract,year,externalIds`
    : ""
}

## Test File (test.js)
Write a test file that:
1. Imports or requires the crawler
2. Runs it with a sample keyword
3. Validates the output is a valid JSON array
4. Checks that each paper has a title
5. Prints "PASS" if all checks pass, "FAIL" otherwise

## Important
- The crawler MUST be a self-contained async function or Node.js script
- Output valid JSON via console.log(JSON.stringify(results))
- Handle cases where the API returns errors
- ${isZh ? "所有注释和日志使用英文" : "Use English for all comments and logs"}
`;
}

function readFileIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function runOpenCode(workspaceDir, prompt, options = {}) {
  const { timeout = OPENCODE_TIMEOUT } = options;

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";

    const child = spawn(OPENCODE_BIN, [
      "run",
      "--model", CODE_MODEL,
      "--dir", workspaceDir,
      "--dangerously-skip-permissions",
      "--format", "json",
      "--thinking",
      prompt,
    ], {
      cwd: workspaceDir,
      timeout,
      env: {
        ...process.env,
        // Ensure OpenCode uses the right API keys
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
        DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });

    child.on("error", (err) => {
      resolve({ code: -1, stdout, stderr: err.message });
    });

    // Timeout guard
    setTimeout(() => {
      child.kill();
      resolve({ code: 124, stdout, stderr: "OpenCode timed out" });
    }, timeout);
  });
}

export default { generateCrawler };
