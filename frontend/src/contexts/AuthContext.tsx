import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { STUDENT_PROFILE_KEY, useStudentAccount } from "./StudentAccountContext";
import { TEACHER_ACCOUNT_KEY, useTeacherAccount } from "./TeacherAccountContext";

export type AuthRole = "teacher" | "student";
type AuthSession = { role: AuthRole; userId: string };
type AuthContextValue = {
  session: AuthSession | null;
  error: string;
  signIn: (role: AuthRole) => boolean;
  signOut: () => boolean;
};
const SESSION_KEY = "webstudy-mock-session-v1";
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readSession(): AuthSession | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null");
    if (!value || typeof value !== "object" || !("role" in value) || !("userId" in value)) return null;
    if ((value.role !== "teacher" && value.role !== "student") || typeof value.userId !== "string" || !value.userId.trim()) return null;
    return { role: value.role, userId: value.userId };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { student, hasStudentProfile } = useStudentAccount();
  const { teacherAccount } = useTeacherAccount();
  const [storedSession, setStoredSession] = useState(readSession);
  const [error, setError] = useState("");
  const studentId = hasStudentProfile ? student.id : undefined;
  const teacherId = teacherAccount.profile?.id;
  // Phiên chỉ hợp lệ khi còn khớp danh tính local. Không thay đổi ID hồ sơ cũ.
  const session = storedSession && storedSession.userId ===
    (storedSession.role === "student" ? studentId : teacherId) ? storedSession : null;

  useEffect(() => {
    const refresh = (event: StorageEvent) => {
      if (event.key === SESSION_KEY || event.key === null) {
        setStoredSession(readSession());
        setError("");
      }
    };
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);

  const signIn = useCallback((role: AuthRole) => {
    const userId = role === "student" ? studentId : teacherId;
    if (!userId) {
      setError("Hồ sơ chưa sẵn sàng. Vui lòng kiểm tra tên và email.");
      return false;
    }
    const nextSession = { role, userId };
    try {
      // Lưu hồ sơ trước phiên, kể cả khi effect của context chưa chạy sau khởi tạo.
      localStorage.setItem(role === "student" ? STUDENT_PROFILE_KEY : TEACHER_ACCOUNT_KEY,
        JSON.stringify(role === "student" ? student : teacherAccount));
      localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
      setStoredSession(nextSession);
      setError("");
      return true;
    } catch {
      setError("Không lưu được phiên trên trình duyệt. Vui lòng thử lại.");
      return false;
    }
  }, [studentId, teacherId, student, teacherAccount]);

  const signOut = useCallback(() => {
    try {
      localStorage.removeItem(SESSION_KEY);
      setStoredSession(null);
      setError("");
      return true;
    } catch {
      setError("Không xóa được phiên trên trình duyệt. Vui lòng thử đăng xuất lại.");
      return false;
    }
  }, []);

  const value = useMemo(() => ({ session, error, signIn, signOut }), [session, error, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth phải được sử dụng bên trong AuthProvider.");
  return context;
}
