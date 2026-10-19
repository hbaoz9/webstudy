import { QuestionImageView } from "../questions/QuestionImage";
import type { AssignmentAnswerV2, AssignmentQuestionV2 } from "../../types/assignment";
import { describeAssignmentCorrectAnswer, evaluateAssignmentAnswer, normalizeNumericAnswer } from "../../utils/assignmentQuestion";

type AssignmentWorkQuestionProps = {
  question: AssignmentQuestionV2;
  index: number;
  currentAnswer: AssignmentAnswerV2 | undefined;
  isDisabled: boolean;
  canReviewAnswers: boolean;
  setQuestionAnswer: (questionId: string, answer: AssignmentAnswerV2) => void;
  toggleMultipleChoiceAnswer: (questionId: string, optionId: string) => void;
  setStatementAnswer: (questionId: string, statementId: string, answer: boolean) => void;
};

export default function AssignmentWorkQuestion({
  question, index, currentAnswer, isDisabled, canReviewAnswers,
  setQuestionAnswer, toggleMultipleChoiceAnswer, setStatementAnswer,
}: AssignmentWorkQuestionProps) {
  return (
    <article className="min-w-0 break-words rounded-2xl border border-line bg-white p-5 shadow-card">

      <p className="whitespace-pre-wrap font-bold leading-7 text-ink">
        Câu {index + 1}. {question.content}
      </p>
      <QuestionImageView image={question.image} />
      <fieldset disabled={isDisabled} className="min-w-0">
        <legend className="sr-only">Câu {index + 1}</legend>

        {question.type === "single_choice" ||
          question.type === "multiple_choice" ? (
          <>
            <p className="mt-2 text-xs text-secondary">
              {question.type === "single_choice"
                ? "Chọn một đáp án."
                : "Chọn các đáp án bạn cho là đúng."}
            </p>

            <div className="mt-4 space-y-2">
              {question.options.map((option, optionIndex) => {
                const label = String.fromCharCode(65 + optionIndex);

                const isChecked =
                  question.type === "single_choice"
                    ? currentAnswer?.type === "single_choice" &&
                    currentAnswer.selectedOptionId === option.id
                    : currentAnswer?.type === "multiple_choice" &&
                    currentAnswer.selectedOptionIds.includes(
                      option.id,
                    );

                return (
                  <label
                    key={option.id}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 text-sm text-ink"
                  >
                    <input
                      type={
                        question.type === "single_choice"
                          ? "radio"
                          : "checkbox"
                      }
                      name={`question-${question.id}`}
                      checked={isChecked}
                      onChange={() => {
                        if (question.type === "single_choice") {
                          setQuestionAnswer(question.id, {
                            type: "single_choice",
                            selectedOptionId: option.id,
                          });
                        } else {
                          toggleMultipleChoiceAnswer(
                            question.id,
                            option.id,
                          );
                        }
                      }}
                      className="mt-1 size-4 shrink-0 accent-emerald"
                    />

                    <span className="min-w-0 break-words whitespace-pre-wrap">
                      <strong className="mr-2">{label}.</strong>
                      {option.text}
                    </span>
                  </label>
                );
              })}
            </div>
          </>
        ) : question.type === "short_answer" ? (
          <div className="mt-4 space-y-2">
            <label className="block text-sm font-bold">Câu trả lời của bạn
              <input type="text" inputMode="text" autoComplete="off" spellCheck={false} aria-label={`Đáp án số câu ${index + 1}`} aria-describedby={`numeric-hint-${question.id}`} aria-invalid={currentAnswer?.type === "short_answer" && !!currentAnswer.value.trim() && normalizeNumericAnswer(currentAnswer.value) === null} value={currentAnswer?.type === "short_answer" ? currentAnswer.value : ""} onChange={(event) => setQuestionAnswer(question.id, { type: "short_answer", value: event.target.value })} placeholder="Nhập số, ví dụ -12,5" className="mt-2 block min-h-12 w-full rounded-xl border border-line px-3 font-normal disabled:bg-slate-50 sm:max-w-sm" />
            </label>
            <p id={`numeric-hint-${question.id}`} className="text-sm leading-6 text-secondary">Chỉ nhập số; có thể dùng dấu âm, dấu phẩy hoặc dấu chấm thập phân. Không kèm đơn vị hay dấu tách hàng nghìn.</p>
            {currentAnswer?.type === "short_answer" && !!currentAnswer.value.trim() && normalizeNumericAnswer(currentAnswer.value) === null && <p role="alert" className="text-sm text-red-700">Giá trị chưa đúng định dạng số, ví dụ 125 hoặc -12,5.</p>}
          </div>
        ) : question.type === "true_false" ? (
          <div className="mt-4 flex flex-wrap gap-4">
            {[true, false].map((value) => (
              <label
                key={String(value)}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm text-ink"
              >
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  checked={
                    currentAnswer?.type === "true_false" &&
                    currentAnswer.answer === value
                  }
                  onChange={() =>
                    setQuestionAnswer(question.id, {
                      type: "true_false",
                      answer: value,
                    })
                  }
                  className="size-4 accent-emerald"
                />

                <span>{value ? "Đúng" : "Sai"}</span>
              </label>
            ))}
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {question.statements.map((statement, statementIndex) => (
              <div
                key={statement.id}
                className="rounded-xl border border-line p-4"
              >
                <p className="whitespace-pre-wrap text-sm leading-6 text-ink">
                  <strong>Ý {statementIndex + 1}. </strong>
                  {statement.content}
                </p>

                <div className="mt-3 flex flex-wrap gap-5">
                  {[true, false].map((value) => (
                    <label
                      key={String(value)}
                      className="flex cursor-pointer items-center gap-2 text-sm text-ink"
                    >
                      <input
                        type="radio"
                        name={`question-${question.id}-statement-${statement.id}`}
                        checked={
                          currentAnswer?.type === "true_false_group" &&
                          currentAnswer.answersByStatementId[
                          statement.id
                          ] === value
                        }
                        onChange={() =>
                          setStatementAnswer(
                            question.id,
                            statement.id,
                            value,
                          )
                        }
                        className="size-4 accent-emerald"
                      />

                      <span>{value ? "Đúng" : "Sai"}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {canReviewAnswers && (
          <div className="mt-4 border-t border-line pt-4 text-sm">
            <p className="font-bold text-ink">Kết quả câu này: {evaluateAssignmentAnswer(question, currentAnswer) === "correct" ? "Chính xác" : "Chưa chính xác"}</p>
            <p className="mt-2 break-words whitespace-pre-wrap text-emerald-700">Đáp án: {describeAssignmentCorrectAnswer(question)}</p>
            {question.explanation && <p className="mt-2 break-words whitespace-pre-wrap text-secondary">Giải thích: {question.explanation}</p>}
          </div>
        )}
      </fieldset>
    </article>
  );
}
