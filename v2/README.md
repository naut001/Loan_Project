# Sổ trả nợ 2.0 — nền tảng giao diện

Bản alpha độc lập với bản 1.3.0. Triển khai song song tại `/Loan_Project/v2/`, không đăng ký service worker và không ghi localStorage. Có thể đăng nhập Supabase và tải bản chụp chỉ đọc khi người dùng yêu cầu. Nhánh phát triển: `feat/v2-interface`.

## Chạy tại thư mục gốc repo

```sh
npm --prefix v2 ci
npm --prefix v2 run dev
npm --prefix v2 test
npm --prefix v2 run build
node tests/run.js
```

Mở địa chỉ Vite in ra (mặc định http://127.0.0.1:5173). Bản build nằm trong `v2/dist`, được Git bỏ qua. Node 22.12+ hoặc 24 được khuyến nghị.

## Phạm vi đã có

- React + TypeScript + Vite, Tailwind, Lucide; Button dùng Radix Slot/CVA theo cách tổ chức shadcn/ui, chưa có toàn bộ bộ component.
- Khung desktop/mobile, sáng/tối trong phiên hiện tại, trạng thái rỗng và báo lỗi.
- Mở JSON 1.3 để xem số dư tài khoản, thu/chi tháng hiện tại và 10 giao dịch gần nhất. Tệp chỉ đọc trong RAM; không tải lên máy chủ.
- Đọc localStorage chỉ khi người dùng yêu cầu. Localhost không đọc được dữ liệu của tên miền GitHub Pages; cần xuất JSON từ bản hiện tại.
- Kiểm tra cấu trúc dữ liệu đầu vào, không tự sửa dữ liệu hỏng, không tính lại lịch nợ.
- Màn hình Chi tiêu: lọc tháng, tài khoản (gồm chuyển đến), loại và ghi chú/danh mục; tải thêm từng 25 giao dịch.
- Màn hình Khoản nợ: tìm tên, lọc còn phải trả, xem lịch nhập tay, phần đã trả và quá hạn. Khoản công thức chỉ hiển thị dư nợ/mức trả từ bản sao lưu, chưa dự phóng.
- Kiểm thử đối chiếu với mã 1.3 cho số dư/chi tiêu và 288 tổ hợp ngày hạn trả; kiểm thử dựng React phía server. Chưa thay thế kiểm thử trình duyệt.

## Các bước tiếp theo

1. Tách nghiệp vụ hiện tại thành module có kiểm thử đối chiếu với 1.3; thay bộ tổng hợp chỉ đọc của alpha bằng module dùng chung.
2. Hoàn thiện vòng đời phiên, đăng ký/phục hồi mật khẩu và quản lý trạng thái; đánh giá xung đột đồng bộ trước khi mở quyền ghi.
3. Chuyển chi tiêu, nợ và lịch trả, báo cáo rồi các màn hình còn lại.
4. Bổ sung kiểm thử trình duyệt/mobile; kiểm tra CSP, cấu hình frontend-safe, đường dẫn Pages và chiến lược cache.
5. Giữ preview ở thư mục con; chưa thay trang chính.

Không đưa bản alpha thay trang chính: mới có ghi thu/chi tiền, lịch dự phóng khoản công thức hoặc đồng bộ hai chiều. Chưa tách hoàn toàn nghiệp vụ dùng chung: module alpha được bảo vệ bằng kiểm thử đối chiếu, bản 1.3 chưa bị sửa. Không sửa SQL trong đợt giao diện này. Giao diện có thể gọi Google Fonts và Supabase đã cấu hình; font hệ thống là dự phòng.

## Supabase: tải và ghi thu/chi

Sao chép `v2/.env.example` thành `v2/.env.local`, điền `VITE_SUPABASE_URL` và `VITE_SUPABASE_KEY` bằng URL dự án và khoá publishable/anon. Khởi động lại Vite sau khi đổi cấu hình. `.env.local` bị Git bỏ qua. Các giá trị `VITE_*` sẽ có trong tài sản frontend: tuyệt đối không đặt bí mật vào chúng. Vite dùng bộ kiểm tra cấu hình của bản 1.3 để từ chối service_role/sb_secret_ trước khi build.

- Đăng nhập tài khoản có sẵn, tải `user_data` bằng GET và token người dùng; RLS phía Supabase vẫn là ranh giới bảo mật.
- Không tự ghi dữ liệu, không tạo hàng khi tài khoản trống, không dùng cơ chế so sánh timestamp để ghi ngược.
- Phiên chỉ nằm trong RAM, không lưu refresh token, không đọc hoặc sửa phiên bản 1.3. Hết phiên cần đăng nhập lại.
- “Đóng kết nối” huỷ tải đang chạy, bỏ token và dữ liệu đang xem khỏi giao diện. Đây là đóng phiên cục bộ, không gọi logout toàn cục hoặc thu hồi token trên server.
- Chưa có đăng ký, phục hồi mật khẩu, tự làm mới token hoặc đồng bộ nền. Dùng bản 1.3 cho những thao tác này.
- Các kiểm thử auth dùng mock HTTP; chưa xác minh đăng nhập/tải dữ liệu với tài khoản thật.
## Ghi thu/chi thử nghiệm

Biểu mẫu tài khoản ghi PATCH có điều kiện user_id và updated_at. Giữ nguyên payload gốc, thêm giao dịch ID mới và tăng updatedAt. Chỉ hỗ trợ thu/chi tiền, không mua tín dụng/trả nợ. Không upload JSON. Không tạo hàng mới. Cần RLS và trigger updated_at theo schema hiện có; không chạy migration.

Không mở đồng thời bản 1.3 để sửa: bản cũ chưa có bảo vệ xung đột. Xuất sao lưu trước khi thử ghi. Nếu mất mạng lúc lưu, giao dịch có thể đã commit: tải lại kiểm tra lịch sử trước khi nhập lại. Không tự retry. Đóng kết nối không hoàn tác ghi đã commit. Kiểm thử cloud hiện dùng mock; chưa xác minh ghi với tài khoản thật hoặc trình duyệt/mobile.
