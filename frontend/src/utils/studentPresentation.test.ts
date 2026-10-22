import { describe, expect, it } from "vitest";

import {
  assignmentContentError,
  isImageUrl,
  normalizeAssignmentContent,
} from "./assignmentValidation";

describe("student-facing assignment presentation", () => {
  it("accepts HTTP images and rejects unsafe image protocols", () => {
    expect(isImageUrl("https://example.com/map.png")).toBe(true);
    expect(isImageUrl("javascript:alert(1)")).toBe(false);
  });

  it("validates YouTube media and removes an empty content block", () => {
    expect(assignmentContentError({ text: "", imageUrl: "", videoUrl: "not-a-video" }))
      .toBe("Liên kết video YouTube không hợp lệ.");
    expect(normalizeAssignmentContent({ text: " ", imageUrl: " ", videoUrl: " " }))
      .toBeUndefined();
  });
});
