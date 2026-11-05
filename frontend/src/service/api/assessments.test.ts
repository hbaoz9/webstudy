import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAssessment, createRevision, getRevision, publishRevision, saveDraft } from "./assessments";
import { apiGet, apiRequest } from "./client";

vi.mock("./client", () => ({ apiGet: vi.fn(), apiRequest: vi.fn() }));

describe("teacher assessment client", () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it("creates an assessment and resolves its server draft", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { id: "a" } });
    await expect(createAssessment("A", "Read")).resolves.toEqual({ id: "a" });
    expect(apiRequest).toHaveBeenCalledWith("/teacher/assessments", "POST", { title: "A", instructions: "Read" });
  });

  it("sends the complete ordered draft with source version and decimal points", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { id: "r" } });
    const questions = [{ sourceQuestionId: "q", sourceQuestionVersion: 2, maxPoints: "0.750001" }];
    await saveDraft("r", 3, "Exam", "Instructions", questions);
    expect(apiRequest).toHaveBeenCalledWith("/teacher/revisions/r/draft", "PUT", {
      expectedVersion: 3, title: "Exam", instructions: "Instructions", questions,
    });
  });

  it("uses a publish idempotency key and reads revisions from the backend", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { id: "r" } });
    vi.mocked(apiGet).mockResolvedValue({ data: { id: "r", status: "published" } });
    await publishRevision("r", 4, "stable-key");
    await expect(getRevision("r")).resolves.toMatchObject({ status: "published" });
    expect(apiRequest).toHaveBeenCalledWith("/teacher/revisions/r/publish", "POST", { expectedVersion: 4 }, 10000, { "Idempotency-Key": "stable-key" });
    expect(apiGet).toHaveBeenCalledWith("/teacher/revisions/r");
  });

  it("clones only the selected published snapshot", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { id: "new" } });
    await createRevision("assessment", "published");
    expect(apiRequest).toHaveBeenCalledWith("/teacher/assessments/assessment/revisions", "POST", { basedOnRevisionId: "published" });
  });
});
