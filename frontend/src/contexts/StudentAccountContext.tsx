import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { StudentProfile } from "../types/student";

export const STUDENT_PROFILE_KEY = "webstudy-geo10-demo-studnt-profile-v1";
const STORAGE_KEY = STUDENT_PROFILE_KEY;

type StudentAccountContextValue = {
  student: StudentProfile;
  hasStudentProfile: boolean;

  updateStudent: (
    changes: Partial<Pick<StudentProfile, "name" | "email">>,
  ) => void;

  resetStudent: () => void;
};

const StudentAccountContext = createContext<
  StudentAccountContextValue | undefined
>(undefined);

function createEmptyStudent(): StudentProfile {
  return {
    id: `student-${crypto.randomUUID()}`,
    name: "",
    email: "",
  };
}

function loadStudent(): StudentProfile {
  if (typeof window === "undefined") {
    return createEmptyStudent();
  }

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return createEmptyStudent();
    }

    const parsed = JSON.parse(saved) as Partial<StudentProfile>;

    if (
      typeof parsed.id !== "string" ||
      typeof parsed.name !== "string" ||
      typeof parsed.email !== "string"
    ) {
      return createEmptyStudent();
    }

    return {
      id: parsed.id,
      name: parsed.name,
      email: parsed.email,
    };
  } catch {
    return createEmptyStudent();
  }
}

type StudentAccountProviderProps = {
  children: ReactNode;
};

export function StudentAccountProvider({
  children,
}: StudentAccountProviderProps) {
  const [student, setStudent] = useState<StudentProfile>(loadStudent);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(student));
    } catch (error) {
      console.error("Khôngt thể lưu hồ sơ học sinh vào localStorage.", error);
    }
  }, [student]);

  const updateStudent = useCallback(
    (changes: Partial<Pick<StudentProfile, "name" | "email">>) => {
      setStudent((currentStudent) => ({
        ...currentStudent,
        ...changes,
        id: currentStudent.id,
      }));
    },
    [],
  );

  const resetStudent = useCallback(() => {
    setStudent(createEmptyStudent());
  }, []);

  const hasStudentProfile =
    student.name.trim().length > 0 && student.email.trim().length > 0;

  const contextValue = useMemo(
    () => ({
      student,
      hasStudentProfile,
      updateStudent,
      resetStudent,
    }),
    [student, hasStudentProfile, updateStudent, resetStudent],
  );

  return (
    <StudentAccountContext.Provider value={contextValue}>
      {children}
    </StudentAccountContext.Provider>
  );
}

export function useStudentAccount() {
  const context = useContext(StudentAccountContext);

  if (context === undefined) {
    throw new Error(
      "useStudentAccount phải được sử dụng bên trong StudentAccountProvider",
    );
  }

  return context;
}
