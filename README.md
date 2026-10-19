# Thiên Đạo · Phàm Nhân Vấn Tiên

Game tu tiên nhập vai theo lượt, chơi đơn ngay trên trình duyệt. Phong cách hang động, thủy mặc, tông xanh trầm và viền vàng lấy cảm hứng từ ảnh tham khảo. Không cần tài khoản, máy chủ, API key hay cơ sở dữ liệu.

## Chạy game

Dùng Node.js 22.12+ (đã kiểm tra với Node.js 24):

```sh
npm ci
npm run dev
```

Mở địa chỉ máy chủ Vite hiển thị trong terminal bằng môi trường phát triển có hỗ trợ truy cập web. Trên cloud này, nếu npm không ghi được cache mặc định, dùng `npm ci --cache /workspace/.cache/thien-dao-npm`.

```sh
npm run build    # Tạo bản phát hành tĩnh trong dist/
npm run preview  # Kiểm tra bản đã build
npm test         # Kiểm thử dữ liệu và luật chơi
```

Chạy kiểm thử trình duyệt:

```sh
npx playwright install chromium
npm run test:e2e
```

Nếu máy đã có Chromium, không cần tải trình duyệt nữa:

```sh
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
```

## Nội dung và hệ thống

Thư viện gồm chính xác **5.000 mục dữ liệu**, có thể tra cứu, tìm kiếm và phân trang trong **Vạn vật lục**:

| Nhóm | Số mục |
| --- | ---: |
| Cảnh giới, mỗi cảnh giới 9 tầng | 30 |
| Vùng đất, mở theo cảnh giới | 120 |
| Yêu thú và thủ lĩnh, có chỉ số và chiến lợi phẩm | 1.200 |
| NPC thuộc 5 vai trò, có đối thoại và thiện cảm | 600 |
| Trang bị, 6 vị trí và 6 phẩm chất | 1.800 |
| Công pháp công kích, hồi phục và hộ thể | 600 |
| Nhiệm vụ: 20 chương chính truyện, 380 ủy thác | 400 |
| Đan phương, cần linh thảo và linh thạch | 250 |
| **Tổng** | **5.000** |

20 chương chính truyện có lời văn riêng, xoay quanh ngọc bội, chín tiếng chuông trời, thân thế của nhân vật và giao ước của Tô Vãn Ninh. Phần lớn mục còn lại là **biến thể được sinh có quy luật** theo vùng đất, loại và cảnh giới; không phải 5.000 kịch bản hay hình minh họa được viết/vẽ riêng. Các dòng quái dùng hai hình linh lang đại diện: yêu lang tím cho dòng Ma đạo, linh lang xanh cho các dòng còn lại; tên, chỉ số và đặc tính theo từng loài.

Các hệ thống hoạt động: chiến đấu theo lượt, bạo kích, phòng thủ, hồi phục, Khí thế và tuyệt kỹ; săn quái rơi đồ; du hành, kỳ ngộ, gặp NPC; mua bán và đổi trang bị ảnh hưởng chỉ số; học và chọn tối đa 3 công pháp; tu luyện, đột phá; ủy thác có tiến độ tính từ lúc nhận; luyện đan; tự động lưu, xuất và nhập bản lưu.

## Chơi lần đầu

1. Đọc cảnh mở đầu và chọn đạo tâm, hoặc dùng **Bỏ qua**. Sau đó đánh thường 4 lượt để tích đủ 100 Khí thế, dùng **Nhất Kiếm Khai Thiên** để hoàn thành chỉ điểm.
2. Mở **Nhiệm vụ**, nhận phần thưởng chương đầu để tiếp nối cốt truyện.
3. Mở **Tu luyện** ở động phủ hoặc nhấn **T**. **Tụ khí** tăng tu vi và hồi toàn bộ sinh lực, linh lực; **Tĩnh tọa** không tốn lượt. Đủ tu vi và linh thạch thì **Đột phá**. Cảnh giới mới mở vùng đất, trang bị và công pháp mới.
4. Đi tới **Thế giới**, khám phá để gặp quái, tìm kho báu, linh thảo và kỳ nhân. Trò chuyện với NPC để mở dịch vụ tương ứng.
5. Vào **Túi đồ** để đổi pháp khí, mua vật tư hoặc luyện đan. Vào **Công pháp** để đổi bí tịch và sắp chiêu thức xuất trận.

