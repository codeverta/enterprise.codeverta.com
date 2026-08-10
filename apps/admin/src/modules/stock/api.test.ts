import { describe, expect, it } from "vitest";
import { deliveryNotePayload } from "./api";

describe("deliveryNotePayload", () => {
  it("serializes an HTML date value as RFC3339 for the Go backend", () => {
    const payload = deliveryNotePayload({ posting_date: "2026-08-07" } as any);
    expect(payload.posting_date).toBe("2026-08-07T00:00:00Z");
  });
});
