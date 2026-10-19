import { normalizeNumericAnswer } from "./assignmentQuestion";
import JSZip from "jszip";
import { geo10Chapters, geo10Lessons } from "../data/geo10Curriculum";
import type { QuestionDifficulty, QuestionInputV2, QuestionType } from "../types/question";

const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
export type WordQuestionLine = { text: string; unsupported: boolean };
export type WordQuestionRow = {
  number: string;
  content: string;
  errors: string[];
  input: QuestionInputV2 | null;
};
export const WORD_TYPES: Record<QuestionType, string> = {
  short_answer: "Trả lời ngắn (số)",
  single_choice: "Chọn 1 đáp án", multiple_choice: "Chọn nhiều đáp án",
  true_false: "Đúng / Sai", true_false_group: "Đúng / Sai nhiều ý",
};
export const WORD_DIFFICULTIES: Record<QuestionDifficulty, string> = {
  recognition: "Nhận biết", comprehension: "Thông hiểu",
  application: "Vận dụng", advanced_application: "Vận dụng cao",
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d")
    .toLowerCase().replace(/\s+/g, " ").trim();
}
function booleanAnswer(value: string): boolean | undefined {
  const answer = normalize(value);
  return answer === "dung" ? true : answer === "sai" ? false : undefined;
}

export async function readQuestionWord(file: File): Promise<WordQuestionLine[]> {
  if (!/\.docx$/i.test(file.name)) throw new Error("Chỉ nhận file .docx. Hãy lưu lại file .doc trong Word thành .docx.");
  if (!file.size || file.size > 5 * 1024 * 1024) throw new Error("Chọn file Word không rỗng và tối đa 5 MB.");
  let xml: string;
  try {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const document = zip.file("word/document.xml");
    if (!document) throw new Error();
    xml = await document.async("string");
  } catch { throw new Error("Không đọc được file Word. File có thể bị hỏng hoặc được bảo vệ bằng mật khẩu."); }
  if (xml.length > 8 * 1024 * 1024) throw new Error("Nội dung Word quá dài. Hãy chia thành các file nhỏ hơn.");
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.getElementsByTagName("parsererror").length) throw new Error("Cấu trúc file Word không hợp lệ.");
  const body = document.getElementsByTagNameNS(WORD_NS, "body")[0];
  if (!body) throw new Error("File không có nội dung Word để đọc.");
  const lines: WordQuestionLine[] = [];
  for (const child of Array.from(body.children)) {
    if (child.localName === "sectPr") continue;
    const descendants = Array.from(child.getElementsByTagName("*"));
    const unsupported = child.localName !== "p" || descendants.some((node) =>
      ["drawing", "pict", "object", "oMath", "oMathPara", "del", "ins"].includes(node.localName));
    let text = "";
    for (const node of descendants) {
      if (node.namespaceURI !== WORD_NS) continue;
      if (node.localName === "t") text += node.textContent ?? "";
      if (["br", "cr"].includes(node.localName)) text += "\n";
      if (node.localName === "tab") text += " ";
    }
    for (const part of text.split(/\r?\n/)) if (part.trim()) lines.push({ text: part.trim(), unsupported });
    if (unsupported && !text.trim()) lines.push({ text: "", unsupported: true });
  }
  return lines;
}

