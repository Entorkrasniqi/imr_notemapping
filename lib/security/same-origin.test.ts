import { describe, expect, it } from "vitest";
import { isSameOrigin } from "./same-origin";

const post = (origin?: string) =>
  new Request("https://notemap.example/api/stripe/checkout", {
    method: "POST",
    headers: origin ? { origin } : {},
  });

describe("isSameOrigin", () => {
  it("accepts our own pages", () => {
    expect(isSameOrigin(post("https://notemap.example"))).toBe(true);
  });

  it("refuses other sites, look-alike hosts, and missing origins", () => {
    expect(isSameOrigin(post("https://evil.example"))).toBe(false);
    expect(isSameOrigin(post("https://notemap.example.evil.example"))).toBe(false);
    expect(isSameOrigin(post("http://notemap.example"))).toBe(false);
    expect(isSameOrigin(post())).toBe(false);
  });
});
