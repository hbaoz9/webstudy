import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpenText, GraduationCap, ListPlus, Plus } from "lucide-react";
import { VerificationBanner } from "../../components/teacher/VerificationBanner";
import { useAuth } from "../../contexts/AuthContext";
import { listTeacherClassrooms, type TeacherClassroom } from "../../service/api/classrooms";
import { listAssessments, type Assessment } from "../../service/api/assessments";
import { listDistributions, type Distribution } from "../../service/api/distributions";

const card = "rounded-2xl border border-line bg-white p-5 shadow-card";
const link = "inline-flex min-h-11 items-center text-sm font-bold text-emerald-800";
type DashboardData = {
  classrooms: TeacherClassroom[];
  assessments: Assessment[];
  assessmentTotal: number;
  distributions: Distribution[];
  distributionTotal: number;
};

export default function TeacherDashboardApiPage() {
  const { session } = useAuth();
  return <DashboardSession key={session?.userId ?? "none"} verified={session?.teacherVerificationStatus === "verified"} name={session?.name ?? ""} />;
}

function DashboardSession({ verified, name }: { verified: boolean; name: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!verified) { setLoading(false); return; }
    let current = true;
    setData(null); setError(false); setLoading(true);
    void Promise.all([listTeacherClassrooms(), listAssessments(), listDistributions()])
      .then(([classrooms, assessments, distributions]) => {
        if (current) setData({ classrooms: classrooms.filter(item => item.status === "active"),
          assessments: assessments.data, assessmentTotal: assessments.meta.total,
          distributions: distributions.data, distributionTotal: distributions.meta.total });
      })
      .catch(() => { if (current) setError(true); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [verified, reload]);

  const active = data?.distributions.filter(item => item.lifecycleStatus === "active") ?? [];
  return <main className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
    <VerificationBanner />
    <header className="rounded-3xl bg-ink p-6 text-white shadow-card sm:p-8">
      <p className="text-sm font-semibold text-emerald">WebStudy · Giáo viên</p>
      <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">{name ? `Xin chào, ${name} 👋` : "Xin chào 👋"}</h1>
      <p className="mt-2 text-sm text-slate-300">Lớp học, đề và bài đã giao được tải từ máy chủ.</p>
    </header>
    {!verified ? <p className={card}>Tài khoản giáo viên cần được xác minh để xem dữ liệu lớp học.</p>
      : loading ? <p role="status" className={card}>Đang tải tổng quan từ máy chủ…</p>
      : error || !data ? <section role="alert" className={card}>
        <p>Không thể tải tổng quan. Vui lòng thử lại.</p>
        <button className="mt-3 min-h-11 rounded-xl bg-emerald px-4 text-sm font-bold text-white" onClick={() => setReload(value => value + 1)}>Thử lại</button>
      </section> : <>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link to="/teacher/classes" className={card}><GraduationCap className="mb-3 size-6 text-emerald" /><strong className="block text-2xl">{data.classrooms.length}</strong><span className="text-sm text-secondary">Lớp đang dạy</span></Link>
          <Link to="/teacher/assessments" className={card}><BookOpenText className="mb-3 size-6 text-emerald" /><strong className="block text-2xl">{data.assessmentTotal}</strong><span className="text-sm text-secondary">Đề đã tạo</span></Link>
          <Link to="/teacher/assessments" className={card}><ListPlus className="mb-3 size-6 text-emerald" /><strong className="block text-2xl">{data.distributionTotal}</strong><span className="text-sm text-secondary">Bài đã giao</span></Link>
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <section className="space-y-3" aria-labelledby="dashboard-distributions">
            <div className="flex items-center justify-between gap-2"><h2 id="dashboard-distributions" className="text-xl font-extrabold">Bài tập & Kiểm tra</h2>
              <Link className={link} to="/teacher/assessments">Xem tất cả →</Link></div>
            {active.length === 0 ? <p className={card}>Chưa có bài được giao đang hoạt động.</p> :
              <ul className="space-y-2">{active.slice(0, 5).map(item => <li key={item.id} className={card}>
                <Link to={`/teacher/assessments?distribution=${encodeURIComponent(item.id)}`} className="block font-bold text-ink hover:text-emerald-800">{item.assessmentTitle}</Link>
                <p className="mt-1 text-sm text-secondary">{item.classroomName} · Hạn {new Date(item.deadlineAt).toLocaleString("vi-VN")}</p>
                <p className="mt-1 text-xs text-secondary">{item.status === "scheduled" ? "Chưa mở" : item.status === "expired" ? "Đã qua hạn bắt đầu" : "Đang mở"}</p>
              </li>)}</ul>}
            {data.distributionTotal > data.distributions.length && <p className="text-xs text-secondary">Hiển thị các bài gần đây trên trang đầu. Mở danh sách để xem thêm.</p>}
          </section>
          <div className="space-y-6">
            <section className="space-y-3" aria-labelledby="dashboard-classes">
              <div className="flex items-center justify-between gap-2"><h2 id="dashboard-classes" className="text-xl font-extrabold">Lớp của tôi</h2><Link className={link} to="/teacher/classes">Xem tất cả →</Link></div>
              {data.classrooms.length === 0 ? <p className={card}>Chưa có lớp đang hoạt động.</p> :
                <ul className="space-y-2">{data.classrooms.slice(0, 5).map(item => <li key={item.id} className={card}>
                  <Link className="font-bold text-ink hover:text-emerald-800" to={`/teacher/classes/${item.id}`}>{item.name}</Link>
                  <p className="mt-1 text-sm text-secondary">{item.studentCount} học sinh · Năm học {item.academicYear}</p>
                </li>)}</ul>}
            </section>
            <section className={card} aria-label="Thao tác nhanh">
              <h2 className="text-xl font-extrabold">Thao tác nhanh</h2>
              <div className="mt-3 flex flex-wrap gap-3 text-sm font-bold">
                <Link className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald px-4 text-white" to="/teacher/assessments"><Plus className="size-4" /> Tạo đề hoặc giao bài</Link>
                <Link className={link} to="/teacher/lessons">Soạn bài học →</Link>
                <Link className={link} to="/teacher/questions/new">Thêm câu hỏi →</Link>
              </div>
            </section>
          </div>
        </div>
        {data.assessments.length === 0 && <p className="text-sm text-secondary">Bạn có thể soạn đề trước rồi giao cho lớp sau.</p>}
      </>}
  </main>;
}
