import { useStudentAccount } from "../contexts/StudentAccountContext";
import { useTeacherData } from "../contexts/TeacherDataContext";

import type { Classroom, JoinRequest } from "../types/teacher";

export type StudentClassStatus =
  | "joined"
  | "pending"
  | "rejected"
  | "needs_link";

export type StudentClassItem = {
  classroom: Classroom;
  request: JoinRequest;
  status: StudentClassStatus;
};

export function useStudentClassMemberships() {
  const { student, hasStudentProfile } = useStudentAccount();

  const { classrooms, getJoinRequests, isStudentJoinedClass } =
    useTeacherData();

  const memberships: StudentClassItem[] = hasStudentProfile
    ? classrooms.flatMap((classroom) => {
        const requests = getJoinRequests(classroom.id).filter(
          (request) => request.studentId === student.id,
        );

        if (requests.length === 0) {
          return [];
        }

        const latestRequest = requests[requests.length - 1];

        if (!latestRequest) {
          return [];
        }

        const isJoined = isStudentJoinedClass(classroom.id, student.id);

        const request = isJoined
          ? ([...requests]
              .reverse()
              .find((item) => item.status === "approved") ?? latestRequest)
          : latestRequest;

        let status: StudentClassStatus;

        if (isJoined) {
          status = "joined";
        } else if (request.status === "approved") {
          status = "needs_link";
        } else {
          status = request.status;
        }

        return [
          {
            classroom,
            request,
            status,
          },
        ];
      })
    : [];

  return {
    memberships,
    hasStudentProfile,
  };
}
