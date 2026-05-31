import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import SystemLog from "../models/SystemLog.js";

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const DB_STATES = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" };
const originalConsole = {
  debug: console.debug.bind(console),
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

const memoryLogs = [];
const pendingLogs = [];
let consoleCaptureInstalled = false;
let flushing = false;

export function createLogger(namespace = "app") {
  return {
    debug(message, metadata, options) {
      return writeLog("debug", namespace, message, metadata, options);
    },
    info(message, metadata, options) {
      return writeLog("info", namespace, message, metadata, options);
    },
    warn(message, metadata, options) {
      return writeLog("warn", namespace, message, metadata, options);
    },
    error(message, metadata, options) {
      return writeLog("error", namespace, message, metadata, options);
    },
  };
}

export function installConsoleLogCapture() {
  if (consoleCaptureInstalled) return;
  consoleCaptureInstalled = true;

  console.debug = (...args) => {
    originalConsole.debug(...args);
    writeConsoleCapture("debug", args);
  };
  console.log = (...args) => {
    originalConsole.log(...args);
    writeConsoleCapture("info", args);
  };
  console.info = (...args) => {
    originalConsole.info(...args);
    writeConsoleCapture("info", args);
  };
  console.warn = (...args) => {
    originalConsole.warn(...args);
    writeConsoleCapture("warn", args);
  };
  console.error = (...args) => {
    originalConsole.error(...args);
    writeConsoleCapture("error", args);
  };
}

export function requestLoggingMiddleware(req, res, next) {
  const startedAt = Date.now();
  const requestId = req.headers["x-request-id"] || randomUUID();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);

  writeLog("debug", "http", "request:start", {
    event: "request_start",
    requestId,
    method: req.method,
    path: req.originalUrl || req.url,
    ip: req.ip,
    userAgent: req.get("user-agent") || "",
    contentLength: req.get("content-length") || "",
  });

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    writeLog(level, "http", "request:finish", {
      event: "request_finish",
      requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs,
      userId: req.user?._id?.toString?.() || req.user?.id || "",
    });
  });

  next();
}

export function errorLoggingMiddleware(err, req, res, next) {
  writeLog("error", "http", "request:error", {
    event: "request_error",
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl || req.url,
    userId: req.user?._id?.toString?.() || req.user?.id || "",
    error: serializeError(err),
  });
  next(err);
}

export async function queryLogs(filters = {}) {
  const limit = clamp(Number(filters.limit) || 200, 1, 1000);
  const query = {};

  if (filters.level) query.level = String(filters.level);
  if (filters.namespace) query.namespace = String(filters.namespace);
  if (filters.event) query.event = String(filters.event);
  if (filters.requestId) query.requestId = String(filters.requestId);
  if (filters.path) query.path = { $regex: escapeRegex(filters.path), $options: "i" };
  if (filters.q) {
    query.$or = [
      { message: { $regex: escapeRegex(filters.q), $options: "i" } },
      { namespace: { $regex: escapeRegex(filters.q), $options: "i" } },
      { event: { $regex: escapeRegex(filters.q), $options: "i" } },
      { path: { $regex: escapeRegex(filters.q), $options: "i" } },
      { "error.message": { $regex: escapeRegex(filters.q), $options: "i" } },
    ];
  }
  if (filters.since) {
    const since = new Date(filters.since);
    if (!Number.isNaN(since.getTime())) query.createdAt = { $gte: since };
  }

  if (isMongoConnected()) {
    const logs = await SystemLog.find(query).sort({ createdAt: -1 }).limit(limit).lean();
    return { logs, storage: "mongodb", db: getDbState() };
  }

  return {
    logs: filterMemoryLogs(filters).slice(0, limit),
    storage: "memory",
    db: getDbState(),
  };
}

export async function getLogStats() {
  const base = {
    db: getDbState(),
    memoryCount: memoryLogs.length,
    pendingCount: pendingLogs.length,
    persistLogs: config.persistLogs,
    logLevel: config.logLevel,
  };

  if (!isMongoConnected()) return { ...base, storage: "memory", byLevel: countByLevel(memoryLogs) };

  const rows = await SystemLog.aggregate([
    { $group: { _id: "$level", count: { $sum: 1 } } },
  ]);
  return {
    ...base,
    storage: "mongodb",
    byLevel: Object.fromEntries(rows.map((row) => [row._id, row.count])),
  };
}

export async function flushMemoryLogs() {
  if (flushing || !isMongoConnected() || !pendingLogs.length || !config.persistLogs) return;
  flushing = true;
  try {
    const docs = pendingLogs.splice(0, pendingLogs.length);
    await SystemLog.insertMany(docs, { ordered: false });
  } catch (err) {
    originalConsole.warn("[logger] failed to flush memory logs:", err.message);
  } finally {
    flushing = false;
  }
}

export function getDbState() {
  return DB_STATES[mongoose.connection.readyState] || "unknown";
}

function writeConsoleCapture(level, args) {
  writeLog(level, "console", stringifyArgs(args), {
    event: "console",
    args: args.map(formatArg).slice(0, 20),
  }, { mirrorConsole: false });
}

