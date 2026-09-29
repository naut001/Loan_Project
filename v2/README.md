# Sổ trả nợ 2.0 — nền tảng giao diện

Theo yêu cầu người dùng, GitHub Pages sẽ đưa bản 2.0 lên `/Loan_Project/` sau khi
merge/push lên `main` và Actions thành công. Bản 1.3 ở `/Loan_Project/v1/`, bản v2
phụ ở `/Loan_Project/v2/`. V2 không đăng ký service worker và không tự ghi localStorage.
Kiểm thử Supabase thật và điện thoại thật vẫn chưa hoàn tất: xem `TEST_RESULTS.md`.
Workflow Pages chỉ chạy khi thay đổi được push lên `main`; sửa file tại máy hoặc push
nhánh `feat/v2-interface` không tự thay trang đang phục vụ. Cần giữ hai GitHub Secrets
`SUPABASE_URL` và `SUPABASE_KEY` (chỉ publishable/anon); thiếu một trong hai thì
deploy sẽ dừng thay vì đăng bản chính không thể đăng nhập. Trang 1.3 vẫn có thể dùng
để khởi tạo tài khoản chưa có hàng `user_data`. Nếu cần quay lại trang chính 1.3,
hoàn tác commit đổi `.github/workflows/pages.yml` rồi push `main`; không chạy SQL
rollback hay chỉnh dữ liệu tài khoản chỉ để đổi giao diện.

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
- Màn hình Khoản nợ: tìm tên, lọc còn phải trả, xem lịch nhập tay, phần đã trả và quá hạn; dự phóng công thức chỉ đọc trong 12 tháng.
- Xuất ICS cho lịch nhập tay chưa trả và khoản công thức: gộp các dòng nhập tay cùng tháng, giữ kỳ quá hạn, giới hạn hạn tương lai trong 12 tháng, nhắc trước một ngày. Lịch không tự cập nhật và không ghi dữ liệu tài chính; hồ sơ công thức không hợp lệ bị chặn thay vì xuất lịch sai.
- Màn hình Phải thu: hiển thị đã thu, còn phải thu, chậm thu, hạn tiếp theo và lịch thu dự kiến 12 tháng. Phép tính đối chiếu với `recvInfo`/`recvArray` của v1.3; dự báo không làm thay đổi ví hoặc thu nhập.
- Màn hình Báo cáo chỉ đọc: thu, chi, tiền trả nợ, dòng tiền ròng, danh mục/ngân sách, xu hướng chi 6 tháng và ước tính chi tháng hiện tại; đối chiếu `spendSummary` của v1.3. Không ghi giao dịch hay thay đổi ngân sách.
- Máy tính khoản vay độc lập: lịch gốc/lãi, lãi hiệu dụng, phí ban đầu, thử tất toán sớm và so sánh gộp nợ đang có từ bản chụp/tài khoản đã tải; đối chiếu với `loan.js` và phép tính nợ v1.3. Nợ nhập tay thiếu gốc còn lại không có kết luận tiết kiệm; vay ròng không đủ tất toán cũng không kết luận tiết kiệm. Không tự tạo khoản vay, ghi giải ngân hoặc thanh toán.
- Kế hoạch dự phóng từ bản chụp: tiền đầu kỳ, lương dự kiến, sinh hoạt, lịch nợ, giải ngân/tất toán giả định, mua sắm và phải thu trong 12 tháng; kiểm thử đối chiếu `planSim`. Không lấy lại giao dịch ví làm tiền kế hoạch; sửa kế hoạch qua bảng tài khoản cloud. Dữ liệu kế hoạch thiếu hoặc lỗi sẽ chặn dự phóng.
- Cloud hỗ trợ tạo/sửa khoản phải thu, xoá khoản chưa thu, ghi nhận collection và hoàn tác lần gần nhất. Các trường mở rộng, ID và lịch sử được giữ; bản ghi legacy thiếu trường bắt buộc sẽ bị chặn để đối chiếu thay vì tự làm sạch.
- Kiểm thử đối chiếu với mã 1.3 cho số dư/chi tiêu và 288 tổ hợp ngày hạn trả; kiểm thử dựng React phía server. Chưa thay thế kiểm thử trình duyệt.

## Các bước tiếp theo

1. Tách nghiệp vụ hiện tại thành module có kiểm thử đối chiếu với 1.3; thay bộ tổng hợp chỉ đọc của alpha bằng module dùng chung.
2. Hoàn thiện vòng đời phiên, đăng ký/phục hồi mật khẩu và quản lý trạng thái; mở rộng bảo vệ xung đột cho các client cũ.
3. Chuyển chi tiêu, nợ và lịch trả, báo cáo rồi các màn hình còn lại.
4. Bổ sung kiểm thử trình duyệt/mobile; kiểm tra CSP, cấu hình frontend-safe, đường dẫn Pages và chiến lược cache.
5. Tiếp tục nghiệm thu live sau khi cấu hình trang chính; bản 1.3 vẫn ở `/Loan_Project/v1/` để sử dụng tính năng cũ và quay lại nếu cần.

Đã cấu hình v2 làm trang chính theo yêu cầu, nhưng kế hoạch và máy tính chưa được nghiệm thu trên Supabase thật và v2 chưa có đồng bộ nền. Nghiệp vụ v2 được bảo vệ bằng kiểm thử đối chiếu với 1.3 nhưng chưa tách hoàn toàn thành module dùng chung. Giao diện có thể gọi Google Fonts và Supabase đã cấu hình; font hệ thống là dự phòng.

## Supabase: tải và ghi thu/chi

