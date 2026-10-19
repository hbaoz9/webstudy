import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { mockClassrooms, mockJoinRequests } from "../data/mockTeacherDashboard";

import type {
  Classroom,
  ClassRosterEntry,
  JoinRequest,
} from "../types/teacher";

import { resolveJoinRequestVerification } from "../utils/rosterMatching";

const STORAGE_KEY = "webstudy-geo10-teacher-data-v1";

type TeacherDataState = {
  classrooms: Classroom[];

  joinRequestsByClass: Record<string, JoinRequest[]>;

  rostersByClass: Record<string, ClassRosterEntry[]>;
};

function countJoinedStudents(entries: ClassRosterEntry[]) {
  return entries.filter(
    (entry) => entry.status === "joined" && Boolean(entry.linkedUserId),
  ).length;
}

type CollectionUpdate<T> = T[] | ((currentItems: T[]) => T[]);

type TeacherDataContextValue = {
  classrooms: Classroom[];

  getClassroom: (classId: string) => Classroom | undefined;

  getJoinRequests: (classId: string) => JoinRequest[];

  getRosterEntries: (classId: string) => ClassRosterEntry[];

  isStudentJoinedClass: (classId: string, studentId: string) => boolean;

  updateClassJoinRequests: (
    classId: string,
    update: CollectionUpdate<JoinRequest>,
  ) => void;

  updateClassRoster: (
    classId: string,
    update: CollectionUpdate<ClassRosterEntry>,
  ) => void;

  addClassroom: (classroom: Classroom) => void;

  updateClassroom: (classId: string, changes: Partial<Classroom>) => void;

  deleteClassroom: (classId: string) => void;

  resetTeacherData: () => void;
};

const TeacherDataContext = createContext<TeacherDataContextValue | undefined>(
  undefined,
);

function resolveCollectionUpdate<T>(
  currentItems: T[],
  update: CollectionUpdate<T>,
) {
  if (typeof update === "function") {
    return (update as (currentItems: T[]) => T[])(currentItems);
  }

  return update;
}

function createInitialTeacherData(): TeacherDataState {
  const joinRequestsByClass = Object.fromEntries(
    mockClassrooms.map((classroom) => {
      const requests = mockJoinRequests[classroom.id] ?? [];

      /*
       * Khi chưa nhập danh sách Excel,
       * yêu cầu đúng lớp sẽ ở trạng thái
       * chưa xác minh.
       */
      const normalizedRequests = requests.map((request) => ({
        ...request,

        verificationStatus: resolveJoinRequestVerification(
          request,
          [],
          classroom.name,
        ),
      }));

      return [classroom.id, normalizedRequests];
    }),
  ) as Record<string, JoinRequest[]>;

  return {
    classrooms: mockClassrooms.map((classroom) => ({
      ...classroom,
      studentCount: 0,
    })),

    joinRequestsByClass,

    rostersByClass: {},
  };
}

function loadTeacherData(): TeacherDataState | null {
  if (typeof window === "undefined") {
    return createInitialTeacherData();
  }

  try {
    const savedData = window.localStorage.getItem(STORAGE_KEY);

    if (savedData === null) {
      return createInitialTeacherData();
    }

    const parsedData = JSON.parse(savedData) as Partial<TeacherDataState>;

    if (!Array.isArray(parsedData.classrooms)) {
      throw new Error("Dữ liệu lớp học không hợp lệ.");
    }

    const rostersByClass = parsedData.rostersByClass ?? {};

    return {
      classrooms: parsedData.classrooms.map((classroom) => ({
        ...classroom,
        studentCount: countJoinedStudents(rostersByClass[classroom.id] ?? []),
      })),

      joinRequestsByClass: parsedData.joinRequestsByClass ?? {},

      rostersByClass,
    };
  } catch {
    return null;
  }
}

type TeacherDataProviderProps = {
  children: ReactNode;
};