Phím tắt khi ở động phủ:

| Phím | Thao tác |
| --- | --- |
| 1 | Tấn công |
| 2–4 | Công pháp đã chọn |
| 5 | Phòng thủ: giảm 70% sát thương, hồi 18 linh lực |
| 6 | Dùng Linh đan |
| 7 | Tuyệt kỹ, cần 100 Khí thế |
| 0 | Rút lui khỏi trận với yêu thú |
| I | Mở/đóng hành trang, cả khi đang đọc đối thoại |
| T | Mở/đóng tu luyện, cả khi đang đọc đối thoại |
| ? | Hướng dẫn |
| Esc | Đóng hộp thoại |
| / | Tìm kiếm khi mở Vạn vật lục |

Đổi trang bị, đổi công pháp, du hành, luyện đan và đột phá cần kết thúc hoặc rời trận trước. Bại trận mất 5% linh thạch, giữ tu vi và được hồi phục. Đột phá không có xác suất thất bại. NPC tặng thiện cảm và tu vi một lần mỗi ngày trong game.

## Đấu trường toàn màn hình

Sau cảnh mở đầu, khi **Thỉnh giáo** sư phụ hoặc gặp quái trong lúc **Khám phá**, game mở đấu trường: chỉ điểm trong hang, săn quái giữa núi phủ sương. Hai nhân vật tách lớp, bảng máu / linh lực / Khí thế, số lượt và nhật ký đều lấy từ trận đang lưu.

- **Tấn công** tích 25 Khí thế. Ba ô sách dùng đúng công pháp đang mang; hiển thị sát thương, hồi phục, hộ thể và chi phí linh lực. Đòn công kích hiển thị khoảng sát thương trước bạo kích.
- Nhãn phía trên đối thủ báo trước **Tấn công**, **Hộ thể** hoặc **Tuyệt chiêu**, kèm khoảng sát thương nếu chưa phòng thủ. Trong chỉ điểm, sư phụ gây 3–6 sát thương và giữ ít nhất 1 sinh lực cho đệ tử.
- **Phòng thủ** giảm 70% sát thương đòn kế tiếp, hồi 18 linh lực và tích 18 Khí thế. **Linh đan** dùng một viên và tiêu tốn một lượt; nút khóa khi đã đầy sinh lực lẫn linh lực.
- Đủ 100 Khí thế, **Nhất Kiếm Khai Thiên** sáng lên. Dùng tuyệt kỹ hoàn thành chỉ điểm; hạ quái nhận tu vi và chiến lợi phẩm theo dữ liệu của quái đó. Kết quả được lưu ngay, hiệu ứng kết trận phát xong thì trở về động phủ.
- **Động phủ** hoặc Esc mở lại giao diện tổng quan, giữ nguyên trận và tài nguyên. Chọn **Vào trận** để trở lại đấu trường. **Rời trận** mới kết thúc giao tranh.
- Mở **Túi đồ** bằng nút góc phải hoặc phím I, dùng đan rồi đóng lại vẫn tiếp tục đúng lượt. Phím T mở tu luyện để xem; thao tác tu hành bị khóa khi chưa rời trận.
- Nút **Nhật ký trận** mở/thu gọn diễn biến. Khi hiệu ứng ra đòn chạy, chiêu thức tạm khóa để mỗi thao tác chỉ tiêu tốn một lượt. Chế độ giảm chuyển động vẫn giữ nguyên luật chơi.

