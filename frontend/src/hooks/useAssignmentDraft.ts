import { useEffect, useState } from "react";
import type { AssignmentV2, AssignmentAnswersV2 } from "../types/assignment";
import {
  assignmentAnswerDraftKey, loadAssignmentAnswerDraft, saveAssignmentAnswerDraft,
  type AssignmentAnswerDraftRead,
} from "../utils/assignmentQuestion";

type DraftOptions = {
  assignment: AssignmentV2 | undefined;
  studentId: string;
  canRead: boolean;
  canSave: boolean;
  hasSubmission: boolean;
  submissionStorageStatus: "saving" | "saved" | "error";
};

export function useAssignmentDraft({ assignment, studentId, canRead, canSave, hasSubmission, submissionStorageStatus }: DraftOptions) {
  const [draftInfo, setDraftInfo] = useState<AssignmentAnswerDraftRead>(() =>
    assignment?.status === "published" && studentId && !hasSubmission && canRead
      ? loadAssignmentAnswerDraft(assignment, studentId)
      : { answers: {}, status: "empty" },
  );
  const [answers, setAnswers] = useState<AssignmentAnswersV2>(() => draftInfo.answers);
  const [draftSaveStatus, setDraftSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [draftSaveAttempt, setDraftSaveAttempt] = useState(0);

  useEffect(() => {
    if (!assignment || !studentId || !canSave || assignment.status !== "published" ||
      hasSubmission || draftInfo.status === "error" || answers === draftInfo.answers) return;
    try {
      saveAssignmentAnswerDraft(assignment, studentId, answers);
      setDraftSaveStatus("saved");
    } catch {
      setDraftSaveStatus("error");
    }
  }, [assignment, studentId, canSave, hasSubmission, answers, draftInfo, draftSaveAttempt]);

  useEffect(() => {
    if (!assignment?.id || !studentId || !hasSubmission || submissionStorageStatus !== "saved") return;
    try {
      window.localStorage.removeItem(assignmentAnswerDraftKey(assignment.id, studentId));
    } catch {
      // A saved submission takes precedence over a leftover answer draft.
    }
  }, [assignment?.id, studentId, hasSubmission, submissionStorageStatus]);

  const retryRead = () => {
    if (!assignment) return;
    const restored = loadAssignmentAnswerDraft(assignment, studentId);
    setDraftInfo(restored);
    setAnswers(restored.answers);
  };
  const resetDraft = () => {
    if (!assignment) return false;
    try {
      window.localStorage.removeItem(assignmentAnswerDraftKey(assignment.id, studentId));
      const empty: AssignmentAnswerDraftRead = { answers: {}, status: "empty" };
      setDraftInfo(empty);
      setAnswers(empty.answers);
      setDraftSaveStatus("idle");
      return true;
    } catch {
      return false;
    }
  };

  return {
    draftInfo, answers, setAnswers, draftSaveStatus, retryRead, resetDraft,
    retrySave: () => setDraftSaveAttempt((value) => value + 1),
  };
}
