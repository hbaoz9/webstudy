import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type {
  SubmitTeacherVerificationPayload,
  TeacherAccountState,
} from '../types/teacherAccount';

export const TEACHER_ACCOUNT_KEY =
  'webstudy-teacher-account-v1';
const STORAGE_KEY = TEACHER_ACCOUNT_KEY;

const INITIAL_TEACHER_ACCOUNT:
  TeacherAccountState = {
  verificationStatus:
    'unverified',

  submission: null,
};

type TeacherAccountContextValue = {
  teacherAccount:
    TeacherAccountState;

  initializeProfile: (name: string, email: string) => void;

  submitVerification: (
    payload:
      SubmitTeacherVerificationPayload,
  ) => void;

  /*
   * Chỉ dùng trong giai đoạn frontend
   * để mô phỏng kết quả từ Admin.
   */
  simulateApproval: () => void;

  simulateRejection: (
    reason: string,
  ) => void;

  resetVerification: () => void;
};

const TeacherAccountContext =
  createContext<
    | TeacherAccountContextValue
    | undefined
  >(undefined);

function loadTeacherAccount():
  TeacherAccountState {
  if (
    typeof window === 'undefined'
  ) {
    return INITIAL_TEACHER_ACCOUNT;
  }

  try {
    const savedData =
      window.localStorage.getItem(
        STORAGE_KEY,
      );

    if (!savedData) {
      return INITIAL_TEACHER_ACCOUNT;
    }

    const parsedData =
      JSON.parse(
        savedData,
      ) as Partial<TeacherAccountState>;

    const validStatuses = [
      'unverified',
      'pending',
      'verified',
      'rejected',
    ];

    if (
      !parsedData.verificationStatus ||
      !validStatuses.includes(
        parsedData.verificationStatus,
      )
    ) {
      return INITIAL_TEACHER_ACCOUNT;
    }

    return {
      profile: parsedData.profile &&
        typeof parsedData.profile.id === 'string' && parsedData.profile.id.trim() &&
        typeof parsedData.profile.name === 'string' && parsedData.profile.name.trim() &&
        typeof parsedData.profile.email === 'string' && parsedData.profile.email.trim()
        ? parsedData.profile : undefined,
      verificationStatus:
        parsedData.verificationStatus,

      submission:
        parsedData.submission ?? null,

      rejectionReason:
        parsedData.rejectionReason,

      verifiedAt:
        parsedData.verifiedAt,
    };
  } catch {
    return INITIAL_TEACHER_ACCOUNT;
  }
}

type TeacherAccountProviderProps = {
  children: ReactNode;
};

export function TeacherAccountProvider({
  children,
}: TeacherAccountProviderProps) {
  const [
    teacherAccount,
    setTeacherAccount,
  ] = useState<TeacherAccountState>(
    loadTeacherAccount,
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          teacherAccount,
        ),
      );
    } catch (error) {
      console.error(
        'Không thể lưu trạng thái xác minh giáo viên.',
        error,
      );
    }
  }, [teacherAccount]);

  const submitVerification =
    useCallback(
      (
        payload:
          SubmitTeacherVerificationPayload,
      ) => {
        setTeacherAccount((currentAccount) => ({
          profile: currentAccount.profile,
          verificationStatus:
            'pending',

          submission: {
            ...payload,

            submittedAt:
              new Date().toISOString(),
          },

          rejectionReason:
            undefined,

          verifiedAt:
            undefined,
        }));
      },
      [],
    );

  const simulateApproval =
    useCallback(() => {
      setTeacherAccount(
        (currentAccount) => ({
          ...currentAccount,

          verificationStatus:
            'verified',

          rejectionReason:
            undefined,

          verifiedAt:
            new Date().toISOString(),
        }),
      );
    }, []);

  const simulateRejection =
    useCallback(
      (reason: string) => {
        setTeacherAccount(
          (currentAccount) => ({
            ...currentAccount,

            verificationStatus:
              'rejected',

            rejectionReason:
              reason.trim() ||
              'Hồ sơ chưa đáp ứng yêu cầu xác minh.',

            verifiedAt:
              undefined,
          }),
        );
      },
      [],
    );

  const resetVerification =
    useCallback(() => {
      setTeacherAccount((currentAccount) => ({
        ...INITIAL_TEACHER_ACCOUNT,
        profile: currentAccount.profile,
      }));
    }, []);

  const initializeProfile = useCallback((name: string, email: string) => {
    setTeacherAccount((currentAccount) => currentAccount.profile ? currentAccount : ({
      ...currentAccount,
      profile: {
        id: `teacher-${crypto.randomUUID()}`,
        name: name.trim(),
        email: email.trim().toLowerCase(),
      },
    }));
  }, []);

  const contextValue = useMemo(
    () => ({
      teacherAccount,
      initializeProfile,
      submitVerification,
      simulateApproval,
      simulateRejection,
      resetVerification,
    }),
    [
      teacherAccount,
      initializeProfile,
      submitVerification,
      simulateApproval,
      simulateRejection,
      resetVerification,
    ],
  );

  return (
    <TeacherAccountContext.Provider
      value={contextValue}
    >
      {children}
    </TeacherAccountContext.Provider>
  );
}

export function useTeacherAccount() {
  const context = useContext(
    TeacherAccountContext,
  );

  if (!context) {
    throw new Error(
      'useTeacherAccount phải được sử dụng bên trong TeacherAccountProvider.',
    );
  }

  return context;
}