function writeLog(level, namespace, message, metadata = {}, options = {}) {
  const normalizedLevel = LEVELS[level] ? level : "info";
  if (!shouldLog(normalizedLevel)) return null;

  const payload = buildPayload(normalizedLevel, namespace, message, metadata);
  if (options.mirrorConsole !== false && config.devVerboseLogging) {
    mirrorToConsole(payload);
  }
  storePayload(payload);
  return payload;
}

function buildPayload(level, namespace, message, metadata = {}) {
  const meta = metadata && typeof metadata === "object" ? { ...metadata } : { value: metadata };
  const error = serializeError(meta.error);
  delete meta.error;

  return {
    level,
    namespace,
    event: String(meta.event || ""),
    message: stringifyMessage(message),
    requestId: String(meta.requestId || ""),
    method: String(meta.method || ""),
    path: String(meta.path || ""),
    statusCode: typeof meta.statusCode === "number" ? meta.statusCode : null,
    durationMs: typeof meta.durationMs === "number" ? meta.durationMs : null,
    userId: String(meta.userId || ""),
    metadata: sanitizeMetadata(meta),
    error,
    dbState: getDbState(),
    pid: process.pid,
    createdAt: new Date(),
  };
}

function storePayload(payload) {
  pushMemory(payload);
  if (!config.persistLogs) return;
  if (!isMongoConnected()) {
    pushPending(payload);
    return;
  }

  SystemLog.create(payload).catch((err) => {
    originalConsole.warn("[logger] failed to persist log:", err.message);
  });
}

function pushMemory(payload) {
  memoryLogs.unshift(payload);
  const max = Math.max(100, Number(config.logMemoryLimit) || 1000);
  if (memoryLogs.length > max) memoryLogs.length = max;
}

function pushPending(payload) {
  pendingLogs.push(payload);
  const max = Math.max(100, Number(config.logMemoryLimit) || 1000);
  if (pendingLogs.length > max) pendingLogs.splice(0, pendingLogs.length - max);
}

function mirrorToConsole(payload) {
  const method = payload.level === "debug" ? "debug" : payload.level;
  const target = originalConsole[method] || originalConsole.log;
  target(`[${payload.level}] [${payload.namespace}] ${payload.message}`, compactMirror(payload));
}

function compactMirror(payload) {
  const details = {
    event: payload.event || undefined,
    requestId: payload.requestId || undefined,
    method: payload.method || undefined,
    path: payload.path || undefined,
    statusCode: payload.statusCode ?? undefined,
    durationMs: payload.durationMs ?? undefined,
    error: payload.error?.message || undefined,
  };
  return Object.fromEntries(Object.entries(details).filter(([, value]) => value !== undefined));
}

function shouldLog(level) {
  const configured = LEVELS[config.logLevel] ? config.logLevel : "debug";
  return LEVELS[level] >= LEVELS[configured];
}

function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}

function filterMemoryLogs(filters) {
  return memoryLogs.filter((log) => {
    if (filters.level && log.level !== filters.level) return false;
    if (filters.namespace && log.namespace !== filters.namespace) return false;
    if (filters.event && log.event !== filters.event) return false;
    if (filters.requestId && log.requestId !== filters.requestId) return false;
    if (filters.path && !String(log.path).toLowerCase().includes(String(filters.path).toLowerCase())) return false;
    if (filters.since) {
      const since = new Date(filters.since);
      if (!Number.isNaN(since.getTime()) && new Date(log.createdAt) < since) return false;
    }
    if (filters.q) {
      const haystack = [
        log.message,
        log.namespace,
        log.event,
        log.path,
        log.error?.message,
        JSON.stringify(log.metadata || {}),
      ].join(" ").toLowerCase();
      if (!haystack.includes(String(filters.q).toLowerCase())) return false;
    }
    return true;
  });
}

function countByLevel(logs) {
  return logs.reduce((acc, log) => {
    acc[log.level] = (acc[log.level] || 0) + 1;
    return acc;
  }, {});
}

function serializeError(err) {
  if (!err) return { name: "", message: "", stack: "" };
  if (err instanceof Error) {
    return {
      name: err.name || "Error",
      message: err.message || "",
      stack: err.stack || "",
    };
  }
  if (typeof err === "object") {
    return {
      name: String(err.name || ""),
      message: String(err.message || JSON.stringify(err)),
      stack: String(err.stack || ""),
    };
  }
  return { name: "", message: String(err), stack: "" };
}

function sanitizeMetadata(value) {
  try {
    return JSON.parse(JSON.stringify(value, (_key, val) => {
      if (typeof val === "bigint") return String(val);
      if (val instanceof Error) return serializeError(val);
      return val;
    }));
  } catch {
    return { unserializable: String(value) };
  }
}

function stringifyArgs(args) {
  return args.map(formatArg).join(" ");
}

function stringifyMessage(message) {
  return typeof message === "string" ? message : formatArg(message);
}

function formatArg(arg) {
  if (typeof arg === "string") return arg;
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export default {
  createLogger,
  installConsoleLogCapture,
  requestLoggingMiddleware,
  errorLoggingMiddleware,
  queryLogs,
  getLogStats,
  flushMemoryLogs,
  getDbState,
};
