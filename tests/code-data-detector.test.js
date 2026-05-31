import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { 
  detectCodeAvailability, 
  detectDataAvailability, 
  detectDatasets,
  enrichWithCodeData 
} from "../server/services/search/codeDataDetector.js";

describe("Code/Data Detector", () => {
  describe("detectCodeAvailability", () => {
    it("should detect GitHub URLs", () => {
      const text = "Code available at https://github.com/user/repo";
      const result = detectCodeAvailability(text);

      assert.strictEqual(result.available, true);
      assert.ok(result.urls.includes("github.com/user/repo"));
    });

    it("should detect GitLab URLs", () => {
      const text = "See gitlab.com/user/project for implementation";
      const result = detectCodeAvailability(text);

      assert.strictEqual(result.available, true);
      assert.ok(result.urls.some(url => url.includes("gitlab.com")));
    });

    it("should detect Bitbucket URLs", () => {
      const text = "Code at bitbucket.org/user/repo";
      const result = detectCodeAvailability(text);

      assert.strictEqual(result.available, true);
      assert.ok(result.urls.some(url => url.includes("bitbucket.org")));
    });

    it("should detect 'code available' phrase", () => {
      const text = "The source code is available upon request";
      const result = detectCodeAvailability(text);

      assert.strictEqual(result.available, true);
    });

    it("should detect 'implementation available' phrase", () => {
      const text = "Implementation available in supplementary materials";
      const result = detectCodeAvailability(text);

      assert.strictEqual(result.available, true);
    });

    it("should return false for text without code", () => {
      const text = "This paper presents a novel algorithm";
      const result = detectCodeAvailability(text);

      assert.strictEqual(result.available, false);
      assert.strictEqual(result.urls.length, 0);
    });

    it("should handle null/empty text", () => {
      const result1 = detectCodeAvailability(null);
      const result2 = detectCodeAvailability("");

      assert.strictEqual(result1.available, false);
      assert.strictEqual(result2.available, false);
    });

    it("should deduplicate URLs", () => {
      const text = "Code at github.com/user/repo and also github.com/user/repo";
      const result = detectCodeAvailability(text);

      assert.strictEqual(result.urls.length, 1);
    });

    it("should detect multiple different URLs", () => {
      const text = "Code at github.com/user/repo1 and github.com/user/repo2";
      const result = detectCodeAvailability(text);

      assert.strictEqual(result.available, true);
      assert.strictEqual(result.urls.length, 2);
    });
  });

  describe("detectDataAvailability", () => {
    it("should detect Zenodo URLs", () => {
      const text = "Data available at zenodo.org/record/12345";
      const result = detectDataAvailability(text);

      assert.strictEqual(result.available, true);
      assert.ok(result.urls.some(url => url.includes("zenodo.org")));
    });

    it("should detect Figshare URLs", () => {
      const text = "See figshare.com/articles/dataset/12345";
      const result = detectDataAvailability(text);

      assert.strictEqual(result.available, true);
      assert.ok(result.urls.some(url => url.includes("figshare.com")));
    });

    it("should detect OSF URLs", () => {
      const text = "Data at osf.io/abc123";
      const result = detectDataAvailability(text);

      assert.strictEqual(result.available, true);
      assert.ok(result.urls.some(url => url.includes("osf.io")));
    });

    it("should detect 'data available' phrase", () => {
      const text = "All data available upon reasonable request";
      const result = detectDataAvailability(text);

      assert.strictEqual(result.available, true);
    });

    it("should detect 'dataset available' phrase", () => {
      const text = "The dataset is available in supplementary materials";
      const result = detectDataAvailability(text);

      assert.strictEqual(result.available, true);
    });

    it("should detect 'supplementary data' phrase", () => {
      const text = "See supplementary data for details";
      const result = detectDataAvailability(text);

      assert.strictEqual(result.available, true);
    });

    it("should return false for text without data", () => {
      const text = "This paper presents results";
      const result = detectDataAvailability(text);

      assert.strictEqual(result.available, false);
      assert.strictEqual(result.urls.length, 0);
    });

    it("should handle null/empty text", () => {
      const result1 = detectDataAvailability(null);
      const result2 = detectDataAvailability("");

      assert.strictEqual(result1.available, false);
      assert.strictEqual(result2.available, false);
    });
  });

  describe("detectDatasets", () => {
    it("should detect ImageNet", () => {
      const text = "We trained our model on ImageNet dataset";
      const result = detectDatasets(text);

      assert.ok(result.some(d => d.name === "ImageNet"));
    });

    it("should detect COCO", () => {
      const text = "Evaluated on COCO benchmark";
      const result = detectDatasets(text);

      assert.ok(result.some(d => d.name === "COCO"));
    });

    it("should detect MNIST", () => {
      const text = "Tested on MNIST digits";
      const result = detectDatasets(text);

      assert.ok(result.some(d => d.name === "MNIST"));
    });

    it("should detect medical datasets", () => {
      const text = "Analysis using MIMIC-III database";
      const result = detectDatasets(text);

      assert.ok(result.some(d => d.name === "MIMIC-III"));
    });

    it("should detect genomics datasets", () => {
      const text = "Data from 1000 Genomes Project";
      const result = detectDatasets(text);

      assert.ok(result.some(d => d.name === "1000 Genomes"));
    });

    it("should detect NLP datasets", () => {
      const text = "Evaluated on GLUE and SQuAD benchmarks";
      const result = detectDatasets(text);

      assert.ok(result.some(d => d.name === "GLUE"));
      assert.ok(result.some(d => d.name === "SQuAD"));
    });

    it("should return empty array for text without datasets", () => {
      const text = "This paper presents a novel approach";
      const result = detectDatasets(text);

      assert.strictEqual(result.length, 0);
    });

    it("should handle null/empty text", () => {
      const result1 = detectDatasets(null);
      const result2 = detectDatasets("");

      assert.strictEqual(result1.length, 0);
      assert.strictEqual(result2.length, 0);
    });

    it("should be case-insensitive", () => {
      const text = "Trained on imagenet and MNIST";
      const result = detectDatasets(text);

      assert.ok(result.some(d => d.name === "ImageNet"));
      assert.ok(result.some(d => d.name === "MNIST"));
    });

    it("should include description for detected datasets", () => {
      const text = "Using ImageNet dataset";
      const result = detectDatasets(text);

      assert.ok(result[0].description);
      assert.strictEqual(result[0].description, "Mentioned in paper");
    });
  });

  describe("enrichWithCodeData", () => {
    it("should enrich paper with all detection results", () => {
      const paper = {
        title: "Deep Learning on ImageNet",
        abstract: "We trained on ImageNet. Code available at github.com/user/repo. Data at zenodo.org/record/123.",
        text: ""
      };

      const enrichment = enrichWithCodeData(paper);

      assert.strictEqual(enrichment.codeAvailable, true);
      assert.ok(enrichment.codeUrls.length > 0);
      assert.strictEqual(enrichment.dataAvailable, true);
      assert.ok(enrichment.dataUrls.length > 0);
      assert.ok(enrichment.datasets.length > 0);
      assert.ok(enrichment.datasets.some(d => d.name === "ImageNet"));
    });

    it("should handle papers without code/data", () => {
      const paper = {
        title: "Theoretical Analysis",
        abstract: "This paper presents a theoretical framework",
        text: ""
      };

      const enrichment = enrichWithCodeData(paper);

      assert.strictEqual(enrichment.codeAvailable, false);
      assert.strictEqual(enrichment.dataAvailable, false);
      assert.strictEqual(enrichment.datasets.length, 0);
    });

    it("should combine title, abstract, and text", () => {
      const paper = {
        title: "Using ImageNet",
        abstract: "Code at github.com/user/repo",
        text: "Data at zenodo.org/record/123"
      };

      const enrichment = enrichWithCodeData(paper);

      assert.strictEqual(enrichment.codeAvailable, true);
      assert.strictEqual(enrichment.dataAvailable, true);
      assert.ok(enrichment.datasets.some(d => d.name === "ImageNet"));
    });

    it("should handle missing text field", () => {
      const paper = {
        title: "Test",
        abstract: "Code available"
      };

      const enrichment = enrichWithCodeData(paper);

      assert.strictEqual(enrichment.codeAvailable, true);
    });
  });
});

// Made with Bob