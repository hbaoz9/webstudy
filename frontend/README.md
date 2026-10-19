# WebStudy Frontend

Frontend demo của WebStudy sử dụng React 19, TypeScript, Vite 7, Tailwind CSS 3 và React Router. Giao diện hiện có cho học sinh và giáo viên; dữ liệu nghiệp vụ vẫn được quản lý phía trình duyệt bằng Context và `localStorage`.

## Bắt đầu

Từ thư mục `frontend/`:

```bash
npm ci
npm run dev
```

## Kiểm tra

```bash
npm test
npm run build
```

`npm run build` chạy TypeScript rồi tạo bản production trong `dist/`. `npm test` chạy các unit test bằng Vitest. Trên Windows PowerShell có thể dùng `npm.cmd` nếu lệnh `npm` bị chặn bởi chính sách thực thi.

## Dữ liệu demo

Thông tin tài khoản, lớp, nội dung và bài làm được lưu cục bộ trên trình duyệt hiện tại. Không dùng dữ liệu thật hoặc bí mật trong môi trường demo; xóa dữ liệu trình duyệt có thể làm mất dữ liệu chưa được xuất ra nơi khác. Frontend chưa kết nối Backend Laravel.
