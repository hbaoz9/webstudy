export type TeacherVerificationStatus =
  | 'unverified'
  | 'pending'
  | 'verified'
  | 'rejected';

export type VerificationDocument = {
  name: string;
  type: string;
  size: number;
};

export type TeacherVerificationSubmission = {
  fullName: string;
  schoolName: string;
  schoolAddress: string;

  teacherCode?: string;
  position: string;

  document:
    VerificationDocument;

  submittedAt: string;
};

export type TeacherAccountState = {
  profile?: {
    id: string;
    name: string;
    email: string;
  };

  verificationStatus:
    TeacherVerificationStatus;

  submission:
    TeacherVerificationSubmission | null;

  rejectionReason?: string;
  verifiedAt?: string;
};

export type SubmitTeacherVerificationPayload =
  Omit<
    TeacherVerificationSubmission,
    'submittedAt'
  >;
