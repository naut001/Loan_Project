# Supabase 1.3 / v2

## Cấu trúc tương thích

`public.user_data`: một hàng cho mỗi `auth.users.id`. `payload` giữ nguyên JSON v1 (wallets, tx, debts, recv, budgets, plan, fund, calc và các trường khác). Không đổi ID tài chính hoặc chia JSON thành nguồn dữ liệu thứ hai.

- `updated_at`: timestamp máy chủ tăng đơn điệu, dùng cho PATCH kiểm tra xung đột của v2.
- `revision`: số phiên bản tăng trên mỗi UPDATE, mặc định 1 cho dữ liệu cũ.
- `public.user_data_history`: giữ tối đa 20 phiên bản **trước đó** mỗi tài khoản, bao gồm payload đầy đủ. Tạo tự động trong cùng transaction khi UPDATE; không tạo bản lịch sử cho dữ liệu chưa từng cập nhật.
- RLS: người dùng chỉ đọc dữ liệu/lịch sử của mình. Browser không có quyền ghi/xoá lịch sử. Xoá tài khoản Auth sẽ xoá cả dữ liệu lẫn lịch sử qua FK cascade.

History không thay thế backup bên ngoài: nhiều lần ghi có thể đẩy bản cũ khỏi giới hạn 20; tài khoản bị xoá cũng mất lịch sử. Dung lượng tối đa xấp xỉ 20 MB/tài khoản nếu mỗi payload gần 1 MB.

## Cài đặt / nâng cấp

1. Xuất JSON trong ứng dụng và tạo backup database bằng công cụ Supabase của quản trị viên. Xác nhận khả năng phục hồi trước khi thay đổi production.
2. Đóng các tab đang chỉnh sửa. Dùng Supabase Dashboard → SQL Editor với quyền quản trị; **không đưa mật khẩu database/service-role key vào frontend hoặc chat**.
3. Dự án mới: chạy `schema.sql`, sau đó `migrations/002_data_history.sql`. Dự án 1.3 hiện có `user_data`: chỉ chạy migration 002. Không cần chạy lại schema để nâng cấp.
4. Chạy `verify_v2.sql`: hai bảng phải bật RLS, user_data có SELECT/INSERT/UPDATE theo auth.uid, history chỉ SELECT theo auth.uid, hai trigger UPDATE tồn tại, revision là bigint NOT NULL. Không có quyền anon/PUBLIC và không có quyền ghi history cho authenticated.
5. Dùng hai tài khoản thử A/B: A không đọc/ghi được dữ liệu B; anon không đọc được. Tải cùng dữ liệu ở hai tab v2; lưu tab thứ nhất, tab thứ hai phải bị chặn. Kiểm tra lịch sử đã lưu payload trước thay đổi.
6. Chạy lại migration để kiểm tra tính lặp lại trên staging trước production. Migration nằm trong transaction, lock_timeout 5 giây; lỗi thì rollback và kiểm tra nguyên nhân, không tiếp tục từng phần.

Migration chưa được chạy/kiểm thử bằng PostgreSQL trong môi trường coding nếu không có kết nối DB. Kiểm thử tĩnh không chứng minh được RLS/trigger thực tế.

## Phục hồi

Chưa cung cấp nút tự phục hồi để tránh ghi đè thay đổi mới. Quản trị viên xuất payload của revision cần phục hồi thành JSON để đối chiếu offline; đóng các tab, sao lưu bản hiện tại rồi mới phục hồi có kiểm tra revision. Không thao tác UPDATE trực tiếp từ ID do người khác cung cấp mà chưa xác minh chủ sở hữu. Không xoá bảng history để rollback giao diện: frontend cũ vẫn tương thích các cột bổ sung.

## Giới hạn xung đột

Bản 1.3 vẫn upsert toàn bộ JSON không điều kiện; history giúp truy vết/khôi phục nhưng **không ngăn bản cũ ghi đè**. Không dùng đồng thời 1.3 và v2 để chỉnh sửa. Database chưa ép mọi client dùng RPC/CAS vì sẽ làm hỏng các tab cũ. Chuyển sang cơ chế bắt buộc CAS cần một đợt nâng cấp client và thu hồi quyền ghi trực tiếp có kế hoạch riêng.

Nếu còn bảng `user_state` cũ, kiểm tra backup và thu hồi quyền truy cập riêng; schema mới không còn tự xoá bảng đó.