Trên điện thoại, các chiêu thức được chia thành hai hàng; khi xoay ngang, chúng nằm cạnh nhật ký. Nền sơn thủy và yêu lang tím được vẽ riêng theo ảnh tham khảo. Nhãn góc trái hiển thị đúng vùng đất hiện tại và dẫn về tổng quan. **Rút lui** hoặc phím **0** kết thúc trận, giữ vật phẩm và không nhận chiến lợi phẩm.

### Đặc tính và hộ thể của yêu thú

Mỗi dòng quái có một hệ kháng và một hệ yếu. **Kháng** giảm 25% sát thương nhận từ hệ tương ứng, **Yếu** tăng 25%. Tấn công thường và tuyệt kỹ thuộc hệ Kiếm; mỗi công pháp có hệ ghi trên ô sách. Dự báo sát thương đã tính kháng, yếu và hộ thể, chưa tính bạo kích. Chọn nhãn đặc tính của quái để xem giải thích và hệ của các chiêu đang mang, không tốn lượt.

| Dòng yêu thú | Hệ kháng | Hệ yếu |
| --- | --- | --- |
| Thanh Lang | Ma đạo | Kiếm |
| Xích Hỏa Hồ | Hỏa | Băng |
| Huyền Giáp Quy | Kiếm | Lôi |
| U Ảnh Báo | Ma đạo | Hỏa |
| Bích Lân Xà | Mộc | Băng |
| Thiết Vũ Ưng | Thương | Lôi |
| Hàn Sương Hổ | Băng | Hỏa |
| Lôi Giác Tê | Lôi | Mộc |
| Ma Viên | Linh thuật | Kiếm |
| Cổ Mộc Yêu | Mộc | Hỏa |

Yêu thú dùng chu kỳ bốn lượt: **Tấn công → Hộ thể → Tấn công → Tuyệt chiêu**. Lượt tạo hộ thể không gây sát thương; lớp hộ thể giảm 50% sát thương của một đòn công kích rồi mất. Hồi phục hoặc phòng thủ không tiêu hao lớp này. Tuyệt chiêu dùng 135% công kích, vẫn có thể giảm sát thương bằng phòng thủ. Tên tuyệt chiêu thay đổi theo dòng quái. Lượt kế tiếp và lớp hộ thể đang có được giữ khi tải lại; bản lưu cũ tiếp tục từ số lượt đã có. Sư phụ giữ luật chỉ điểm, không dùng cơ chế kháng/yếu của yêu thú.

## Tu luyện và tụ khí

Nhấn **T**, chọn **Tu luyện** ở động phủ / hồ sơ nhân vật, hoặc mở **Tụ Khí Quyết → Xem tu luyện** trong túi đồ. Màn nhập định dùng nền hang mờ, nhân vật ngồi giữa vòng linh khí, chín sao sáng theo tầng và thanh tu vi thực tế. Đóng bằng **X**, **T** hoặc Esc; đối thoại đang đọc được giữ nguyên trang.

- **Tụ khí:** có 10 lượt, hồi đầy cả nhóm sau 3 giờ kể từ lần dùng đầu tiên. Thời hạn không bị kéo dài bởi những lần dùng tiếp, đóng màn hoặc tải lại. Thời gian rời game vẫn được tính. Bộ đếm dùng đồng hồ của thiết bị và được lưu cùng nhân vật.
- Mỗi lượt nhận `(52 + tầng × 8) × 1,75^cảnh_giới` tu vi, làm tròn; đạo tâm Kiên định cộng 5%. Sinh lực và linh lực hồi đầy.
- **Tĩnh tọa:** không giới hạn lượt, nhận lượng tu vi nhỏ hơn và hồi đầy sinh lực, linh lực. Có thể tiếp tục tu hành trong lúc chờ lượt tụ khí.
- **Đột phá:** mở khi đủ tu vi và linh thạch, trừ đúng chi phí hiển thị, tăng tầng và chỉ số. Qua tầng 9 sẽ sang cảnh giới mới; số lượt tụ khí còn lại được giữ. Đạt Vô Thượng tầng 9 là viên mãn.
- Đang giao tranh thì tụ khí, tĩnh tọa và đột phá bị khóa. Bản lưu cũ tự nhận 10 lượt đầu, giữ nguyên tiến trình. Tu vi tích lũy tối đa bằng 10 lần yêu cầu tầng hiện tại; tụ khí dừng khi đầy.

