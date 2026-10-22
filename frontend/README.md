# WebStudy Frontend

Frontend sử dụng React 19, TypeScript, Vite và Tailwind CSS. Ứng dụng có các khu vực Public, Giáo viên và Học sinh; router bảo vệ trang theo vai trò. API client kết nối Laravel cho các endpoint nền tảng, còn một số dữ liệu nghiệp vụ học tập vẫn dùng localStorage trong giai đoạn chuyển đổi backend.

## Lệnh phát triển

```bash
npm ci
npm run dev
npm test
npm run build
```

- `npm run dev`: chạy Vite development server.
- `npm test`: chạy toàn bộ test Vitest một lần.
- `npm run build`: kiểm tra TypeScript và tạo production bundle.

Không commit `dist/`, `coverage/`, file môi trường hoặc danh sách extension cục bộ.
