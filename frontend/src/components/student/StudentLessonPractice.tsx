import { useState } from "react";
import { QuestionImageView } from "../questions/QuestionImage";
import type { AssignmentAnswerV2, AssignmentAnswersV2 } from "../../types/assignment";
import type { QuestionV2 } from "../../types/question";
import { evaluateAssignmentAnswer, normalizeNumericAnswer } from "../../utils/assignmentQuestion";

export default function StudentLessonPractice({ questions }: { questions: QuestionV2[] }) {
  const [selectedAnswers, setSelectedAnswers] = useState<AssignmentAnswersV2>(
    {},
  );
  const [checkedQuestions, setCheckedQuestions] = useState<
    Record<string, boolean>
  >({});

  const togglePracticeOption = (questionId: string, optionId: string) => {
    setSelectedAnswers((current) => {
      const answer = current[questionId];

      const selectedIds =
        answer?.type === "multiple_choice" ? answer.selectedOptionIds : [];

      return {
        ...current,
        [questionId]: {
          type: "multiple_choice",
          selectedOptionIds: selectedIds.includes(optionId)
            ? selectedIds.filter((id) => id !== optionId)
            : [...selectedIds, optionId],
        },
      };
    });

    setCheckedQuestions((current) => ({
      ...current,
      [questionId]: false,
    }));
  };

  const setPracticeAnswer = (
    questionId: string,
    answer: AssignmentAnswerV2,
  ) => {
    setSelectedAnswers((current) => ({
      ...current,
      [questionId]: answer,
    }));

    setCheckedQuestions((current) => ({
      ...current,
      [questionId]: false,
    }));
  };

  const setPracticeStatementAnswer = (
    questionId: string,
    statementId: string,
    answer: boolean,
  ) => {
    setSelectedAnswers((current) => {
      const existingAnswer = current[questionId];

      const previousAnswers =
        existingAnswer?.type === "true_false_group"
          ? existingAnswer.answersByStatementId
          : {};

      return {
        ...current,
        [questionId]: {
          type: "true_false_group",
          answersByStatementId: {
            ...previousAnswers,
            [statementId]: answer,
          },
        },
      };
    });

    setCheckedQuestions((current) => ({
      ...current,
      [questionId]: false,
    }));
  };

  if (questions.length === 0) return null;
  return (
    <section className="border-t border-line pt-6">
      <h3 className="font-extrabold text-ink">Luyện tập</h3>

      <div className="mt-4 space-y-6">
        {questions.map((question, index) => {
          if (question.type === "short_answer") {
            const answer = selectedAnswers[question.id];
            const value = answer?.type === "short_answer" ? answer.value : "";
            const valid = normalizeNumericAnswer(value) !== null;
            const checked = checkedQuestions[question.id];
            const result = evaluateAssignmentAnswer(question, answer);
            return <div key={question.id} className="min-w-0 space-y-3 rounded-xl border border-line p-4">
              <p className="whitespace-pre-wrap font-bold text-ink">Câu {index + 1}. {question.content}</p>
              <QuestionImageView image={question.image} />
              <label className="block text-sm font-bold">Câu trả lời của bạn
                <input type="text" inputMode="text" autoComplete="off" spellCheck={false} aria-label={`Đáp án luyện tập câu ${index + 1}`} aria-describedby={`practice-number-${question.id}`} aria-invalid={!!value.trim() && !valid} value={value} onChange={(event) => setPracticeAnswer(question.id, { type: "short_answer", value: event.target.value })} placeholder="Nhập số, ví dụ -12,5" className="mt-2 block min-h-12 w-full rounded-xl border border-line px-3 font-normal sm:max-w-sm" />
              </label>
              <p id={`practice-number-${question.id}`} className="text-sm leading-6 text-secondary">Chỉ nhập số, có thể dùng dấu âm và dấu phẩy hoặc chấm thập phân. Không kèm đơn vị hay dấu tách hàng nghìn.</p>
              {!!value.trim() && !valid && <p role="alert" className="text-sm text-red-700">Vui lòng nhập số hợp lệ, ví dụ 125 hoặc -12,5.</p>}
              <button type="button" disabled={!valid} onClick={() => setCheckedQuestions((current) => ({ ...current, [question.id]: true }))} className="min-h-11 rounded-full bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-40">Kiểm tra</button>
              {checked && <div className={`space-y-1 rounded-xl p-3 text-sm ${result === "correct" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}><p className="font-bold">{result === "correct" ? "Chính xác!" : "Chưa chính xác."}</p><p>Đáp án: {question.correctAnswer}</p>{question.explanation && <p className="whitespace-pre-wrap">Giải thích: {question.explanation}</p>}</div>}
            </div>;
          }
          if (question.type === "multiple_choice") {
            const answer = selectedAnswers[question.id];

            const selectedIds =
              answer?.type === "multiple_choice"
                ? answer.selectedOptionIds
                : [];

            const checked = checkedQuestions[question.id];

            const result = evaluateAssignmentAnswer(
              question,
              answer,
            );

            return (
              <div
                key={question.id}
                className="rounded-xl border border-line p-4"
              >
                <p className="whitespace-pre-wrap font-bold text-ink">
                  Câu {index + 1}. {question.content}
                </p>
                <QuestionImageView image={question.image} />

                <p className="mt-2 text-xs text-secondary">
                  Chọn các đáp án bạn cho là đúng.
                </p>

                <div className="mt-3 space-y-2">
                  {question.options.map((option, optionIndex) => {
                    const label = String.fromCharCode(
                      65 + optionIndex,
                    );

                    const isCorrectOption =
                      question.correctOptionIds.includes(
                        option.id,
                      );

                    return (
                      <label
                        key={option.id}
                        className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm ${checked && isCorrectOption
                            ? "border-emerald bg-emerald/5 text-emerald-700"
                            : "border-line text-secondary"
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(
                            option.id,
                          )}
                          onChange={() =>
                            togglePracticeOption(
                              question.id,
                              option.id,
                            )
                          }
                          className="mt-1 shrink-0 accent-emerald"
                        />

                        <span className="whitespace-pre-wrap">
                          {label}. {option.text}
                        </span>
                      </label>
                    );
                  })}
                </div>

                <button
                  type="button"
                  disabled={selectedIds.length === 0}
                  onClick={() =>
                    setCheckedQuestions((current) => ({
                      ...current,
                      [question.id]: true,
                    }))
                  }
                  className="mt-4 rounded-full bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  Kiểm tra đáp án
                </button>

                {checked && (
                  <div
                    aria-live="polite"
                    className="mt-3 text-sm text-secondary"
                  >
                    <p>
                      {result === "correct"
                        ? "Chính xác!"
                        : "Chưa đúng. Các phương án đúng được tô xanh."}
                    </p>

                    {question.explanation && (
                      <p className="mt-1 whitespace-pre-wrap">
                        Giải thích: {question.explanation}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          }
          if (
            question.type === "true_false" ||
            question.type === "true_false_group"
          ) {
            const answer = selectedAnswers[question.id];
            const checked = checkedQuestions[question.id];

            const result = evaluateAssignmentAnswer(
              question,
              answer,
            );

            const canCheck =
              result === "correct" || result === "incorrect";

            return (
              <div
                key={question.id}
                className="rounded-xl border border-line p-4"
              >
                <p className="whitespace-pre-wrap font-bold text-ink">
                  Câu {index + 1}. {question.content}
                </p>
                <QuestionImageView image={question.image} />

                {question.type === "true_false" ? (
                  <div className="mt-3 flex flex-wrap gap-5">
                    {[true, false].map((value) => (
                      <label
                        key={String(value)}
                        className="flex cursor-pointer items-center gap-2 text-sm text-secondary"
                      >
                        <input
                          type="radio"
                          name={`practice-${question.id}`}
                          checked={
                            answer?.type === "true_false" &&
                            answer.answer === value
                          }
                          onChange={() =>
                            setPracticeAnswer(question.id, {
                              type: "true_false",
                              answer: value,
                            })
                          }
                          className="accent-emerald"
                        />

                        <span>{value ? "Đúng" : "Sai"}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {question.statements.map(
                      (statement, statementIndex) => {
                        const selected =
                          answer?.type === "true_false_group"
                            ? answer.answersByStatementId[
                            statement.id
                            ]
                            : undefined;

                        const isCorrect =
                          selected === statement.correctAnswer;

                        return (
                          <div
                            key={statement.id}
                            className="rounded-lg border border-line p-3"
                          >
                            <p className="whitespace-pre-wrap text-sm leading-6 text-ink">
                              <strong>
                                Ý {statementIndex + 1}.{" "}
                              </strong>
                              {statement.content}
                            </p>

                            <div className="mt-2 flex flex-wrap gap-5">
                              {[true, false].map((value) => (
                                <label
                                  key={String(value)}
                                  className="flex cursor-pointer items-center gap-2 text-sm text-secondary"
                                >
                                  <input
                                    type="radio"
                                    name={`practice-${question.id}-${statement.id}`}
                                    checked={selected === value}
                                    onChange={() =>
                                      setPracticeStatementAnswer(
                                        question.id,
                                        statement.id,
                                        value,
                                      )
                                    }
                                    className="accent-emerald"
                                  />

                                  <span>
                                    {value ? "Đúng" : "Sai"}
                                  </span>
                                </label>
                              ))}
                            </div>

                            {checked && (
                              <p
                                className={`mt-2 text-sm ${isCorrect
                                    ? "text-emerald-700"
                                    : "text-red-600"
                                  }`}
                              >
                                {isCorrect
                                  ? "Chính xác."
                                  : `Chưa đúng. Cần chọn ${statement.correctAnswer
                                    ? "Đúng"
                                    : "Sai"
                                  }.`}
                              </p>
                            )}
                          </div>
                        );
                      },
                    )}
                  </div>
                )}

                <button
                  type="button"
                  disabled={!canCheck}
                  onClick={() =>
                    setCheckedQuestions((current) => ({
                      ...current,
                      [question.id]: true,
                    }))
                  }
                  className="mt-4 rounded-full bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  Kiểm tra đáp án
                </button>

                {checked && (
                  <div
                    aria-live="polite"
                    className="mt-3 text-sm text-secondary"
                  >
                    <p>
                      {result === "correct"
                        ? "Chính xác!"
                        : question.type === "true_false"
                          ? `Chưa đúng. Cần chọn ${question.correctAnswer
                            ? "Đúng"
                            : "Sai"
                          }.`
                          : "Chưa đúng toàn bộ. Xem phản hồi ở từng ý."}
                    </p>

                    {question.explanation && (
                      <p className="mt-1 whitespace-pre-wrap">
                        Giải thích: {question.explanation}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          }

          const answer = selectedAnswers[question.id];

          const selected =
            answer?.type === "single_choice"
              ? answer.selectedOptionId
              : undefined;

          const checked = checkedQuestions[question.id];

          const result = evaluateAssignmentAnswer(
            question,
            answer,
          );

          const correctOptionIndex = question.options.findIndex(
            (option) => option.id === question.correctOptionId,
          );

          const correctOption =
            question.options[correctOptionIndex];

          const correctOptionLabel =
            correctOptionIndex >= 0
              ? String.fromCharCode(65 + correctOptionIndex)
              : "";

          return (
            <div
              key={question.id}
              className="rounded-xl border border-line p-4"
            >
              <p className="font-bold text-ink">
                Câu {index + 1}. {question.content}
              </p>
              <QuestionImageView image={question.image} />

              <div className="mt-3 space-y-2">
                {question.options.map((option, optionIndex) => {
                  const label = String.fromCharCode(
                    65 + optionIndex,
                  );

                  return (
                    <label
                      key={option.id}
                      className="flex cursor-pointer items-start gap-2 text-sm text-secondary"
                    >
                      <input
                        type="radio"
                        name={`practice-${question.id}`}
                        checked={selected === option.id}
                        onChange={() => {
                          setSelectedAnswers((current) => ({
                            ...current,
                            [question.id]: {
                              type: "single_choice",
                              selectedOptionId: option.id,
                            },
                          }));

                          setCheckedQuestions((current) => ({
                            ...current,
                            [question.id]: false,
                          }));
                        }}
                        className="mt-1 accent-emerald"
                      />

                      <span className="whitespace-pre-wrap">
                        {label}. {option.text}
                      </span>
                    </label>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={!selected}
                onClick={() =>
                  setCheckedQuestions((current) => ({
                    ...current,
                    [question.id]: true,
                  }))
                }
                className="mt-4 rounded-full bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                Kiểm tra đáp án
              </button>

              {checked && (
                <p
                  aria-live="polite"
                  className="mt-3 text-sm text-secondary"
                >
                  {result === "correct"
                    ? "Chính xác!"
                    : correctOption
                      ? `Chưa đúng. Đáp án đúng là ${correctOptionLabel}. ${correctOption.text}`
                      : "Không tìm thấy đáp án đúng của câu hỏi."}
                  {question.explanation && (
                    <span className="mt-1 block">
                      Giải thích: {question.explanation}
                    </span>
                  )}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
