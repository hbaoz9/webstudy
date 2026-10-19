import { useEffect, useRef, useState, type FormEvent } from "react";
import { EditorContent, Node, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import type { CommandProps, JSONContent } from "@tiptap/react";
import type { DOMOutputSpec } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Markdown } from "@tiptap/markdown";
import { Bold, Italic, Heading3, List, ListOrdered, RemoveFormatting, Undo2, Redo2, ImagePlus, Video, Library } from "lucide-react";
import { LessonBody, safeUrl, formatImageCaption, type LessonBodyEditorProps } from "./LessonBody";
import { readLearningAssetReference, parseLearningAssetReferenceHref, learningAssetReferenceMarkdown } from "../../utils/lessonContentStorage";
import { getYouTubeVideoId } from "../media/InteractiveVideoPlayer";
import Dialog from "./Dialog";
import LearningAssetView, { UploadedInfographicImage } from "../infographic/LearningAssetView";
import { getUploadedInfographic, listUploadedInfographics, type UploadedInfographic } from "../../utils/uploadedInfographicStorage";
import { geo10Chapters } from "../../data/geo10Curriculum";

function AssetNodeView({ node, selected }: NodeViewProps) {
  const reference = readLearningAssetReference(node.attrs);
  return <NodeViewWrapper contentEditable={false} data-learning-asset-reference={reference?.version} data-asset-id={reference?.assetId} className={selected ? "rounded-xl outline outline-2 outline-emerald-700" : ""}>
    {reference ? <LearningAssetView assetId={reference.assetId} audience="teacher" /> : <p>Học liệu không hợp lệ.</p>}
  </NodeViewWrapper>;
}

