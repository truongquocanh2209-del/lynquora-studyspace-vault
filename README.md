# Lynquora StudySpace

Không gian học tập cá nhân với giao diện tối/sáng, màu nhấn tùy chỉnh, cỡ chữ linh hoạt, danh sách nhiệm vụ, lịch tuần, Focus/Pomodoro, ghi chú, thẻ ghi nhớ, quiz ôn tập, thống kê và sao lưu/khôi phục JSON.

## Bản cập nhật 2.3.0

- Sửa lỗi gửi biểu mẫu nhiệm vụ, ghi chú và thẻ ghi nhớ: thao tác lưu không còn điều hướng ra URL có chứa dữ liệu biểu mẫu.
- Lưu dấu phiên đăng nhập trong trình duyệt; tự mở lại không gian khi tải trang và chỉ bỏ ghi nhớ khi người dùng đăng xuất (hoặc xóa dữ liệu trang web).
- Quiz gắn đáp án với mã thẻ nguồn nên không chấm nhầm khi nhiều thẻ có cùng câu trả lời; tự đặt lại quiz nếu không còn đủ hai thẻ.
- Tăng kiểm tra cấu trúc JSON khi khôi phục bản sao lưu; tệp không hợp lệ bị từ chối mà không ghi đè dữ liệu hiện có.
- Thêm mục **Giải trí & nghỉ ngơi** với liên kết trực tiếp đến Echo Collapse của tác giả trên itch.io, mở tab mới và có nhắc đặt giới hạn thời gian.
- Thêm đồng hồ nghỉ 3/5/10/15 phút, tạm dừng/tiếp tục/đặt lại, cùng các gợi ý nghỉ ngắn không màn hình.
- Thêm thử thách học tập nhỏ theo ngày, lưu trạng thái hoàn thành trong dữ liệu tài khoản.
- Thêm **Lộ trình gợi ý hôm nay** trên Tổng quan: tự ưu tiên việc quá hạn, bài đến hạn, việc ưu tiên cao, thẻ ôn đến hạn và mục tiêu tập trung.
- Bổ sung lịch ôn cách quãng cho thẻ ghi nhớ: đánh dấu “Khó nhớ” để hẹn ngày mai hoặc “Đã nhớ” để giãn dần từ 1 đến 30 ngày; lịch này được giữ trong bản sao lưu.
- Nâng phiên bản cache service worker và tham số tệp CSS/JS lên 2.3.0 để trình duyệt nhận mã mới.

- Thêm **Kho nguồn dữ liệu**: lưu website, video, tài liệu/PDF, đề thi, khóa học và nguồn khác; ghi môn học, mô tả, tối đa 12 tag, trạng thái đọc, đánh dấu yêu thích và đánh giá cá nhân.
- Kho nguồn có tìm kiếm toàn văn trên tên/URL/mô tả/môn/tag, lọc theo loại và trạng thái, đếm nhanh nguồn/yêu thích/chưa đọc, và xuất danh mục ra CSV tương thích bảng tính.
- Có checklist đánh giá độ tin cậy, mở nguồn bằng tab an toàn (`noopener noreferrer`), sao chép trích dẫn, tạo nhiệm vụ đọc và tạo ghi chú có gắn liên kết nguồn.
- Nâng cấu trúc sao lưu/khôi phục để lưu cả kho nguồn. Bản sao lưu v2.2.0 không có `resources` vẫn được nhập tương thích và tự chuyển thành kho trống.
- Chặn protocol nguy hiểm và thông tin đăng nhập nhúng trong URL; từ chối URL trùng, giới hạn tag/độ dài và xử lý các ô CSV có nguy cơ formula injection.

## Chạy thử trên máy

Mở `index.html` trong trình duyệt để xem giao diện và dùng thử. Để kiểm tra đăng ký/đăng nhập có mật khẩu, hãy chạy từ `localhost` hoặc HTTPS vì Web Crypto có thể bị trình duyệt chặn trên một số ngữ cảnh `file://`.

## Đăng website bằng GitHub Pages

1. Tải và giải nén ZIP.
2. Tạo một repository mới trên GitHub (ví dụ `lynquora-studyspace-vault`).
3. Sau khi giải nén ZIP, tải **toàn bộ các tệp nằm ngay trong thư mục vừa giải nén** lên thư mục gốc của repository (không đặt chúng bên trong thêm một thư mục con) — đặc biệt giữ `index.html`, `styles.css`, `app.js`, `sw.js`, `manifest.webmanifest` và `favicon.svg` cùng cấp.
4. Mở **Settings → Pages**.
5. Ở **Build and deployment**, chọn **Deploy from a branch**, chọn nhánh `main` và thư mục `/(root)`, sau đó nhấn Save.
6. Chờ GitHub Pages xuất bản xong và mở địa chỉ được hiển thị trong phần Pages. Với repository thông thường, địa chỉ thường có dạng `https://TEN-GITHUB.github.io/TEN-REPOSITORY/`.