## Hành trang và chỉ số

Nhấn **I** hoặc chọn **Túi đồ** để mở cửa sổ nổi trên nền động phủ. Bên trái là nhân vật, 6 vị trí trang bị và các thanh sinh lực, linh lực, Khí thế, tu vi. Hai ô nhanh mở Linh đan và tâm pháp nhập môn.

- **Hành trang:** lọc Toàn bộ / Đan dược / Nguyên liệu / Trang bị / Đạo cụ / Sách. Tìm theo tên hoặc mô tả, hỗ trợ tiếng Việt không dấu. Danh sách phân trang 20 mục.
- **Chỉ số:** công kích, phòng ngự, bạo kích, sinh lực, linh lực, linh căn, pháp khí đang mang và hiệu ứng đạo tâm; các giá trị cập nhật từ trang bị thực tế.
- Chọn vật phẩm để xem chi tiết. Pháp khí có so sánh với đồ cùng vị trí đang mặc; có thể **Trang bị**, **Tháo trang bị** và **Bán**. Tháo đồ giữ vật phẩm trong túi. Đồ đang mặc cần tháo trước khi bán.
- Chọn một ô trang bị trống để lọc đúng vị trí đó. Sách đã học cho phép mang/gỡ công pháp xuất trận. Linh đan dùng trực tiếp; linh thảo dẫn tới Đan phòng; tiền tệ dẫn tới Thương hội.
- Khi giao tranh, hành trang vẫn mở được để xem hoặc dùng đan. Đổi trang bị và công pháp bị khóa; dùng đan vẫn tiêu tốn một lượt.

