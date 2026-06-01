import test from "node:test";
import assert from "node:assert/strict";
import { config } from "../server/config.js";
import {
  createWorkspace,
  uploadSource,
  deleteSource,
  chatWithSources,
  generateArtifact,
  deleteWorkspace
} from "../server/services/notebooklm.js";

// ---------------------------------------------------------------------------
// NotebookLM Cloud Sync Engine Unit Tests
// ---------------------------------------------------------------------------

// Store original fetch
const originalFetch = globalThis.fetch;

// Helper to configure mock fetches
function setupMockFetch(mockFn) {
  globalThis.fetch = mockFn;
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

test("createWorkspace throws error when disabled in config", async () => {
  const originalEnabled = config.notebooklmEnabled;
  config.notebooklmEnabled = false;

  try {
    await createWorkspace("Test Title");
    assert.fail("Should have thrown error");
  } catch (err) {
    assert.match(err.message, /NotebookLM API is disabled/);
  } finally {
    config.notebooklmEnabled = originalEnabled;
  }
});

test("createWorkspace calls Google Cloud API first and returns remote workspaceId", async () => {
  const originalEnabled = config.notebooklmEnabled;
  const originalKey = config.notebooklmApiKey;
  const originalProject = config.notebooklmProjectId;
  
  config.notebooklmEnabled = true;
  config.notebooklmApiKey = "mock-api-key";
  config.notebooklmProjectId = "mock-project-id";

  let callCount = 0;
  let requestUrl = "";
  let requestHeaders = {};
  let requestBody = {};

  setupMockFetch(async (url, init) => {
    callCount++;
    requestUrl = url;
    requestHeaders = init.headers;
    requestBody = JSON.parse(init.body);

    return {
      ok: true,
      json: async () => ({
        name: "projects/mock-project-id/locations/global/notebooks/workspace_12345",
        displayName: "Test Title"
      })
    };
  });

  try {
    const result = await createWorkspace("Test Title");

    assert.equal(callCount, 1);
    assert.equal(requestUrl, "https://notebooklm.googleapis.com/v1/projects/mock-project-id/locations/global/notebooks");
    assert.equal(requestHeaders["Authorization"], "Bearer mock-api-key");
    assert.equal(requestHeaders["X-Goog-User-Project"], "mock-project-id");
    assert.deepEqual(requestBody, { displayName: "Test Title" });
    assert.deepEqual(result, { workspaceId: "workspace_12345", displayName: "Test Title" });
  } finally {
    restoreFetch();
    config.notebooklmEnabled = originalEnabled;
    config.notebooklmApiKey = originalKey;
    config.notebooklmProjectId = originalProject;
  }
});

test("createWorkspace handles API network error correctly by propagating it", async () => {
  const originalEnabled = config.notebooklmEnabled;
  const originalKey = config.notebooklmApiKey;
  config.notebooklmEnabled = true;
  config.notebooklmApiKey = "mock-api-key";

  setupMockFetch(async () => {
    return {
      ok: false,
      status: 400,
      text: async () => "Invalid project region"
    };
  });

  try {
    await createWorkspace("Test Title");
    assert.fail("Should have failed on API error");
  } catch (err) {
    assert.match(err.message, /Google NotebookLM API error/);
    assert.match(err.message, /400 Invalid project region/);
  } finally {
    restoreFetch();
    config.notebooklmEnabled = originalEnabled;
    config.notebooklmApiKey = originalKey;
  }
});

test("uploadSource uploads document content and parses remote sourceId on success", async () => {
  const originalEnabled = config.notebooklmEnabled;
  const originalKey = config.notebooklmApiKey;
  const originalProject = config.notebooklmProjectId;

  config.notebooklmEnabled = true;
  config.notebooklmApiKey = "mock-api-key";
  config.notebooklmProjectId = "mock-project-id";

  let callCount = 0;
  let requestUrl = "";
  let requestBody = {};

  setupMockFetch(async (url, init) => {
    callCount++;
    requestUrl = url;
    requestBody = JSON.parse(init.body);

    return {
      ok: true,
      json: async () => ({
        name: "projects/mock-project-id/locations/global/notebooks/workspace_123/sources/source_456",
        displayName: "Research Paper Title"
      })
    };
  });

  try {
    const result = await uploadSource("workspace_123", {
      title: "Research Paper Title",
      textContent: "Abstract and full content of the paper."
    });

    assert.equal(callCount, 1);
    assert.equal(requestUrl, "https://notebooklm.googleapis.com/v1/projects/mock-project-id/locations/global/notebooks/workspace_123/sources");
    assert.deepEqual(requestBody, {
      displayName: "Research Paper Title",
      content: { textContent: "Abstract and full content of the paper." }
    });
    assert.deepEqual(result, { googleSourceId: "source_456" });
  } finally {
    restoreFetch();
    config.notebooklmEnabled = originalEnabled;
    config.notebooklmApiKey = originalKey;
    config.notebooklmProjectId = originalProject;
  }
});

test("chatWithSources performs grounded content query and retrieves citation sources", async () => {
  const originalEnabled = config.notebooklmEnabled;
  const originalKey = config.notebooklmApiKey;
  const originalProject = config.notebooklmProjectId;

  config.notebooklmEnabled = true;
  config.notebooklmApiKey = "mock-api-key";
  config.notebooklmProjectId = "mock-project-id";

  let requestUrl = "";
  let requestBody = {};

  setupMockFetch(async (url, init) => {
    requestUrl = url;
    requestBody = JSON.parse(init.body);

    return {
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: "Based on the sources, transformer models use self-attention." }]
            },
            groundingMetadata: {
              groundingChunks: [
                {
                  derivedSource: { sourceDisplayName: "Attention Is All You Need" }
                }
              ]
            }
          }
        ]
      })
    };
  });

  try {
    const result = await chatWithSources("workspace_123", "How do transformers work?", [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi" }
    ]);

    assert.equal(requestUrl, "https://notebooklm.googleapis.com/v1/projects/mock-project-id/locations/global/notebooks/workspace_123:generateGroundedContent");
    assert.deepEqual(requestBody.contents, [
      { role: "user", parts: [{ text: "Hello" }] },
      { role: "model", parts: [{ text: "Hi" }] },
      { role: "user", parts: [{ text: "How do transformers work?" }] }
    ]);
    assert.equal(result.text, "Based on the sources, transformer models use self-attention.");
    assert.equal(result.citations.length, 1);
    assert.equal(result.citations[0].derivedSource.sourceDisplayName, "Attention Is All You Need");
  } finally {
    restoreFetch();
    config.notebooklmEnabled = originalEnabled;
    config.notebooklmApiKey = originalKey;
    config.notebooklmProjectId = originalProject;
  }
});

