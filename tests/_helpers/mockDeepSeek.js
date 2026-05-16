// Factory for mock DeepSeek chat() and chatStream() functions

export function mockChat(responses = []) {
  let callCount = 0;

  return async function chat(messages, locale, options = {}) {
    const idx = Math.min(callCount, responses.length - 1);
    const response = responses[idx] || { content: "", tokensUsed: 0, model: "mock" };
    callCount += 1;
    return {
      content: response.content || "",
      tokensUsed: response.tokensUsed || 0,
      model: response.model || "mock",
    };
  };
}

export function mockChatStream(events = []) {
  return async function* chatStream(messages, locale, options = {}) {
    for (const event of events) {
      yield event;
    }
  };
}

// Pre-built common responses
export const AI_RESPONSES = {
  empty: { content: "", tokensUsed: 0, model: "mock" },

  validJson: (json) => ({
    content: JSON.stringify(json),
    tokensUsed: 100,
    model: "mock",
  }),

  parseFailure: {
    content: "This is not JSON at all, just plain text.",
    tokensUsed: 50,
    model: "mock",
  },

  trackerKind: {
    content: 'TRACKER: I created a tracker for you. {"context":{"papers":["Paper A"],"tokens":200,"artifacts":1}}',
    tokensUsed: 200,
    model: "mock",
  },

  crawlerKind: {
    content: 'CRAWLER: {"name":"Test Crawler","query":"test","sources":["arxiv"],"keywords":["test"],"maxResults":5}',
    tokensUsed: 150,
    model: "mock",
  },

  metadata: (overrides = {}) => ({
    content: JSON.stringify({
      title: overrides.title || "Test Paper",
      authors: overrides.authors || ["Author One", "Author Two"],
      year: overrides.year || 2025,
      doi: overrides.doi || "10.1234/test",
      abstract: overrides.abstract || "This is a test abstract.",
    }),
    tokensUsed: 80,
    model: "mock",
  }),

  summary: (overrides = {}) => ({
    content: JSON.stringify({
      summary: overrides.summary || "This paper presents a novel approach.",
      contributions: overrides.contributions || "Key contribution to the field.",
      methods: overrides.methods || "Experimental validation on benchmarks.",
      limitations: overrides.limitations || "Limited to small datasets.",
    }),
    tokensUsed: 120,
    model: "mock",
  }),

  ranking: (paperIds) => ({
    content: JSON.stringify({
      ranked_papers: (paperIds || ["id1", "id2"]).map((id, i) => ({
        id,
        relevance: 100 - i * 10,
      })),
    }),
    tokensUsed: 50,
    model: "mock",
  }),
};

export default { mockChat, mockChatStream, AI_RESPONSES };
