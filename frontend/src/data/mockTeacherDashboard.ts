import type { Classroom, JoinRequest } from "../types/teacher";

export const mockClassrooms: Classroom[] = [
  {
    id: "class-10a1",
    name: "Lớp 10A1",
    code: "KNT101",
    studentCount: 0,
    completionRate: 0,
    coverImage:
      "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "class-10a2",
    name: "Lớp 10A2",
    code: "XYZ456",
    studentCount: 34,
    completionRate: 88,
    coverImage:
      "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "class-10b1",
    name: "Lớp 10B1",
    code: "QWE789",
    studentCount: 38,
    completionRate: 79,
    coverImage:
      "https://images.unsplash.com/photo-1501854140801-50d01698950b?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "class-10b2",
    name: "Lớp 10B2",
    code: "MNP103",
    studentCount: 34,
    completionRate: 82,
    coverImage:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
  },
];

export const mockJoinRequests: Record<string, JoinRequest[]> = {
  "class-10a1": [
    {
      id: "request-001",
      studentId: "student-001",
      studentName: "Nguyễn Thu An",
      email: "thuan10a1@gmail.com",
      declaredClass: "10A1",
      studentCode: "10A1-01",
      requestedAt: "Hôm nay, 08:30",
      verificationStatus: "matched",
      status: "pending",
    },
    {
      id: "request-002",
      studentId: "student-002",
      studentName: "Trần Minh Khang",
      email: "minhkhang@gmail.com",
      declaredClass: "10A1",
      studentCode: "10A1-02",
      requestedAt: "Hôm qua, 20:15",
      verificationStatus: "unverified",
      status: "pending",
    },
    {
      id: "request-003",
      studentId: "student-003",
      studentName: "Lê Gia Hân",
      email: "giahan10a2@gmail.com",
      declaredClass: "10A2",
      studentCode: "10A1-03",
      requestedAt: "18/09/2026, 15:20",
      verificationStatus: "mismatch",
      status: "pending",
    },
  ],

  "class-10a2": [],
  "class-10b1": [],
  "class-10b2": [],
};