Bấm **X**, **I** hoặc Esc để đóng. Nếu đang xem chi tiết vật phẩm, Esc đóng phần chi tiết trước. **/** đưa con trỏ tới ô tìm kiếm. Có thể mở túi đồ giữa cuộc đối thoại; khi đóng, câu chuyện trở lại đúng trang và người nói trước đó.

## Đối thoại theo cảnh

Cảnh mở đầu dùng nền hang toàn màn hình, chân dung tách lớp và khung thoại viền vàng. Nhân vật đang nói sáng hơn. Chạm **Tiếp tục**, Enter hoặc Space để hiện hết lời đang chạy; thao tác thêm một lần để sang trang. Phím ← đọc lại trang trước, **L** mở nhật ký, Esc đóng nhật ký hoặc tạm rời đối thoại. Có thể bật giảm chuyển động trong Cài đặt để hiện chữ ngay.

Ở trang cuối cảnh mở đầu, chọn một đạo tâm:

- **Kiên định:** thêm 5% tu vi từ tĩnh tọa và tụ khí.
- **Minh tâm:** thêm 10 linh lực tối đa.
- **Nhân tâm:** Linh đan hồi 60% thay vì 50% sinh lực.

Hoàn thành hoặc bỏ qua cảnh mở đầu nhận Tụ Khí Quyết, 20 tu vi, 1 Linh đan và 2 linh thảo đúng một lần. Bỏ qua không tự chọn đạo tâm. Nút **Chuyện cũ** ở động phủ cho xem lại cảnh mở đầu; xem lại không đổi lựa chọn hay nhận thêm thưởng.

NPC trò chuyện qua ba lượt thoại, sau đó đưa tới dịch vụ tương ứng. Trong **Nhiệm vụ → Chính truyện**, nút **Đọc đối thoại** mở cảnh của chương hiện tại. Đọc truyện không tự hoàn thành mục tiêu hoặc nhận thưởng nhiệm vụ.

Trang xa nhất đã đọc của cảnh mở đầu được lưu và khôi phục khi tải lại. Bản lưu cũ tự chuyển đổi, giữ nguyên nhân vật và không ép xem lại mở đầu. Các chân dung được dùng lại theo vai trò nhân vật, không phải 600 hình NPC riêng.

## Lưu tiến trình

Bản lưu nằm trong `localStorage` với khóa `thien-dao-save-v1`, gồm cả trận đấu đang diễn ra. **Cài đặt → Xuất bản lưu** tạo tệp JSON; nhập lại cần xác nhận trước khi thay thế hành trình hiện tại. Xóa dữ liệu trình duyệt sẽ xóa bản lưu. Các địa chỉ web khác nhau có bộ nhớ riêng. Không có đồng bộ tài khoản hoặc máy chủ; nên chơi trong một tab và xuất bản lưu định kỳ.

## Cấu trúc

- `src/data.js`: dữ liệu có quy luật và 20 chương chính truyện.
- `src/engine.js`: luật chơi độc lập với giao diện, bộ sinh số ngẫu nhiên có seed và xác thực bản lưu.
- `src/app.js`: giao diện, điều hướng, âm thanh, hộp thoại và lưu trên trình duyệt.
- `src/combat-rules.js`: hệ công pháp, kháng/yếu theo loài, hộ thể, dự báo và chu kỳ ra đòn của yêu thú.
- `src/battle-screen.js`, `src/battle.css`: đấu trường toàn màn hình, dự báo sát thương, chiêu thức và hiệu ứng nhân vật tách lớp.
- `src/styles.css`: bố cục máy tính/điện thoại, hiệu ứng và chế độ giảm chuyển động.
- `src/narrative.js`: kịch bản cảnh mở đầu, đối thoại 20 chương, 5 vai trò NPC và hiệu ứng đạo tâm.
- `src/story-player.js`, `src/story.css`: sân khấu đối thoại toàn màn hình, hiệu ứng hiện chữ, đổi người nói và nhật ký.
- `src/inventory-panel.js`, `src/inventory.css`: cửa sổ hành trang và chỉ số trên nền động phủ.
- `src/cultivation.js`, `src/cultivation-panel.js`, `src/cultivation.css`: lượt tụ khí, hồi phục theo đồng hồ và màn nhập định chín tầng.
- `src/inventory-model.js`, `src/item-art.js`: nhóm vật phẩm từ bản lưu, bộ lọc, so sánh trang bị và hình minh họa vector.
- `public/art/`: minh họa chỉ điểm, săn quái, nền hang và chân dung nhân vật có kênh alpha, được tạo riêng cho dự án.
- `tests/engine.test.js`: kiểm thử dữ liệu, chiến đấu, kinh tế, nhiệm vụ, 30 cảnh giới và bản lưu.
- `tests/inventory.test.js`: 6 kiểm thử dữ liệu hành trang, tìm kiếm, so sánh, tháo và bán trang bị.
- `tests/narrative.test.js`: 6 kiểm thử kịch bản, đạo tâm, phần thưởng một lần và tương thích bản lưu cũ.
- `tests/combat-rules.test.js`: kiểm thử chọn hệ khắc chế, hộ thể một đòn, tuyệt chiêu, giảm sát thương và tương thích bản lưu.
- `tests/cultivation.test.js`: kiểm thử hồi lượt, thời hạn cố định, giới hạn tu vi, chiến đấu, đột phá và bản lưu cũ.
- `tests/browser/`: kiểm thử luồng chơi, đấu trường, túi đồ, NPC, kỹ năng, đối thoại, tìm kiếm, bản lưu và bố cục di động/ngang bằng Chromium.

Phông chữ được đóng gói cùng ứng dụng, không gọi Google Fonts khi chơi. Giấy phép OFL của phông nằm trong `public/licenses/`.