export function TeacherDataProvider({ children }: TeacherDataProviderProps) {
  const [initialTeacherData] = useState(loadTeacherData);
  const hasStorageReadError = initialTeacherData === null;
  const [teacherData, setTeacherData] =
    useState<TeacherDataState>(() => initialTeacherData ?? createInitialTeacherData());

  /*
   * Mỗi khi dữ liệu thay đổi,
   * tự động lưu lại vào trình duyệt.
   */
  useEffect(() => {
    if (hasStorageReadError) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(teacherData));
    } catch (error) {
      console.error("Không thể lưu dữ liệu Teacher vào localStorage.", error);
    }
  }, [teacherData, hasStorageReadError]);

  const getClassroom = useCallback(
    (classId: string) =>
      teacherData.classrooms.find((classroom) => classroom.id === classId),
    [teacherData.classrooms],
  );

  const getJoinRequests = useCallback(
    (classId: string) => teacherData.joinRequestsByClass[classId] ?? [],
    [teacherData.joinRequestsByClass],
  );

  const getRosterEntries = useCallback(
    (classId: string) => teacherData.rostersByClass[classId] ?? [],
    [teacherData.rostersByClass],
  );

  const isStudentJoinedClass = useCallback(
    (classId: string, studentId: string) => {
      const isApproved = getJoinRequests(classId).some(
        (request) =>
          request.studentId === studentId && request.status === "approved",
      );

      const isLinkedInRoster = getRosterEntries(classId).some(
        (entry) =>
          entry.linkedUserId === studentId && entry.status === "joined",
      );

      return isApproved && isLinkedInRoster;
    },
    [getJoinRequests, getRosterEntries],
  );

  const updateClassJoinRequests = useCallback(
    (classId: string, update: CollectionUpdate<JoinRequest>) => {
      setTeacherData((currentData) => {
        const currentRequests = currentData.joinRequestsByClass[classId] ?? [];

        const nextRequests = resolveCollectionUpdate(currentRequests, update);

        return {
          ...currentData,

          joinRequestsByClass: {
            ...currentData.joinRequestsByClass,

            [classId]: nextRequests,
          },
        };
      });
    },
    [],
  );

  const updateClassRoster = useCallback(
    (classId: string, update: CollectionUpdate<ClassRosterEntry>) => {
      setTeacherData((currentData) => {
        const currentRoster = currentData.rostersByClass[classId] ?? [];

        const nextRoster = resolveCollectionUpdate(currentRoster, update);

        const joinedStudentCount = countJoinedStudents(nextRoster);

        return {
          ...currentData,

          classrooms: currentData.classrooms.map((classroom) =>
            classroom.id === classId
              ? {
                  ...classroom,

                  studentCount: joinedStudentCount,
                }
              : classroom,
          ),

          rostersByClass: {
            ...currentData.rostersByClass,

            [classId]: nextRoster,
          },
        };
      });
    },
    [],
  );

  const addClassroom = useCallback((classroom: Classroom) => {
    setTeacherData((currentData) => {
      const alreadyExists = currentData.classrooms.some(
        (item) => item.id === classroom.id,
      );

      if (alreadyExists) {
        return currentData;
      }

      return {
        ...currentData,

        classrooms: [...currentData.classrooms, classroom],

        joinRequestsByClass: {
          ...currentData.joinRequestsByClass,

          [classroom.id]: [],
        },

        rostersByClass: {
          ...currentData.rostersByClass,

          [classroom.id]: [],
        },
      };
    });
  }, []);

  const updateClassroom = useCallback(
    (classId: string, changes: Partial<Classroom>) => {
      setTeacherData((currentData) => ({
        ...currentData,

        classrooms: currentData.classrooms.map((classroom) =>
          classroom.id === classId
            ? {
                ...classroom,
                ...changes,

                /*
                 * Không cho changes
                 * thay ID của lớp.
                 */
                id: classroom.id,
              }
            : classroom,
        ),
      }));
    },
    [],
  );

  const deleteClassroom = useCallback((classId: string) => {
    setTeacherData((currentData) => {
      const nextJoinRequests = {
        ...currentData.joinRequestsByClass,
      };

      const nextRosters = {
        ...currentData.rostersByClass,
      };

      delete nextJoinRequests[classId];
      delete nextRosters[classId];

      return {
        ...currentData,

        classrooms: currentData.classrooms.filter(
          (classroom) => classroom.id !== classId,
        ),

        joinRequestsByClass: nextJoinRequests,

        rostersByClass: nextRosters,
      };
    });
  }, []);

  const resetTeacherData = useCallback(() => {
    setTeacherData(createInitialTeacherData());
  }, []);

  const contextValue = useMemo(
    () => ({
      classrooms: teacherData.classrooms,

      getClassroom,
      getJoinRequests,
      getRosterEntries,
      updateClassJoinRequests,
      updateClassRoster,
      addClassroom,
      updateClassroom,
      deleteClassroom,
      resetTeacherData,
      isStudentJoinedClass,
    }),
    [
      teacherData.classrooms,
      getClassroom,
      getJoinRequests,
      getRosterEntries,
      updateClassJoinRequests,
      updateClassRoster,
      addClassroom,
      updateClassroom,
      deleteClassroom,
      resetTeacherData,
      isStudentJoinedClass,
    ],
  );

  if (hasStorageReadError) return <main role="alert" className="mx-auto my-8 w-[calc(100%-2rem)] max-w-xl rounded-2xl border border-red-200 bg-white p-5 text-ink">
    <h1 className="text-lg font-bold">Không đọc được dữ liệu lớp học</h1>
    <p className="mt-3 text-sm leading-6 text-secondary">Bản lưu lớp và danh sách học sinh được giữ nguyên để có thể khôi phục. Hãy thử tải lại; nếu lỗi vẫn còn, nhờ hỗ trợ kiểm tra dữ liệu trên trình duyệt.</p>
    <button type="button" onClick={() => window.location.reload()} className="mt-4 min-h-11 rounded-xl border border-line px-4 text-sm font-bold">Thử tải lại</button>
  </main>;

  return (
    <TeacherDataContext.Provider value={contextValue}>
      {children}
    </TeacherDataContext.Provider>
  );
}

export function useTeacherData() {
  const context = useContext(TeacherDataContext);

  if (!context) {
    throw new Error(
      "useTeacherData phải được sử dụng bên trong TeacherDataProvider.",
    );
  }

  return context;
}