Sau khi cập nhật mã, commit và push lại các tệp lên nhánh đã chọn. Không cần build hoặc cài thư viện. Phiên bản cache được đổi theo bản phát hành để tránh giữ lại tệp JavaScript/CSS cũ sau khi cập nhật.

## Tính năng

- Trang giới thiệu riêng và màn hình làm việc chính.
- Thanh công cụ dạng token bên trái cuộn dọc độc lập, có hỗ trợ menu trên màn hình nhỏ.
- Nhiệm vụ/bài tập: môn học, hạn hoàn thành, mức ưu tiên, lọc và đánh dấu hoàn tất.
- Kho nguồn dữ liệu cá nhân với tìm kiếm, lọc, tags, trạng thái đọc, yêu thích, đánh giá nguồn, xuất CSV, trích dẫn, tạo nhiệm vụ và ghi chú từ nguồn.
- Lịch tuần dựa trên hạn bài tập.
- Focus timer 15/25/45/60 phút, tạm dừng/tiếp tục và ghi nhận phiên học; thêm hẹn giờ nghỉ 3/5/10/15 phút.
- Ghi chú, thẻ ghi nhớ với lịch ôn cách quãng, quiz tạo từ các thẻ; quiz nhận diện đáp án theo thẻ nguồn kể cả khi nội dung đáp án trùng nhau.
- Thống kê phiên học theo ngày/môn, mục tiêu ngày và tiến độ nhiệm vụ.
- Cài đặt nền sáng/tối, 5 màu nhấn, cỡ chữ 14–19 px, mục tiêu thời gian học.
- Lộ trình gợi ý công việc theo ngày, thử thách học tập ngắn hằng ngày, khu Giải trí & nghỉ ngơi có liên kết Echo Collapse và gợi ý nghỉ cân bằng.
- Xuất/nhập dữ liệu cá nhân dạng JSON, gồm lịch ôn cách quãng và trạng thái thử thách ngày.
- Giao diện responsive, biểu tượng SVG tự vẽ, chế độ ngoại tuyến cơ bản qua service worker.

## Lưu ý về tài khoản và dữ liệu

Đây là website tĩnh, không có máy chủ xác thực. Tài khoản, bản băm mật khẩu PBKDF2, dấu phiên đăng nhập đã ghi nhớ và dữ liệu học được lưu trong `localStorage` của **trình duyệt trên thiết bị hiện tại**. Sau lần đăng nhập thành công, website tự mở lại không gian đó khi tải lại trang; dấu phiên chỉ bị xóa khi chọn Đăng xuất (hoặc khi bạn xóa dữ liệu website). Mật khẩu không được lưu dạng văn bản thuần, nhưng dữ liệu tổng thể không phải kho lưu trữ máy chủ được bảo vệ và không đồng bộ qua các thiết bị/trình duyệt. Vì phiên được ghi nhớ, không bật dùng trên thiết bị công cộng hoặc máy người khác; hãy đăng xuất khi dùng xong. Không dùng mật khẩu đang dùng ở dịch vụ khác, không lưu dữ liệu nhạy cảm và hãy tải bản sao lưu JSON trước khi xóa dữ liệu trình duyệt.

Nếu cần đồng bộ đa thiết bị, xác minh email, đặt lại mật khẩu hoặc bảo mật tài khoản ở cấp máy chủ, cần tích hợp một backend xác thực và cơ sở dữ liệu riêng; GitHub Pages một mình không cung cấp các khả năng đó.

## Rà soát bản quyền và tên

Mã HTML/CSS/JavaScript, SVG logo và hình minh họa giao diện trong gói được tạo riêng cho dự án, không tải ảnh, font hoặc thư viện bên thứ ba vào thời điểm đóng gói. Giấy phép MIT đi kèm áp dụng cho phần mã dự án này.

Tên **Lynquora StudySpace** đã được tìm kiếm sơ bộ bằng truy vấn web theo tên và cụm từ chính xác; lượt tìm kiếm đó không trả về kết quả trùng khớp rõ ràng. Việc này **không bảo đảm** tên miền còn trống, không trùng nhãn hiệu ở mọi quốc gia/ngành hàng, hoặc không có quyền trước đó chưa được lập chỉ mục. Trước khi dùng cho mục đích thương mại, hãy tra cứu cơ sở dữ liệu nhãn hiệu chính thức tại thị trường bạn quan tâm và kiểm tra tên miền.

## Các tệp chính

- `index.html` — cấu trúc trang, landing page và bảng điều khiển.
- `styles.css` — giao diện, bố cục responsive và các chủ đề.
- `app.js` — nghiệp vụ, xác thực cục bộ và lưu trữ dữ liệu.
- `sw.js` — cache tài nguyên tĩnh để hỗ trợ dùng lại khi ngoại tuyến.
- `manifest.webmanifest` — thông tin cài đặt dạng web app.
- `favicon.svg` — biểu tượng vector tự tạo.
- `PRIVACY.md` — giải thích dữ liệu được lưu như thế nào.
- `LICENSE` — giấy phép MIT.
