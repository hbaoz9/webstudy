// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StudentNotificationsPanel } from "./StudentNotificationsPanel";
import { listStudentNotifications, markStudentNotificationRead } from "../../service/api/distributions";

let userId = "student-a";
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => ({ status: "ready", session: { role: "student", userId } }) }));
vi.mock("../../service/api/distributions", () => ({ listStudentNotifications: vi.fn(), markStudentNotificationRead: vi.fn() }));

let host: HTMLDivElement;
let root: Root;
const notice = (id: string, title: string) => ({ id, distributionId: "distribution", type: "distribution_cancelled",
  title, body: "Bài đã hủy", createdAt: "2026-11-07T10:00:00Z", readAt: null });

describe("student cancellation inbox", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    userId = "student-a";
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

  it("does not show an empty notification card on the dashboard", async () => {
    vi.mocked(listStudentNotifications).mockResolvedValue({ data: [], meta: { lastPage: 1 } } as never);
    await act(async () => root.render(<StudentNotificationsPanel />));
    expect(host.querySelector('[aria-label="Thông báo của bạn"]')).toBeNull();
  });

  it("reads a durable notice and marks only the selected notice read", async () => {
    vi.mocked(listStudentNotifications).mockResolvedValue({ data: [notice("n1", "Đã hủy")], meta: { lastPage: 1 } } as never);
    vi.mocked(markStudentNotificationRead).mockResolvedValue({ ...notice("n1", "Đã hủy"), readAt: "2026-11-07T11:00:00Z" } as never);
    await act(async () => root.render(<StudentNotificationsPanel />));
    expect(host.textContent).toContain("Đã hủy");
    await act(async () => [...host.querySelectorAll("button")].find(button => button.textContent === "Đánh dấu đã đọc")?.click());
    expect(markStudentNotificationRead).toHaveBeenCalledWith("n1");
    expect(host.textContent).not.toContain("Đánh dấu đã đọc");
  });

  it("hides the previous student's notice immediately on session change", async () => {
    let resolveB: (value: never) => void = () => {};
    vi.mocked(listStudentNotifications).mockResolvedValueOnce({ data: [notice("n1", "Riêng A")], meta: { lastPage: 1 } } as never)
      .mockImplementationOnce(() => new Promise(resolve => { resolveB = resolve; }));
    await act(async () => root.render(<StudentNotificationsPanel />));
    expect(host.textContent).toContain("Riêng A");
    userId = "student-b";
    await act(async () => root.render(<StudentNotificationsPanel />));
    expect(host.textContent).not.toContain("Riêng A");
    await act(async () => resolveB({ data: [notice("n2", "Riêng B")], meta: { lastPage: 1 } } as never));
    expect(host.textContent).toContain("Riêng B");
  });
});
