# Sổ trả nợ

> Trang chính GitHub Pages được cấu hình để chạy **v2** tại
> `https://naut001.github.io/Loan_Project/` sau khi đưa thay đổi lên `main` và
> GitHub Actions triển khai thành công. Hướng dẫn bên dưới dành cho bản **1.3**,
> vẫn được giữ tại `https://naut001.github.io/Loan_Project/v1/` để khởi tạo tài khoản,
> khôi phục mật khẩu, dùng ngoại tuyến và quay lại khi cần. Bản v2 phụ tại `/Loan_Project/v2/`.
> Đừng chỉnh sửa cùng một tài khoản ở hai phiên bản đồng thời. Kiểm thử Supabase thật
> chưa hoàn tất: xem `v2/TEST_RESULTS.md` và `v2/ACCEPTANCE_CHECKLIST.md`.

Trang web tĩnh (HTML, CSS, JavaScript thuần, không cần build) để:

- **Theo dõi khoản nợ**: thẻ tín dụng, vay tiêu dùng, SPayLater (mỗi tháng một số tiền khác nhau), có hạn mức, ngày sao kê và hạn trả.
- **Nhắc kỳ trả**: đếm ngược ngày, báo quá hạn, dự báo 6 tháng tới, tỷ lệ trả nợ trên lương.
- **Tính khoản vay**: trả góp đều theo dư nợ giảm dần, thử tất toán sớm với phí trả trước, thử gộp nợ.
- **Phải thu**: tiền người khác nợ bạn, hạn hẹn trả, ghi nhận từng lần thu.
- **Kế hoạch tiền**: tiền đang có, khoản vay dự định, mua sắm dự định, dòng tiền 12 tháng tới.
- **Quỹ dự phòng**.
- **Chi tiêu**: ví, số dư ban đầu, thu/chi/chuyển ví, sửa/xoá giao dịch và ngân sách theo tháng.
- **Báo cáo**: chi theo danh mục, cảnh báo vượt ngân sách, xu hướng 6 tháng, so tháng trước và dự báo chi cuối tháng.
- **Xuất dữ liệu**: CSV giao dịch của tháng đang xem; lịch nhắc trả nợ `.ics` ở Tổng quan → Dữ liệu và sao lưu.

Có hai chế độ:

| Chế độ | Khi nào | Dữ liệu nằm ở đâu |
|---|---|---|
| **Chỉ trên thiết bị** | Chưa cấu hình Supabase (mặc định khi chạy ở máy) | Trình duyệt (localStorage). Không đăng nhập, không gửi đi đâu |
| **Tài khoản + đồng bộ** | Đã cấu hình Supabase | Supabase, theo tài khoản email và mật khẩu; localStorage làm bản nháp dùng khi mất mạng |

> Đây là công cụ tính toán tham khảo, không phải tư vấn tài chính. Số liệu chính thức theo hợp đồng với ngân hàng.

## Cài đặt từ đầu