### Bổ sung trong preview

- Chuyển máy tính sang kế hoạch: bấm “Đề xuất vào kế hoạch”, mở tài khoản cloud rồi “Nhập đề xuất vào bản nháp”. Chỉ sao chép số tiền, lãi suất, kỳ hạn và phí ban đầu, mặc định giải ngân tháng sau. Chỉnh tên/tháng/nợ tất toán rồi lưu kế hoạch với xác nhận riêng. Không tự ghi cloud, tạo nợ thật hoặc ghi giải ngân; không chuyển phí/kỳ tất toán sớm. Kế hoạch hỗ trợ tối đa 120 tháng dù máy tính tính được tới 600 tháng. Đề xuất chỉ ở RAM, mất khi tải lại trang hoặc đóng kết nối; có nút bỏ đề xuất. Nhập đề xuất không sửa bản chụp JSON đang xem và không tự ghi vào tài khoản mới.

- Biểu mẫu kế hoạch theo từng dòng trong bảng tài khoản: thêm/sửa/xoá tiền đang có, mua sắm và khoản vay dự định; chỉnh lương, sinh hoạt, mức an toàn và lương tháng này đang chờ. Lưu `plan` và `income` có xác nhận và kiểm tra revision cloud. Chọn nợ tất toán chỉ mô phỏng, phải còn dư nợ và không được chọn trùng giữa các khoản vay. Không ghi giải ngân hay tất toán thực tế. Các trường mở rộng của dòng giữ cùng ID được bảo toàn; dữ liệu legacy lỗi bị chặn thay vì ghi đè. So sánh gộp nợ ở máy tính chỉ trong RAM, không tự chuyển lựa chọn nợ sang kế hoạch; phải chọn lại và xác nhận lưu kế hoạch riêng.
- Khôi phục JSON vào dòng cloud hiện có: chọn tệp tối đa 950 KB, kiểm tra bản chụp, xác nhận thay toàn bộ dữ liệu. Xuất sao lưu hiện tại trước; không tự gộp, tự thử lại hay tạo dòng cho tài khoản trống. Khi lỗi sau khi gửi, tải lại để xác minh trước khi thử lại.
- Các luồng này chưa được nghiệm thu trên Supabase staging hoặc điện thoại thật. Việc đổi trang chính là theo yêu cầu người dùng, không phải xác nhận nghiệm thu live.

Sao chép `v2/.env.example` thành `v2/.env.local`, điền `VITE_SUPABASE_URL` và `VITE_SUPABASE_KEY` bằng URL dự án và khoá publishable/anon. Khởi động lại Vite sau khi đổi cấu hình. `.env.local` bị Git bỏ qua. Các giá trị `VITE_*` sẽ có trong tài sản frontend: tuyệt đối không đặt bí mật vào chúng. Vite dùng bộ kiểm tra cấu hình của bản 1.3 để từ chối service_role/sb_secret_ trước khi build.

- Đăng nhập tài khoản có sẵn, tải `user_data` bằng GET và token người dùng; RLS phía Supabase vẫn là ranh giới bảo mật.
- Không tự ghi dữ liệu, không tạo hàng khi tài khoản trống, không dùng cơ chế so sánh timestamp để ghi ngược.
- Phiên chỉ nằm trong RAM, không lưu refresh token, không đọc hoặc sửa phiên bản 1.3. Hết phiên cần đăng nhập lại.
- “Đóng kết nối” huỷ tải đang chạy, bỏ token và dữ liệu đang xem khỏi giao diện. Đây là đóng phiên cục bộ, không gọi logout toàn cục hoặc thu hồi token trên server.
- Chưa có đăng ký, phục hồi mật khẩu, tự làm mới token hoặc đồng bộ nền. Dùng bản 1.3 cho những thao tác này.
- Các kiểm thử auth dùng mock HTTP; chưa xác minh đăng nhập/tải dữ liệu với tài khoản thật.
## Ghi thu/chi thử nghiệm

Biểu mẫu tài khoản ghi PATCH có điều kiện user_id và updated_at. Giữ nguyên payload gốc, thêm giao dịch ID mới và tăng updatedAt. Thu/chi tiền, phải thu, mua tín dụng và trả nợ có các luồng riêng; khoản collection không tạo giao dịch ví hoặc thu nhập. Mở JSON để xem không upload; khôi phục cloud là thao tác riêng có xác nhận thay toàn bộ payload. Không tạo hàng mới. Cần RLS và trigger updated_at theo schema hiện có.

Không mở đồng thời bản 1.3 để sửa: bản cũ chưa có bảo vệ xung đột. Xuất sao lưu trước khi thử ghi. Nếu mất mạng lúc lưu, giao dịch có thể đã commit: tải lại kiểm tra lịch sử trước khi nhập lại. Không tự retry. Đóng kết nối không hoàn tác ghi đã commit. Kiểm thử cloud hiện dùng mock; chưa xác minh ghi với tài khoản thật hoặc trình duyệt/mobile.

## Nâng cấp cơ sở dữ liệu

Xem `sql/README.md` ở thư mục gốc cho hướng dẫn migration `002_data_history.sql` và kiểm tra RLS/trigger bằng `verify_v2.sql`. Migration bổ sung revision và tối đa 20 phiên bản payload trước đó, không chia dữ liệu sang nguồn thứ hai. Deploy Pages không tự thực thi SQL trên Supabase. Nút “Tải sao lưu đầy đủ từ tài khoản” xuất toàn bộ payload, không chỉ các trường v2 hiển thị; giữ tệp ở nơi riêng tư.