export function parseWordQuestions(
  lines: WordQuestionLine[],
  defaults: { lessonId: string; difficulty: QuestionDifficulty },
): WordQuestionRow[] {
  const blocks: { number: string; lines: WordQuestionLine[] }[] = [];
  for (const line of lines) {
    const start = line.text.match(/^c[âa]u\s+(\d+)\s*[:.)-]\s*(.*)$/i);
    if (start) {
      if (blocks.length >= 500) throw new Error("Mỗi lần nhập tối đa 500 câu. Hãy chia nhỏ file Word.");
      blocks.push({ number: start[1], lines: [{ ...line, text: start[2] }] });
    } else if (blocks.length) blocks[blocks.length - 1].lines.push(line);
  }
  return blocks.map((block) => {
    const errors: string[] = [];
    const fields = new Map<string, string>([["content", block.lines[0].text]]);
    const options = new Map<string, string>();
    let target = "content";
    for (const line of block.lines.slice(1)) {
      const field = line.text.match(/^([^:]+):\s*(.*)$/);
      const key = field ? normalize(field[1]) : "";
      if (["loai", "bai", "muc do", "dap an", "giai thich"].includes(key) && field) {
        if (fields.has(key)) errors.push(`Trường “${field[1]}” bị lặp.`);
        fields.set(key, field[2].trim()); target = key; continue;
      }
      const option = line.text.match(/^([A-Za-z])[.)]\s*(.*)$/);
      if (option) {
        const label = option[1].toUpperCase();
        if (options.has(label)) errors.push(`Phương án/ý ${label} bị lặp.`);
        options.set(label, option[2].trim()); target = `option:${label}`; continue;
      }
      if (!line.text.trim()) continue;
      if (target.startsWith("option:")) {
        const label = target.slice(7); options.set(label, `${options.get(label)}\n${line.text}`);
      } else if (["content", "giai thich"].includes(target)) fields.set(target, `${fields.get(target) ?? ""}\n${line.text}`.trim());
      else errors.push(`Dòng chưa đúng định dạng: “${line.text.slice(0, 80)}”.`);
    }
    if (block.lines.some((line) => line.unsupported)) errors.push("Có ảnh, bảng, công thức, theo dõi thay đổi hoặc khối chưa hỗ trợ. Hãy chuyển bảng thành chữ; ảnh có thể thêm sau bằng form sửa câu.");
    if (block.lines.reduce((sum, line) => sum + line.text.length, 0) > 100000) errors.push("Nội dung câu quá dài.");
    const content = fields.get("content")?.trim() ?? "";
    if (!content) errors.push("Thiếu nội dung sau Câu N:.");
    const type = (Object.keys(WORD_TYPES) as QuestionType[]).find((key) => normalize(WORD_TYPES[key]) === normalize(fields.get("loai") ?? ""));
    if (!type) errors.push("Thiếu hoặc sai Loại. Dùng một trong 5 loại trong file mẫu.");
    const difficultyText = fields.get("muc do");
    const difficulty = difficultyText === undefined ? defaults.difficulty : (Object.keys(WORD_DIFFICULTIES) as QuestionDifficulty[]).find((key) => normalize(WORD_DIFFICULTIES[key]) === normalize(difficultyText));
    if (!difficulty) errors.push("Mức độ không hợp lệ. Dùng Nhận biết, Thông hiểu, Vận dụng hoặc Vận dụng cao.");
    const lessonText = fields.get("bai");
    const lessonNumber = lessonText?.match(/^(?:b[àa]i\s*)?(\d+)$/i)?.[1];
    const lesson = lessonText === undefined ? geo10Lessons.find((item) => item.id === defaults.lessonId) : geo10Lessons.find((item) => item.number === Number(lessonNumber));
    if (lessonText !== undefined && !lesson) errors.push("Bài học không hợp lệ. Ghi số bài, ví dụ Bài: 5; hoặc bỏ dòng này để dùng lựa chọn chung.");
    const chapter = geo10Chapters.find((item) => item.id === lesson?.chapterId);
    const common = {
      content, difficulty: difficulty ?? defaults.difficulty, lessonId: lesson?.id,
      chapter: chapter ? `Chương ${chapter.number}: ${chapter.title}` : "",
      explanation: fields.get("giai thich")?.trim() || undefined, showInLesson: false,
    };
    const answer = fields.get("dap an")?.trim() ?? "";
    if (!answer) errors.push("Thiếu Đáp án.");
    let input: QuestionInputV2 | null = null;
    if (type === "short_answer") {
      const correctAnswer = normalizeNumericAnswer(answer);
      if (correctAnswer === null) errors.push("Đáp án phải là số, ví dụ 125 hoặc -12,5; không kèm đơn vị hay dấu tách hàng nghìn.");
      if (options.size) errors.push("Trả lời ngắn không có phương án A., B. hoặc các ý a., b.");
      input = { ...common, type, correctAnswer: correctAnswer ?? "" };
    } else if (type === "single_choice" || type === "multiple_choice") {
      if (options.size < 2) errors.push("Cần ít nhất 2 phương án A., B., ...");
      if ([...options.keys()].some((label, index) => label !== String.fromCharCode(65 + index))) errors.push("Các phương án cần theo thứ tự A., B., C., ... và không bỏ nhãn ở giữa.");
      for (const [label, text] of options) if (!text.trim()) errors.push(`Phương án ${label} chưa có nội dung.`);
      const answers = answer.toUpperCase().split(/[,;\s]+/).filter(Boolean);
      if (new Set(answers).size !== answers.length || answers.some((label) => !options.has(label))) errors.push("Đáp án bị lặp hoặc không khớp nhãn phương án.");
      if (type === "single_choice" && answers.length !== 1) errors.push("Chọn 1 đáp án phải có đúng một đáp án, ví dụ Đáp án: B.");
      if (type === "multiple_choice" && !answers.length) errors.push("Chọn nhiều đáp án cần ít nhất một đáp án, ví dụ Đáp án: A, C.");
      const choices = [...options].map(([label, text]) => ({ label, id: crypto.randomUUID(), text }));
      const values = choices.map(({ id, text }) => ({ id, text }));
      input = type === "single_choice"
        ? { ...common, type, options: values, correctOptionId: choices.find((item) => item.label === answers[0])?.id ?? "" }
        : { ...common, type, options: values, correctOptionIds: choices.filter((item) => answers.includes(item.label)).map((item) => item.id) };
    } else if (type === "true_false") {
      const correctAnswer = booleanAnswer(answer);
      if (correctAnswer === undefined) errors.push("Đáp án Đúng / Sai chỉ nhận Đúng hoặc Sai.");
      if (options.size) errors.push("Đúng / Sai không có phương án A., B. Dùng Đúng / Sai nhiều ý nếu có nhiều phát biểu.");
      input = { ...common, type, correctAnswer: correctAnswer ?? false };
    } else if (type === "true_false_group") {
      if (options.size < 2) errors.push("Đúng / Sai nhiều ý cần ít nhất hai ý a., b., ...");
      if ([...options.keys()].some((label, index) => label !== String.fromCharCode(65 + index))) errors.push("Các ý cần theo thứ tự a., b., c., ... và không bỏ nhãn ở giữa.");
      const answers = new Map<string, boolean>();
      for (const entry of answer.split(/[;,]/).filter(Boolean)) {
        const pair = entry.trim().match(/^([a-z])[.)]?\s*[-:=]\s*(.+)$/i);
        const value = pair ? booleanAnswer(pair[2]) : undefined;
        const label = pair?.[1].toUpperCase();
        if (!label || value === undefined || answers.has(label) || !options.has(label)) errors.push(`Đáp án ý chưa đúng định dạng hoặc bị lặp: “${entry.trim()}”. Dùng a-Đúng; b-Sai.`);
        else answers.set(label, value);
      }
      const statements = [...options].map(([label, text]) => {
        if (!text.trim()) errors.push(`Ý ${label} chưa có nội dung.`);
        if (!answers.has(label)) errors.push(`Thiếu đáp án Đúng/Sai của ý ${label}.`);
        return { id: crypto.randomUUID(), content: text, correctAnswer: answers.get(label) ?? false };
      });
      input = { ...common, type, statements };
    }
    return { number: block.number, content, errors: [...new Set(errors)], input: errors.length ? null : input };
  });
}

