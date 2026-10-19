import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Compass, GraduationCap, Map, MapPin, Mountain, Building2, BookOpenCheck } from "lucide-react";
import { geo10Parts, geo10Chapters } from "../../data/geo10Curriculum";
import ContourBackground from "../../components/common/ContourBackground";

const sampleQuestions = [
  { content: "Một xentimét trên bản đồ có thể dài bao xa?", context: "Bản đồ có tỉ lệ 1 : 100 000.", options: ["100 m", "1 km", "10 km", "100 km"], correct: 1, explanation: "1 cm trên bản đồ tương ứng 100 000 cm ngoài thực tế, tức là 1 km." },
  { content: "Trái Đất tự quay quanh trục theo hướng nào?", context: "Thử hình dung chuyển động của Trái Đất.", options: ["Từ đông sang tây", "Từ bắc xuống nam", "Từ tây sang đông", "Từ nam lên bắc"], correct: 2, explanation: "Trái Đất tự quay quanh trục theo hướng từ tây sang đông." },
  { content: "Mật độ dân số của khu vực này là bao nhiêu?", context: "Dân số 120 000 người, diện tích 200 km².", options: ["60 người/km²", "240 người/km²", "6 000 người/km²", "600 người/km²"], correct: 3, explanation: "Lấy dân số chia diện tích: 120 000 ÷ 200 = 600 người/km²." },
];
const classroomViews = {
  student: { label: "Học sinh", image: "/images/webstudy-student.jpg", alt: "Ảnh chụp WebStudy: học sinh đọc bài học và làm câu hỏi luyện tập với dữ liệu minh họa", title: "Mở bài học. Thử vận dụng.", notes: ["Đọc nội dung giáo viên đã đăng", "Tự luyện và xem giải thích", "Mở bài tập được giao cho lớp"], route: "Nhận mã lớp → Gửi yêu cầu tham gia → Học cùng lớp" },
  teacher: { label: "Giáo viên", image: "/images/webstudy-teacher.jpg", alt: "Ảnh chụp WebStudy: giáo viên quản lý bài tập của lớp minh họa", title: "Một nơi để theo dõi bài đã giao.", notes: ["Tìm bài theo lớp và trạng thái", "Xem hạn nộp và tiến độ nộp bài", "Mở bài để xem kết quả học sinh"], route: "Tạo lớp → Soạn nội dung → Giao bài và theo dõi" },
};
type ViewRole = keyof typeof classroomViews;
const partIcons = [Map, Mountain, Building2];

