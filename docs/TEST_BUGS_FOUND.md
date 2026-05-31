# Test Bugs Found - Discovery & Search Module

**Date**: 2026-05-31  
**Test Run**: `npm run test:search`  
**Result**: 30 failures, 42 cancelled, 34 passed

---

## 🐛 Critical Bugs Found

### Bug #1: Cache Service Export Mismatch
**Severity**: 🔴 CRITICAL  
**Affected Files**: 5 test files  
**Error**: `The requested module '../cache.js' does not provide an export named 'getCache'`

**Files Affected**:
- `tests/embedding-service.test.js`
- `tests/query-parser.test.js`  
- `tests/semantic-search.test.js`
- `tests/embed-papers-worker.test.js`
- All files importing from `embeddingService.js` or `queryParser.js`

**Root Cause**:
```javascript
// Tests expect:
import { getCache, setCache } from "../server/services/cache.js";

// But cache.js likely exports differently (default export or different names)
```

**Solution Needed**:
1. Check `server/services/cache.js` export format
2. Update test mocks to match actual exports
3. OR update cache service to export named functions

---

### Bug #2: User Model Password Field Mismatch
**Severity**: 🔴 CRITICAL  
**Affected Files**: `tests/subscription-model.test.js`, `tests/alert-service.test.js`  
**Error**: `User validation failed: passwordHash: Path 'passwordHash' is required`

**Root Cause**:
```javascript
// Tests create users with:
await User.create({
  email: "test@example.com",
  password: "hashed",  // ❌ WRONG FIELD
  name: "Test User"
});

// But User model requires:
passwordHash: {
  type: String,
  required: true
}
```

**Failed Tests**: 16 tests

**Solution**:
```javascript
// Change all User.create() calls to:
await User.create({
  email: "test@example.com",
  passwordHash: "hashed_password_here",  // ✅ CORRECT
  name: "Test User"
});
```

---

### Bug #3: Export Syntax Errors in Source Files
**Severity**: 🟡 MEDIUM  
**Affected Files**: `citation-graph.test.js`, `federation-manager.test.js`  
**Error**: `Unexpected token 'export'`

**Root Cause**:
Source files (`arxiv.js`, `semanticScholar.js`, `citationGraph.js`) have syntax errors or are using incompatible export syntax.

**Files with Issues**:
- `server/services/ingestion/arxiv.js:68` - `export class ArxivProvider`
- `server/services/ingestion/semanticScholar.js` - Similar issue
- `server/services/search/citationGraph.js` - Import issues

**Solution Needed**:
1. Check if these files are valid ES modules
2. Verify export syntax is correct
3. Check for circular dependencies

---

### Bug #4: Mock Redefinition Error
**Severity**: 🟢 LOW  
**Affected Files**: `tests/metadata-extractor.test.js`  
**Error**: `Cannot redefine property: chat`

**Root Cause**:
```javascript
// Trying to mock 'chat' function that's already mocked elsewhere
const deepseekModule = await import("../server/services/deepseek.js");
chatMock = mock.method(deepseekModule, "chat", async () => {...});
// ❌ 'chat' is already mocked by another test file
```

**Solution**:
```javascript
// Use mock.fn() instead of mock.method() for already-mocked functions
// OR ensure proper cleanup in after() hooks
// OR use different mock strategy
```

---

## 📊 Test Failure Breakdown

### By Test File

| Test File | Status | Passed | Failed | Cancelled |
|-----------|--------|--------|--------|-----------|
| `code-data-detector.test.js` | ✅ PASS | 22 | 0 | 0 |
| `embedding-service.test.js` | ❌ FAIL | 0 | 0 | 0 (Exit 1) |
| `query-parser.test.js` | ❌ FAIL | 0 | 0 | 0 (Exit 1) |
| `federation-manager.test.js` | ❌ FAIL | 0 | 0 | 0 (Exit 1) |
| `semantic-search.test.js` | ❌ FAIL | 0 | 12 | 0 |
| `citation-graph.test.js` | ❌ FAIL | 0 | 12 | 0 |
| `metadata-extractor.test.js` | ❌ FAIL | 0 | 8 | 0 |
| `alert-service.test.js` | ❌ FAIL | 0 | 10 | 0 |
| `subscription-model.test.js` | ❌ FAIL | 3 | 16 | 0 |
| `embed-papers-worker.test.js` | ❌ FAIL | 0 | 13 | 0 |