const TEMPLATE_LINES = [
  "WEBSTUDY — MẪU NHẬP CÂU HỎI TỪ WORD",
  "Giữ nhãn Câu N:, Loại:, Đáp án:. Mỗi phương án/ý là một đoạn riêng, bắt đầu bằng A., B. hoặc a., b. Không dùng đánh số tự động của Word.",
  "Bài và Mức độ là tùy chọn: bỏ cả dòng để dùng lựa chọn chung khi tải lên. Bài ghi số bài trong chương trình Địa lí 10. Loại và Đáp án bắt buộc cho từng câu.",
  "Chỉ nhập nội dung chữ. Chưa nhập ảnh, bảng, công thức và sửa đổi đang theo dõi. Có thể thêm ảnh bằng form sửa câu sau khi nhập. Xóa các câu ví dụ bên dưới rồi thay bằng câu của bạn.",
  "Câu 1: Bản đồ thường được sử dụng để làm gì?", "Loại: Chọn 1 đáp án", "Bài: 1", "Mức độ: Nhận biết",
  "A. Thể hiện sự phân bố các đối tượng địa lí", "B. Thay thế hoàn toàn việc quan sát thực địa", "C. Chỉ để trang trí", "D. Dự đoán chính xác mọi hiện tượng",
  "Đáp án: A", "Giải thích: Bản đồ thể hiện các đối tượng địa lí trên bề mặt Trái Đất.",
  "Câu 2: Đâu là các nguồn thu thập thông tin địa lí?", "Loại: Chọn nhiều đáp án", "Mức độ: Thông hiểu",
  "A. Bản đồ", "B. Số liệu thống kê", "C. Phỏng đoán không có căn cứ", "Đáp án: A, B", "Giải thích: Có thể khai thác thông tin từ bản đồ và số liệu thống kê.",
  "Câu 3: Trái Đất tự quay quanh trục.", "Loại: Đúng / Sai", "Đáp án: Đúng",
  "Câu 4: Xác định tính đúng sai của các phát biểu về bản đồ.", "Loại: Đúng / Sai nhiều ý",
  "a. Bản đồ có thể thể hiện các đối tượng địa lí.", "b. Mọi bản đồ đều có cùng một tỉ lệ.",
  "Đáp án: a-Đúng; b-Sai", "Giải thích: Bản đồ có thể có nhiều tỉ lệ khác nhau.",
  "Câu 5: Một khu vực có dân số 1000 người và diện tích 8 km². Tính mật độ dân số (người/km²).", "Loại: Trả lời ngắn (số)", "Mức độ: Vận dụng", "Đáp án: 125", "Giải thích: Mật độ dân số = dân số / diện tích = 1000 / 8 = 125 người/km².",
];

export async function downloadQuestionWordTemplate() {
  const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file("_rels/.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="${WORD_NS}"><w:body>${TEMPLATE_LINES.map((text) => `<w:p><w:pPr><w:spacing w:after="160"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">${escape(text)}</w:t></w:r></w:p>`).join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`);
  const blob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = "WebStudy-mau-cau-hoi.docx";
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
