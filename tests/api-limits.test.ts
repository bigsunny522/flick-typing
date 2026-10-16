import { describe, expect, it } from "vitest";
import { limitFor, limitKey } from "../src/api/limits";

describe("limitFor", () => {
  it("POST /api/results は write", () => {
    expect(limitFor("POST", "/api/results")).toBe("write");
  });

  it("POST /api/ranking/entry は write", () => {
    expect(limitFor("POST", "/api/ranking/entry")).toBe("write");
  });

  it("PUT /api/name は name", () => {
    expect(limitFor("PUT", "/api/name")).toBe("name");
  });

  it("GET /api/ranking は read", () => {
    expect(limitFor("GET", "/api/ranking")).toBe("read");
  });

  it("GET /api/stats は read", () => {
    expect(limitFor("GET", "/api/stats")).toBe("read");
  });

  it("GET /api/results は数えない", () => {
    expect(limitFor("GET", "/api/results")).toBeNull();
  });

  it("GET /api/ranking/entry は数えない", () => {
    expect(limitFor("GET", "/api/ranking/entry")).toBeNull();
  });

  it("POST /api/ranking は数えない", () => {
    expect(limitFor("POST", "/api/ranking")).toBeNull();
  });

  it("GET /api/unknown は数えない", () => {
    expect(limitFor("GET", "/api/unknown")).toBeNull();
  });

  it("GET / は数えない", () => {
    expect(limitFor("GET", "/")).toBeNull();
  });

  it("GET /stats は数えない", () => {
    expect(limitFor("GET", "/stats")).toBeNull();
  });
});

describe("limitKey", () => {
  it("write は path を含める", () => {
    expect(limitKey("write", "/api/results", "203.0.113.5")).toBe("write:/api/results:203.0.113.5");
  });

  it("write は entry を結果と別に数える", () => {
    expect(limitKey("write", "/api/ranking/entry", "203.0.113.5")).toBe(
      "write:/api/ranking/entry:203.0.113.5",
    );
  });

  it("name は ip だけ", () => {
    expect(limitKey("name", "/api/name", "2001:db8::1")).toBe("name:2001:db8::1");
  });

  it("read は ip だけ", () => {
    expect(limitKey("read", "/api/stats", "203.0.113.5")).toBe("read:203.0.113.5");
  });
});
