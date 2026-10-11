# Quyền riêng tư — Lynquora StudySpace

Lynquora StudySpace là ứng dụng web tĩnh chạy trong trình duyệt của bạn.

## Dữ liệu được lưu

Khi bạn tạo tài khoản, ứng dụng lưu tên đăng nhập, tên hiển thị, muối ngẫu nhiên và bản băm mật khẩu PBKDF2-SHA-256 trong localStorage. Nhiệm vụ, thời gian tập trung, ghi chú, thẻ ghi nhớ, tùy chỉnh và các thống kê được lưu ở localStorage theo tài khoản trên cùng thiết bị/trình duyệt.

Mật khẩu thô không được lưu lại. Sau khi đăng nhập, một dấu phiên chứa tên tài khoản (không chứa mật khẩu) được lưu để tự mở lại không gian khi tải trang; dấu này được xóa khi chọn Đăng xuất. Vì vậy, bất kỳ ai sử dụng cùng hồ sơ trình duyệt khi bạn vẫn đăng nhập đều có thể mở không gian đó. Tuy vậy, vì ứng dụng không có backend và localStorage không phải kho dữ liệu máy chủ bảo mật, đây không phải hệ thống tài khoản dùng cho dữ liệu nhạy cảm. Người có quyền truy cập vào trình duyệt hoặc hồ sơ người dùng trên thiết bị có thể có khả năng truy cập dữ liệu cục bộ.

## Dữ liệu không được gửi đi

Bản hiện tại không gửi dữ liệu học tập hoặc tài khoản tới API của bên thứ ba, không có đăng nhập qua mạng xã hội, không có đồng bộ máy chủ và không có chức năng khôi phục mật khẩu. Không sử dụng công cụ xuất/nhập JSON trên thiết bị công cộng nếu bản sao lưu có thông tin riêng tư. Trên thiết bị dùng chung, hãy chọn Đăng xuất sau khi sử dụng.

## Quản lý dữ liệu

Bạn có thể xuất dữ liệu JSON từ phần Tùy chỉnh. Xóa dữ liệu website trong cài đặt trình duyệt sẽ xóa các dữ liệu đã lưu trên thiết bị đó. Nếu chuyển trình duyệt hoặc thiết bị, hãy tự tải bản sao lưu và nhập lại ở nơi mới.

## Liên hệ & cập nhật

Đây là ghi chú quyền riêng tư cho bản tĩnh được phát hành cùng bộ mã. Nếu bạn triển khai một backend hoặc thêm dịch vụ bên ngoài, hãy cập nhật tài liệu này trước khi phát hành phiên bản mới.


## Dữ liệu của tính năng mới

Bản 2.2.0 lưu ngày hoàn thành thử thách và lịch ôn cách quãng của thẻ (ngày ôn tiếp, khoảng ngày và chuỗi ôn) trong dữ liệu học tập của trình duyệt. Hẹn giờ nghỉ chỉ chạy trong phiên trang hiện tại và không gửi dữ liệu ra máy chủ. Khu giải trí mở Echo Collapse trên trang itch.io của tác giả; website không nhúng nội dung game và không thu thập dữ liệu từ trang game bên ngoài.


Kho nguồn dữ liệu cũng được lưu cục bộ trong dữ liệu tài khoản trình duyệt. Bản sao lưu JSON và CSV do bạn chủ động tải xuống có thể chứa tên, đường dẫn, mô tả, tag và ghi chú nguồn; hãy lưu tệp ở nơi phù hợp. Website không tự tải nội dung tài liệu từ các liên kết và không gửi chúng đến máy chủ.

Ở bản 2.3.0, kho nguồn học liệu (tên, URL, môn, mô tả, tag, trạng thái đọc và đánh giá cá nhân) cũng nằm trong `localStorage`. CSV và JSON chỉ được tạo khi bạn chủ động chọn xuất; không có thao tác tải hàng loạt nội dung từ website bên ngoài.
