import { STORY, REGIONS } from './data.js';

export const VOWS = {
  resolve: { name: 'Kiên định', text: 'Dù tiên lộ gian nan, con sẽ không lùi bước.', effect: 'Tu luyện nhận thêm 5% tu vi.', icon: 'mountain' },
  wisdom: { name: 'Minh tâm', text: 'Con muốn hiểu đạo, trước khi dùng sức mạnh của đạo.', effect: 'Linh lực tối đa tăng thêm 10.', icon: 'book' },
  compassion: { name: 'Nhân tâm', text: 'Con muốn đủ mạnh để bảo vệ người bên cạnh.', effect: 'Linh đan hồi 60% thay vì 50% sinh lực.', icon: 'lotus' },
};

export function createNarrative(legacy = false) {
  return { introStep: legacy ? 3 : 0, introComplete: legacy, vow: null, seenChapters: [] };
}

export function introScene(name) {
  return {
    kind: 'intro', title: 'Một niệm bước vào tiên lộ', location: 'Động phủ vô danh',
    context: 'Mười sáu tuổi · Động phủ vô danh', npcName: 'Sư phụ', portrait: 'master',
    pages: [
      { side: 'left', speaker: 'Sư phụ', text: 'Lại đến rồi à? Mới sáng sớm mà con đã đứng trước cửa động. Mười năm nay ta dạy con cầm kiếm, dạy con nhận mặt linh thảo… xem ra bấy nhiêu vẫn chưa đủ làm con hết tò mò.' },
      { side: 'right', speaker: name, text: 'Sư phụ, người đã hứa khi linh căn của con thức tỉnh sẽ truyền cho con tiên pháp. Con không muốn chỉ đứng nhìn những vệt kiếm bay qua đỉnh núi nữa. Con cũng muốn tự mình bước lên con đường ấy.' },
      { side: 'left', speaker: 'Sư phụ', text: 'Tiểu tử, ngươi vội cái gì? Làm tiên nhân không dễ như ngươi nghĩ đâu. Được rồi, dù gì cũng đã hứa với ngươi. Đây là “Tụ Khí Quyết”, hãy học nó và ngươi sẽ có thể bắt đầu tu luyện.' },
      { side: 'left', speaker: 'Sư phụ', text: 'Nhưng trước khi nhận công pháp, hãy trả lời ta một điều. Tiên lộ có thể cho con sức mạnh, cũng có thể lấy đi tất cả. Đến lúc ấy, con muốn giữ lại điều gì trong lòng mình?', choices: true },
    ],
  };
}

const replies = [
  'Con sẽ ghi nhớ. Trước khi đi tìm câu trả lời, con muốn biết mình đã đủ sức cầm thanh kiếm này hay chưa.',
  'Một vết kiếm giữa rừng trúc… Ta sẽ tìm người mất tích trước. Nếu có ai đứng sau chuyện này, hắn phải để lại dấu vết.',
  'Ký ức của ta có thể không trọn vẹn, nhưng lời hứa cứu người thì vẫn còn nguyên. Hãy chỉ cho ta đường đi.',
  'Ta đã thấy khuôn mặt ấy trong mộng. Nếu thanh kiếm này còn nhớ, ta sẽ lắng nghe câu chuyện của nó.',
  'Con sẽ tìm người bán đèn. Nhưng sư phụ, người phải chờ con trở lại. Đây cũng là một lời hứa.',
  'Nếu một ngọn đèn đổi được một bí mật, ta xin đổi lấy sự thật về người đã để miếng ngọc này lại.',
  'Vậy chúng ta cùng đi. Lần này ta sẽ không quyết định thay nàng nữa.',
  'Tiếng gọi ấy có thể là một cái bẫy. Nhưng ta không thể quay lưng trước khi biết ai đang chờ dưới đáy vực.',
  'Nước mắt của kiếm… Có lẽ điều lão muốn không phải một báu vật, mà là một câu trả lời.',
  'Xin đừng khép quyển sách. Dù chỉ còn một cái tên, ta cũng muốn đọc đến cuối cùng.',
  'Ta sẽ nghe. Một người bị xóa khỏi luân hồi cũng phải có quyền kể lại tên mình.',
  'Nàng đừng sợ. Nếu nàng quên, ta sẽ kể lại. Còn nếu ta quên, xin nàng hãy gọi tên ta.',
  'Người đã giữ cánh cửa mười năm. Phần đường còn lại, hãy để con đi cùng người.',
  'Ta đã trách nhầm người ấy. Lá thư này sẽ được gửi đi, kể cả khi người viết không còn trở về.',
  'Một giấc mộng đẹp đến đâu cũng không thể thay thế những người thật đang đợi ta. Ta phải tỉnh lại.',
  'Nếu ta đã từng thất bại, hôm nay ta sẽ lựa chọn lại. Vòng luân hồi này không cần kết thúc như lần trước.',
  'Ta không đến để xin trường sinh. Ta đến để đưa một người trở về.',
  'Lần này không vì thiên mệnh, cũng không vì bất kỳ lời tiên tri nào. Chúng ta tự chọn con đường này.',
  'Một lời thề để bảo vệ thế giới không thể trở thành xiềng xích của thế giới. Ta sẽ viết tiếp phần còn thiếu.',
  'Ngày trước cũng có người trao cho ta một thanh kiếm gỗ. Bây giờ, đến lượt ta giữ sáng ngọn đèn ấy.',
];

