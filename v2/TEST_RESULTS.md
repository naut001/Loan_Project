# Kết quả kiểm thử v2 — 29/09/2026

## Phạm vi và kết luận

Kiểm thử trên workspace hiện tại, có các thay đổi chưa commit. Không coi kết quả này
là nghiệm thu production hoặc chứng nhận đã kiểm thử toàn bộ chức năng trên Supabase thật.
Người dùng đã cho phép thử tài khoản hiện tại với dữ liệu giả, nhưng thông tin đăng nhập
trước đó không còn trong ngữ cảnh và không có phiên test trong môi trường.
**Lần kiểm thử này không đăng nhập, không ghi dữ liệu và không chạy migration trên Supabase thật.**

## Kết quả đã quan sát

| Hạng mục | Kết quả |
| --- | --- |
| Vitest v2 | 222/222 test đạt, 26/26 file, exit 0 |
| Test bản 1.3 | 54 đạt, 0 lỗi |
| TypeScript `tsc --noEmit` | exit 0 |
| Vite production build | exit 0, 1.924 module; có `dist/index.html`, JS/CSS |
| `git diff --check` | Không báo lỗi whitespace |
| Chrome headless, Supabase mô phỏng | 6 nhóm kiểm tra đạt, không có exception runtime chưa xử lý |

### Các chức năng được bộ test tự động bao phủ

- Đọc/kiểm tra JSON, bảo toàn trường mở rộng, sao lưu/khôi phục có điều kiện.
- Ví: tạo, sửa, xoá có bảo vệ; thu/chi/chuyển tiền, sửa/xoá giao dịch, ngày đầu kỳ.
- Khoản nợ công thức/nhập theo tháng, chỉnh lịch, chuyển công thức sang lịch tháng.
- Trả nợ từng phần/toàn phần, lãi/phí, hoàn tác và bảo vệ liên kết.
- Mua tín dụng/hoàn tác, kỳ sao kê, lô chi hỗn hợp nguyên tử.
- Ngân sách, báo cáo, CSV chống công thức bảng tính, xuất ICS.
- Phải thu: tạo/sửa/xoá có bảo vệ, thu/hoàn tác, dự báo không tự cộng tiền ví.
- Máy tính khoản vay, tất toán sớm, gộp nợ, dự phóng kế hoạch, chuyển đề xuất vào nháp.
- Xung đột phiên, lỗi mạng, khoá ghi sau kết quả không chắc chắn, đóng kết nối.
- Đối chiếu các công thức/nghiệp vụ có test parity với bản 1.3.

Test mới `src/lib/acceptance-flow.test.ts` chạy các thao tác nối tiếp trên một máy chủ
PostgREST mô phỏng có timestamp, revision và history. Nó kiểm tra bản nháp không ghi,
lưu kế hoạch không đổi nợ/giao dịch, stale writer không ghi đè, lô lỗi không lưu một phần,
và khôi phục backup. Cách ly A/B và history trong test là **hành vi mock**, không phải
bằng chứng RLS/trigger PostgreSQL thật hoạt động.

### Kiểm thử trình duyệt thực tế, backend mô phỏng

`scripts/browser-smoke.mjs` dùng Chrome headless qua CDP, không thêm thư viện.
Dữ liệu hoàn toàn giả; dùng profile tạm riêng, chặn fetch không thuộc API mock.

1. Đăng nhập mock và tải bản chụp.
2. Điều hướng 7 màn hình, kiểm tra không tràn ngang ở 1440×1000 và 390×844.
3. Chọn nợ gộp rồi tải lại bản chụp cùng ID: lựa chọn và so sánh cũ biến mất.
4. Đề xuất/nhập nháp/hủy xác nhận: không PATCH.
5. Xác nhận lưu: một ghi, payoff không tự sao chép, nợ và giao dịch giữ nguyên.
6. Đóng kết nối: đề xuất và giao diện tài khoản được xoá; không có uncaught exception.

Đây là smoke test thao tác DOM, không phải rà soát thị giác hay kiểm tra cảm ứng trên
điện thoại thật. Nó không thao tác mọi biểu mẫu ghi bằng trình duyệt; các thao tác khác
được kiểm tra ở mức logic/client bởi Vitest.

## Giới hạn mới được xác nhận

- Tài khoản **không có hàng `user_data`**: v2 tải trả `null`, không cho ghi và không tự
  INSERT/khởi tạo. Giao diện yêu cầu khởi tạo bằng bản 1.3. Tài khoản có hàng nhưng
  không có nợ khác với trường hợp này.
- V2 chưa có đăng ký, khôi phục/đổi mật khẩu, callback email; chưa có lưu phiên bền vững,
  refresh token hoặc đồng bộ local/offline. Phiên hiện tại giữ trong RAM.
- Kiểm tra RLS hai tài khoản thật, đọc history, revision/trigger thật, mất mạng sau commit
  thật, thao tác tất cả biểu mẫu trên thiết bị và rollout/rollback vẫn chưa hoàn tất.
- Không tìm thấy lỗi ứng dụng mới trong phạm vi kiểm thử này. **Sau đợt kiểm thử này,
  người dùng yêu cầu chuyển v2 thành trang chính dù các bước live còn thiếu.**
  Kết quả mock không được hiểu là nghiệm thu Supabase production.

## Chạy lại

Từ PowerShell:

```powershell
npm --prefix 'C:\Users\PC\Downloads\so-tra-no\v2' test
npm --prefix 'C:\Users\PC\Downloads\so-tra-no\v2' run build
node 'C:\Users\PC\Downloads\so-tra-no\tests\run.js'
node 'C:\Users\PC\Downloads\so-tra-no\v2\scripts\browser-smoke.mjs'
```

Browser smoke cần Node hỗ trợ WebSocket, Chrome trên Windows và bản build có cấu hình
Supabase public để hiện biểu mẫu đăng nhập. Có thể chỉ định executable qua `CHROME_PATH`.
Không dùng service-role key hoặc mật khẩu thật cho smoke test này.

Các bước live còn lại theo `ACCEPTANCE_CHECKLIST.md`. Đổi mật khẩu đã lộ và thu hồi các
phiên khác; không ghi token/mật khẩu vào Git hoặc biên bản test.