import { useEffect, useRef, useState } from "react";
import { getVerificationDocument, type VerificationDocument } from "../../service/api/client";

type Preview = { url: string; contentType: VerificationDocument["contentType"] };

export function VerificationDocumentViewer({ submissionId, label }: { submissionId: number; label: string }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview.url);
  }, [preview]);

  const open = async () => {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const document = await getVerificationDocument(submissionId);
      const url = URL.createObjectURL(document.blob);
      if (!mounted.current) { URL.revokeObjectURL(url); return; }
      setPreview({ url, contentType: document.contentType });
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Không thể tải minh chứng.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  return <div className="mt-3 space-y-3">
    {preview ? <>
      <button type="button" onClick={() => setPreview(null)} className="min-h-11 font-bold text-emerald underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald">Đóng minh chứng</button>
      {preview.contentType === "application/pdf"
        ? <iframe title={label} src={preview.url} className="h-[60vh] min-h-80 w-full rounded-xl border border-line bg-white" />
        : <img src={preview.url} alt={label} className="max-h-[60vh] max-w-full rounded-xl border border-line object-contain" />}
    </> : <button type="button" disabled={loading} onClick={() => void open()} className="min-h-11 font-bold text-emerald underline disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald">{loading ? "Đang tải minh chứng…" : label}</button>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}