export default function LandingPage() {
  const { hash, key } = useLocation();
  const root = useRef<HTMLElement>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [expandedPart, setExpandedPart] = useState<string | null>(null);
  const [viewRole, setViewRole] = useState<ViewRole>("student");
  const question = sampleQuestions[questionIndex];
  const view = classroomViews[viewRole];
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      // Keep previously shared public anchors working after the page redesign.
      const aliases: Record<string, string> = { lessons: "journey", "how-it-works": "classroom", contact: "get-started" };
      if (hash) document.getElementById(aliases[hash.slice(1)] ?? hash.slice(1))?.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      else window.scrollTo({ top: 0, behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [hash, key]);
  useEffect(() => {
    const element = root.current;
    if (!element || !("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) { entry.target.setAttribute("data-visible", "true"); observer.unobserve(entry.target); } });
    }, { threshold: 0.08 });
    element.querySelectorAll("[data-reveal]").forEach(item => observer.observe(item));
    element.classList.add("landing-motion-ready");
    return () => observer.disconnect();
  }, []);
  function changeView(next: ViewRole) { setViewRole(next); }
  function onTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? "student" : event.key === "End" ? "teacher" : viewRole === "student" ? "teacher" : "student";
    changeView(next);
    document.getElementById(`classroom-tab-${next}`)?.focus();
  }
  return <main ref={root} className="landing-page text-ink">
    <section aria-labelledby="landing-title" className="relative isolate overflow-hidden bg-ink text-white" onPointerMove={event => {
      if (event.pointerType !== "mouse" || !matchMedia("(prefers-reduced-motion: no-preference)").matches) return;
      const box = event.currentTarget.getBoundingClientRect();
      event.currentTarget.style.setProperty("--compass-angle", `${((event.clientX - box.left) / box.width - 0.5) * 32}deg`);
    }} onPointerLeave={event => event.currentTarget.style.setProperty("--compass-angle", "0deg")}>
      <ContourBackground className="landing-contours absolute -inset-16 h-[calc(100%+8rem)] w-[calc(100%+8rem)] text-emerald-200/15" />
      <div className="container-page relative grid items-center gap-12 py-16 lg:grid-cols-[1.1fr_1fr] lg:gap-20 lg:py-24">
        <div>
          <p className="flex items-center gap-3 text-sm font-semibold text-emerald-200">
            <Compass aria-hidden="true" className="landing-compass size-6" style={{ transform: "rotate(var(--compass-angle, 0deg))" }} /> ĐỊA LÍ 10 · KẾT NỐI TRI THỨC</p>
          <h1 id="landing-title" className="mt-7 max-w-2xl text-4xl font-extrabold leading-[1.15] tracking-tight sm:text-5xl xl:text-6xl">Địa lí bắt đầu<br />từ một <span className="text-emerald-300">câu hỏi.</span>
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-slate-200">Một tấm bản đồ, một hiện tượng quen thuộc, một điều em muốn hiểu. Cùng WebStudy tiếp tục việc học trước và sau mỗi tiết Địa lí.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/auth?tab=register&role=student" className="inline-flex min-h-12 items-center gap-3 rounded-full bg-amber px-6 py-3 text-sm font-bold text-ink hover:bg-amber-400">Tôi là Học sinh <ArrowUpRight aria-hidden="true" size={17} />
            </Link>
            <Link to="/auth?tab=register&role=teacher" className="inline-flex min-h-12 items-center gap-3 rounded-full border border-white/40 px-6 py-3 text-sm font-bold text-white hover:bg-white/10">Tôi là Giáo viên <ArrowUpRight aria-hidden="true" size={17} />
            </Link>
          </div>
          <a href="#journey" className="mt-8 inline-flex min-h-11 items-center gap-2 text-sm text-slate-200 hover:text-white">Đi một vòng khám phá <ChevronDown aria-hidden="true" size={16} />
          </a>
        </div>
        <section aria-labelledby="sample-question-title" className="min-w-0 rounded-3xl border border-white/20 bg-white p-5 text-ink shadow-2xl sm:p-8">
          <div className="flex items-center justify-between gap-3 text-xs font-bold tracking-wide text-secondary">
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-600" /> THỬ MỘT CÂU HỎI</span>
            <span>{String(questionIndex + 1).padStart(2, "0")} / 03</span>
          </div>
          <h2 id="sample-question-title" tabIndex={-1} className="outline-none mt-5 text-xl font-extrabold leading-8 sm:text-2xl">{question.content}</h2>
          <p className="mt-2 text-sm leading-6 text-secondary">{question.context}</p>
          <fieldset className="mt-5 grid gap-2" disabled={selected !== null}>
            <legend className="sr-only">Chọn một đáp án cho câu hỏi minh họa</legend>
            {question.options.map((option, index) => <label key={`${questionIndex}-${index}`} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition-colors ${selected !== null && index === question.correct ? "border-emerald-700 bg-emerald-50 text-emerald-900" : selected === index ? "border-red-600 bg-red-50 text-red-800" : "border-line hover:border-slate-400"}`}>
              <input type="radio" name="landing-sample-answer" checked={selected === index} onChange={() => setSelected(index)} className="size-4 shrink-0 accent-emerald-700" />
              <span className="font-semibold text-secondary">{String.fromCharCode(65 + index)}.</span>
              <span>{option}</span>{selected !== null && index === question.correct && <Check aria-hidden="true" size={17} className="ml-auto shrink-0" />}
            </label>)}
          </fieldset>
          <div aria-live="polite" aria-atomic="true" className="mt-5 min-h-24">
            {selected === null ? <p className="text-sm leading-6 text-secondary">Chọn một đáp án để xem giải thích. Không cần đăng nhập.</p> : <>
              <p className={`text-sm font-bold ${selected === question.correct ? "text-emerald-800" : "text-red-800"}`}>{selected === question.correct ? "Chính xác!" : "Chưa đúng. Thử tìm hiểu nhé."}</p>
              <p className="mt-1 text-sm leading-6 text-secondary">{question.explanation}</p>
            </>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="text-xs text-secondary">Câu hỏi minh họa · Không lưu kết quả</p>
            <button type="button" disabled={selected === null} onClick={() => { setQuestionIndex((questionIndex + 1) % sampleQuestions.length); setSelected(null); requestAnimationFrame(() => document.getElementById("sample-question-title")?.focus({ preventScroll: true })); }} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-bold text-emerald-800 disabled:cursor-not-allowed disabled:opacity-40">Câu tiếp theo <ArrowRight aria-hidden="true" size={16} />
            </button>
          </div>
        </section>
      </div>
      <svg aria-hidden="true" viewBox="0 0 1440 40" preserveAspectRatio="none" className="block h-7 w-full fill-canvas sm:h-10">
        <path d="M0 24 Q360 0 720 24 T1440 24 V40 H0Z" />
      </svg>
    </section>

    <section id="journey" aria-labelledby="journey-title" data-reveal className="scroll-mt-24 py-16 sm:py-20">
      <div className="container-page">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">01 · Hành trình Địa lí</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <h2 id="journey-title" className="text-3xl font-extrabold tracking-tight sm:text-4xl">Từ bản đồ đến thế giới quanh ta.</h2>
          <p className="max-w-xs text-sm leading-6 text-secondary">Ba phần của chương trình. Chọn một phần để xem các chương.</p>
        </div>
        <div className="relative mt-10">
          <svg aria-hidden="true" viewBox="0 0 1200 120" preserveAspectRatio="none" className="pointer-events-none absolute -top-7 left-0 hidden h-28 w-full md:block">
            <path d="M60 70 C250 -35 340 125 600 60 S940 5 1140 65" fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 9" />
            <path className="journey-line-draw" pathLength="1" d="M60 70 C250 -35 340 125 600 60 S940 5 1140 65" fill="none" stroke="#047857" strokeWidth="2" />
          </svg>
          <div className="relative grid items-start gap-5 md:grid-cols-3">
            {geo10Parts.map((part, index) => {
const Icon = partIcons[index] ?? Map; const expanded = expandedPart === part.id; return <article key={part.id} className="min-w-0 rounded-2xl border border-line bg-white p-6 shadow-card">
                <div className="flex items-start justify-between">
                  <span className="text-4xl font-extrabold tracking-tight text-slate-200">{String(part.number).padStart(2, "0")}</span>
                  <Icon aria-hidden="true" size={52} strokeWidth={1.2} className="text-emerald-800" />
                </div>
                <h3 className="mt-6 min-h-14 text-xl font-extrabold leading-7">{part.title}</h3>
                <button type="button" aria-expanded={expanded} aria-controls={`chapters-${part.id}`} onClick={() => setExpandedPart(expanded ? null : part.id)} className="mt-4 flex min-h-11 w-full items-center justify-between gap-2 border-t border-line pt-3 text-left text-sm font-bold text-emerald-800">{expanded ? "Thu gọn các chương" : "Khám phá các chương"}<ChevronDown aria-hidden="true" size={18} className={`shrink-0 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`} />
                </button>
                <ul id={`chapters-${part.id}`} hidden={!expanded} className="mt-4 space-y-3 border-t border-line pt-4">{geo10Chapters.filter(chapter => chapter.partId === part.id).map(chapter => <li key={chapter.id} className="flex items-start gap-2 text-sm leading-6 text-secondary">
                  <MapPin aria-hidden="true" size={15} className="mt-1 shrink-0 text-emerald-800" />
                  <span>Chương {chapter.number}. {chapter.title}</span>
                </li>)}</ul>
              </article>;
})}
          </div>
        </div>
      </div>
    </section>

    <section id="classroom" aria-labelledby="classroom-title" data-reveal className="scroll-mt-24 border-y border-line bg-white py-16 sm:py-20">
      <div className="container-page">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">02 · Trong lớp học</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-6">
          <h2 id="classroom-title" className="max-w-xl text-3xl font-extrabold tracking-tight sm:text-4xl">Mở WebStudy, bạn sẽ thấy gì?</h2>
          <div role="tablist" aria-label="Xem giao diện theo vai trò" className="inline-flex rounded-full bg-canvas p-1">{(["student", "teacher"] as const).map(role => <button key={role} type="button" role="tab" id={`classroom-tab-${role}`} aria-selected={viewRole === role} aria-controls="classroom-panel" tabIndex={viewRole === role ? 0 : -1} onKeyDown={onTabKey} onClick={() => changeView(role)} className={`min-h-11 rounded-full px-5 text-sm font-bold ${viewRole === role ? "bg-ink text-white shadow-sm" : "text-secondary hover:text-ink"}`}>{classroomViews[role].label}</button>)}</div>
        </div>
        <div id="classroom-panel" role="tabpanel" aria-labelledby={`classroom-tab-${viewRole}`} tabIndex={0} className="mt-8 min-w-0">
          <div className="grid items-center gap-6 lg:grid-cols-[1fr_2fr] lg:gap-10">
            <div>
              <h3 className="text-2xl font-extrabold leading-8">{view.title}</h3>
              <ul className="mt-5 space-y-4">{view.notes.map(note => <li key={note} className="flex items-start gap-3 text-sm leading-6 text-secondary">
                <Check aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-emerald-800" />{note}</li>)}</ul>
              <p className="mt-7 border-t border-line pt-4 text-sm leading-6 text-secondary">{view.route}</p>
            </div>
            <figure className="min-w-0 overflow-hidden rounded-2xl border border-line bg-canvas shadow-card">
              <div aria-hidden="true" className="flex h-10 items-center gap-1.5 border-b border-line px-4">
                <span className="size-2 rounded-full bg-slate-300" />
                <span className="size-2 rounded-full bg-slate-300" />
                <span className="size-2 rounded-full bg-slate-300" />
                <span className="ml-3 text-xs text-secondary">WebStudy / {view.label}</span>
              </div>
              <img key={view.image} src={view.image} alt={view.alt} width={1440} height={900} loading="lazy" className="h-auto w-full" />
              <figcaption className="border-t border-line px-4 py-3 text-xs leading-5 text-secondary">Ảnh chụp giao diện thật · Dữ liệu minh họa</figcaption>
            </figure>
          </div>
        </div>
      </div>
    </section>

    <section id="get-started" aria-labelledby="start-title" data-reveal className="scroll-mt-24 py-16 sm:py-20">
      <div className="container-page">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">03 · Bắt đầu</p>
        <h2 id="start-title" className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Bạn sẽ tham gia với vai trò nào?</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-2">{(["student", "teacher"] as const).map(role => <article key={role} className={`rounded-2xl p-7 sm:p-9 ${role === "teacher" ? "bg-ink text-white" : "border border-line bg-white"}`}>
          {role === "student" ? <GraduationCap aria-hidden="true" size={34} strokeWidth={1.5} className="text-emerald-800" /> : <BookOpenCheck aria-hidden="true" size={34} strokeWidth={1.5} className="text-emerald-300" />}
          <h3 className="mt-5 text-2xl font-extrabold">{classroomViews[role].label}</h3>
          <p className={`mt-3 max-w-sm text-sm leading-6 ${role === "teacher" ? "text-slate-200" : "text-secondary"}`}>{role === "student" ? "Chuẩn bị mã lớp từ giáo viên để gửi yêu cầu tham gia lớp học của mình." : "Tạo hồ sơ, hoàn tất xác minh giáo viên, rồi tạo lớp và giao bài cho học sinh."}</p>
          <Link to={`/auth?tab=register&role=${role}`} className={`mt-6 inline-flex min-h-12 items-center gap-3 rounded-full px-5 py-3 text-sm font-bold ${role === "teacher" ? "bg-emerald-700 text-white hover:bg-emerald-800" : "bg-ink text-white hover:bg-slate-800"}`}>Tạo tài khoản {role === "student" ? "học sinh" : "giáo viên"} <ArrowUpRight aria-hidden="true" size={17} />
          </Link>
        </article>)}</div>
        <p className="mt-6 text-center text-sm text-secondary">Đã có hồ sơ? <Link to="/auth" className="inline-flex min-h-11 items-center font-bold text-emerald-800 underline underline-offset-4">Đăng nhập để tiếp tục</Link>
        </p>
      </div>
    </section>
    <footer className="border-t border-line bg-white py-7">
      <div className="container-page flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link to="/" className="text-lg font-extrabold">Web<span className="text-emerald-700">Study</span>
          </Link>
          <p className="mt-1 text-xs text-secondary">Địa lí 10 · Kết nối tri thức</p>
        </div>
        <p className="max-w-sm text-sm leading-6 text-secondary">Cần mã lớp hoặc hỗ trợ học tập? Liên hệ giáo viên phụ trách lớp.</p>
      </div>
    </footer>
  </main>;
}
