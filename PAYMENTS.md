# Thanh toán liên kết — 1.3.0

- Với khoản nợ có lịch theo tháng, chọn **Thanh toán từ tài khoản** tại Khoản nợ, hoặc **Đã trả** tại Tổng quan.
- Chọn kỳ, ngày thực trả, tài khoản và số thanh toán kỳ. Có thể thanh toán một phần; không được vượt số còn lại của dòng lịch.
- Số thanh toán kỳ giảm nghĩa vụ và số dư tài khoản, không tính lại là chi tiêu. Lãi/phí **ngoài lịch** được tính vào chi tiêu. Không nhập lại lãi/phí đã nằm trong số tiền kỳ.
- Xoá giao dịch trả nợ tại Chi tiêu để hoàn tác cả tài khoản và nghĩa vụ. Muốn sửa thanh toán, hoàn tác rồi nhập lại.
- Có thể sửa các kỳ chưa liên kết. Không sửa/xoá kỳ đã liên kết hoặc xoá khoản nợ khi còn giao dịch liên kết; hoàn tác giao dịch trước.
- Các dấu đã trả cũ không tạo giao dịch và không trừ tiền hồi tố. Khoản vay công thức giữ cơ chế cũ.
- Dòng tiền ròng bao gồm toàn bộ tiền trả nợ. Chi tiêu chỉ gồm chi thông thường và lãi/phí ngoài lịch; số dư đầu kỳ không phải thu nhập.

## Mua tín dụng và chuyển lịch

- Ghi chi cuối ngày: chọn khoản nợ có lịch theo tháng làm nguồn thanh toán. Khoản mua tính vào chi tiêu và thêm dòng nghĩa vụ riêng, không trừ tài khoản tiền. Một dòng lỗi thì cả lô không lưu.
- Lịch 6 triệu + khoản mua mới 500 nghìn = nghĩa vụ 6,5 triệu; tiền mặt không đổi. Không nhập lại khoản mua đã có trong lịch ban đầu.
- Kỳ mặc định theo ngày mua và ngày sao kê: sau ngày chốt chuyển kỳ tiếp theo, đúng ngày chốt thuộc kỳ hiện tại; ngày 31 chặn về cuối tháng ngắn. Có thể chọn kỳ thủ công để khớp sao kê thực tế. Nếu không có sao kê, kỳ là tháng đến hạn; sau ngày đến hạn chọn tháng sau.
- Xoá khoản mua sẽ xoá dòng nghĩa vụ tương ứng; phải hoàn tác thanh toán của dòng đó trước. Sửa giao dịch liên kết bằng cách hoàn tác rồi nhập lại.
- Khoản vay công thức có nút **Chuyển sang lịch linh hoạt**. Chỉ chuyển kỳ còn lại, giữ dấu trả cũ, không trừ tài khoản hồi tố. Tổng sau chuyển bao gồm lãi dự kiến, không chỉ dư nợ gốc. Xuất sao lưu trước và đối chiếu ngân hàng sau chuyển.
- Mua tín dụng không làm giảm dòng tiền; trả nợ không ghi lại khoản mua thành chi tiêu. JSON giữ liên kết; CSV thêm mã nợ, mã kỳ và lãi/phí. ICS và dự báo dùng nghĩa vụ còn lại.

## Giới hạn và đối chiếu

Không tự phân tách gốc/lãi đã gộp trong lịch cũ. Trường gốc còn lại cần đối chiếu thủ công, không tự giảm khi thanh toán một phần; hạn mức dựa trên trường này chỉ là tham khảo. Không tự tính lãi tín dụng quay vòng hoặc áp hạn mức. Kế hoạch và Phải thu vẫn độc lập với sổ thu chi. Không tự chuyển dữ liệu cũ sang lịch mới. Chưa xác minh thao tác trên điện thoại thật và Supabase thực tế.