# Nghiệm thu preview v2: máy tính vay → kế hoạch

Trạng thái: **chưa nghiệm thu staging/Supabase thật/điện thoại thật**. Theo yêu cầu của
người dùng, cấu hình triển khai đã đổi để v2 là trang chính, bản 1.3 ở `/Loan_Project/v1/`.
Đây là quyết định phát hành với các rủi ro đã nêu, **không phải xác nhận các bước live đạt**.

Kết quả bổ sung 29/09/2026: xem `TEST_RESULTS.md`. Đã chạy 222 test v2, 54 test v1.3,
build và Chrome headless với backend mô phỏng ở desktop/mobile viewport. Chưa có
nghiệm thu Supabase thật hoặc điện thoại thật; không đánh dấu các bước live dưới đây đã đạt.

## Chuẩn bị an toàn

- Dùng **dự án Supabase staging riêng**, hai tài khoản thử A/B và dữ liệu tài chính giả. Không dùng tài khoản production; không dán URL, token, mật khẩu hay JSON cá nhân vào biên bản công khai. Xác nhận cấu hình `VITE_*` trỏ đúng staging trước khi mở trang.
- Đối chiếu `sql/README.md`, chạy migration/`sql/verify_v2.sql` trên staging bằng quy trình quản trị; xác nhận RLS, revision và history. Sao lưu JSON đầy đủ và dữ liệu DB staging trước khi thử ghi. Không mở v1.3 đồng thời để sửa cùng tài khoản.
- Ghi lại trình duyệt/phiên bản, kích thước màn hình, thời gian, commit và dữ liệu giả định; thực hiện trên desktop và điện thoại (hoặc đánh dấu thiết bị nào chưa thử). Không ghi khóa vào nhật ký.

## Kịch bản (đánh dấu đạt/chưa đạt và ghi kết quả quan sát)

1. **Nguồn dữ liệu:** Mở JSON giả có nợ công thức và nợ nhập tay; chuyển tới Tính khoản vay. Kiểm tra danh sách chỉ có nợ còn dư, tên được hiển thị như văn bản, đóng bản chụp thì không còn nợ để chọn. Khi đang chọn nợ, tải bản chụp khác có cùng ID nợ: nợ mới phải chưa được chọn, không tự hiển thị kết luận cũ. Thử tải tài khoản staging: nợ trong máy tính phải khớp bản chụp mới. Chưa chọn nợ thì không có kết luận gộp nợ.
2. **So sánh:** Chọn từng nợ rồi nhiều nợ; đối chiếu số tất toán, phí tất toán cũ, trả/tháng và chi phí giữ nguyên với dữ liệu giả/v1.3. Đổi số vay, phí ban đầu, lãi, kỳ hạn; kết quả phải cập nhật mà không thay nợ, ví, giao dịch hoặc revision trên staging. Nợ nhập tay thiếu gốc còn lại phải hiện chi phí chưa xác định và **không** kết luận tiết kiệm; vay ròng không đủ phải hiện số thiếu và **không** kết luận tiết kiệm. Thử nợ lỗi: hiển thị lỗi thay vì kết luận; vay dư đáng kể phải được cảnh báo.
3. **Đề xuất chỉ trong RAM:** Bấm “Đề xuất vào kế hoạch”; kiểm tra chưa có PATCH, revision và backup cloud chưa đổi, không tự thêm khoản vay vào kế hoạch, không tự chọn nợ tất toán. Bỏ đề xuất hoặc tải lại trang thì đề xuất mất. Kỳ hạn trên 120 tháng phải không cho đề xuất dù máy tính vẫn tính được.
4. **Nhập bản nháp:** Đăng nhập tài khoản A, bấm “Nhập đề xuất vào bản nháp”; kiểm tra chỉ sao chép tiền vay, lãi, kỳ hạn, phí, tháng giải ngân mặc định là tháng sau; phí/kỳ tất toán sớm và danh sách nợ đã chọn **không** được sao chép. Trước khi lưu, tải lại trang để xác nhận cloud chưa đổi. Lặp lại, sửa tên/tháng, tự chọn nợ tất toán trong biểu mẫu; kiểm tra nợ trùng/không còn dư bị từ chối.
5. **Lưu có xác nhận:** Xuất backup trước; bấm lưu rồi **hủy** xác nhận: không có ghi. Bấm lại và đồng ý: chỉ `plan`/`income` đổi, revision tăng, history chứa bản trước; nợ thật, ví và giao dịch không đổi. Tải lại dữ liệu, đối chiếu kế hoạch và JSON backup. Thử hai tab cùng revision: tab lưu sau phải bị chặn, không ghi đè. Nếu mạng mất sau khi gửi, tải lại kiểm tra trước khi thao tác tiếp; không thử lại mù.
6. **Quyền truy cập và giao diện:** A không đọc/ghi được B, anon không đọc được dữ liệu, B không thấy kế hoạch A. Trên desktop và điện thoại: điều hướng tới máy tính/kế hoạch, cuộn và chọn checkbox, xem cảnh báo và hộp xác nhận, kiểm tra không tràn ngang/che nút. Đóng kết nối phải xóa dữ liệu và đề xuất khỏi giao diện.

**Điều kiện dừng khi kiểm tra live:** Sai dự án, không có backup, sai số tiền, ghi cloud trước xác nhận, ghi thay đổi nợ/ví/giao dịch khi chỉ lập kế hoạch, ghi đè revision hoặc lộ dữ liệu tài khoản B → dừng ghi, dùng `/Loan_Project/v1/` nếu cần, lưu mô tả lỗi đã loại bỏ dữ liệu nhạy cảm. Không xem phát hành theo yêu cầu là bằng chứng các kịch bản staging đã đạt.