export function chapterScene(index, name) {
  const chapter = STORY[index];
  if (!chapter) return null;
  const sentences = chapter.text.split(/(?<=[.!?])\s+/u);
  const split = Math.max(1, Math.ceil(sentences.length / 2));
  const first = sentences.slice(0, split).join(' ');
  const last = sentences.slice(split).join(' ');
  const isPlayer = chapter.speaker === 'Ngươi';
  const portrait = /Tô|Liễu|Nhược Thủy|Vãn Ninh/u.test(chapter.speaker) ? 'woman' : 'master';
  return {
    kind: 'chapter', id: index, title: chapter.title, location: REGIONS[chapter.region].name,
    context: `Chương ${String(index + 1).padStart(2, '0')} · ${REGIONS[chapter.region].name}`,
    npcName: isPlayer ? 'Sư phụ' : chapter.speaker, portrait,
    pages: [
      { side: isPlayer ? 'right' : 'left', speaker: isPlayer ? name : chapter.speaker, text: first },
      { side: 'right', speaker: name, text: replies[index] },
      ...(last ? [{ side: isPlayer ? 'right' : 'left', speaker: isPlayer ? name : chapter.speaker, text: last }] : []),
      { side: 'narrator', speaker: 'Tiên lộ ký', text: `Câu chuyện “${chapter.title}” vẫn còn một trang chưa khép. Hãy trở về hành trình, hoàn thành mục tiêu chương và nhận phần thưởng trong Nhiệm vụ.`, ending: true },
    ],
  };
}

const npcReplies = {
  'Trưởng lão': 'Đệ tử xin ghi nhớ. Mong tiền bối chỉ thêm cho con một đường kiếm.',
  'Thương nhân': 'Đạo hữu nói có lý. Ta muốn xem những pháp khí và vật tư hiện có.',
  'Luyện đan sư': 'Ta có mang theo linh thảo. Xin chỉ cho ta cách giữ dược lực trong lò đan.',
  'Tán tu': 'Cảm ơn đạo hữu đã nhắc. Nếu đi qua nơi ấy, ta sẽ để tâm tìm dấu tích.',
  'Người giữ bí cảnh': 'Ta sẽ trở lại khi đã chuẩn bị đủ. Trước mắt, có việc gì ta có thể giúp người trong vùng?',
};
const npcEndings = {
  'Trưởng lão': 'Được. Kiếm không chỉ ở tay, mà còn ở cách ngươi giữ tâm giữa một trận đấu. Nếu muốn, ta sẽ chỉ điểm cho ngươi ngay bây giờ.',
  'Thương nhân': 'Mời đạo hữu cứ xem. Linh đan, linh thảo, pháp khí đều có giá rõ ràng. Chỉ mua thứ thật sự hợp với căn cơ của mình.',
  'Luyện đan sư': 'Hãy mang linh thảo vào đan phòng. Ta đã chuẩn bị đan phương phù hợp với cảnh giới của ngươi. Đừng nóng vội, giữ lửa đều tay.',
  'Tán tu': 'Sơn dân đang cần người giúp. Những việc nhỏ ấy cũng là một cách kết thiện duyên. Hãy xem bảng ủy thác trước khi lên đường.',
  'Người giữ bí cảnh': 'Có. Những yêu thú ngoài sơn môn vẫn chưa yên. Hoàn thành ủy thác trong vùng, rồi ngươi sẽ hiểu vì sao ta chưa thể rời nơi này.',
};

export function npcScene(npc, name) {
  return {
    kind: 'npc', id: npc.id, title: `Gặp gỡ ${npc.name}`, location: REGIONS[npc.region].name,
    context: `${npc.role} · ${REGIONS[npc.region].name}`, npcName: npc.name,
    portrait: npc.role === 'Luyện đan sư' ? 'woman' : 'master', role: npc.role,
    pages: [
      { side: 'left', speaker: npc.name, text: npc.dialogue },
      { side: 'right', speaker: name, text: npcReplies[npc.role] },
      { side: 'left', speaker: npc.name, text: npcEndings[npc.role], service: true },
    ],
  };
}