### 1. Tạo dự án Supabase
1. Vào [supabase.com](https://supabase.com), tạo dự án mới (vùng Singapore cho gần).
2. Vào **SQL Editor → New query**, dán toàn bộ `sql/schema.sql` rồi **Run**. Chạy lại nhiều lần vẫn an toàn.
3. **Authentication → Sign In / Providers → Email**: tắt **Confirm email** nếu chỉ một mình bạn dùng; đặt độ dài mật khẩu tối thiểu là 8.
4. **Authentication → URL Configuration**: đặt **Site URL** là địa chỉ trang của bạn (ví dụ `https://<tài-khoản>.github.io/<tên-repo>/`) và thêm nó vào **Redirect URLs**. Không làm bước này thì email đặt lại mật khẩu sẽ dẫn về `localhost`.
5. Lấy khoá công khai ở **Settings → API Keys**: *Project URL* và khoá **publishable** (`sb_publishable_...`) hoặc khoá **anon**. **Không bao giờ** dùng khoá `secret` hoặc `service_role`.

### 2. Đưa khoá vào GitHub Secrets (không ghi vào mã nguồn)
Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Tên | Giá trị |
|---|---|
| `SUPABASE_URL` | Project URL, dạng `https://xxxx.supabase.co` |
| `SUPABASE_KEY` | Khoá publishable hoặc anon |

Khi triển khai, `scripts/inject-config.js` thay hai placeholder trong `js/supabase-sync.js` **trên bản đăng lên**, không đụng vào mã nguồn. Script từ chối khoá `service_role` và `sb_secret_...`.

### 3. Đăng lên GitHub Pages
```bash
git add -A
git commit -m "Sổ trả nợ"
git push
```
Rồi vào **Settings → Pages → Source: GitHub Actions**. Workflow chạy test và đăng trang. Repo cần **public** nếu dùng tài khoản GitHub miễn phí.

### 4. Tạo tài khoản của bạn, rồi khoá đăng ký
M�� trang, chọn **Tạo tài khoản**. Sau khi tạo xong tài khoản của mình, vào **Authentication → Sign In / Providers** và **tắt "Allow new users to sign up"**, để người lạ không tạo được tài khoản trên dự án của bạn.

## Chạy ở máy

```bash
python3 -m http.server 8080      # hoặc: npm run serve
# mở http://localhost:8080
```

Ở máy, placeholder chưa được thay nên ứng dụng chạy chế độ chỉ trên thiết bị. Mở thẳng `index.html` bằng `file://` vẫn dùng được, chỉ không có ngoại tuyến.

## Kiểm thử

```bash
npm test      # hoặc: node tests/run.js  (Node 18 trở lên, không cài thêm gói nào)
```

Bộ test kiểm tra phép tính khoản vay (đối chiếu số liệu bảng UOB), hạn trả theo sao kê, phải thu, dòng tiền, làm sạch dữ liệu nhập, dịch lỗi đăng nhập, script cấu hình khoá (từ chối khoá bí mật), cấu trúc dự án, và chặn hai lỗi hay lặp lại: chuỗi tiếng Việt không dấu, và khoá thật lọt vào mã nguồn.

## Cấu trúc thư mục

```
index.html               Khung trang, chính sách CSP, thứ tự nạp script
css/styles.css           Toàn bộ giao diện (sáng và tối theo hệ thống)
js/
  util.js                Định dạng số, ngày tháng, chuỗi
  loan.js                Công thức trả góp (pmt, nper, rateFor, schedule)
  model.js               Khoản nợ, hạn trả, phải thu, mô phỏng dòng tiền (không đụng DOM)
  state.js               Trạng thái, làm sạch dữ liệu, lưu localStorage
  views/                 Mỗi tab một file: home, debts, calc, recv, plan, fund; cộng backup, login
  events.js              Xử lý click, nhập liệu, thay đổi (uỷ quyền sự kiện)
  supabase-sync.js       Đồng bộ theo tài khoản; chứa 2 placeholder cấu hình
  auth.js                Đăng nhập, đăng ký, đổi và đặt lại mật khẩu (gọi thẳng Supabase Auth REST)
  app.js                 Khởi động
  pwa.js                 Đăng ký service worker
sql/schema.sql           Bảng user_data, RLS, ràng buộc kích thước
scripts/inject-config.js Điền cấu hình lúc triển khai, kiểm tra loại khoá
scripts/build-single.js  Gộp thành một file HTML (dist/), bỏ CSP và service worker
sw.js, manifest.webmanifest, icons/    Cài lên màn hình chính, chạy ngoại tuyến
tests/run.js             Bộ kiểm thử
.github/workflows/       Kiểm thử rồi đăng lên Pages
```

## Cách đồng bộ hoạt động

- Mỗi lần sửa, dữ liệu lưu ngay vào localStorage rồi đẩy lên Supabase sau khoảng 0,8 giây.
- Khi mở trang, quay lại tab hoặc có mạng trở lại, ứng dụng so `updatedAt` của bản trên máy và bản trên đám mây, **bản mới hơn thắng**. Nếu hai thiết bị cùng sửa lúc mất mạng, bản lưu sau cùng được giữ.
- Mất mạng thì ứng dụng vẫn chạy với dữ liệu trên máy và tự đẩy lên khi có mạng.
- Đăng xuất xoá bản lưu trên máy này để người dùng chung máy không xem được.
- Không dùng WebSocket hay Realtime, để đơn giản và dễ kiểm chứng.

## Bảo mật

- **Khoá công khai an toàn khi nằm trong trang web** chỉ vì bảng bật RLS và người chưa đăng nhập bị thu quyền. Bảo mật thật nằm ở `sql/schema.sql`, không phải ở việc giấu khoá.
- Mỗi tài khoản chỉ đọc và ghi được đúng một hàng của mình. Dữ liệu tối đa 1 MB.
- Phiên đăng nhập lưu trong localStorage. Vì vậy trang dùng CSP nghiêm (chỉ chạy script cùng nguồn, chỉ kết nối tới `*.supabase.co`), mọi chữ do người dùng nhập đều được thoát ký tự trước khi hiển thị, và dữ liệu nhập từ file sao lưu được làm sạch.
- Supabase mã hoá dữ liệu khi truyền và khi lưu, nhưng **không phải mã hoá đầu cuối**: chủ dự án Supabase (chính bạn) xem được dữ liệu trong bảng.
- Đừng commit file sao lưu `.json` hay ảnh báo cáo tín dụng vào repo.

## Phát triển

- Các script là script thường (không phải module), dùng chung phạm vi toàn cục. **Thứ tự nạp trong `index.html` quan trọng**.
- `model.js` và `loan.js` không đụng DOM nên test được bằng Node. Ngày hôm nay giả lập qua `globalThis.__TODAY__`.
- Thêm một tab: thêm nút và `<section>` trong `index.html`, viết `views/<tên>.js`, gọi trong `renderAll()` ở `app.js`, thêm file vào `index.html` và `sw.js` (test báo nếu thiếu).
- Khi thêm hoặc bỏ file, đổi `VERSION` trong `sw.js`.
- Dữ liệu đọc từ localStorage, file nhập hay đám mây đều đi qua `sanitizeState`. Thêm trường mới thì thêm luôn vào hàm `clean...` trong `state.js`.

## Giới hạn

### Bản 1.2.0 — dữ liệu và cách dùng

- Nhập số dư ví **trước giao dịch đầu tiên**, không nhập số dư hiện tại rồi nhập lại giao dịch cũ.
- Chuyển ví không được tính vào thu/chi. Ví có giao dịch không thể xoá để tránh mất tham chiếu.
- Chi tiêu độc lập với Kế hoạch, Phải thu và ghi nhận Đã trả nợ; chưa tự tạo giao dịch giữa các mục.
- Ngân sách áp dụng riêng từng tháng, chưa có giao dịch định kỳ. Báo cáo so với toàn bộ tháng trước; tháng hiện tại có thể chưa kết thúc.
- Giao dịch lưu trong `tx['YYYY-MM']` nhưng **vẫn đồng bộ toàn bộ payload** trong bảng `user_data`, giữ giới hạn 1 MB và nguyên tắc bản mới hơn thắng. Không cần thay SQL cho bản này; chưa đồng bộ riêng từng tháng.
- Sao lưu JSON chứa cả ví, giao dịch và ngân sách. Sao lưu cũ được bổ sung ví mặc định khi đọc. Không mở bản dữ liệu mới bằng ứng dụng phiên bản cũ vì bản cũ không giữ các trường mới.
- Khi dữ liệu cục bộ không đọc được, ứng dụng dừng và chặn lưu/đồng bộ, cho tải bản gốc để phục hồi. Không xoá bộ nhớ trình duyệt trước khi giữ bản sao.
- CSV có BOM UTF-8 và vô hiệu hoá ô văn bản bắt đầu như công thức bảng tính. File lịch là ảnh chụp lịch dự kiến, không tự cập nhật hay xoá sự kiện đã nhập; kiểm tra nhắc báo trong ứng dụng lịch.
- Các file mới: `js/spend.js` (mô hình), `js/exports.js` (CSV/ICS), `js/views/spend.js` (Chi tiêu/Báo cáo). Hai file logic mới nạp trước `state.js` để đọc dữ liệu cũ an toàn.
- Chưa triển khai mô hình thẻ tín dụng chuyên biệt, bốn cách tính lãi, IRR và mô phỏng chiến lược trả nợ của kế hoạch 2.0.

- Không có thông báo đẩy: ứng dụng nhắc khi bạn mở nó. Nên đặt thêm nhắc lịch trên điện thoại.
- Phông Be Vietnam Pro tải từ Google Fonts; ngoại tuyến sẽ dùng phông hệ thống.
