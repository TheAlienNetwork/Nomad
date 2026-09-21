import { describe, expect, it } from "vitest";
import { assertCredentials, isValidEmail, normalizeEmail } from "../src/auth";

describe("account credentials", () => {
  it("accepts a normal email and strong enough password", () => {
    expect(isValidEmail("Hunter@example.com")).toBe(true);
    expect(normalizeEmail("Hunter@example.com")).toBe("hunter@example.com");
    expect(assertCredentials("hunter@example.com", "fieldready1")).toBeUndefined();
  });

  it("rejects weak or invalid credentials", () => {
    expect(assertCredentials("not-an-email", "fieldready1")).toMatch(/email/i);
    expect(assertCredentials("hunter@example.com", "short1")).toMatch(/10 characters/i);
    expect(assertCredentials("hunter@example.com", "lettersonly")).toMatch(/number/i);
  });
});
