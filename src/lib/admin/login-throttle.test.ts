import { describe, it, expect, beforeEach } from "vitest";
import {
  isThrottled,
  recordLoginFailure,
  recordLoginSuccess,
} from "./login-throttle";

let testIp: string;

describe("login-throttle", () => {
  beforeEach(() => {
    // Each test uses a fresh IP so buckets don't leak between tests
    testIp = `test-${Math.random().toString(36).slice(2)}`;
  });

  it("not throttled by default", async () => {
    expect(await isThrottled(testIp)).toBe(false);
  });

  it("throttles after 5 failures", async () => {
    for (let i = 0; i < 4; i++) {
      await recordLoginFailure(testIp);
      expect(await isThrottled(testIp)).toBe(false);
    }
    await recordLoginFailure(testIp);
    expect(await isThrottled(testIp)).toBe(true);
  });

  it("recordLoginSuccess clears the bucket", async () => {
    for (let i = 0; i < 5; i++) await recordLoginFailure(testIp);
    expect(await isThrottled(testIp)).toBe(true);
    await recordLoginSuccess(testIp);
    expect(await isThrottled(testIp)).toBe(false);
  });

  it("isolates buckets per IP", async () => {
    const ipA = `${testIp}-A`;
    const ipB = `${testIp}-B`;

    for (let i = 0; i < 5; i++) await recordLoginFailure(ipA);
    expect(await isThrottled(ipA)).toBe(true);
    expect(await isThrottled(ipB)).toBe(false);
  });

  it("does not throttle while under threshold across consecutive calls", async () => {
    for (let i = 0; i < 4; i++) {
      await recordLoginFailure(testIp);
    }
    expect(await isThrottled(testIp)).toBe(false);
  });
});