### By Error Type

| Error Type | Count | Severity |
|------------|-------|----------|
| Cache export mismatch | 5 files | 🔴 Critical |
| User model field mismatch | 16 tests | 🔴 Critical |
| Export syntax errors | 3 files | 🟡 Medium |
| Mock redefinition | 1 file | 🟢 Low |

---

## 🔧 Required Fixes

### Priority 1: Fix Cache Service Exports

**Option A**: Update cache.js to use named exports
```javascript
// server/services/cache.js
export async function getCache(key) { ... }
export async function setCache(key, value, ttl) { ... }
```

**Option B**: Update all tests to use correct import
```javascript
// Check actual cache.js exports first
import cache from "../server/services/cache.js";
// Then use: cache.get(), cache.set(), etc.
```

### Priority 2: Fix User Model Usage in Tests

**Files to Update**:
- `tests/subscription-model.test.js` (16 occurrences)
- `tests/alert-service.test.js` (10 occurrences)

**Find & Replace**:
```javascript
// FIND:
password: "hashed"

// REPLACE WITH:
passwordHash: "hashed_password_123"
```

### Priority 3: Fix Export Syntax Issues

**Check these source files**:
1. `server/services/ingestion/arxiv.js`
2. `server/services/ingestion/semanticScholar.js`
3. `server/services/search/citationGraph.js`

**Verify**:
- Proper ES module syntax
- No circular dependencies
- Correct export statements

### Priority 4: Fix Mock Redefinition

**Update**: `tests/metadata-extractor.test.js`

**Solution**:
```javascript
// Instead of mock.method(), use a different approach
const originalChat = deepseekModule.chat;
deepseekModule.chat = async () => ({ content: "..." });

// Restore in after()
after(() => {
  deepseekModule.chat = originalChat;
});
```

---

## 📋 Action Plan

### Step 1: Investigate Cache Service (15 min)
```bash
# Check cache.js exports
cat server/services/cache.js | grep -E "export|module.exports"
```

### Step 2: Fix User Model Usage (10 min)
```bash
# Update all test files
# Replace 'password:' with 'passwordHash:' in test files
```

### Step 3: Fix Export Syntax (20 min)
```bash
# Check source files for syntax errors
node --check server/services/ingestion/arxiv.js
node --check server/services/search/citationGraph.js
```

### Step 4: Fix Mock Issues (10 min)
```bash
# Update metadata-extractor.test.js mock strategy
```

### Step 5: Re-run Tests (5 min)
```bash
npm run test:search
```

**Total Estimated Time**: 60 minutes

---

## 🎯 Expected Outcome After Fixes

- **Cache errors**: 0 (fixed 5 files)
- **User model errors**: 0 (fixed 16 tests)
- **Export errors**: 0 (fixed 3 files)
- **Mock errors**: 0 (fixed 1 file)

**Expected Pass Rate**: 95%+ (100+ tests passing)

---

## 📝 Lessons Learned

1. **Always check actual exports** before writing tests
2. **Verify model schemas** before creating test data
3. **Test imports** before writing full test suites
4. **Mock strategy** should be consistent across test files
5. **Run tests incrementally** as you write them

---

## 🔍 Root Cause Analysis

### Why These Bugs Occurred

1. **Cache Service**: Tests were written based on assumed API, not actual implementation
2. **User Model**: Tests used intuitive field name (`password`) instead of checking actual schema (`passwordHash`)
3. **Export Syntax**: Source files may have been refactored after tests were written
4. **Mock Conflicts**: Multiple test files trying to mock the same module

### Prevention Strategy

1. **Read source code first** before writing tests
2. **Check model schemas** in MongoDB/Mongoose
3. **Verify imports work** with simple test
4. **Use isolated mocks** per test file
5. **Run tests frequently** during development

---

**Status**: 🔴 BUGS IDENTIFIED - FIXES REQUIRED  
**Next Step**: Implement fixes in priority order  
**ETA**: 60 minutes to fix all issues

---

*Generated: 2026-05-31*  
*Test Run: npm run test:search*  
*Total Issues: 4 critical bugs affecting 25+ tests*