import { questionTypeLabels } from "../../types/question";
import { toQuestionInput, validateQuestionInput } from "../../utils/questionForm";
import { useState, useEffect, useRef, type FormEvent } from "react";
import { QuestionImageEditor, questionImageError } from "../../components/questions/QuestionImage";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { useTeacherQuestions } from "../../contexts/TeacherQuestionsContext";

import type {
  QuestionDifficulty,
  QuestionInputV2,
} from "../../types/question";

import {
  geo10Chapters,
  geo10Lessons,
  getLessonsByChapter,
} from "../../data/geo10Curriculum";

type SingleChoiceQuestionInput = Extract<
  QuestionInputV2,
  { type: "single_choice" }
>;

type TrueFalseQuestionInput = Extract<QuestionInputV2, { type: "true_false" }>;

type MultipleChoiceQuestionInput = Extract<
  QuestionInputV2,
  { type: "multiple_choice" }
>;

type QuestionFormInput =
  | SingleChoiceQuestionInput
  | TrueFalseQuestionInput
  | MultipleChoiceQuestionInput
  | TrueFalseGroupQuestionInput
  | Extract<QuestionInputV2, { type: "short_answer" }>;
type QuestionFormType = QuestionFormInput["type"];

type TrueFalseGroupQuestionInput = Extract<
  QuestionInputV2,
  { type: "true_false_group" }
>;

function createInitialQuestion(
  type: QuestionFormType = "single_choice",
): QuestionFormInput {
  const commonFields = {
    chapter: "",
    difficulty: "recognition" as const,
    content: "",
    explanation: "",
    lessonId: "",
    showInLesson: false,
  };

  if (type === "short_answer") return { ...commonFields, type, correctAnswer: "" };

  if (type === "true_false") {
    return {
      ...commonFields,
      type: "true_false",
      correctAnswer: true,
    };
  }

  if (type === "true_false_group") {
    return {
      ...commonFields,
      type: "true_false_group",
      statements: [
        {
          id: window.crypto.randomUUID(),
          content: "",
          correctAnswer: true,
        },
        {
          id: window.crypto.randomUUID(),
          content: "",
          correctAnswer: true,
        },
      ],
    };
  }

  const options = Array.from({ length: 4 }, () => ({ id: window.crypto.randomUUID(), text: "" }));
  if (type === "multiple_choice") {
    return { ...commonFields, type, options, correctOptionIds: [] };
  }
  return { ...commonFields, type: "single_choice", options, correctOptionId: "" };
}

