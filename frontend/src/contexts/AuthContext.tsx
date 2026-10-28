import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useStudentAccount } from "./StudentAccountContext";
import { useTeacherAccount } from "./TeacherAccountContext";
import { AUTH_UNAUTHORIZED_EVENT, ApiError, apiGet, apiRequest } from "../service/api/client";

export type AuthRole = "teacher" | "student";
export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: AuthRole | "admin";
  teacher_verification_status: "unverified" | "pending" | "verified" | "rejected" | null;
};
export type AuthSession = {
  role: AuthRole;
  userId: string;
  name: string;
  email: string;
  teacherVerificationStatus: AuthUser["teacher_verification_status"];
};
type AuthContextValue = {
  session: AuthSession | null;
  status: "loading" | "ready" | "error";
  error: string;
  signIn: (email: string, password: string) => Promise<AuthSession>;
  registerAccount: (role: AuthRole, name: string, email: string, password: string, confirmation: string) => Promise<AuthSession>;
  signOut: () => Promise<boolean>;
  refreshSession: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { setAuthenticatedStudent } = useStudentAccount();
  const { setAuthenticatedTeacher } = useTeacherAccount();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");
  const [error, setError] = useState("");
  const generation = useRef(0);

  const applyUser = useCallback((user: AuthUser | null): AuthSession | null => {
    if (!user || (user.role !== "student" && user.role !== "teacher")) {
      setSession(null);
      setAuthenticatedStudent(null);
      setAuthenticatedTeacher(null);
      return null;
    }
    const next: AuthSession = {
      role: user.role,
      userId: String(user.id),
      name: user.name,
      email: user.email,
      teacherVerificationStatus: user.teacher_verification_status,
    };
    setSession(next);
    setAuthenticatedStudent(user.role === "student" ? { id: next.userId, name: user.name, email: user.email } : null);
    setAuthenticatedTeacher(user.role === "teacher" ? {
      id: next.userId,
      name: user.name,
      email: user.email,
      verificationStatus: user.teacher_verification_status ?? "unverified",
    } : null);
    return next;
  }, [setAuthenticatedStudent, setAuthenticatedTeacher]);

  const refreshSession = useCallback(async () => {
    const current = ++generation.current;
    try {
      const response = await apiGet<{ data: AuthUser }>("/auth/me");
      if (current !== generation.current) return;
      applyUser(response.data);
      setStatus("ready");
      setError("");
    } catch (cause) {
      if (current !== generation.current) return;
      if (cause instanceof ApiError && cause.status === 401) {
        applyUser(null);
        setStatus("ready");
        setError("");
      } else {
        setStatus((previous) => previous === "loading" ? "error" : previous);
        setError(cause instanceof Error ? cause.message : "Không thể kiểm tra phiên đăng nhập.");
      }
    }
  }, [applyUser]);

  useEffect(() => {
    void refreshSession();
    const unauthorized = () => {
      ++generation.current;
      applyUser(null);
      setStatus("ready");
      setError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    };
    const onFocus = () => { void refreshSession(); };
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, unauthorized);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, unauthorized);
      window.removeEventListener("focus", onFocus);
      ++generation.current;
    };
  }, [refreshSession, applyUser]);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthSession> => {
    ++generation.current;
    setError("");
    try {
      const response = await apiRequest<{ data: AuthUser }>("/auth/login", "POST", { email, password });
      if (response.data.role === "admin") {
        await apiRequest("/auth/logout", "POST");
        throw new ApiError("Tài khoản quản trị chưa có giao diện đăng nhập tại đây.", 403);
      }
      const next = applyUser(response.data);
      if (!next) throw new ApiError("Vai trò tài khoản không được hỗ trợ.", 403);
      setStatus("ready");
      return next;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể đăng nhập.");
      throw cause;
    }
  }, [applyUser]);

  const registerAccount = useCallback(async (
    role: AuthRole, name: string, email: string, password: string, confirmation: string,
  ): Promise<AuthSession> => {
    ++generation.current;
    setError("");
    try {
      const response = await apiRequest<{ data: AuthUser }>("/auth/register", "POST", {
        role, name, email, password, password_confirmation: confirmation,
      });
      const next = applyUser(response.data);
      if (!next) throw new ApiError("Vai trò tài khoản không được hỗ trợ.", 403);
      setStatus("ready");
      return next;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể đăng ký.");
      throw cause;
    }
  }, [applyUser]);

  const signOut = useCallback(async (): Promise<boolean> => {
    ++generation.current;
    setError("");
    try {
      await apiRequest("/auth/logout", "POST");
      applyUser(null);
      setStatus("ready");
      return true;
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        applyUser(null);
        return true;
      }
      setError(cause instanceof Error ? cause.message : "Không thể đăng xuất.");
      return false;
    }
  }, [applyUser]);

  const value = useMemo(() => ({
    session, status, error, signIn, registerAccount, signOut, refreshSession,
  }), [session, status, error, signIn, registerAccount, signOut, refreshSession]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth phải được sử dụng bên trong AuthProvider.");
  return context;
}
