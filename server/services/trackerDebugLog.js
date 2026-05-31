import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const LOGS_DIR = path.resolve("logs");
const colors = { blue: "\x1b[34m", green: "\x1b[32m", yellow: "\x1b[33m", red: "\x1b[31m", cyan: "\x1b[36m", reset: "\x1b[0m" };

export function setActiveDebugLog(log) {
  globalThis._trackerDebugLog = log;
}

export function getActiveDebugLog() {
  return globalThis._trackerDebugLog || null;
}

export function clearActiveDebugLog() {
  globalThis._trackerDebugLog = null;
}

export function createTrackerDebugLog() {
  const runId = randomUUID().slice(0, 8);
  const startedAt = new Date();
  const ts = [
    startedAt.getFullYear(),
    String(startedAt.getMonth() + 1).padStart(2, "0"),
    String(startedAt.getDate()).padStart(2, "0"),
    "_",
    String(startedAt.getHours()).padStart(2, "0"),
    String(startedAt.getMinutes()).padStart(2, "0"),
    String(startedAt.getSeconds()).padStart(2, "0"),
  ].join("");
  const logFile = path.join(LOGS_DIR, `tracker_${ts}_${runId}.log`);

  let firstWrite = true;
  let indent = 0;

  function ensureDir() {
    if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
  }

  function now() {
    const d = new Date();
    return [
      String(d.getHours()).padStart(2, "0"),
      String(d.getMinutes()).padStart(2, "0"),
      String(d.getSeconds()).padStart(2, "0"),
      ".",
      String(d.getMilliseconds()).padStart(3, "0"),
    ].join("");
  }

  function pad() {
    return "  ".repeat(indent);
  }

  function write(color, label, msg, meta) {
    let line = "";
    let metaStr = "";
    try {
      ensureDir();
      const tsNow = now();
      const elapsed = ((Date.now() - startedAt.getTime()) / 1000).toFixed(3);
      line = `${tsNow} [${elapsed}s] ${pad()}${label} ${msg}`;
      metaStr = meta && Object.keys(meta).length ? ` | ${JSON.stringify(meta)}` : "";
      const fullLine = line + metaStr + "\n";

      if (firstWrite) {
        const header = `${"=".repeat(80)}\n`;
        const headerInfo = `Tracker Crawl Debug Log\nRun ID: ${runId}\nStarted: ${startedAt.toISOString()}\nFile: ${logFile}\n${"=".repeat(80)}\n\n`;
        fs.appendFileSync(logFile, header + headerInfo);
        firstWrite = false;
      }

      fs.appendFileSync(logFile, fullLine);
    } catch {
      // File I/O failed — fall through to stdout only
    }
    try {
      process.stdout.write(`${color}${line}${colors.reset}${metaStr}\n`);
    } catch {
      // stdout closed — nothing to do
    }
  }

  return {
    /** Returns the log file path for reference */
    get logFile() {
      return logFile;
    },

    /** Returns the run ID */
    get runId() {
      return runId;
    },

    /** Increase indent level */
    begin(label) {
      write(colors.cyan, "[BEGIN]", label);
      indent += 1;
    },

    /** Decrease indent level */
    end(label, meta) {
      indent = Math.max(0, indent - 1);
      write(colors.cyan, "[END]  ", `${label}`, meta);
    },

    /** Info-level log */
    info(label, meta) {
      write(colors.green, "[INFO] ", label, meta);
    },

    /** Debug-level log (details) */
    detail(label, meta) {
      write(colors.reset, "[DBG]  ", label, meta);
    },

    /** Warning */
    warn(label, meta) {
      write(colors.yellow, "[WARN] ", label, meta);
    },

    /** Error */
    error(label, meta) {
      write(colors.red, "[ERR]  ", label, meta);
    },

    /** Section header */
    section(label) {
      const s = `\n${"=".repeat(60)}`;
      write(colors.blue, "", s, {});
      write(colors.blue, "[SECT] ", label, {});
      write(colors.blue, "", s, {});
    },

    /** Log an object/array dump for debugging */
    dump(label, obj) {
      const str = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
      try {
        ensureDir();
        const tsNow = now();
        const elapsed = ((Date.now() - startedAt.getTime()) / 1000).toFixed(3);
        const lines = [`${tsNow} [${elapsed}s] ${pad()}[DUMP] ${label}`];
        for (const line of str.split("\n")) {
          lines.push(`  ${pad()}${line}`);
        }
        const out = lines.join("\n") + "\n";
        fs.appendFileSync(logFile, out);
      } catch {
        // File I/O failed — fall through
      }
      process.stdout.write(`${colors.reset}${str.slice(0, 400)}${str.length > 400 ? "...\n" : ""}`);
    },
  };
}