export default function TeacherCreateQuestionPage() {
  const navigate = useNavigate();
  const { questionId } = useParams();
  const [params] = useSearchParams();
  const requestedReturn = params.get("return");
  const backTo = requestedReturn === "/teacher/questions" || requestedReturn?.startsWith("/teacher/questions?") ? requestedReturn : "/teacher/questions";

  const { questions, addQuestion, updateQuestion } = useTeacherQuestions();

  const savedQuestion = questionId
    ? questions.find((item) => item.id === questionId)
    : undefined;

  const [question, setQuestion] = useState<QuestionFormInput>(() => {
    if (savedQuestion) {
      return toQuestionInput(savedQuestion) ?? createInitialQuestion();
    }

    return createInitialQuestion();
  });

  const [imageProcessing, setImageProcessing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formSequence, setFormSequence] = useState(0);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setNotice("");
    if (savedQuestion) {
      const input = toQuestionInput(savedQuestion);

      if (input) {
        setQuestion(input);
      }

      setError("");
      return;
    }

    setQuestion(createInitialQuestion());
    setError("");
    setNotice("");
  }, [questionId, savedQuestion]);

  const changeQuestionType = (nextType: QuestionFormType) => {
    if (questionId) return;

    setQuestion((current) => {
      if (current.type === nextType) {
        return current;
      }

      const nextQuestion = createInitialQuestion(nextType);

      return {
        ...nextQuestion,
        chapter: current.chapter,
        difficulty: current.difficulty,
        content: current.content,
        image: current.image,
        explanation: current.explanation,
        lessonId: current.lessonId,
        showInLesson: current.showInLesson,
      };
    });

    setError("");
  };

  const updateOption = (optionId: string, text: string) => {
    setQuestion((current) => {
      if (
        current.type !== "single_choice" &&
        current.type !== "multiple_choice"
      ) {
        return current;
      }

      return {
        ...current,
        options: current.options.map((option) =>
          option.id === optionId
            ? {
              ...option,
              text,
            }
            : option,
        ),
      };
    });
  };

  const addOption = () => {
    setQuestion((current) => {
      if (
        current.type !== "single_choice" &&
        current.type !== "multiple_choice"
      ) {
        return current;
      }

      return {
        ...current,
        options: [
          ...current.options,
          {
            id: window.crypto.randomUUID(),
            text: "",
          },
        ],
      };
    });
  };

  const removeOption = (optionId: string) => {
    setQuestion((current) => {
      if (
        current.type !== "single_choice" &&
        current.type !== "multiple_choice"
      ) {
        return current;
      }

      if (current.options.length <= 2) {
        return current;
      }

      const nextOptions = current.options.filter(
        (option) => option.id !== optionId,
      );

      if (current.type === "multiple_choice") {
        return {
          ...current,
          options: nextOptions,
          correctOptionIds: current.correctOptionIds.filter(
            (id) => id !== optionId,
          ),
        };
      }

      return {
        ...current,
        options: nextOptions,
        correctOptionId:
          current.correctOptionId === optionId
            ? ""
            : current.correctOptionId,
      };
    });
  };

  const toggleCorrectOption = (optionId: string) => {
    setQuestion((current) => {
      if (current.type !== "multiple_choice") {
        return current;
      }

      const isSelected = current.correctOptionIds.includes(optionId);

      return {
        ...current,
        correctOptionIds: isSelected
          ? current.correctOptionIds.filter((id) => id !== optionId)
          : [...current.correctOptionIds, optionId],
      };
    });
  };

  const updateStatementContent = (statementId: string, content: string) => {
    setQuestion((current) => {
      if (current.type !== "true_false_group") {
        return current;
      }

      return {
        ...current,
        statements: current.statements.map((statement) =>
          statement.id === statementId ? { ...statement, content } : statement,
        ),
      };
    });
  };

  const updateStatementAnswer = (
    statementId: string,
    correctAnswer: boolean,
  ) => {
    setQuestion((current) => {
      if (current.type !== "true_false_group") {
        return current;
      }

      return {
        ...current,
        statements: current.statements.map((statement) =>
          statement.id === statementId
            ? { ...statement, correctAnswer }
            : statement,
        ),
      };
    });
  };

  const addStatement = () => {
    setQuestion((current) => {
      if (current.type !== "true_false_group") {
        return current;
      }

      return {
        ...current,
        statements: [
          ...current.statements,
          {
            id: window.crypto.randomUUID(),
            content: "",
            correctAnswer: true,
          },
        ],
      };
    });
  };

  const removeStatement = (statementId: string) => {
    setQuestion((current) => {
      if (
        current.type !== "true_false_group" ||
        current.statements.length <= 2
      ) {
        return current;
      }

      return {
        ...current,
        statements: current.statements.filter(
          (statement) => statement.id !== statementId,
        ),
      };
    });
  };

  function persistQuestion(input: QuestionFormInput, continueAdding: boolean) {
    if (questionId) {
      updateQuestion(questionId, input);
      navigate(backTo);
      return;
    }
    const id = addQuestion(input);
    if (!id) {
      setError("Chưa lưu được câu hỏi mới. Nội dung vẫn được giữ trong form; hãy giảm dung lượng ảnh hoặc giải phóng bộ nhớ rồi bấm lưu lại.");
      return;
    }
    if (!continueAdding) { navigate(backTo); return; }
    setQuestion({ ...createInitialQuestion(input.type), lessonId: input.lessonId, chapter: input.chapter, difficulty: input.difficulty });
    setFormSequence((current) => current + 1);
    setNotice("Đã lưu câu hỏi. Tiếp tục soạn câu mới với cùng Bài học, Mức độ và loại câu.");
    window.requestAnimationFrame(() => { contentRef.current?.focus({ preventScroll: true }); contentRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }); });
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(""); setNotice("");
    const submitter = event.nativeEvent instanceof SubmitEvent ? event.nativeEvent.submitter : null;
    const continueAdding = !questionId && submitter instanceof HTMLButtonElement && submitter.value === "continue";
    if (imageProcessing) { setError("Đợi ảnh xử lý xong trước khi lưu câu hỏi."); return; }
    const imageError = questionImageError(question.image);
    if (imageError) { setError(imageError); return; }

    const result = validateQuestionInput(question, geo10Lessons);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    persistQuestion(result.input, continueAdding);
  };

  if (questionId && !savedQuestion) {
    return (
      <div className="rounded-2xl border border-line bg-white p-6">
        <h1 className="text-xl font-extrabold text-ink">
          Không tìm thấy câu hỏi
        </h1>

        <Link
          to={backTo}
          className="mt-4 inline-block text-sm font-bold text-emerald"
        >
          Quay lại ngân hàng câu hỏi
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to={backTo}
        className="inline-flex items-center gap-2 text-sm font-bold text-secondary hover:text-emerald"
      >
        <ArrowLeft className="size-4" />
        Quay lại ngân hàng câu hỏi
      </Link>

      <div>
        <h1 className="text-2xl font-extrabold text-ink">
          {questionId ? "Sửa câu hỏi" : "Thêm câu hỏi"}
        </h1>

        <p className="mt-2 text-sm text-secondary">
          Chọn loại câu hỏi và nhập nội dung phù hợp.
        </p>
      </div>

      <form
        id="question-form"
        noValidate
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6"
      >
        <label className="block">
          <span className="text-sm font-bold text-ink">Loại câu hỏi *</span>

          <select
            value={question.type}
            disabled={Boolean(questionId)}
            onChange={(event) => {
              const nextType = event.target.value;

              if (
                nextType === "single_choice" ||
                nextType === "true_false" ||
                nextType === "multiple_choice" ||
                nextType === "true_false_group" ||
                nextType === "short_answer"
              ) {
                changeQuestionType(nextType);
              }
            }}
            className="mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-4 text-sm outline-none focus:border-emerald disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-muted"
          >
            <optgroup label="Các dạng thường dùng trong đề thi">
              <option value="single_choice">{questionTypeLabels.single_choice}</option>
              <option value="true_false_group">{questionTypeLabels.true_false_group}</option>
              <option value="short_answer">{questionTypeLabels.short_answer}</option>
            </optgroup>
            <optgroup label="Dạng bổ sung cho luyện tập">
              <option value="true_false">{questionTypeLabels.true_false}</option>
              <option value="multiple_choice">{questionTypeLabels.multiple_choice}</option>
            </optgroup>
          </select>

          <span className="mt-2 block text-xs text-muted">
            {questionId
              ? "Loại câu hỏi được giữ nguyên khi chỉnh sửa."
              : "Đổi loại sẽ đặt lại phần đáp án; các nội dung khác được giữ nguyên."}
          </span>
        </label>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-bold text-ink">Bài học *</span>

            <select
              value={question.lessonId ?? ""}
              onChange={(event) => {
                const lesson = geo10Lessons.find(
                  (item) => item.id === event.target.value,
                );
                const chapter = geo10Chapters.find(
                  (item) => item.id === lesson?.chapterId,
                );

                setQuestion((current) => ({
                  ...current,
                  lessonId: lesson?.id ?? "",
                  chapter: chapter
                    ? `Chương ${chapter.number}: ${chapter.title}`
                    : "",
                }));
              }}
              className="mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-4 text-sm outline-none focus:border-emerald"
            >
              <option value="">Chọn bài học</option>

              {geo10Chapters.map((chapter) => (
                <optgroup
                  key={chapter.id}
                  label={`Chương ${chapter.number}: ${chapter.title}`}
                >
                  {getLessonsByChapter(chapter.id).map((lesson) => (
                    <option key={lesson.id} value={lesson.id}>
                      Bài {lesson.number}: {lesson.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-bold text-ink">Mức độ *</span>

            <select
              value={question.difficulty}
              onChange={(event) =>
                setQuestion((current) => ({
                  ...current,
                  difficulty: event.target.value as QuestionDifficulty,
                }))
              }
              className="mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-4 text-sm outline-none focus:border-emerald"
            >
              <option value="recognition">Nhận biết</option>
              <option value="comprehension">Thông hiểu</option>
              <option value="application">Vận dụng</option>
              <option value="advanced_application">Vận dụng cao</option>
            </select>
          </label>
        </div>

        {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
        <label className="block">
          <span className="text-sm font-bold text-ink">
            {question.type === "true_false_group"
              ? "Nội dung chung / yêu cầu câu hỏi *"
              : "Nội dung câu hỏi *"}
          </span>

          <textarea
            ref={contentRef}
            value={question.content}
            onChange={(event) =>
              setQuestion((current) => ({
                ...current,
                content: event.target.value,
              }))
            }
            rows={4}
            placeholder={
              question.type === "true_false_group"
                ? "Nhập thông tin chung hoặc yêu cầu xác định các ý đúng hay sai..."
                : "Nhập nội dung câu hỏi..."
            }
            className="mt-2 w-full rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-emerald"
          />
        </label>

        <QuestionImageEditor key={`${questionId ?? "new"}-${formSequence}`} value={question.image} onChange={(image) => setQuestion((current) => ({ ...current, image }))} onProcessingChange={setImageProcessing} />

        {question.type === "short_answer" ? (
          <fieldset className="space-y-3 rounded-xl border border-line p-4">
            <legend className="px-2 text-sm font-bold">Đáp án số *</legend>
            <label className="block text-sm font-bold">Giá trị đúng
              <input type="text" inputMode="text" aria-label="Đáp án số đúng" value={question.correctAnswer} onChange={(event) => { const value = event.target.value; setQuestion((current) => current.type === "short_answer" ? { ...current, correctAnswer: value } : current); }} placeholder="Ví dụ: 125 hoặc -12,5" className="mt-2 block min-h-11 w-full rounded-xl border border-line px-3 font-normal sm:max-w-sm" />
            </label>
            <p className="text-sm leading-6 text-secondary">Nhận số nguyên, số âm và số thập phân. Dấu phẩy hoặc chấm đều được; không nhập đơn vị hay dấu tách hàng nghìn. Ví dụ 12,5 và 12.50 được chấm như nhau.</p>
            <p className="text-sm leading-6 text-secondary">Chấm đúng giá trị, không tự làm tròn. Nếu cần làm tròn, ghi rõ yêu cầu trong nội dung câu hỏi.</p>
          </fieldset>
        ) : question.type === "single_choice" ? (
          <fieldset>
            <legend className="text-sm font-bold text-ink">Các đáp án *</legend>

            <p className="mt-1 text-xs text-muted">
              Nhập các phương án và chọn một đáp án đúng. Cần ít nhất 2 phương án.
            </p>

            <div className="mt-4 space-y-3">
              <div className="space-y-3">
                {question.options.map((option, index) => {
                  const label = String.fromCharCode(65 + index);
                  const isCorrect = question.correctOptionId === option.id;

                  return (
                    <div key={option.id} data-option-row className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${isCorrect ? "border-emerald-700 bg-emerald-50" : "border-line"}`}>
                      <input
                        type="radio"
                        name="correctOption"
                        aria-label={`Phương án ${label} là đáp án đúng`}
                        checked={question.correctOptionId === option.id}
                        onChange={() =>
                          setQuestion((current) => {
                            if (current.type !== "single_choice") {
                              return current;
                            }

                            return {
                              ...current,
                              correctOptionId: option.id,
                            };
                          })
                        }
                        className="size-4 shrink-0 accent-emerald"
                      />

                      <span className="w-6 shrink-0 text-sm font-extrabold text-ink">
                        {label}.
                      </span>

                      <input
                        type="text"
                        value={option.text}
                        onChange={(event) =>
                          updateOption(option.id, event.target.value)
                        }
                        aria-label={`Nội dung phương án ${label}`}
                        placeholder={`Nhập phương án ${label}`}
                        className="min-h-11 min-w-0 flex-1 rounded-xl border border-line px-4 text-sm outline-none focus:border-emerald"
                      />

                      <button
                        type="button"
                        onClick={() => removeOption(option.id)}
                        disabled={question.options.length <= 2}
                        title={question.options.length <= 2 ? "Cần ít nhất 2 phương án" : `Xóa phương án ${label}`}
                        aria-label={`Xóa phương án ${label}`}
                        className="shrink-0 rounded-lg px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        Xóa
                      </button>
                      {isCorrect && <span className="w-full text-sm font-bold text-emerald-800">✓ Đáp án đúng</span>}
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={addOption}
                className="mt-3 inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-bold text-emerald hover:bg-emerald/5"
              >
                + Thêm phương án
              </button>
            </div>
          </fieldset>
        ) : question.type === "true_false" ? (
          <fieldset className="rounded-xl border border-line p-4">
            <legend className="px-2 text-sm font-bold text-ink">
              Đáp án đúng *
            </legend>

            <p className="mb-3 text-xs text-muted">
              Chọn Đúng hoặc Sai cho nhận định trong nội dung câu hỏi.
            </p>

            <div className="flex flex-wrap gap-6">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="correctAnswer"
                  checked={question.correctAnswer === true}
                  onChange={() =>
                    setQuestion((current) => {
                      if (current.type !== "true_false") {
                        return current;
                      }

                      return {
                        ...current,
                        correctAnswer: true,
                      };
                    })
                  }
                  className="size-4 accent-emerald"
                />

                <span className="text-sm font-bold text-ink">Đúng</span>
              </label>

              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="correctAnswer"
                  checked={question.correctAnswer === false}
                  onChange={() =>
                    setQuestion((current) => {
                      if (current.type !== "true_false") {
                        return current;
                      }

                      return {
                        ...current,
                        correctAnswer: false,
                      };
                    })
                  }
                  className="size-4 accent-emerald"
                />

                <span className="text-sm font-bold text-ink">Sai</span>
              </label>
            </div>
          </fieldset>
        ) : question.type === "multiple_choice" ? (
          <fieldset>
            <legend className="text-sm font-bold text-ink">Các đáp án *</legend>

            <p className="mt-1 text-xs text-muted">
              Nhập các phương án và đánh dấu đáp án đúng. Cần ít nhất 2 phương án.
            </p>

            <div className="mt-4 space-y-3">
              {question.options.map((option, index) => {
                const label = String.fromCharCode(65 + index);
                const isCorrect = question.correctOptionIds.includes(option.id);

                return (
                  <div key={option.id} data-option-row className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${isCorrect ? "border-emerald-700 bg-emerald-50" : "border-line"}`}>
                    <input
                      type="checkbox"
                      checked={question.correctOptionIds.includes(option.id)}
                      onChange={() => toggleCorrectOption(option.id)}
                      aria-label={`Phương án ${label} là đáp án đúng`}
                      className="size-4 shrink-0 accent-emerald"
                    />

                    <span className="w-6 shrink-0 text-sm font-extrabold text-ink">
                      {label}.
                    </span>

                    <input
                      type="text"
                      value={option.text}
                      onChange={(event) =>
                        updateOption(option.id, event.target.value)
                      }
                      aria-label={`Nội dung phương án ${label}`}
                      placeholder={`Nhập phương án ${label}`}
                      className="min-h-11 min-w-0 flex-1 rounded-xl border border-line px-4 text-sm outline-none focus:border-emerald"
                    />

                    <button
                      type="button"
                      onClick={() => removeOption(option.id)}
                      disabled={question.options.length <= 2}
                      title={question.options.length <= 2 ? "Cần ít nhất 2 phương án" : `Xóa phương án ${label}`}
                      aria-label={`Xóa phương án ${label}`}
                      className="shrink-0 rounded-lg px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      Xóa
                    </button>
                    {isCorrect && <span className="w-full text-sm font-bold text-emerald-800">✓ Đáp án đúng</span>}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={addOption}
              className="mt-3 inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-bold text-emerald hover:bg-emerald/5"
            >
              + Thêm phương án
            </button>
          </fieldset>
        ) : (
          <fieldset>
            <legend className="text-sm font-bold text-ink">Các ý *</legend>

            <p className="mt-1 text-xs text-muted">
              Nhập ít nhất 2 ý và chọn đáp án Đúng hoặc Sai cho từng ý.
            </p>

            <div className="mt-4 space-y-4">
              {question.statements.map((statement, index) => (
                <div
                  key={statement.id}
                  className="rounded-xl border border-line p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <label
                      htmlFor={`statement-${statement.id}`}
                      className="text-sm font-bold text-ink"
                    >
                      Ý {index + 1}
                    </label>

                    <button
                      type="button"
                      onClick={() => removeStatement(statement.id)}
                      disabled={question.statements.length <= 2}
                      className="rounded-lg px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      Xóa ý
                    </button>
                  </div>

                  <textarea
                    id={`statement-${statement.id}`}
                    value={statement.content}
                    onChange={(event) =>
                      updateStatementContent(statement.id, event.target.value)
                    }
                    rows={2}
                    placeholder={`Nhập nội dung ý ${index + 1}...`}
                    className="mt-2 w-full rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-emerald"
                  />

                  <div className="mt-3 flex flex-wrap items-center gap-5">
                    <span className="text-xs font-bold text-secondary">
                      Đáp án đúng:
                    </span>

                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name={`statement-answer-${statement.id}`}
                        checked={statement.correctAnswer === true}
                        onChange={() =>
                          updateStatementAnswer(statement.id, true)
                        }
                        className="size-4 accent-emerald"
                      />

                      <span className="text-sm text-ink">Đúng</span>
                    </label>

                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name={`statement-answer-${statement.id}`}
                        checked={statement.correctAnswer === false}
                        onChange={() =>
                          updateStatementAnswer(statement.id, false)
                        }
                        className="size-4 accent-emerald"
                      />

                      <span className="text-sm text-ink">Sai</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addStatement}
              className="mt-3 inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-bold text-emerald hover:bg-emerald/5"
            >
              + Thêm ý
            </button>
          </fieldset>
        )}

        <label className="flex items-center gap-3 text-sm font-bold text-ink">
          <input
            type="checkbox"
            checked={question.showInLesson ?? false}
            onChange={(event) =>
              setQuestion((current) => ({
                ...current,
                showInLesson: event.target.checked,
              }))
            }
            className="size-4 accent-emerald"
          />
          Hiển thị câu hỏi luyện tập trong bài học
        </label>

        <label className="block">
          <span className="text-sm font-bold text-ink">Giải thích đáp án</span>

          <textarea
            value={question.explanation ?? ""}
            onChange={(event) =>
              setQuestion((current) => ({
                ...current,
                explanation: event.target.value,
              }))
            }
            rows={3}
            placeholder="Không bắt buộc"
            className="mt-2 w-full rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-emerald"
          />
        </label>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
          >
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className={`min-h-12 rounded-full px-6 text-sm font-bold ${questionId ? "bg-emerald text-white hover:bg-emerald/90" : "border border-line bg-white text-ink hover:bg-slate-50"}`}
          >
            {questionId ? "Lưu thay đổi" : "Lưu câu hỏi"}
          </button>

          {!questionId && <button type="submit" name="intent" value="continue" className="min-h-12 rounded-full bg-emerald px-6 text-sm font-bold text-white hover:bg-emerald/90">Lưu và thêm câu mới</button>}
          <Link
            to={backTo}
            className="inline-flex min-h-12 items-center rounded-full border border-line px-6 text-sm font-bold text-ink hover:bg-slate-50"
          >
            Hủy
          </Link>
        </div>
      </form>
    </div>
  );
}
