import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/server/passwords";

describe("password hashing", () => {
  it("verifies a matching password and rejects a wrong one", () => {
    const { salt, hash } = hashPassword("fieldready1");
    expect(verifyPassword("fieldready1", salt, hash)).toBe(true);
    expect(verifyPassword("wrong-password1", salt, hash)).toBe(false);
  });
});