function InfographicPicker({ chapterId, lessonId, onClose, onChoose }: {
  chapterId: string; lessonId: string; onClose: () => void; onChoose: (item: UploadedInfographic) => void;
}) {
  const [chapter, setChapter] = useState(chapterId);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<UploadedInfographic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [limit, setLimit] = useState(12);
  const [choosing, setChoosing] = useState(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    let current = true;
    setLoading(true); setItems([]); setError(""); setLimit(12);
    Promise.all([
      listUploadedInfographics("chapter", chapter),
      ...(chapter === chapterId ? [listUploadedInfographics("lesson", lessonId)] : []),
    ]).then(groups => {
      if (current) { setItems(groups.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt))); setLoading(false); }
    }).catch(() => {
      if (current) { setError("Chưa tải được thư viện. Bạn có thể thử lại."); setLoading(false); }
    });
    return () => { current = false; };
  }, [chapter, chapterId, lessonId, reload]);
  async function choose(id: string) {
    if (choosing) return;
    setChoosing(true); setError("");
    try {
      const item = await getUploadedInfographic(id);
      if (!active.current) return;
      if (!item) { setError("Ảnh vừa bị xóa khỏi thư viện. Hãy chọn ảnh khác hoặc tải lại."); return; }
      onChoose(item);
    } catch {
      if (active.current) setError("Chưa đọc được ảnh đã chọn. Hãy thử lại.");
    } finally { if (active.current) setChoosing(false); }
  }
  const filtered = items.filter(item => item.title.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")));
  return <Dialog title="Chèn infographic từ thư viện" onClose={onClose}>
    <p className="mb-4 text-sm text-secondary">Chèn tại vị trí con trỏ. Học liệu chưa đăng vẫn lưu được trong bản soạn; học sinh chỉ thấy khi học liệu và bài học đều đã đăng.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-semibold">Chương
        <select value={chapter} disabled={choosing} onChange={e => { setChapter(e.target.value); setQuery(""); }} className="mt-2 min-h-11 w-full rounded-xl border border-line bg-white px-3">
          {geo10Chapters.map(item => <option key={item.id} value={item.id}>Chương {item.number}. {item.title}</option>)}
        </select>
      </label>
      <label className="text-sm font-semibold">Tìm infographic
        <input type="search" value={query} disabled={choosing} onChange={e => { setQuery(e.target.value); setLimit(12); }} className="mt-2 min-h-11 w-full rounded-xl border border-line px-3" placeholder="Nhập tên học liệu…" />
      </label>
    </div>
    {error && <div role="alert" className="mt-4 text-sm text-red-700">{error} <button type="button" disabled={choosing} onClick={() => setReload(n => n + 1)} className="min-h-11 px-3 font-bold underline">Tải lại thư viện</button></div>}
    {loading ? <p role="status" className="py-6 text-sm text-secondary">Đang tải thư viện…</p> : <>
      {!filtered.length && !error && <p role="status" className="py-6 text-sm text-secondary">{items.length ? "Không có infographic khớp với tên này." : "Chưa có infographic trong chương này. Bạn có thể đổi chương hoặc tải ảnh lên tại Học liệu trực quan."}</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {filtered.slice(0, limit).map(item => <article key={item.id} className="min-w-0 rounded-xl border border-line p-3">
          <UploadedInfographicImage item={item} />
          <h3 className="mt-3 break-words text-sm font-bold">{item.title}</h3>
          <p className="mt-1 text-sm text-secondary">{item.visibility === "published" ? "Đã đăng" : "Bản nháp · Học sinh chưa thấy"}</p>
          <button type="button" disabled={choosing} onClick={() => void choose(item.id)} className="mt-3 min-h-11 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50" aria-label={`Chèn ${item.title}`}>Chèn vào bài</button>
        </article>)}
      </div>
      {filtered.length > limit && <button type="button" onClick={() => setLimit(n => n + 12)} className="mt-4 min-h-11 rounded-xl border border-line px-4 text-sm font-semibold">Xem thêm</button>}
    </>}
  </Dialog>;
}

// Render the stored image description directly below the image in the editor.
// The image remains the same Markdown node; the caption is display-only.
const CaptionedImage = Image.extend({
  parseHTML() {
    return [
      {
        tag: "figure[data-lesson-image]",
        getAttrs: element => {
          const image = element.querySelector("img");
          if (!image) return false;
          return { src: image.getAttribute("src"), alt: image.getAttribute("alt"), title: image.getAttribute("title") };
        },
      },
      ...(this.parent?.() ?? []),
    ];
  },
  renderHTML({ HTMLAttributes }): DOMOutputSpec {
    const caption = formatImageCaption(typeof HTMLAttributes.alt === "string" ? HTMLAttributes.alt : "");
    return [
      "figure", { "data-lesson-image": "true", class: "space-y-2" },
      ["img", { ...HTMLAttributes, class: "mx-auto h-auto max-h-[480px] max-w-full rounded-xl object-contain" }],
      ...(caption ? [["figcaption", { class: "text-center text-sm leading-6 text-secondary [overflow-wrap:anywhere]" }, caption] as DOMOutputSpec] : []),
    ];
  },
});

// A dedicated block token avoids changing normal Markdown link/image parsing.
const LearningAssetNode = Node.create({
  name: "learningAssetReference",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addNodeView() { return ReactNodeViewRenderer(AssetNodeView); },
  addAttributes() {
    return { version: { default: 1 }, kind: { default: "infographic" }, assetId: { default: null } };
  },
  parseHTML() {
    return [{
      tag: "div[data-learning-asset-reference]",
      getAttrs: element => readLearningAssetReference({
        version: Number(element.getAttribute("data-learning-asset-reference")),
        kind: element.getAttribute("data-asset-kind"), assetId: element.getAttribute("data-asset-id"),
      }) ?? false,
    }];
  },
  renderHTML({ node }): DOMOutputSpec {
    const reference = readLearningAssetReference(node.attrs);
    return ["div", {
      "data-learning-asset-reference": reference?.version ?? "invalid",
      "data-asset-kind": reference?.kind ?? "", "data-asset-id": reference?.assetId ?? "",
      class: "my-2 rounded-xl border border-line bg-canvas p-4 text-sm font-semibold text-secondary",
    }, reference ? "Học liệu trực quan" : "Học liệu không hợp lệ"];
  },
  renderText({ node }) {
    const reference = readLearningAssetReference(node.attrs);
    return reference ? learningAssetReferenceMarkdown(reference) : "Học liệu không hợp lệ";
  },
  markdownTokenizer: {
    name: "learningAssetReference",
    level: "block",
    start: src => {
      // Marked calls start() with the first character removed. Only announce
      // a following line, otherwise an escaped opening bracket can be split
      // off and the remaining literal text mistaken for an asset block.
      const match = /\n(\[Học liệu\]\(webstudy-asset:\/\/)/.exec(src);
      return match ? match.index + 1 : -1;
    },
    tokenize: src => {
      const match = /^\[Học liệu\]\(([^)\r\n]+)\)[ \t]*(?:\r?\n|$)/.exec(src);
      const reference = match ? parseLearningAssetReferenceHref(match[1]) : null;
      return match && reference ? { type: "learningAssetReference", raw: match[0], reference } : undefined;
    },
  },
  parseMarkdown: (token, helpers) => {
    const reference = readLearningAssetReference(token.reference);
    return reference ? helpers.createNode("learningAssetReference", reference) : [];
  },
  renderMarkdown: node => {
    const reference = readLearningAssetReference(node.attrs);
    return reference ? learningAssetReferenceMarkdown(reference) : "Học liệu không hợp lệ";
  },
});

// Shared configuration for visual editing and Markdown roundtrip checks.
export function createLessonEditorExtensions() {
  return [
    StarterKit.configure({ trailingNode: false, underline: false, strike: false, link: { openOnClick: false } }),
    CaptionedImage.configure({ inline: false, allowBase64: false }),
    LearningAssetNode,
    Markdown.configure({ markedOptions: { breaks: true, gfm: false } }),
  ];
}

// Plain legacy lessons must keep literal punctuation and line breaks.
function plainDocument(value: string): JSONContent {
  const content: JSONContent[] = [];
  value.split("\n").forEach((line, index) => {
    if (index) content.push({ type: "hardBreak" });
    if (line) content.push({ type: "text", text: line });
  });
  return { type: "doc", content: [{ type: "paragraph", content }] };
}

// Legacy/plain content can contain several visible lines inside one text block.
// Split its hard breaks in the same transaction before applying a block tool,
// so the mapped selection still targets only the line(s) the teacher chose.
function separateSelectedLines({ tr }: CommandProps): boolean {
  const { from, to, anchor, head } = tr.selection;
  const breaks: number[] = [];
  tr.doc.descendants((node, pos) => {
    if (node.type.name !== "paragraph" && node.type.name !== "heading") return;
    const start = pos + 1;
    const end = pos + node.nodeSize - 1;
    if (from > end || to < start || (from < to && to === start)) return false;
    node.forEach((child, offset) => {
      if (child.type.name === "hardBreak") breaks.push(start + offset);
      // Markdown soft breaks may be literal newlines in a text node.
      if (child.isText && child.text) {
        for (const match of child.text.matchAll(/\n/g)) {
          breaks.push(start + offset + match.index);
        }
      }
    });
    return false;
  });
  // Work backwards so earlier positions remain valid. ProseMirror maps the
  // caret/selection through each split; undo reverses the whole action at once.
  for (const pos of [...breaks].reverse()) {
    tr.delete(pos, pos + 1);
    tr.split(pos);
  }
  if (breaks.length) {
    // A break occupies one position; a paragraph boundary occupies two.
    // Keep a range ending before a break on the left line, not the next one.
    const map = (point: number) => point + breaks.filter(pos => pos < point).length;
    tr.setSelection(TextSelection.between(
      tr.doc.resolve(map(anchor)), tr.doc.resolve(map(head)),
    ));
  }
  return true;
}

export default function LessonRichTextEditor({
  title, value, format, onChange, hidePreview = false, layout = "stacked", lessonId, chapterId,
}: LessonBodyEditorProps) {
  const lastValue = useRef({ value, format });
  const selection = useRef({ from: 1, to: 1 });
  const [insertKind, setInsertKind] = useState<"image" | "video" | null>(null);
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const editor = useEditor({
    shouldRerenderOnTransaction: true,
    extensions: createLessonEditorExtensions(),
    content: format === "markdown" ? value : plainDocument(value),
    ...(format === "markdown" ? { contentType: "markdown" as const } : {}),
    editorProps: {
      attributes: {
        role: "textbox", "aria-label": title, "aria-multiline": "true",
        class: "min-h-40 w-full min-w-0 rounded-xl border border-line bg-white p-3 text-sm leading-7 text-secondary outline-none focus:border-emerald-700 [overflow-wrap:anywhere] [&_strong]:font-bold [&_em]:italic [&_h1]:text-xl [&_h2]:text-lg [&_h3]:text-base [&_h4]:text-base [&_h5]:text-base [&_h6]:text-base [&_h1]:font-bold [&_h1]:leading-7 [&_h2]:font-bold [&_h2]:leading-7 [&_h3]:font-bold [&_h3]:leading-7 [&_h4]:font-bold [&_h4]:leading-7 [&_h5]:font-bold [&_h5]:leading-7 [&_h6]:font-bold [&_h6]:leading-7 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_img]:mx-auto [&_img]:max-h-[480px] [&_img]:max-w-full [&_img]:rounded-xl [&_a]:text-emerald-800 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_pre]:overflow-x-auto [&_pre]:bg-slate-100 [&_pre]:p-3",
      }
    },
    onUpdate: ({ editor: current }) => {
      const next = current.isEmpty ? "" : current.getMarkdown();
      lastValue.current = { value: next, format: "markdown" };
      onChange(next, "markdown");
    },
  });
  useEffect(() => {
    if (!editor || (lastValue.current.value === value && lastValue.current.format === format)) return;
    lastValue.current = { value, format };
    editor.commands.setContent(format === "markdown" ? value : plainDocument(value), {
      emitUpdate: false, ...(format === "markdown" ? { contentType: "markdown" } : {}),
    });
    setInsertKind(null);
    setPickerOpen(false);
  }, [editor, value, format]);

  function toggleList(type: "bulletList" | "orderedList") {
    if (!editor) return;
    const other = type === "bulletList" ? "orderedList" : "bulletList";
    const chain = editor.chain().focus(undefined, { scrollIntoView: false }).command(separateSelectedLines);
    // Lift only the selected items before changing type; the default list
    // toggle changes the entire parent list, including unselected neighbours.
    if (editor.isActive(other)) chain.liftListItem("listItem");
    if (type === "bulletList") chain.toggleBulletList().run();
    else chain.toggleOrderedList().run();
  }

  function openInsert(kind: "image" | "video") {
    if (!editor) return;
    selection.current = { from: editor.state.selection.from, to: editor.state.selection.to };
    setInsertKind(kind); setUrl(""); setCaption(""); setError("");
  }
  function cancelInsert() {
    setInsertKind(null);
    editor?.chain().focus(undefined, { scrollIntoView: false }).setTextSelection(selection.current).run();
  }
  function submitInsert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleaned = safeUrl(url);
    if (!cleaned || (insertKind === "video" && !getYouTubeVideoId(cleaned))) {
      setError(insertKind === "image" ? "Nhập liên kết ảnh HTTP hoặc HTTPS hợp lệ." : "Nhập liên kết YouTube HTTPS hợp lệ.");
      return;
    }
    if (!editor) return;
    const chain = editor.chain().focus(undefined, { scrollIntoView: false }).setTextSelection(selection.current.to);
    if (insertKind === "image") chain.setImage({ src: cleaned, alt: caption.trim() }).run();
    else chain.insertContent({ type: "paragraph", content: [{ type: "text", text: "Video YouTube", marks: [{ type: "link", attrs: { href: cleaned } }] }] }).run();
    setInsertKind(null); setError("");
  }

  const toolbar = (
    <div
      role="toolbar"
      aria-label={`Định dạng ${title}`}
      className="flex flex-wrap gap-1 sm:gap-2"
      onPointerDown={(event) => {
        if (
          event.target instanceof Element &&
          event.target.closest("button")
        )
          event.preventDefault();
      }}
    >
      {[
        { label: "In đậm", Icon: Bold, active: editor?.isActive("bold"), action: () => editor?.chain().focus(undefined, { scrollIntoView: false }).toggleBold().run() },
        { label: "In nghiêng", Icon: Italic, active: editor?.isActive("italic"), action: () => editor?.chain().focus(undefined, { scrollIntoView: false }).toggleItalic().run() },
        {
          label: "Tiêu đề nhỏ",
          Icon: Heading3,
          active: editor?.isActive("heading", { level: 3 }),
          action: () => editor?.chain().focus(undefined, { scrollIntoView: false }).command(separateSelectedLines).toggleHeading({ level: 3 }).run(),
        },
        { label: "Danh sách", Icon: List, active: editor?.isActive("bulletList"), action: () => toggleList("bulletList") },
        {
          label: "Danh sách đánh số", Icon: ListOrdered,
          active: editor?.isActive("orderedList"),
          action: () => toggleList("orderedList"),
        },
        {
          label: "Xóa định dạng", Icon: RemoveFormatting,
          action: () => editor?.chain().focus(undefined, { scrollIntoView: false }).command(separateSelectedLines).unsetAllMarks().clearNodes().run(),
        },
        {
          label: "Chèn hình ảnh",
          Icon: ImagePlus,
          action: () => openInsert("image"),
        },
        {
          label: "Chèn video",
          Icon: Video,
          action: () => openInsert("video"),
        },
        ...(lessonId && chapterId ? [{
          label: "Chèn infographic từ thư viện", Icon: Library,
          action: () => {
            if (!editor) return;
            selection.current = { from: editor.state.selection.from, to: editor.state.selection.to };
            setInsertKind(null); setPickerOpen(true);
          },
        }] : []),
        {
          label: "Hoàn tác", Icon: Undo2, disabled: !editor?.can().undo(),
          action: () => editor?.chain().focus(undefined, { scrollIntoView: false }).undo().run(),
        },
        {
          label: "Làm lại", Icon: Redo2, disabled: !editor?.can().redo(),
          action: () => editor?.chain().focus(undefined, { scrollIntoView: false }).redo().run(),
        },
      ].map(({ label, Icon, action, active, disabled }) => (
        <button
          key={label}
          type="button"
          onClick={action}
          title={label}
          aria-label={label}
          aria-pressed={active}
          disabled={!editor || disabled}
          className="flex size-10 shrink-0 sm:size-11 disabled:cursor-not-allowed disabled:opacity-40 items-center justify-center rounded-lg border border-line bg-white text-ink transition-colors aria-pressed:border-emerald-700 aria-pressed:bg-emerald-50 aria-pressed:text-emerald-800 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
        >
          <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
  const insertForm = (insertKind && (
    <form
      aria-label={
        insertKind === "image"
          ? "Chèn ảnh vào nội dung"
          : "Chèn video vào nội dung"
      }
      noValidate
      onSubmit={submitInsert}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          cancelInsert();
        }
      }}
      className="mt-4 space-y-3 rounded-xl border border-line bg-white p-3"
    >
      <label className="block text-sm font-semibold text-ink">
        {insertKind === "image" ? "Liên kết ảnh" : "Liên kết YouTube"}
        <input
          autoFocus
          type="url"
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            setError("");
          }}
          placeholder="https://…"
          className="mt-2 min-h-11 w-full rounded-lg border border-line px-3 font-normal"
        />
      </label>
      {insertKind === "image" && (
        <label className="block text-sm font-semibold text-ink">
          Mô tả ảnh
          <input
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            maxLength={200}
            className="mt-2 min-h-11 w-full rounded-lg border border-line px-3 font-normal"
          />
        </label>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-1 sm:gap-2">
        <button
          type="submit"
          className="min-h-11 rounded-full border border-line px-4 text-sm font-bold"
        >
          Chèn vào nội dung
        </button>
        <button
          type="button"
          onClick={cancelInsert}
          className="min-h-11 rounded-full border border-line px-4 text-sm font-semibold"
        >
          Hủy
        </button>
      </div>
    </form>
  ));
  const editorField = <>
    <EditorContent editor={editor} className="mt-4 min-w-0" />
    {pickerOpen && chapterId && lessonId && <InfographicPicker chapterId={chapterId} lessonId={lessonId}
      onClose={() => {
        setPickerOpen(false);
        editor?.chain().focus(undefined, { scrollIntoView: false }).setTextSelection(selection.current).run();
      }}
      onChoose={item => {
        editor?.chain().focus(undefined, { scrollIntoView: false }).setTextSelection(selection.current.to)
          .insertContent({ type: "learningAssetReference", attrs: { version: 1, kind: "infographic", assetId: item.id } })
          // An inserted atom can remain selected, especially in an empty body.
          // Put typing in a paragraph instead of replacing the selected asset.
          .createParagraphNear().run();
        setPickerOpen(false);
      }} />}
  </>;
  const preview = (
    <section
      aria-label={layout === "split" ? "Xem trước nội dung bài học" : `Xem trước ${title}`}
      className={layout === "split" ? "min-w-0 rounded-2xl border border-line bg-canvas/50 p-4 lg:sticky lg:top-44" : "mt-4 min-w-0 rounded-2xl border border-line bg-white p-4"}
    >
      <h3 className="min-h-6 text-base font-bold text-ink">Xem trước</h3>
      <div data-lesson-preview-content className={layout === "split" ? "mt-4 min-h-40 min-w-0 rounded-xl border border-line bg-white p-3 lg:max-h-[calc(100dvh-22rem)] lg:overflow-y-auto" : "mt-3 min-w-0"}>
        {value.trim() ? <LessonBody value={value} format={format} teacherPreview /> : <p className="text-sm text-secondary">Chưa có nội dung để xem trước.</p>}
      </div>
    </section>
  );

  if (layout === "split") return (
    <section aria-label={hidePreview ? "Soạn nội dung bài học" : "Soạn và xem trước nội dung"} className="min-w-0">
      <div className="sticky top-20 z-20 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white p-3 shadow-sm">
        {toolbar}
        <p className="hidden min-w-0 flex-1 text-[13px] leading-5 text-secondary xl:block">{hidePreview ? "Định dạng ngay trong nội dung. Chọn Xem thử để kiểm tra trước khi đăng." : "Bôi đen văn bản để định dạng. Bản xem trước cập nhật ngay khi soạn."}</p>
      </div>
      <div className={`mt-4 grid min-w-0 items-start gap-5 ${hidePreview ? "" : "lg:grid-cols-2"}`}>
        <section aria-label={title} className="min-w-0 rounded-2xl border border-line bg-canvas/50 p-4">
          <h3 className="min-h-6 text-base font-bold text-ink">{title}</h3>
          {insertForm}
          {editorField}
        </section>
        {!hidePreview && preview}
      </div>
    </section>
  );

  return <>
    <section aria-label={title} className="min-w-0 rounded-2xl border border-line bg-canvas/50 p-4">
      <h3 className="text-base font-bold text-ink">{title}</h3>
      <p className="mb-3 mt-2 text-[13px] leading-5 text-secondary">Bôi đen văn bản để định dạng hoặc chọn công cụ để thêm hình ảnh, video.</p>
      {toolbar}
      {insertForm}
      {editorField}
    </section>
    {!hidePreview && preview}
  </>;
}