test("generateArtifact formats prompt and delegates to DeepSeek chat function fallback for Studio tasks", async () => {
  const originalEnabled = config.notebooklmEnabled;
  config.notebooklmEnabled = true;

  const mockSources = [
    { title: "Source A", textContent: "Content A" },
    { title: "Source B", textContent: "Content B" }
  ];

  let deepSeekCalled = false;
  let receivedMessages = [];

  const mockDeepSeekChat = async (messages, locale, options) => {
    deepSeekCalled = true;
    receivedMessages = messages;
    return {
      content: `{"flashcards":[{"front":"What is A?","back":"Answer A"}]}`
    };
  };

  try {
    const result = await generateArtifact("workspace_123", "flashcards", mockSources, mockDeepSeekChat);

    assert.ok(deepSeekCalled);
    assert.ok(receivedMessages.length > 0);
    assert.match(receivedMessages[0].content, /Source A/);
    assert.match(receivedMessages[0].content, /Content B/);
    assert.deepEqual(result.content, {
      flashcards: [{ front: "What is A?", back: "Answer A" }]
    });
  } finally {
    config.notebooklmEnabled = originalEnabled;
  }
});

test("deleteWorkspace executes remote DELETE call successfully", async () => {
  const originalEnabled = config.notebooklmEnabled;
  const originalKey = config.notebooklmApiKey;
  const originalProject = config.notebooklmProjectId;

  config.notebooklmEnabled = true;
  config.notebooklmApiKey = "mock-api-key";
  config.notebooklmProjectId = "mock-project-id";

  let callCount = 0;
  let requestUrl = "";
  let requestMethod = "";

  setupMockFetch(async (url, init) => {
    callCount++;
    requestUrl = url;
    requestMethod = init.method;

    return {
      ok: true
    };
  });

  try {
    await deleteWorkspace("workspace_123");
    
    assert.equal(callCount, 1);
    assert.equal(requestUrl, "https://notebooklm.googleapis.com/v1/projects/mock-project-id/locations/global/notebooks/workspace_123");
    assert.equal(requestMethod, "DELETE");
  } finally {
    restoreFetch();
    config.notebooklmEnabled = originalEnabled;
    config.notebooklmApiKey = originalKey;
    config.notebooklmProjectId = originalProject;
  }
});
