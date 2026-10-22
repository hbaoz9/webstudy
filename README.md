# WebStudy

WebStudy là ứng dụng hỗ trợ dạy và học Địa lí 10, gồm frontend React/Vite và backend Laravel/PostgreSQL.

## Cấu trúc

- `frontend/`: giao diện React + TypeScript. Các luồng nghiệp vụ hiện tại kết hợp API xác thực/health check với dữ liệu học tập đang được lưu cục bộ.
- `backend/`: Laravel API, xác thực Sanctum và nền tảng dữ liệu PostgreSQL.

## Chạy frontend

```bash
cd frontend
npm ci
npm run dev
```

Kiểm tra trước khi tạo commit:

```bash
npm test
npm run build
```

## Chạy backend

Xem hướng dẫn môi trường và lệnh Laravel trong `backend/README.md`. Không commit các file `.env`, database cục bộ, cache hoặc log runtime.
