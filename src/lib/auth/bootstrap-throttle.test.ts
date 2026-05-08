import { describe, it, expect, beforeEach } from "vitest";
import { isBootstrapAllowed, recordBootstrap } from "./bootstrap-throttle";

let testIp: string;

describe("bootstrap-throttle", () => {
  beforeEach(() => {
    testIp = `bootstrap-test-${Math.random().toString(36).slice(2)}`;
  });

  it("allows by default", async () => {
    expect(await isBootstrapAllowed(testIp)).toBe(true);
  });

  it("allows up to 10 bootstraps in the hour", async () => {
    for (let i = 0; i < 10; i++) {
      expect(await isBootstrapAllowed(testIp)).toBe(true);
      await recordBootstrap(testIp);
    }
    expect(await isBootstrapAllowed(testIp)).toBe(false);
  });

  it("isolates buckets per IP", async () => {
    const ipA = `${testIp}-A`;
    const ipB = `${testIp}-B`;
    for (let i = 0; i < 10; i++) await recordBootstrap(ipA);
    expect(await isBootstrapAllowed(ipA)).toBe(false);
    expect(await isBootstrapAllowed(ipB)).toBe(true);
  });
});
