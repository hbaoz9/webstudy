# WebStudy

WebStudy là dự án nền tảng học tập Địa lí 10. Frontend React/TypeScript hiện có các luồng demo cho học sinh (lớp học, bài học, video, bài tập) và giáo viên (lớp học, học liệu, câu hỏi, giao bài). Dữ liệu hiện chủ yếu được lưu trong `localStorage` của trình duyệt. Backend Laravel và khu vực Admin chưa được triển khai.

## Cấu trúc hiện tại

```text
WebStudy/
├── frontend/   # React 19, TypeScript, Vite 7, Tailwind CSS 3
├── backend/    # Chưa có mã nguồn Laravel
└── .gitignore
```

## Chạy frontend

Yêu cầu Node.js và npm tương thích với các phiên bản dependency trong `frontend/package.json`. Từ thư mục `frontend/`:

```bash
npm ci
npm run dev
```

Các lệnh kiểm tra hiện có:

```bash
npm test
npm run build
```

Trên Windows PowerShell, có thể dùng `npm.cmd` thay cho `npm` nếu chính sách thực thi chặn script PowerShell.

## Dữ liệu và giới hạn hiện tại

- Tài khoản, lớp học, nội dung và bài tập demo được quản lý ở frontend bằng Context và `localStorage`; dữ liệu gắn với trình duyệt và profile đang dùng, chưa đồng bộ qua server.
- Không nhập dữ liệu thật hoặc thông tin nhạy cảm vào môi trường demo. Xóa dữ liệu trình duyệt có thể làm mất dữ liệu demo chưa xuất ra nơi khác.
- Frontend chưa có hợp đồng API ổn định với Laravel. Khi triển khai Backend, cần xác định API, xác thực, phân quyền và phương án chuyển dữ liệu demo trước khi thay thế cơ chế lưu hiện tại.
- Không commit `.env`, khóa bí mật, log, thư mục dependency hoặc output build. Khi có Backend, chỉ commit `.env.example` với giá trị mẫu an toàn.
