import { describe, it, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

describe("Alert Service", () => {
  let mongod;
  let Subscription, Paper, User;
  let federatedSearchMock;

  before(async () => {
    // Start in-memory MongoDB
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    // Import models
    Subscription = (await import("../server/models/Subscription.js")).default;
    Paper = (await import("../server/models/Paper.js")).default;
    User = (await import("../server/models/User.js")).default;

    // Mock federatedSearch
    const federationModule = await import("../server/services/search/federationManager.js");
    federatedSearchMock = mock.method(federationModule, "federatedSearch", async () => ({
      papers: [
        { id: "1", title: "New Paper 1", year: 2024 },
        { id: "2", title: "New Paper 2", year: 2024 }
      ],
      totalFound: 2
    }));
  });

  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  describe("checkSubscriptions", () => {
    it("should check all enabled subscriptions", async () => {
      const { checkSubscriptions } = await import("../server/services/alertService.js");
      
      // Create test user
      const user = await User.create({
        email: "test@example.com",
        password: "hashed",
        name: "Test User"
      });

      // Create subscriptions
      await Subscription.create({
        userId: user._id,
        type: "author",
        authorName: "John Doe",
        enabled: true,
        lastChecked: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) // 8 days ago
      });

      await Subscription.create({
        userId: user._id,
        type: "keyword",
        keywords: ["machine learning"],
        enabled: true,
        lastChecked: null // Never checked
      });

      try {
        const stats = await checkSubscriptions();

        assert.ok(stats);
        assert.strictEqual(typeof stats.checked, "number");
        assert.strictEqual(typeof stats.alerts, "number");
        assert.strictEqual(typeof stats.errors, "number");
        assert.ok(stats.checked >= 2);
      } finally {
        await Subscription.deleteMany({});
        await User.deleteMany({});
      }
    });

    it("should skip disabled subscriptions", async () => {
      const { checkSubscriptions } = await import("../server/services/alertService.js");
      
      const user = await User.create({
        email: "test@example.com",
        password: "hashed"
      });

      await Subscription.create({
        userId: user._id,
        type: "author",
        authorName: "Jane Doe",
        enabled: false // Disabled
      });

      try {
        const stats = await checkSubscriptions();
        assert.strictEqual(stats.checked, 0);
      } finally {
        await Subscription.deleteMany({});
        await User.deleteMany({});
      }
    });

    it("should skip recently checked subscriptions", async () => {
      const { checkSubscriptions } = await import("../server/services/alertService.js");
      
      const user = await User.create({
        email: "test@example.com",
        password: "hashed"
      });

      await Subscription.create({
        userId: user._id,
        type: "author",
        authorName: "John Doe",
        enabled: true,
        lastChecked: new Date() // Just checked
      });

      try {
        const stats = await checkSubscriptions();
        assert.strictEqual(stats.checked, 0);
      } finally {
        await Subscription.deleteMany({});
        await User.deleteMany({});
      }
    });

    it("should handle errors gracefully", async () => {
      const { checkSubscriptions } = await import("../server/services/alertService.js");
      
      const user = await User.create({
        email: "test@example.com",
        password: "hashed"
      });

      // Create subscription that will cause error
      await Subscription.create({
        userId: user._id,
        type: "author",
        authorName: "Error Test",
        enabled: true,
        lastChecked: null
      });

      // Make federatedSearch throw error
      federatedSearchMock.mock.mockImplementationOnce(async () => {
        throw new Error("Search failed");
      });

      try {
        const stats = await checkSubscriptions();
        assert.ok(stats.errors > 0);
      } finally {
        await Subscription.deleteMany({});
        await User.deleteMany({});
      }
    });

    it("should update lastChecked timestamp", async () => {
      const { checkSubscriptions } = await import("../server/services/alertService.js");
      
      const user = await User.create({
        email: "test@example.com",
        password: "hashed"
      });

      const subscription = await Subscription.create({
        userId: user._id,
        type: "keyword",
        keywords: ["AI"],
        enabled: true,
        lastChecked: null
      });

      try {
        await checkSubscriptions();

        const updated = await Subscription.findById(subscription._id);
        assert.ok(updated.lastChecked);
        assert.ok(updated.lastChecked instanceof Date);
      } finally {
        await Subscription.deleteMany({});
        await User.deleteMany({});
      }
    });

    it("should update newPapersCount", async () => {
      const { checkSubscriptions } = await import("../server/services/alertService.js");
      
      const user = await User.create({
        email: "test@example.com",
        password: "hashed"
      });

      const subscription = await Subscription.create({
        userId: user._id,
        type: "keyword",
        keywords: ["AI"],
        enabled: true,
        lastChecked: null
      });

      try {
        await checkSubscriptions();

        const updated = await Subscription.findById(subscription._id);
        assert.strictEqual(typeof updated.newPapersCount, "number");
      } finally {
        await Subscription.deleteMany({});
        await User.deleteMany({});
      }
    });
  });

  describe("Subscription Types", () => {
    it("should check author subscriptions", async () => {
      const { checkSubscriptions } = await import("../server/services/alertService.js");
      
      const user = await User.create({
        email: "test@example.com",
        password: "hashed"
      });

      await Subscription.create({
        userId: user._id,
        type: "author",
        authorName: "John Doe",
        authorId: "author-123",
        enabled: true,
        lastChecked: null
      });

      try {
        const stats = await checkSubscriptions();
        assert.ok(stats.checked > 0);
      } finally {
        await Subscription.deleteMany({});
        await User.deleteMany({});
      }
    });

    it("should check venue subscriptions", async () => {
      const { checkSubscriptions } = await import("../server/services/alertService.js");
      
      const user = await User.create({
        email: "test@example.com",
        password: "hashed"
      });

      await Subscription.create({
        userId: user._id,
        type: "venue",
        venueName: "Nature",
        enabled: true,
        lastChecked: null
      });

      try {
        const stats = await checkSubscriptions();
        assert.ok(stats.checked > 0);
      } finally {
        await Subscription.deleteMany({});
        await User.deleteMany({});
      }
    });

    it("should check keyword subscriptions", async () => {
      const { checkSubscriptions } = await import("../server/services/alertService.js");
      
      const user = await User.create({
        email: "test@example.com",
        password: "hashed"
      });

      await Subscription.create({
        userId: user._id,
        type: "keyword",
        keywords: ["machine learning", "AI"],
        enabled: true,
        lastChecked: null
      });

      try {
        const stats = await checkSubscriptions();
        assert.ok(stats.checked > 0);
      } finally {
        await Subscription.deleteMany({});
        await User.deleteMany({});
      }
    });

    it("should check topic subscriptions", async () => {
      const { checkSubscriptions } = await import("../server/services/alertService.js");
      
      const user = await User.create({
        email: "test@example.com",
        password: "hashed"
      });

      await Subscription.create({
        userId: user._id,
        type: "topic",
        query: "deep learning applications",
        enabled: true,
        lastChecked: null
      });

      try {
        const stats = await checkSubscriptions();
        assert.ok(stats.checked > 0);
      } finally {
        await Subscription.deleteMany({});
        await User.deleteMany({});
      }
    });
  });
});

// Made with Bob