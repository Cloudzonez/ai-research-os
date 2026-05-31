import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

describe("Subscription Model", () => {
  let mongod;
  let Subscription, User;

  before(async () => {
    // Start in-memory MongoDB
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    // Import models
    Subscription = (await import("../server/models/Subscription.js")).default;
    User = (await import("../server/models/User.js")).default;
  });

  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  describe("Schema Validation", () => {
    it("should create subscription with valid data", async () => {
      const user = await User.create({
        email: "test@example.com",
        password: "hashed",
        name: "Test User"
      });

      const subscription = await Subscription.create({
        userId: user._id,
        type: "author",
        authorName: "John Doe",
        authorId: "author-123"
      });

      assert.ok(subscription._id);
      assert.strictEqual(subscription.type, "author");
      assert.strictEqual(subscription.authorName, "John Doe");
      assert.strictEqual(subscription.enabled, true); // Default value

      await Subscription.deleteMany({});
      await User.deleteMany({});
    });

    it("should require userId", async () => {
      await assert.rejects(
        async () => await Subscription.create({
          type: "author",
          authorName: "John Doe"
        }),
        /userId.*required/
      );
    });

    it("should require type", async () => {
      const user = await User.create({
        email: "test@example.com",
        password: "hashed"
      });

      await assert.rejects(
        async () => await Subscription.create({
          userId: user._id,
          authorName: "John Doe"
        }),
        /type.*required/
      );

      await User.deleteMany({});
    });

    it("should validate type enum", async () => {
      const user = await User.create({
        email: "test@example.com",
        password: "hashed"
      });

      await assert.rejects(
        async () => await Subscription.create({
          userId: user._id,
          type: "invalid_type"
        }),
        /type.*not a valid enum value/
      );

      await User.deleteMany({});
    });

    it("should accept valid type values", async () => {
      const user = await User.create({
        email: "test@example.com",
        password: "hashed"
      });

      const types = ["author", "venue", "keyword", "topic"];

      for (const type of types) {
        const subscription = await Subscription.create({
          userId: user._id,
          type,
          authorName: "Test"
        });

        assert.strictEqual(subscription.type, type);
        await Subscription.deleteOne({ _id: subscription._id });
      }

      await User.deleteMany({});
    });

    it("should validate frequency enum", async () => {
      const user = await User.create({
        email: "test@example.com",
        password: "hashed"
      });

      await assert.rejects(
        async () => await Subscription.create({
          userId: user._id,
          type: "author",
          frequency: "invalid"
        }),
        /frequency.*not a valid enum value/
      );

      await User.deleteMany({});
    });

    it("should accept valid frequency values", async () => {
      const user = await User.create({
        email: "test@example.com",
        password: "hashed"
      });

      const frequencies = ["immediate", "daily", "weekly"];

      for (const frequency of frequencies) {
        const subscription = await Subscription.create({
          userId: user._id,
          type: "author",
          frequency
        });

        assert.strictEqual(subscription.frequency, frequency);
        await Subscription.deleteOne({ _id: subscription._id });
      }

      await User.deleteMany({});
    });
  });

  describe("Default Values", () => {
    it("should set default frequency to weekly", async () => {
      const user = await User.create({
        email: "test@example.com",
        password: "hashed"
      });

      const subscription = await Subscription.create({
        userId: user._id,
        type: "author",
        authorName: "John Doe"
      });

      assert.strictEqual(subscription.frequency, "weekly");

      await Subscription.deleteMany({});
      await User.deleteMany({});
    });

    it("should set default enabled to true", async () => {
      const user = await User.create({
        email: "test@example.com",
        password: "hashed"
      });

      const subscription = await Subscription.create({
        userId: user._id,
        type: "author",
        authorName: "John Doe"
      });

      assert.strictEqual(subscription.enabled, true);

      await Subscription.deleteMany({});
      await User.deleteMany({});
    });

    it("should set default newPapersCount to 0", async () => {
      const user = await User.create({
        email: "test@example.com",
        password: "hashed"
      });

      const subscription = await Subscription.create({
        userId: user._id,
        type: "author",
        authorName: "John Doe"
      });

      assert.strictEqual(subscription.newPapersCount, 0);

      await Subscription.deleteMany({});
      await User.deleteMany({});
    });
  });

  describe("Subscription Types", () => {
    it("should store author subscription data", async () => {
      const user = await User.create({
        email: "test@example.com",
        password: "hashed"
      });

      const subscription = await Subscription.create({
        userId: user._id,
        type: "author",
        authorName: "John Doe",
        authorId: "orcid:0000-0001-2345-6789"
      });

      assert.strictEqual(subscription.authorName, "John Doe");
      assert.strictEqual(subscription.authorId, "orcid:0000-0001-2345-6789");

      await Subscription.deleteMany({});
      await User.deleteMany({});
    });

    it("should store venue subscription data", async () => {
      const user = await User.create({
        email: "test@example.com",
        password: "hashed"
      });

      const subscription = await Subscription.create({
        userId: user._id,
        type: "venue",
        venueName: "Nature",
        venueISSN: "0028-0836"
      });

      assert.strictEqual(subscription.venueName, "Nature");
      assert.strictEqual(subscription.venueISSN, "0028-0836");

      await Subscription.deleteMany({});
      await User.deleteMany({});
    });

    it("should store keyword subscription data", async () => {
      const user = await User.create({
        email: "test@example.com",
        password: "hashed"
      });

      const subscription = await Subscription.create({
        userId: user._id,
        type: "keyword",
        keywords: ["machine learning", "deep learning", "AI"]
      });

      assert.ok(Array.isArray(subscription.keywords));
      assert.strictEqual(subscription.keywords.length, 3);
      assert.ok(subscription.keywords.includes("machine learning"));

      await Subscription.deleteMany({});
      await User.deleteMany({});
    });

    it("should store topic subscription data", async () => {
      const user = await User.create({
        email: "test@example.com",
        password: "hashed"
      });

      const subscription = await Subscription.create({
        userId: user._id,
        type: "topic",
        query: "applications of deep learning in healthcare"
      });

      assert.strictEqual(subscription.query, "applications of deep learning in healthcare");

      await Subscription.deleteMany({});
      await User.deleteMany({});
    });
  });

  describe("Timestamps", () => {
    it("should auto-generate createdAt and updatedAt", async () => {
      const user = await User.create({
        email: "test@example.com",
        password: "hashed"
      });

      const subscription = await Subscription.create({
        userId: user._id,
        type: "author",
        authorName: "John Doe"
      });

      assert.ok(subscription.createdAt);
      assert.ok(subscription.updatedAt);
      assert.ok(subscription.createdAt instanceof Date);
      assert.ok(subscription.updatedAt instanceof Date);

      await Subscription.deleteMany({});
      await User.deleteMany({});
    });

    it("should update updatedAt on save", async () => {
      const user = await User.create({
        email: "test@example.com",
        password: "hashed"
      });

      const subscription = await Subscription.create({
        userId: user._id,
        type: "author",
        authorName: "John Doe"
      });

      const originalUpdatedAt = subscription.updatedAt;

      // Wait a bit and update
      await new Promise(resolve => setTimeout(resolve, 10));
      subscription.authorName = "Jane Doe";
      await subscription.save();

      assert.ok(subscription.updatedAt > originalUpdatedAt);

      await Subscription.deleteMany({});
      await User.deleteMany({});
    });
  });

  describe("Indexes", () => {
    it("should have index on userId and type", async () => {
      const indexes = Subscription.schema.indexes();
      const hasUserIdTypeIndex = indexes.some(index => 
        index[0].userId === 1 && index[0].type === 1
      );

      assert.ok(hasUserIdTypeIndex, "Should have compound index on userId and type");
    });

    it("should have index on enabled and lastChecked", async () => {
      const indexes = Subscription.schema.indexes();
      const hasEnabledLastCheckedIndex = indexes.some(index =>
        index[0].enabled === 1 && index[0].lastChecked === 1
      );

      assert.ok(hasEnabledLastCheckedIndex, "Should have compound index on enabled and lastChecked");
    });
  });

  describe("Population", () => {
    it("should populate userId reference", async () => {
      const user = await User.create({
        email: "test@example.com",
        password: "hashed",
        name: "Test User"
      });

      const subscription = await Subscription.create({
        userId: user._id,
        type: "author",
        authorName: "John Doe"
      });

      const populated = await Subscription.findById(subscription._id).populate("userId");

      assert.ok(populated.userId);
      assert.strictEqual(populated.userId.email, "test@example.com");
      assert.strictEqual(populated.userId.name, "Test User");

      await Subscription.deleteMany({});
      await User.deleteMany({});
    });
  });
});

// Made with Bob