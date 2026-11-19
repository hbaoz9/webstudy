// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import TeacherDashboardApiPage from "./TeacherDashboardApiPage";

let userId = "teacher-a";
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => ({ session: { userId, name: "Cô An", teacherVerificationStatus: "verified" } }) }));
vi.mock("../../components/teacher/VerificationBanner", () => ({ VerificationBanner: () => null }));
const api = vi.hoisted(() => ({ classes: vi.fn(), assessments: vi.fn(), distributions: vi.fn() }));
vi.mock("../../service/api/classrooms", () => ({ listTeacherClassrooms: api.classes }));
vi.mock("../../service/api/assessments", () => ({ listAssessments: api.assessments }));
vi.mock("../../service/api/distributions", () => ({ listDistributions: api.distributions }));

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  userId = "teacher-a";
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  api.classes.mockResolvedValue([{ id: "class-1", name: "10A1", status: "active", studentCount: 32, academicYear: "2026-2027" }]);
  api.assessments.mockResolvedValue({ data: [], meta: { total: 4 } });
  api.distributions.mockResolvedValue({ data: [{ id: "dist-1", assessmentTitle: "Đề địa lí", classroomName: "10A1",
    lifecycleStatus: "active", status: "open", deadlineAt: "2026-12-01T00:00:00Z" }], meta: { total: 1 } });
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.clearAllMocks(); });

it("shows server classrooms, assessments and distributions without prototype submissions", async () => {
  await act(async () => { root.render(<MemoryRouter><TeacherDashboardApiPage /></MemoryRouter>); });
  expect(api.classes).toHaveBeenCalledOnce();
  expect(api.assessments).toHaveBeenCalledOnce();
  expect(api.distributions).toHaveBeenCalledOnce();
  expect(document.body.textContent).toContain("Đề địa lí");
  expect(document.body.textContent).toContain("10A1");
  expect(document.querySelector('a[href="/teacher/assessments?distribution=dist-1"]')).not.toBeNull();
  expect(document.body.textContent).not.toContain("Điểm TB");
});

it("does not show old account data when the session changes", async () => {
  await act(async () => { root.render(<MemoryRouter><TeacherDashboardApiPage /></MemoryRouter>); });
  let resolve: (value: unknown) => void = () => {};
  api.distributions.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  userId = "teacher-b";
  await act(async () => { root.render(<MemoryRouter><TeacherDashboardApiPage /></MemoryRouter>); });
  expect(document.body.textContent).not.toContain("Đề địa lí");
  await act(async () => { resolve({ data: [], meta: { total: 0 } }); });
  expect(document.body.textContent).not.toContain("Đề địa lí");
});
