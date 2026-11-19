import { geo10Chapters, geo10Lessons } from "../../../data/geo10Curriculum";
import type { QuestionDifficulty } from "../../../types/question";
import type {
  ChapterDeckAvailability,
  GameMetadata,
  GameQuizQuestion,
  WordCatchPuzzle,
} from "../types";
import {
  GEO10_ADDITIONAL_QUESTIONS,
  GEO10_ADDITIONAL_WORD_PUZZLES,
} from "./geo10AdditionalQuestions";

export const GAME_CATALOG: GameMetadata[] = [
  {
    id: "millionaire",
    slug: "millionaire",
    title: "Ai là triệu phú Địa lý",
    badge: "NỔI BẬT",
    description:
      "Chinh phục 15 nấc thang kiến thức Địa lí 10 với 3 mốc an toàn và 4 quyền trợ giúp chiến thuật!",
    rulesSummary: [
      "Vượt qua 15 câu hỏi trắc nghiệm từ Nhận biết đến Vận dụng cao.",
      "Mốc an toàn tại câu 5 (2.000 điểm), câu 10 (22.000 điểm) và câu 15 (150.000 điểm).",
      "4 quyền trợ giúp dùng 1 lần/ván: 50:50, Hỏi ý kiến lớp học, Gợi ý chuyên gia, Đổi câu hỏi.",
      "Có thể Dừng cuộc chơi bất kỳ lúc nào để bảo toàn mức điểm hiện tại.",
    ],
    accentColor: "#8b5cf6",
    accentBg: "#f5f3ff",
    buttonBg: "bg-[#8b5cf6] hover:bg-[#7c3aed]",
    questionCountLabel: "15 câu hỏi / ván",
  },
  {
    id: "word-catch",
    slug: "word-catch",
    title: "Đuổi hình bắt chữ",
    badge: "TRÍ TUỆ",
    description:
      "Quan sát sơ đồ, hiện tượng và danh thắng để giải mã các thuật ngữ Địa lí 10 chuẩn xác.",
    rulesSummary: [
      "Mỗi ván gồm 10 thử thách hình ảnh kèm gợi ý kiến thức Địa lí 10.",
      "Chọn chữ cái từ bảng chữ hoặc gõ bàn phím (hỗ trợ cả có dấu và không dấu).",
      "Mỗi ván có 3 mạng và quyền Mở 1 chữ cái gợi ý khi gặp từ khó.",
      "Hoàn thành từ đúng sẽ hiển thị đầy đủ dấu tiếng Việt và giải thích chi tiết.",
    ],
    accentColor: "#06b6d4",
    accentBg: "#ecfeff",
    buttonBg: "bg-[#06b6d4] hover:bg-[#0891b2]",
    questionCountLabel: "10 hình ảnh / ván",
  },
  {
    id: "penalty-quiz",
    slug: "penalty-quiz",
    title: "Penalty Quiz",
    badge: "THỂ THAO",
    description:
      "Trả lời nhanh câu hỏi Địa lí 10 để nạp lực sút và đánh bại thủ môn trong loạt luân lưu 5 lượt!",
    rulesSummary: [
      "Loạt sút gồm 5 lượt giữa Học sinh và Thủ môn máy.",
      "Trả lời ĐÚNG câu hỏi Địa lí giúp mở khóa Cú sút Vàng (tăng tỉ lệ ghi bàn và cộng điểm thưởng).",
      "Trả lời SAI khiến cú sút bị giảm lực, thủ môn dễ bắt bài hơn.",
      "Chọn 1 trong 5 góc khung thành để dứt điểm ngay sau khi trả lời.",
    ],
    accentColor: "#10b981",
    accentBg: "#ecfdf5",
    buttonBg: "bg-[#10b981] hover:bg-[#059669]",
    questionCountLabel: "5 lượt sút / trận",
  },
  {
    id: "o-an-quan",
    slug: "o-an-quan",
    title: "Ô ăn quan Địa lý",
    badge: "DÂN GIAN",
    description:
      "Trò chơi dân gian Việt Nam kết hợp thử thách Địa lí 10 khi ăn Quan và cố vấn nước đi thông minh.",
    rulesSummary: [
      "Bàn cờ gồm 2 ô Quan (mỗi ô 1 Quan = 10 điểm dân) và 10 ô Dân (mỗi ô 5 quân dân).",
      "Chọn ô dân bên mình và hướng rải (Trái/Phải). Nếu sau ô cuối là 1 ô trống rồi đến ô có quân thì được ăn!",
      "Khi thực hiện nước ăn lớn hoặc ăn Quan, trả lời đúng câu hỏi Địa lí 10 sẽ được cộng thưởng điểm học thuật.",
      "Có thể dùng nút 'Cố vấn Địa lí' (trả lời 1 câu hỏi) để xem chỉ dẫn nước đi tối ưu nhất.",
    ],
    accentColor: "#f97316",
    accentBg: "#fff7ed",
    buttonBg: "bg-[#f97316] hover:bg-[#ea580c]",
    questionCountLabel: "Đấu trí với Máy",
  },
];

export const GEO10_BASE_QUESTIONS: GameQuizQuestion[] = [
  // ================= RECOGNITION (NHẬN BIẾT) =================
  {
    id: "gq-rec-01",
    type: "single_choice",
    chapterId: "geo10-kn-c01",
    lessonId: "geo10-kn-b02",
    difficulty: "recognition",
    content:
      "Phương pháp nào thường dùng để biểu hiện các đối tượng địa lí phân bố theo những điểm cụ thể như sân bay, cảng biển, nhà máy thủy điện?",
    options: [
      { id: "A", text: "Phương pháp kí hiệu" },
      { id: "B", text: "Phương pháp chấm điểm" },
      { id: "C", text: "Phương pháp khoanh vùng" },
      { id: "D", text: "Phương pháp bản đồ - biểu đồ" },
    ],
    correctOptionId: "A",
    explanation:
      "Phương pháp kí hiệu dùng các kí hiệu hình học, chữ hoặc tượng hình đặt chính xác vào vị trí phân bố của đối tượng theo điểm cụ thể (sân bay, cảng biển, mỏ khoáng sản).",
    expertHint: "Hãy nhớ các biểu tượng chiếc máy bay hay mỏ neo đặt ngay tại vị trí thành phố trên bản đồ.",
  },
  {
    id: "gq-rec-02",
    type: "single_choice",
    chapterId: "geo10-kn-c01",
    lessonId: "geo10-kn-b03",
    difficulty: "recognition",
    content: "Hệ thống định vị toàn cầu (GPS) xác định vị trí của một đối tượng trên mặt đất dựa vào tín hiệu từ đâu?",
    options: [
      { id: "A", text: "Các trạm thu phát sóng phát thanh FM" },
      { id: "B", text: "Hệ thống các vệ tinh nhân tạo bay quanh Trái Đất" },
      { id: "C", text: "La bàn từ trường đặt dưới lòng đất" },
      { id: "D", text: "Các khinh khí cầu khí tượng ở tầng đối lưu" },
    ],
    correctOptionId: "B",
    explanation:
      "GPS hoạt động nhờ mạng lưới các vệ tinh nhân tạo quay quanh Trái Đất truyền tín hiệu xuống thiết bị thu để tính toán tọa độ kinh độ, vĩ độ và độ cao.",
    expertHint: "Thiết bị dẫn đường trên ô tô và điện thoại nhận tín hiệu từ không gian vũ trụ.",
  },
  {
    id: "gq-rec-03",
    type: "single_choice",
    chapterId: "geo10-kn-c02",
    lessonId: "geo10-kn-b04",
    difficulty: "recognition",
    content: "Theo thứ tự từ ngoài vào trong, cấu tạo của Trái Đất gồm 3 lớp chính nào sau đây?",
    options: [
      { id: "A", text: "Vỏ Trái Đất, lớp Manti, Nhân Trái Đất" },
      { id: "B", text: "Thạch quyển, Thủy quyển, Khí quyển" },
      { id: "C", text: "Lớp Manti, Vỏ Trái Đất, Nhân Trái Đất" },
      { id: "D", text: "Vỏ đại dương, Vỏ lục địa, Tầng đá trầm tích" },
    ],
    correctOptionId: "A",
    explanation:
      "Cấu tạo bên trong của Trái Đất gồm 3 lớp đồng tâm từ ngoài vào tâm: Vỏ Trái Đất (mỏng nhất), lớp Manti (chiếm phần lớn thể tích) và Nhân Trái Đất (trong cùng).",
    expertHint: "Lớp ngoài cùng rất mỏng là Vỏ, ở giữa là Manti và trong tâm là Nhân.",
  },
  {
    id: "gq-rec-04",
    type: "single_choice",
    chapterId: "geo10-kn-c02",
    lessonId: "geo10-kn-b05",
    difficulty: "recognition",
    content: "Trái Đất tự quay quanh trục theo hướng nào?",
    options: [
      { id: "A", text: "Từ Đông sang Tây" },
      { id: "B", text: "Từ Tây sang Đông" },
      { id: "C", text: "Từ Bắc xuống Nam" },
      { id: "D", text: "Từ Nam lên Bắc" },
    ],
    correctOptionId: "B",
    explanation:
      "Trái Đất tự quay quanh một trục tưởng tượng theo hướng từ Tây sang Đông, vì vậy ở mặt đất ta thấy Mặt Trời mọc ở đằng Đông và lặn ở đằng Tây.",
    expertHint: "Vì sao các nước phía Đông lại đón bình minh sớm hơn các nước phía Tây?",
  },
  {
    id: "gq-rec-05",
    type: "single_choice",
    chapterId: "geo10-kn-c03",
    lessonId: "geo10-kn-b06",
    difficulty: "recognition",
    content: "Thạch quyển của Trái Đất bao gồm những bộ phận nào?",
    options: [
      { id: "A", text: "Toàn bộ vỏ Trái Đất và phần trên cùng của lớp Manti" },
      { id: "B", text: "Chỉ riêng tầng đá granit và đá trầm tích" },
      { id: "C", text: "Toàn bộ lớp Manti và nhân ngoài của Trái Đất" },
      { id: "D", text: "Vỏ đại dương và toàn bộ thủy quyển" },
    ],
    correctOptionId: "A",
    explanation:
      "Thạch quyển gồm toàn bộ vỏ Trái Đất và phần cứng mỏng phía trên cùng của lớp Manti (tới độ sâu khoảng 100 km), nằm phía trên quyển mềm.",
    expertHint: "Thạch quyển dày hơn vỏ Trái Đất vì bao gồm cả phần cứng trên cùng của Manti.",
  },
  {
    id: "gq-rec-06",
    type: "single_choice",
    chapterId: "geo10-kn-c04",
    lessonId: "geo10-kn-b09",
    difficulty: "recognition",
    content: "Tầng khí quyển nào nằm sát mặt đất nhất và là nơi diễn ra hầu hết các hiện tượng mây, mưa, sấm, chớp?",
    options: [
      { id: "A", text: "Tầng bình lưu" },
      { id: "B", text: "Tầng đối lưu" },
      { id: "C", text: "Tầng giữa" },
      { id: "D", text: "Tầng nhiệt" },
    ],
    correctOptionId: "B",
    explanation:
      "Tầng đối lưu nằm sát mặt đất (độ cao trung bình 0–16 km ở Xích đạo), tập trung khoảng 80% khối lượng không khí và hầu hết hơi nước nên sinh ra mây, mưa, bão.",
    expertHint: "Đây là tầng có không khí chuyển động theo chiều thẳng đứng sát mặt đất.",
  },
  {
    id: "gq-rec-07",
    type: "single_choice",
    chapterId: "geo10-kn-c04",
    lessonId: "geo10-kn-b09",
    difficulty: "recognition",
    content: "Lớp Ôdôn (Ozone) có tác dụng ngăn cản tia tử ngoại bảo vệ sự sống trên Trái Đất nằm ở tầng nào của khí quyển?",
    options: [
      { id: "A", text: "Tầng đối lưu" },
      { id: "B", text: "Tầng bình lưu" },
      { id: "C", text: "Tầng giữa" },
      { id: "D", text: "Tầng ngoài" },
    ],
    correctOptionId: "B",
    explanation:
      "Lớp Ôdôn tập trung ở độ cao khoảng 22–25 km thuộc tầng bình lưu, đóng vai trò như tấm lá chắn hấp thụ tia bức xạ tử ngoại có hại từ Mặt Trời.",
    expertHint: "Tầng này nằm ngay phía trên tầng đối lưu, ở độ cao khoảng 16 đến 50 km.",
  },
  {
    id: "gq-rec-08",
    type: "single_choice",
    chapterId: "geo10-kn-c05",
    lessonId: "geo10-kn-b12",
    difficulty: "recognition",
    content: "Hiện tượng nước biển dâng cao và hạ thấp theo quy luật hàng ngày dưới sức hút của Mặt Trăng và Mặt Trời gọi là gì?",
    options: [
      { id: "A", text: "Sóng thần" },
      { id: "B", text: "Dòng biển nóng" },
      { id: "C", text: "Thủy triều" },
      { id: "D", text: "Băng tan" },
    ],
    correctOptionId: "C",
    explanation:
      "Thủy triều là hiện tượng nước biển dao động lên xuống theo chu kì dưới tác động của lực hấp dẫn từ Mặt Trăng, Mặt Trời và lực li tâm khi Trái Đất tự quay.",
    expertHint: "Hiện tượng có triều cường và triều kém gắn liền với tuần trăng.",
  },
  {
    id: "gq-rec-09",
    type: "single_choice",
    chapterId: "geo10-kn-c06",
    lessonId: "geo10-kn-b14",
    difficulty: "recognition",
    content: "Đặc trưng quan trọng nhất của đất (thổ nhưỡng) giúp phân biệt đất với đá mẹ là gì?",
    options: [
      { id: "A", text: "Độ cứng cơ học" },
      { id: "B", text: "Độ phì (khả năng cung cấp nước, nhiệt, khí và dinh dưỡng cho thực vật)" },
      { id: "C", text: "Tỉ trọng kim loại nặng" },
      { id: "D", text: "Nhiệt độ nóng chảy" },
    ],
    correctOptionId: "B",
    explanation:
      "Độ phì là thuộc tính cơ bản nhất của đất, thể hiện khả năng cung cấp nước, chất dinh dưỡng, không khí và nhiệt cho cây trồng sinh trưởng.",
    expertHint: "Nhờ đặc tính này mà thực vật có thể bám rễ và phát triển xanh tốt.",
  },
  {
    id: "gq-rec-10",
    type: "single_choice",
    chapterId: "geo10-kn-c08",
    lessonId: "geo10-kn-b19",
    difficulty: "recognition",
    content: "Hiệu số giữa tỉ suất sinh thô và tỉ suất tử thô của dân số (tính bằng phần trăm) được gọi là gì?",
    options: [
      { id: "A", text: "Gia tăng dân số cơ học" },
      { id: "B", text: "Tỉ suất gia tăng dân số tự nhiên" },
      { id: "C", text: "Mật độ dân số" },
      { id: "D", text: "Tỉ số giới tính" },
    ],
    correctOptionId: "B",
    explanation:
      "Tỉ suất gia tăng dân số tự nhiên là hiệu số giữa tỉ suất sinh thô và tỉ suất tử thô, được coi là động lực phát triển dân số toàn cầu.",
    expertHint: "Chỉ tiêu này phản ánh mức chênh lệch giữa số trẻ sinh ra và số người mất đi.",
  },
  {
    id: "gq-rec-11",
    type: "single_choice",
    chapterId: "geo10-kn-c09",
    lessonId: "geo10-kn-b22",
    difficulty: "recognition",
    content: "Chỉ tiêu kinh tế viết tắt là GDP dùng để chỉ khái niệm nào sau đây?",
    options: [
      { id: "A", text: "Tổng thu nhập quốc gia" },
      { id: "B", text: "Tổng sản phẩm trong nước" },
      { id: "C", text: "Chỉ số phát triển con người" },
      { id: "D", text: "Năng suất lao động xã hội" },
    ],
    correctOptionId: "B",
    explanation:
      "GDP (Gross Domestic Product) là Tổng sản phẩm trong nước — tổng giá trị sản phẩm vật chất và dịch vụ cuối cùng được tạo ra trong phạm vi lãnh thổ một quốc gia trong một thời kì nhất định.",
    expertHint: "Tính toàn bộ giá trị sản xuất bên trong lãnh thổ một nước, không phân biệt trong hay ngoài nước.",
  },
  {
    id: "gq-rec-12",
    type: "single_choice",
    chapterId: "geo10-kn-c13",
    lessonId: "geo10-kn-b40",
    difficulty: "recognition",
    content: "Sự phát triển đáp ứng nhu cầu của thế hệ hiện tại mà không làm tổn hại đến khả năng đáp ứng nhu cầu của thế hệ tương lai gọi là gì?",
    options: [
      { id: "A", text: "Công nghiệp hóa truyền thống" },
      { id: "B", text: "Phát triển bền vững" },
      { id: "C", text: "Đô thị hóa tự phát" },
      { id: "D", text: "Khai thác tận thu tài nguyên" },
    ],
    correctOptionId: "B",
    explanation:
      "Phát triển bền vững kết hợp chặt chẽ, hài hòa giữa 3 trụ cột: Tăng trưởng kinh tế, Công bằng xã hội và Bảo vệ môi trường tài nguyên cho thế hệ mai sau.",
    expertHint: "Khái niệm gắn với 17 mục tiêu toàn cầu của Liên Hợp Quốc.",
  },

  // ================= COMPREHENSION (THÔNG HIỂU) =================
  {
    id: "gq-comp-01",
    type: "single_choice",
    chapterId: "geo10-kn-c01",
    lessonId: "geo10-kn-b02",
    difficulty: "comprehension",
    content: "Để biểu hiện hướng gió bão và các dòng biển nóng, lạnh trên bản đồ thế giới, người ta sử dụng phương pháp nào?",
    options: [
      { id: "A", text: "Phương pháp kí hiệu đường chuyển động" },
      { id: "B", text: "Phương pháp chấm điểm" },
      { id: "C", text: "Phương pháp bản đồ - biểu đồ" },
      { id: "D", text: "Phương pháp nền chất lượng" },
    ],
    correctOptionId: "A",
    explanation:
      "Phương pháp kí hiệu đường chuyển động dùng các mũi tên có màu sắc, độ dày khác nhau để thể hiện hướng, tốc độ và khối lượng di chuyển của gió, dòng biển, luồng di dân hay giao thông.",
    expertHint: "Các mũi tên xanh và đỏ trên bản đồ khí hậu chính là phương pháp này.",
  },
  {
    id: "gq-comp-02",
    type: "single_choice",
    chapterId: "geo10-kn-c02",
    lessonId: "geo10-kn-b04",
    difficulty: "comprehension",
    content: "Điểm khác biệt cơ bản về cấu tạo giữa vỏ lục địa và vỏ đại dương của Trái Đất là gì?",
    options: [
      { id: "A", text: "Vỏ đại dương dày hơn vỏ lục địa gấp 5 lần" },
      { id: "B", text: "Vỏ đại dương không có tầng đá granit và mỏng hơn vỏ lục địa" },
      { id: "C", text: "Vỏ lục địa chỉ gồm đá bazan, không có đá trầm tích" },
      { id: "D", text: "Vỏ đại dương nằm ở trạng thái lỏng nóng chảy hoàn toàn" },
    ],
    correctOptionId: "B",
    explanation:
      "Vỏ lục địa dày trung bình 35–40 km (vùng núi cao tới 70 km) có đủ 3 tầng: trầm tích, granit và bazan. Vỏ đại dương mỏng (5–10 km) chỉ có tầng trầm tích và bazan, không có tầng đá granit.",
    expertHint: "Đáy đại dương rất mỏng và thiếu đi tầng đá nhẹ thường cấu tạo nên các lục địa.",
  },
  {
    id: "gq-comp-03",
    type: "single_choice",
    chapterId: "geo10-kn-c02",
    lessonId: "geo10-kn-b05",
    difficulty: "comprehension",
    content: "Theo tác động của lực Coriolis, các vật chuyển động theo phương kinh tuyến ở bán cầu Bắc sẽ bị lệch về phía nào so với hướng ban đầu?",
    options: [
      { id: "A", text: "Lệch về bên phải theo hướng chuyển động" },
      { id: "B", text: "Lệch về bên trái theo hướng chuyển động" },
      { id: "C", text: "Không bị lệch hướng ở bất kỳ vĩ độ nào" },
      { id: "D", text: "Luôn quay ngược lại 180 độ" },
    ],
    correctOptionId: "A",
    explanation:
      "Do Trái Đất tự quay từ Tây sang Đông, lực Coriolis làm mọi vật chuyển động trên bề mặt Trái Đất bị lệch về bên phải ở bán cầu Bắc và lệch về bên trái ở bán cầu Nam.",
    expertHint: "Quy tắc nhớ nhanh: Bắc - Phải, Nam - Trái.",
  },
  {
    id: "gq-comp-04",
    type: "single_choice",
    chapterId: "geo10-kn-c03",
    lessonId: "geo10-kn-b06",
    difficulty: "comprehension",
    content: "Nguyên nhân chủ yếu làm cho các mảng kiến tạo của thạch quyển có thể dịch chuyển trên bề mặt Trái Đất là gì?",
    options: [
      { id: "A", text: "Sức thổi của các loại gió thường xuyên trên Trái Đất" },
      { id: "B", text: "Hoạt động của các dòng đối lưu vật chất quánh dẻo có nhiệt độ cao trong tầng Manti trên" },
      { id: "C", text: "Dòng chảy của các dòng biển nóng và lạnh trong đại dương" },
      { id: "D", text: "Sự thay đổi lượng mưa theo mùa giữa các lục địa" },
    ],
    correctOptionId: "B",
    explanation:
      "Các mảng kiến tạo nổi trên lớp vật chất quánh dẻo (quyển mềm) của Manti trên. Các dòng đối lưu nhiệt trong Manti chính là động lực kéo các mảng kiến tạo tách xa hoặc xô vào nhau.",
    expertHint: "Hãy nghĩ tới lớp vật chất nóng chảy quánh dẻo ngay bên dưới thạch quyển.",
  },
  {
    id: "gq-comp-05",
    type: "single_choice",
    chapterId: "geo10-kn-c03",
    lessonId: "geo10-kn-b07",
    difficulty: "comprehension",
    content: "Xu hướng tác động đối lập nhau giữa nội lực và ngoại lực lên địa hình bề mặt Trái Đất thể hiện như thế nào?",
    options: [
      { id: "A", text: "Nội lực làm địa hình gồ ghề, cao thấp; ngoại lực có xu hướng san bằng, làm phẳng địa hình" },
      { id: "B", text: "Nội lực chỉ tạo ra đồng bằng; ngoại lực chỉ tạo ra núi cao" },
      { id: "C", text: "Nội lực xảy ra vào mùa đông; ngoại lực chỉ xảy ra vào mùa hạ" },
      { id: "D", text: "Nội lực lấy năng lượng từ Mặt Trời; ngoại lực lấy năng lượng từ lòng đất" },
    ],
    correctOptionId: "A",
    explanation:
      "Nội lực sinh ra từ trong lòng Trái Đất làm nâng cao, hạ thấp, uốn nếp tạo sự gồ ghề; còn ngoại lực (phong hóa, bóc mòn, bồi tụ) có xu hướng phá hủy chỗ cao, bồi lấp chỗ trũng để san bằng địa hình.",
    expertHint: "Một lực nâng núi lên cao, một lực bào mòn núi lấp vào thung lũng.",
  },
  {
    id: "gq-comp-06",
    type: "single_choice",
    chapterId: "geo10-kn-c04",
    lessonId: "geo10-kn-b09",
    difficulty: "comprehension",
    content: "Gió Mậu dịch (Tín phong) là loại gió thổi thường xuyên quanh năm từ khu vực khí áp nào về khu vực khí áp nào?",
    options: [
      { id: "A", text: "Từ áp cao cực về áp thấp ôn đới" },
      { id: "B", text: "Từ áp cao cận chí tuyến về áp thấp xích đạo" },
      { id: "C", text: "Từ áp thấp xích đạo lên áp cao cận chí tuyến" },
      { id: "D", text: "Từ áp cao cận chí tuyến về áp thấp ôn đới" },
    ],
    correctOptionId: "B",
    explanation:
      "Gió Mậu dịch thổi từ hai đai áp cao cận chí tuyến (khoảng vĩ độ 30°) về đai áp thấp Xích đạo, có hướng Đông Bắc ở bán cầu Bắc và Đông Nam ở bán cầu Nam, tính chất nhìn chung khô và ít mưa.",
    expertHint: "Gió thổi từ đai áp cao ở vĩ độ 30° hội tụ về vùng Xích đạo.",
  },
  {
    id: "gq-comp-07",
    type: "single_choice",
    chapterId: "geo10-kn-c05",
    lessonId: "geo10-kn-b11",
    difficulty: "comprehension",
    content: "Ở vùng khí hậu nhiệt đới ẩm gió mùa như Việt Nam, nguồn cung cấp nước chủ yếu cho sông ngòi là gì?",
    options: [
      { id: "A", text: "Băng tuyết vĩnh cửu trên núi cao tan chảy" },
      { id: "B", text: "Nước mưa và nước ngầm" },
      { id: "C", text: "Tuyết tan vào mùa xuân" },
      { id: "D", text: "Nước biển tràn sâu vào thượng nguồn" },
    ],
    correctOptionId: "B",
    explanation:
      "Ở miền nhiệt đới ẩm gió mùa, sông ngòi có nguồn tiếp nước chủ yếu từ nước mưa và nước ngầm, nên chế độ dòng chảy của sông phụ thuộc chặt chẽ vào chế độ mưa theo mùa.",
    expertHint: "Mùa lũ của sông ngòi nước ta trùng với mùa nào trong năm?",
  },
  {
    id: "gq-comp-08",
    type: "single_choice",
    chapterId: "geo10-kn-c06",
    lessonId: "geo10-kn-b15",
    difficulty: "comprehension",
    content: "Nhân tố nào quyết định nguồn thức ăn dồi dào làm cho giới động vật ở vùng rừng mưa nhiệt đới vô cùng phong phú?",
    options: [
      { id: "A", text: "Địa hình dốc đứng" },
      { id: "B", text: "Sự phong phú và xanh tốt quanh năm của thảm thực vật" },
      { id: "C", text: "Áp suất khí quyển biến động mạnh" },
      { id: "D", text: "Độ mặn của nước ngầm" },
    ],
    correctOptionId: "B",
    explanation:
      "Thực vật là mắt xích mở đầu chuỗi thức ăn và cung cấp nơi cư trú cho động vật. Nơi có thảm thực vật phong phú như rừng mưa nhiệt đới sẽ có giới động vật đa dạng bậc nhất.",
    expertHint: "Trong chuỗi thức ăn tự nhiên, động vật phụ thuộc trực tiếp vào sinh vật sản xuất nào?",
  },
  {
    id: "gq-comp-09",
    type: "single_choice",
    chapterId: "geo10-kn-c07",
    lessonId: "geo10-kn-b18",
    difficulty: "comprehension",
    content: "Nguyên nhân cơ bản tạo nên quy luật địa đới (sự thay đổi có quy luật của các thành phần tự nhiên từ Xích đạo về hai cực) là gì?",
    options: [
      { id: "A", text: "Độ cao của các dãy núi lục địa" },
      { id: "B", text: "Dạng hình cầu của Trái Đất làm góc nhập xạ (góc chiếu của tia sáng Mặt Trời) giảm dần từ Xích đạo về hai cực" },
      { id: "C", text: "Sự phân bố xen kẽ giữa lục địa và đại dương" },
      { id: "D", text: "Hoạt động phun trào của núi lửa ngầm" },
    ],
    correctOptionId: "B",
    explanation:
      "Do Trái Đất hình cầu, góc chiếu của tia sáng Mặt Trời tới mặt đất giảm dần từ Xích đạo về hai cực, kéo theo lượng bức xạ Mặt Trời giảm dần và tạo nên các đới tự nhiên theo vĩ độ.",
    expertHint: "Góc chiếu sáng của Mặt Trời phụ thuộc vào hình dạng khối cầu của hành tinh chúng ta.",
  },
  {
    id: "gq-comp-10",
    type: "single_choice",
    chapterId: "geo10-kn-c08",
    lessonId: "geo10-kn-b20",
    difficulty: "comprehension",
    content: "Biểu hiện nào sau đây phản ánh đúng bản chất của quá trình đô thị hóa hiện đại?",
    options: [
      { id: "A", text: "Chỉ tăng diện tích đất nông nghiệp ở ngoại thành" },
      { id: "B", text: "Tỉ lệ dân thành thị tăng lên, không gian đô thị mở rộng và lối sống thành thị lan tỏa về nông thôn" },
      { id: "C", text: "Toàn bộ dân cư thành thị di cư ngược về vùng núi cao" },
      { id: "D", text: "Tỉ trọng ngành nông - lâm - ngư nghiệp chiếm 100% GDP" },
    ],
    correctOptionId: "B",
    explanation:
      "Đô thị hóa không chỉ là sự gia tăng quy mô và tỉ lệ dân thành thị mà còn là sự mở rộng không gian đô thị và phổ biến lối sống văn minh đô thị vào các vùng nông thôn.",
    expertHint: "Bao gồm cả quy mô dân số thành thị, không gian đô thị và lối sống đô thị.",
  },
  {
    id: "gq-comp-11",
    type: "single_choice",
    chapterId: "geo10-kn-c10",
    lessonId: "geo10-kn-b23",
    difficulty: "comprehension",
    content: "Vì sao sản xuất nông nghiệp luôn mang tính mùa vụ rõ rệt?",
    options: [
      { id: "A", text: "Vì đối tượng sản xuất là cây trồng, vật nuôi có quy luật sinh trưởng phụ thuộc vào điều kiện tự nhiên và khí hậu" },
      { id: "B", text: "Vì máy móc nông nghiệp chỉ hoạt động được 3 tháng mỗi năm" },
      { id: "C", text: "Vì nhu cầu lương thực của con người chỉ phát sinh vào mùa đông" },
      { id: "D", text: "Vì diện tích đất đai thay đổi theo chu kì thủy triều" },
    ],
    correctOptionId: "A",
    explanation:
      "Đối tượng của nông nghiệp là cơ thể sống (cây trồng, vật nuôi), thời gian sinh trưởng và phát triển gắn chặt với nhịp điệu mùa khí hậu (nhiệt, ẩm, ánh sáng).",
    expertHint: "Cây trồng và vật nuôi là các cơ thể sống chịu chi phối bởi thời tiết, khí hậu.",
  },

  // ================= APPLICATION (VẬN DỤNG) =================
  {
    id: "gq-app-01",
    type: "single_choice",
    chapterId: "geo10-kn-c02",
    lessonId: "geo10-kn-b05",
    difficulty: "application",
    content:
      "Khi ở khu vực giờ gốc (GMT+0, Luân Đôn) đang là 7 giờ sáng ngày 15/11 thì cùng lúc đó tại Hà Nội (múi giờ GMT+7) là mấy giờ?",
    options: [
      { id: "A", text: "0 giờ sáng ngày 15/11" },
      { id: "B", text: "14 giờ chiều ngày 15/11" },
      { id: "C", text: "19 giờ tối ngày 15/11" },
      { id: "D", text: "14 giờ chiều ngày 14/11" },
    ],
    correctOptionId: "B",
    explanation:
      "Hà Nội nằm ở múi giờ số 7 (phía Đông kinh tuyến gốc) nên có giờ sớm hơn giờ GMT là 7 tiếng: 7 + 7 = 14 giờ chiều cùng ngày 15/11.",
    expertHint: "Ở phía Đông kinh tuyến gốc thì cộng thêm số múi giờ chênh lệch.",
  },
  {
    id: "gq-app-02",
    type: "single_choice",
    chapterId: "geo10-kn-c02",
    lessonId: "geo10-kn-b05",
    difficulty: "application",
    content: "Vào ngày Hạ chí (22/6), hiện tượng ngày và đêm ở vòng cực Bắc (vĩ độ 66°33'B) diễn ra như thế nào?",
    options: [
      { id: "A", text: "Ngày dài bằng đêm (12 giờ ngày, 12 giờ đêm)" },
      { id: "B", text: "Có ngày dài suốt 24 giờ (hiện tượng đêm trắng / Mặt Trời không lặn)" },
      { id: "C", text: "Có đêm dài suốt 24 giờ (Mặt Trời không mọc)" },
      { id: "D", text: "Mặt Trời lên thiên đỉnh lúc 12 giờ trưa" },
    ],
    correctOptionId: "B",
    explanation:
      "Vào ngày 22/6, nửa cầu Bắc ngả về phía Mặt Trời nhiều nhất (tia sáng Mặt Trời vuông góc tại chí tuyến Bắc 23°27'B), toàn bộ khu vực từ vòng cực Bắc (66°33'B) đến cực Bắc được chiếu sáng suốt 24 giờ.",
    expertHint: "Ngày 22/6 là giữa mùa hạ của bán cầu Bắc, vùng cực Bắc ngả hẳn về phía Mặt Trời.",
  },
  {
    id: "gq-app-03",
    type: "single_choice",
    chapterId: "geo10-kn-c03",
    lessonId: "geo10-kn-b08",
    difficulty: "application",
    content: "Vì sao quần đảo Nhật Bản và Philippines thường xuyên xảy ra động đất và núi lửa hoạt động mạnh?",
    options: [
      { id: "A", text: "Do nằm ở trung tâm mảng lục địa Á - Âu ổn định" },
      { id: "B", text: "Do nằm trên vành đai lửa Thái Bình Dương, nơi tiếp xúc và hút chìm giữa các mảng kiến tạo" },
      { id: "C", text: "Do chịu ảnh hưởng của các dòng biển lạnh chảy ven bờ" },
      { id: "D", text: "Do quá trình phong hóa hóa học của đá vôi diễn ra mạnh" },
    ],
    correctOptionId: "B",
    explanation:
      "Nhật Bản và Philippines nằm dọc ranh giới tiếp xúc hội tụ (hút chìm) giữa mảng Thái Bình Dương, mảng Philippines và mảng Á - Âu thuộc Vành đai lửa Thái Bình Dương.",
    expertHint: "Hãy liên hệ với vị trí của Vành đai lửa Thái Bình Dương và ranh giới các mảng kiến tạo.",
  },
  {
    id: "gq-app-04",
    type: "single_choice",
    chapterId: "geo10-kn-c04",
    lessonId: "geo10-kn-b09",
    difficulty: "application",
    content:
      "Ở tầng đối lưu, trung bình cứ lên cao 100 m thì nhiệt độ không khí giảm 0,6°C. Nếu ở chân núi (độ cao 0 m) nhiệt độ là 28°C thì ở đỉnh núi cao 3.000 m nhiệt độ khoảng bao nhiêu?",
    options: [
      { id: "A", text: "10°C" },
      { id: "B", text: "18°C" },
      { id: "C", text: "22°C" },
      { id: "D", text: "4°C" },
    ],
    correctOptionId: "A",
    explanation:
      "Lên cao 3.000 m (tức 30 lần 100 m), nhiệt độ giảm: 30 × 0,6°C = 18°C. Vậy nhiệt độ tại đỉnh núi là: 28°C - 18°C = 10°C.",
    expertHint: "Tính mức giảm nhiệt độ cho 3.000 m (30 × 0,6°C) rồi lấy 28°C trừ đi.",
  },
  {
    id: "gq-app-05",
    type: "single_choice",
    chapterId: "geo10-kn-c04",
    lessonId: "geo10-kn-b09",
    difficulty: "application",
    content: "Vì sao sườn núi đón gió ẩm từ biển thổi vào thường có mưa rất nhiều, trong khi sườn khuất gió lại khô và nóng (hiệu ứng phơn)?",
    options: [
      { id: "A", text: "Do không khí ẩm bị đẩy lên cao theo sườn đón gió bị lạnh đi, ngưng tụ gây mưa; khi vượt đỉnh tràn xuống sườn khuất gió thì khô và nóng lên" },
      { id: "B", text: "Do sườn đón gió nhận được bức xạ Mặt Trời nhiều gấp đôi sườn khuất gió" },
      { id: "C", text: "Do lực Coriolis chỉ tác động ở sườn đón gió" },
      { id: "D", text: "Do sườn khuất gió luôn có băng tuyết bao phủ quanh năm" },
    ],
    correctOptionId: "A",
    explanation:
      "Khi gió ẩm gặp núi chắn, không khí bốc lên cao lạnh dần (0,6°C/100m) khiến hơi nước ngưng tụ tạo mưa địa hình ở sườn đón gió. Sang sườn bên kia, khối khí đã mất ẩm nên nén đoạn nhiệt làm nhiệt độ tăng khoảng 1°C/100m, gây gió khô nóng.",
    expertHint: "Liên hệ hiện tượng gió Tây khô nóng ở miền Trung khi vượt dãy Trường Sơn.",
  },
  {
    id: "gq-app-06",
    type: "single_choice",
    chapterId: "geo10-kn-c05",
    lessonId: "geo10-kn-b12",
    difficulty: "application",
    content: "Các vùng biển ven bờ nơi có dòng biển lạnh chảy qua (như ven bờ Tây Nam Mỹ, Tây Nam Phi) thường có đặc điểm khí hậu và sinh vật như thế nào?",
    options: [
      { id: "A", text: "Mưa rất lớn quanh năm và rừng rậm nhiệt đới phát triển" },
      { id: "B", text: "Khí hậu ven bờ khô hạn dễ hình thành hoang mạc, nhưng vùng biển lại giàu nguồn lợi cá do nước trồi" },
      { id: "C", text: "Nước biển đóng băng quanh năm từ Xích đạo đến chí tuyến" },
      { id: "D", text: "Không có sinh vật phù du sinh sống" },
    ],
    correctOptionId: "B",
    explanation:
      "Dòng biển lạnh làm nhiệt độ lớp không khí bên trên giảm, hơi nước khó bốc hơi gây khô hạn (như hoang mạc Atacama, Namib), nhưng dòng nước lạnh trồi từ đáy lên lại mang nhiều muối khoáng nuôi sinh vật phù du nên ngư trường rất giàu cá.",
    expertHint: "Nước lạnh khó bốc hơi tạo mưa trên bờ, nhưng lại giàu dinh dưỡng cho cá biển.",
  },
  {
    id: "gq-app-07",
    type: "single_choice",
    chapterId: "geo10-kn-c07",
    lessonId: "geo10-kn-b17",
    difficulty: "application",
    content:
      "Việc chặt phá rừng đầu nguồn ở vùng đồi núi dẫn đến xói mòn đất, lũ quét ở miền núi và ngập lụt ở đồng bằng hạ lưu là biểu hiện trực tiếp của quy luật nào?",
    options: [
      { id: "A", text: "Quy luật thống nhất và hoàn chỉnh của vỏ địa lí" },
      { id: "B", text: "Quy luật thủy triều bán nhật triều" },
      { id: "C", text: "Quy luật dịch chuyển các mảng kiến tạo" },
      { id: "D", text: "Quy luật phân bố các vành đai động đất" },
    ],
    correctOptionId: "A",
    explanation:
      "Theo quy luật thống nhất và hoàn chỉnh của vỏ địa lí, các thành phần tự nhiên (sinh vật, đất, nước, địa hình) luôn tác động qua lại mật thiết; chỉ cần một thành phần (thảm thực vật rừng) biến đổi sẽ kéo theo sự biến đổi của toàn bộ các thành phần khác.",
    expertHint: "Khi một thành phần tự nhiên thay đổi, các thành phần khác cũng thay đổi theo.",
  },
  {
    id: "gq-app-08",
    type: "single_choice",
    chapterId: "geo10-kn-c08",
    lessonId: "geo10-kn-b19",
    difficulty: "application",
    content: "Một quốc gia có tháp dân số với phần đáy thu hẹp rõ rệt và phần đỉnh phình to đang đối mặt với thách thức dân số nào?",
    options: [
      { id: "A", text: "Bùng nổ dân số trẻ và thừa lao động trầm trọng" },
      { id: "B", text: "Già hóa dân số, thiếu hụt lao động tương lai và chi phí phúc lợi người cao tuổi tăng cao" },
      { id: "C", text: "Tỉ suất sinh thô tăng vượt mức 40‰" },
      { id: "D", text: "Tuổi thọ trung bình giảm mạnh" },
    ],
    correctOptionId: "B",
    explanation:
      "Đáy tháp hẹp thể hiện tỉ lệ sinh thấp (nhóm 0–14 tuổi ít), đỉnh tháp mở rộng thể hiện tỉ lệ người từ 65 tuổi trở lên cao — đây là kiểu tháp dân số già, dẫn tới thiếu hụt nguồn lao động bổ sung và áp lực an sinh xã hội.",
    expertHint: "Đáy tháp biểu thị trẻ em mới sinh, đỉnh tháp biểu thị người cao tuổi.",
  },
  {
    id: "gq-app-09",
    type: "single_choice",
    chapterId: "geo10-kn-c11",
    lessonId: "geo10-kn-b31",
    difficulty: "application",
    content: "Việc chuyển dịch cơ cấu ngành năng lượng từ nhiệt điện than sang điện gió, điện mặt trời mang lại ý nghĩa lớn nhất nào đối với môi trường?",
    options: [
      { id: "A", text: "Giảm phát thải khí nhà kính (CO₂) và hạn chế biến đổi khí hậu toàn cầu" },
      { id: "B", text: "Tăng lượng bụi mịn trong tầng đối lưu" },
      { id: "C", text: "Làm tăng nhu cầu khai thác nhiên liệu hóa thạch" },
      { id: "D", text: "Loại bỏ hoàn toàn sự phụ thuộc vào điều kiện thời tiết" },
    ],
    correctOptionId: "A",
    explanation:
      "Năng lượng tái tạo (gió, mặt trời) không đốt nhiên liệu hóa thạch nên giảm mạnh lượng khí thải CO₂ và các chất gây ô nhiễm không khí, góp phần chống biến đổi khí hậu và hướng tới tăng trưởng xanh.",
    expertHint: "Liên hệ giữa đốt than đá với hiệu ứng nhà kính và biến đổi khí hậu.",
  },

  // ================= ADVANCED APPLICATION (VẬN DỤNG CAO) =================
  {
    id: "gq-adv-01",
    type: "single_choice",
    chapterId: "geo10-kn-c02",
    lessonId: "geo10-kn-b05",
    difficulty: "advanced_application",
    content:
      "Một máy bay cất cánh từ TP. Hồ Chí Minh (GMT+7) lúc 6 giờ sáng ngày 1/12 và bay mất 14 giờ để tới Los Angeles (Mỹ, múi giờ GMT-8). Hỏi khi máy bay hạ cánh tại Los Angeles thì đồng hồ địa phương ở đó chỉ mấy giờ, ngày nào?",
    options: [
      { id: "A", text: "5 giờ sáng ngày 1/12" },
      { id: "B", text: "20 giờ tối ngày 1/12" },
      { id: "C", text: "5 giờ sáng ngày 2/12" },
      { id: "D", text: "12 giờ trưa ngày 30/11" },
    ],
    correctOptionId: "A",
    explanation:
      "Lúc máy bay cất cánh (6h ngày 1/12 tại GMT+7), giờ tại Los Angeles (GMT-8, chênh lệch 15 múi giờ về phía Tây) là: 6 - 15 = -9h, tức 15 giờ chiều ngày 30/11. Cộng thêm 14 giờ bay: 15h ngày 30/11 + 14 tiếng = 5 giờ sáng ngày 1/12!",
    expertHint: "Đổi giờ khởi hành sang giờ Los Angeles (lùi 15 tiếng) rồi cộng thêm 14 tiếng bay.",
  },
  {
    id: "gq-adv-02",
    type: "single_choice",
    chapterId: "geo10-kn-c01",
    lessonId: "geo10-kn-b03",
    difficulty: "advanced_application",
    content:
      "Trên bản đồ có tỉ lệ 1 : 2.500.000, khoảng cách đo được giữa hai thành phố A và B là 6 cm. Khoảng cách thực tế theo đường chim bay giữa hai thành phố đó là bao nhiêu ki-lô-mét?",
    options: [
      { id: "A", text: "15 km" },
      { id: "B", text: "150 km" },
      { id: "C", text: "250 km" },
      { id: "D", text: "1.500 km" },
    ],
    correctOptionId: "B",
    explanation:
      "Tỉ lệ 1 : 2.500.000 nghĩa là 1 cm trên bản đồ ứng với 2.500.000 cm = 25 km ngoài thực địa. Vậy 6 cm trên bản đồ ứng với: 6 × 25 km = 150 km.",
    expertHint: "1 : 2.500.000 tương đương 1 cm bản đồ = 25 km thực tế.",
  },
  {
    id: "gq-adv-03",
    type: "single_choice",
    chapterId: "geo10-kn-c04",
    lessonId: "geo10-kn-b10",
    difficulty: "advanced_application",
    content:
      "Mặc dù cùng nằm gần vĩ tuyến chí tuyến Bắc như các hoang mạc ở Bắc Phi và Tây Nam Á, nhưng miền Bắc Việt Nam lại có khí hậu ẩm, mưa nhiều và hệ sinh thái rừng phong phú. Nguyên nhân chủ yếu là do đâu?",
    options: [
      { id: "A", text: "Do địa hình Việt Nam hoàn toàn là đồng bằng thấp" },
      { id: "B", text: "Do vị trí tiếp giáp Biển Đông rộng lớn kết hợp với hoạt động của hoàn lưu gió mùa châu Á mang lượng ẩm dồi dào" },
      { id: "C", text: "Do có dòng biển lạnh hoạt động quanh năm sát bờ biển" },
      { id: "D", text: "Do không chịu tác động của bức xạ Mặt Trời vùng nội chí tuyến" },
    ],
    correctOptionId: "B",
    explanation:
      "Các vùng chí tuyến lục địa thường khô hạn do thống trị bởi áp cao cận chí tuyến. Riêng Việt Nam nằm ở rìa Đông châu Á giáp Biển Đông, chịu chi phối mạnh của gió mùa thổi từ biển vào nên phá vỡ thế độc tôn của khối khí chí tuyến khô, mang lại lượng mưa lớn (1.500–2.000 mm/năm).",
    expertHint: "Hai nhân tố phá vỡ tính chất khô hạn chí tuyến ở nước ta là Biển Đông và hoàn lưu gió mùa.",
  },
  {
    id: "gq-adv-04",
    type: "single_choice",
    chapterId: "geo10-kn-c09",
    lessonId: "geo10-kn-b22",
    difficulty: "advanced_application",
    content:
      "Một quốc gia đang phát triển thu hút rất nhiều tập đoàn đa quốc gia nước ngoài đặt nhà máy sản xuất và xuất khẩu, nhưng người dân trong nước ít đầu tư ra nước ngoài. Khi đó mối quan hệ giữa GDP và GNI của quốc gia này thường như thế nào?",
    options: [
      { id: "A", text: "GDP lớn hơn GNI vì một phần lợi nhuận tạo ra trong nước được chuyển trả cho các nhà đầu tư nước ngoài" },
      { id: "B", text: "GNI lớn gấp đôi GDP" },
      { id: "C", text: "GDP luôn bằng 0" },
      { id: "D", text: "GDP và GNI hoàn toàn không liên quan đến đầu tư nước ngoài" },
    ],
    correctOptionId: "A",
    explanation:
      "GNI = GDP + (Thu nhập nhận được từ nước ngoài - Thu nhập chi trả cho nước ngoài). Khi vốn FDI lớn tạo ra sản lượng lớn trong lãnh thổ (tính vào GDP) nhưng phần lợi nhuận chuyển về nước chủ đầu tư lớn hơn thu nhập từ nước ngoài gửi về, thì GDP sẽ lớn hơn GNI.",
    expertHint: "Hãy xét phần lợi nhuận của doanh nghiệp FDI tạo ra trong lãnh thổ nhưng thuộc sở hữu nước ngoài.",
  },
  {
    id: "gq-adv-05",
    type: "single_choice",
    chapterId: "geo10-kn-c07",
    lessonId: "geo10-kn-b18",
    difficulty: "advanced_application",
    content:
      "Khi leo từ chân lên đỉnh một ngọn núi cao trên 4.500 m ở vùng nhiệt đới, người quan sát thấy các vành đai thực vật thay đổi tuần tự từ rừng nhiệt đới → rừng cận nhiệt → rừng ôn đới → đồng cỏ núi cao. Sự phân tầng này phản ánh quy luật nào?",
    options: [
      { id: "A", text: "Quy luật địa đới thuần túy theo vĩ độ" },
      { id: "B", text: "Quy luật đai cao (một biểu hiện của quy luật phi địa đới do sự giảm nhiệt độ và thay đổi độ ẩm theo độ cao địa hình)" },
      { id: "C", text: "Quy luật tuần hoàn của nước trong đại dương" },
      { id: "D", text: "Quy luật lệch hướng chuyển động Coriolis" },
    ],
    correctOptionId: "B",
    explanation:
      "Quy luật đai cao là sự thay đổi có quy luật của các thành phần tự nhiên và cảnh quan theo độ cao địa hình (nhiệt độ giảm 0,6°C/100m, áp suất và độ ẩm biến đổi), tạo nên các vành đai thực vật và đất tương tự như khi đi từ vùng vĩ độ thấp lên vĩ độ cao.",
    expertHint: "Sự thay đổi cảnh quan theo độ cao địa hình thuộc nhóm quy luật phi địa đới.",
  },
  {
    id: "gq-adv-06",
    type: "single_choice",
    chapterId: "geo10-kn-c12",
    lessonId: "geo10-kn-b34",
    difficulty: "advanced_application",
    content:
      "Một doanh nghiệp cần vận chuyển 50.000 tấn quặng sắt và than đá từ cảng biển châu Úc sang Nhật Bản với yêu cầu chi phí trên mỗi tấn-km thấp nhất và không đòi hỏi giao hàng gấp. Loại hình giao thông nào tối ưu nhất?",
    options: [
      { id: "A", text: "Đường hàng không" },
      { id: "B", text: "Đường biển" },
      { id: "C", text: "Đường ống" },
      { id: "D", text: "Đường ô tô" },
    ],
    correctOptionId: "B",
    explanation:
      "Giao thông đường biển có ưu thế vượt trội khi chuyên chở hàng hóa khối lượng cực lớn, cồng kềnh trên cự li xa xuyên đại dương giữa các quốc gia quần đảo/ven biển với giá thành vận tải thấp nhất.",
    expertHint: "Hàng nặng hàng chục nghìn tấn đi qua đại dương giữa Úc và Nhật Bản.",
  },
];

export const GEO10_GAME_QUESTIONS: GameQuizQuestion[] = [
  ...GEO10_BASE_QUESTIONS,
  ...GEO10_ADDITIONAL_QUESTIONS,
];

const GEO10_BASE_WORD_PUZZLES: WordCatchPuzzle[] = [
  {
    id: "wp-01",
    chapterId: "geo10-kn-c03",
    lessonId: "geo10-kn-b07",
    difficulty: "recognition",
    categoryLabel: "Di sản & Địa hình Karst (Chương 3)",
    answerDisplay: "VỊNH HẠ LONG",
    hint: "Ghép tên mùa nắng nóng trong năm với linh vật rồng đáp xuống vùng biển nghìn đảo đá vôi ở tỉnh Quảng Ninh.",
    explanation:
      "Vịnh Hạ Long là mẫu hình tiêu biểu của địa hình Karst (phong hóa hóa học đá vôi) bị ngập chìm bởi nước biển tiến.",
    illustrationKind: "halong-karst",
    visualClues: [
      {
        badge: "Mảnh ghép 1",
        title: "Eo biển kín + Nắng mùa Hè",
        caption: "Vùng nước biển ăn sâu vào đất liền + Mùa nắng rực rỡ",
        motif: "sun-summer",
        accentHex: "#f59e0b",
      },
      {
        badge: "Mảnh ghép 2",
        title: "Rồng vàng đáp xuống đảo đá",
        caption: "Truyền thuyết rồng mẹ và đàn rồng con bảo vệ bờ cõi",
        motif: "dragon-islands",
        accentHex: "#0d9488",
      },
    ],
  },
  {
    id: "wp-02",
    chapterId: "geo10-kn-c03",
    lessonId: "geo10-kn-b06",
    difficulty: "recognition",
    categoryLabel: "Cấu tạo Trái Đất (Chương 3)",
    answerDisplay: "THẠCH QUYỂN",
    hint: "Ghép từ Hán-Việt chỉ 'khối đá cứng' với lớp vỏ bao bọc ngoài cùng tới độ sâu 100 km của hành tinh.",
    explanation:
      "Thạch quyển gồm toàn bộ vỏ Trái Đất và phần cứng trên cùng của lớp Manti (đến độ sâu khoảng 100 km), bị chia cắt thành các mảng kiến tạo.",
    illustrationKind: "lithosphere-plates",
    visualClues: [
      {
        badge: "Mảnh ghép 1",
        title: "Tinh thể đá cứng chắc",
        caption: "Từ Hán-Việt chỉ vật chất bằng đá rắn",
        motif: "rock-crystal",
        accentHex: "#d97706",
      },
      {
        badge: "Mảnh ghép 2",
        title: "Lớp vỏ ghép mảng bao quanh Địa Cầu",
        caption: "Bao gồm vỏ Trái Đất và phần trên cùng Manti",
        motif: "globe-shell",
        accentHex: "#4f46e5",
      },
    ],
  },
  {
    id: "wp-03",
    chapterId: "geo10-kn-c04",
    lessonId: "geo10-kn-b09",
    difficulty: "recognition",
    categoryLabel: "Lớp vỏ khí (Chương 4)",
    answerDisplay: "KHÍ QUYỂN",
    hint: "Tấm áo giáp vô hình gồm 5 tầng chất hơi bao bọc quanh Trái Đất nhờ lực hấp dẫn, bảo vệ sự sống khỏi thiên thạch và tia cực tím.",
    explanation:
      "Khí quyển gồm 5 tầng: đối lưu, bình lưu, tầng giữa, tầng nhiệt và tầng ngoài; cung cấp oxy và điều hòa nhiệt độ bề mặt Trái Đất.",
    illustrationKind: "atmosphere-layers",
    visualClues: [
      {
        badge: "Mảnh ghép 1",
        title: "Luồng chất hơi & Oxy",
        caption: "Hỗn hợp Nitơ (78%), Oxy (21%) và hơi nước",
        motif: "layers-sky",
        accentHex: "#0ea5e9",
      },
      {
        badge: "Mảnh ghép 2",
        title: "Vòng lá chắn 5 tầng quanh Địa Cầu",
        caption: "Giữ lại nhờ trọng lực từ mặt đất tới vũ trụ",
        motif: "shield-earth",
        accentHex: "#6366f1",
      },
    ],
  },
  {
    id: "wp-04",
    chapterId: "geo10-kn-c05",
    lessonId: "geo10-kn-b12",
    difficulty: "recognition",
    categoryLabel: "Nước biển & Đại dương (Chương 5)",
    answerDisplay: "THỦY TRIỀU",
    hint: "Nhịp thở dâng lên – rút xuống theo chu kì hàng ngày của đại dương dưới sức hút hấp dẫn từ Mặt Trăng và Mặt Trời.",
    explanation:
      "Thủy triều đạt dao động lớn nhất (triều cường) khi Mặt Trăng, Mặt Trời và Trái Đất thẳng hàng (ngày không trăng và trăng tròn).",
    illustrationKind: "ocean-tide",
    visualClues: [
      {
        badge: "Mảnh ghép 1",
        title: "Giọt nước đại dương",
        caption: "Từ Hán-Việt chỉ nguyên tố Nước",
        motif: "water-drop",
        accentHex: "#0284c7",
      },
      {
        badge: "Mảnh ghép 2",
        title: "Trăng rằm hút sóng dâng – hạ",
        caption: "Mực nước lên xuống đều đặn theo chu kì tuần trăng",
        motif: "moon-waves",
        accentHex: "#8b5cf6",
      },
    ],
  },
  {
    id: "wp-05",
    chapterId: "geo10-kn-c04",
    lessonId: "geo10-kn-b09",
    difficulty: "comprehension",
    categoryLabel: "Hoàn lưu khí quyển (Chương 4)",
    answerDisplay: "GIÓ MẬU DỊCH",
    hint: "Đới gió thổi đều quanh năm từ áp cao cận chí tuyến về Xích đạo, từng giúp các đoàn thuyền buôn cổ đại vượt đại dương.",
    explanation:
      "Gió Mậu dịch (Tín phong) thổi từ áp cao cận chí tuyến về áp thấp Xích đạo theo hướng Đông Bắc ở bán cầu Bắc và Đông Nam ở bán cầu Nam.",
    illustrationKind: "trade-winds",
    visualClues: [
      {
        badge: "Mảnh ghép 1",
        title: "Luồng không khí thổi căng cánh buồm",
        caption: "Dòng chuyển động từ nơi áp cao về nơi áp thấp",
        motif: "sail-wind",
        accentHex: "#06b6d4",
      },
      {
        badge: "Mảnh ghép 2",
        title: "Hải trình giao thương buôn bán",
        caption: "Từ Hán-Việt chỉ hoạt động trao đổi thương mại",
        motif: "merchant-route",
        accentHex: "#f59e0b",
      },
    ],
  },
  {
    id: "wp-06",
    chapterId: "geo10-kn-c08",
    lessonId: "geo10-kn-b20",
    difficulty: "comprehension",
    categoryLabel: "Địa lí dân cư (Chương 8)",
    answerDisplay: "ĐÔ THỊ HÓA",
    hint: "Sự chuyển mình từ làng quê sang những tòa nhà hiện đại, mở rộng quy mô thành phố và lan tỏa nếp sống văn minh.",
    explanation:
      "Đô thị hóa gắn liền với quá trình công nghiệp hóa và chuyển dịch cơ cấu kinh tế từ nông nghiệp sang công nghiệp - dịch vụ.",
    illustrationKind: "urbanization",
    visualClues: [
      {
        badge: "Mảnh ghép 1",
        title: "Quần thể cao ốc & Đại lộ",
        caption: "Khu vực tập trung đông dân cư phi nông nghiệp",
        motif: "city-towers",
        accentHex: "#3b82f6",
      },
      {
        badge: "Mảnh ghép 2",
        title: "Mũi tên chuyển biến & Lan tỏa",
        caption: "Sự biến đổi không gian và lối sống theo thời gian",
        motif: "arrow-expand",
        accentHex: "#8b5cf6",
      },
    ],
  },
  {
    id: "wp-07",
    chapterId: "geo10-kn-c06",
    lessonId: "geo10-kn-b14",
    difficulty: "comprehension",
    categoryLabel: "Thổ nhưỡng (Chương 6)",
    answerDisplay: "ĐẤT FERALIT",
    hint: "Lớp thổ nhưỡng màu đỏ vàng đặc trưng ở vùng đồi núi nhiệt đới ẩm, ghép tên từ kí hiệu hóa học của Sắt (Fe) và Nhôm (Al).",
    explanation:
      "Đất Feralit hình thành ở vùng nhiệt đới ẩm mưa nhiều, quá trình rửa trôi các chất dễ tan diễn ra mạnh và tích tụ oxit sắt, nhôm tạo màu đỏ vàng.",
    illustrationKind: "feralit-soil",
    visualClues: [
      {
        badge: "Mảnh ghép 1",
        title: "Tầng thổ nhưỡng màu đỏ cam",
        caption: "Lớp vật chất tơi xốp có độ phì nuôi cây trồng",
        motif: "red-soil",
        accentHex: "#ea580c",
      },
      {
        badge: "Mảnh ghép 2",
        title: "Hợp chất Sắt (Fe) + Nhôm (Al)",
        caption: "Ghép 2 kí hiệu hóa học Fe + Al + đuôi kết tinh",
        motif: "fe-al-atoms",
        accentHex: "#dc2626",
      },
    ],
  },
  {
    id: "wp-08",
    chapterId: "geo10-kn-c06",
    lessonId: "geo10-kn-b15",
    difficulty: "recognition",
    categoryLabel: "Thế giới sinh vật (Chương 6)",
    answerDisplay: "SINH QUYỂN",
    hint: "Ngôi nhà chung chứa toàn bộ thực vật, động vật và vi sinh vật, giao thoa giữa đất, nước và không khí.",
    explanation:
      "Sinh quyển là một quyển của Trái Đất trong đó có toàn bộ sinh vật sinh sống, gồm phần thấp của khí quyển, toàn bộ thủy quyển và phần trên của thạch quyển.",
    illustrationKind: "biosphere",
    visualClues: [
      {
        badge: "Mảnh ghép 1",
        title: "Mầm cây xanh & Muông thú",
        caption: "Các cơ thể sống đang sinh trưởng",
        motif: "sprout-life",
        accentHex: "#16a34a",
      },
      {
        badge: "Mảnh ghép 2",
        title: "Vòng cầu giao thoa Đất – Nước – Khí",
        caption: "Không gian bao quanh hành tinh có sự sống",
        motif: "sphere-harmony",
        accentHex: "#0ea5e9",
      },
    ],
  },
  {
    id: "wp-09",
    chapterId: "geo10-kn-c01",
    lessonId: "geo10-kn-b03",
    difficulty: "recognition",
    categoryLabel: "Bản đồ & Công nghệ (Chương 1)",
    answerDisplay: "BẢN ĐỒ SỐ",
    hint: "Công cụ dẫn đường thông minh kết hợp hệ thống ký hiệu địa lí truyền thống với dữ liệu máy tính và định vị vệ tinh.",
    explanation:
      "Bản đồ số cho phép thu phóng linh hoạt, bật/tắt các lớp dữ liệu địa lí (GIS) và định vị thời gian thực cùng GPS.",
    illustrationKind: "digital-map",
    visualClues: [
      {
        badge: "Mảnh ghép 1",
        title: "Tấm họa đồ & Kim chỉ hướng",
        caption: "Bản vẽ thu nhỏ bề mặt Trái Đất theo tỉ lệ",
        motif: "compass-map",
        accentHex: "#10b981",
      },
      {
        badge: "Mảnh ghép 2",
        title: "Dữ liệu 0101 trên màn hình cảm ứng",
        caption: "Công nghệ kĩ thuật số hiện đại",
        motif: "binary-screen",
        accentHex: "#3b82f6",
      },
    ],
  },
  {
    id: "wp-10",
    chapterId: "geo10-kn-c04",
    lessonId: "geo10-kn-b09",
    difficulty: "application",
    categoryLabel: "Khí hậu & Địa hình (Chương 4)",
    answerDisplay: "MƯA ĐỊA HÌNH",
    hint: "Hiện tượng mây tích tụ trút nước xối xả bên sườn núi đón gió biển, trong khi sườn bên kia lại khô ráo.",
    explanation:
      "Sườn núi đón gió ẩm bị đẩy lên cao lạnh đi gây mưa lớn (mưa địa hình), trong khi sườn khuất gió thường khô và nóng.",
    illustrationKind: "orographic-rain",
    visualClues: [
      {
        badge: "Mảnh ghép 1",
        title: "Mây đen ngưng tụ trút hạt nước",
        caption: "Hiện tượng nước rơi từ tầng đối lưu xuống",
        motif: "rain-cloud",
        accentHex: "#0284c7",
      },
      {
        badge: "Mảnh ghép 2",
        title: "Dãy núi cao chắn luồng gió ẩm",
        caption: "Dáng đất cao thấp của bề mặt lục địa",
        motif: "mountain-barrier",
        accentHex: "#059669",
      },
    ],
  },
  {
    id: "wp-11",
    chapterId: "geo10-kn-c08",
    lessonId: "geo10-kn-b19",
    difficulty: "comprehension",
    categoryLabel: "Cơ cấu dân số (Chương 8)",
    answerDisplay: "THÁP DÂN SỐ",
    hint: "Biểu đồ có dáng như công trình kiến trúc cổ đại, gồm hai cánh Nam – Nữ đối xứng theo từng bậc tuổi từ sơ sinh đến cao niên.",
    explanation:
      "Tháp dân số (tháp tuổi) cho biết cơ cấu giới tính, độ tuổi hiện tại cũng như xu hướng phát triển dân số trong tương lai.",
    illustrationKind: "population-pyramid",
    visualClues: [
      {
        badge: "Mảnh ghép 1",
        title: "Khối kiến trúc bậc thang vươn lên đỉnh",
        caption: "Đáy rộng ở dưới và thu nhỏ dần lên cao",
        motif: "pyramid-steps",
        accentHex: "#f59e0b",
      },
      {
        badge: "Mảnh ghép 2",
        title: "Thanh ngang Nam – Nữ theo độ tuổi",
        caption: "Quy mô và cơ cấu con người sinh sống",
        motif: "age-gender-bars",
        accentHex: "#6366f1",
      },
    ],
  },
  {
    id: "wp-12",
    chapterId: "geo10-kn-c13",
    lessonId: "geo10-kn-b40",
    difficulty: "application",
    categoryLabel: "Môi trường & Phát triển (Chương 13)",
    answerDisplay: "TĂNG TRƯỞNG XANH",
    hint: "Ghép mũi tên đi lên của nền kinh tế với sắc màu của lá cây sinh thái, năng lượng sạch và giảm phát thải carbon.",
    explanation:
      "Tăng trưởng xanh là con đường thiết yếu để đạt mục tiêu phát triển bền vững và ứng phó với biến đổi khí hậu.",
    illustrationKind: "green-growth",
    visualClues: [
      {
        badge: "Mảnh ghép 1",
        title: "Biểu đồ cột vươn cao đi lên",
        caption: "Sự gia tăng quy mô và sản lượng kinh tế",
        motif: "growth-chart",
        accentHex: "#0284c7",
      },
      {
        badge: "Mảnh ghép 2",
        title: "Mầm lá sạch giảm khí thải CO₂",
        caption: "Màu biểu trưng cho thiên nhiên và bền vững",
        motif: "eco-leaf",
        accentHex: "#10b981",
      },
    ],
  },
];

export const GEO10_WORD_PUZZLES: WordCatchPuzzle[] = [
  ...GEO10_BASE_WORD_PUZZLES,
  ...GEO10_ADDITIONAL_WORD_PUZZLES,
];

function shuffleWithRng<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Lọc câu hỏi trắc nghiệm ĐÚNG theo chương đã chọn.
 * Tuyệt đối không âm thầm trộn chương khác nếu chương đã chọn tồn tại.
 */
export function filterQuestionsByChapter(
  chapterId?: string,
  pool: readonly GameQuizQuestion[] = GEO10_GAME_QUESTIONS,
): GameQuizQuestion[] {
  if (!chapterId || chapterId === "all") return [...pool];
  return pool.filter((q) => q.chapterId === chapterId);
}

/**
 * Lọc câu đố hình ảnh ĐÚNG theo chương đã chọn.
 * Tuyệt đối không âm thầm trộn chương khác nếu chương đã chọn tồn tại.
 */
export function filterPuzzlesByChapter(
  chapterId?: string,
  pool: readonly WordCatchPuzzle[] = GEO10_WORD_PUZZLES,
): WordCatchPuzzle[] {
  if (!chapterId || chapterId === "all") return [...pool];
  return pool.filter((p) => p.chapterId === chapterId);
}

/**
 * Kiểm tra số lượng câu hỏi / câu đố hiện có của một chương so với số câu tiêu chuẩn của trò chơi.
 * Dùng để hiển thị thông báo minh bạch và cho phép học sinh lựa chọn chế độ chơi khi chọn 1 chương đơn lẻ.
 */
export function getChapterDeckAvailability(
  chapterId: string | undefined,
  standardRequiredCount: number,
  kind: "quiz" | "word-catch" = "quiz",
): ChapterDeckAvailability {
  const normalizedId = !chapterId || chapterId === "all" ? "all" : chapterId;
  const chapterObj = geo10Chapters.find((c) => c.id === normalizedId);
  const chapterTitle = chapterObj
    ? `Chương ${chapterObj.number}: ${chapterObj.title}`
    : "Toàn bộ chương trình Địa lí 10";

  const availableCount =
    kind === "quiz"
      ? filterQuestionsByChapter(normalizedId).length
      : filterPuzzlesByChapter(normalizedId).length;

  const isStrictlySingleChapter = normalizedId !== "all";
  return {
    chapterId: normalizedId,
    chapterTitle,
    availableCount,
    standardRequiredCount,
    isStrictlySingleChapter,
    isShortOfStandard: isStrictlySingleChapter && availableCount < standardRequiredCount,
  };
}
export type DeckBuildOptions = {
  /**
   * Mặc định = false: chỉ lấy câu thuộc đúng chương đã chọn, tuyệt đối không tự ý trộn chương khác.
   * Chỉ khi học sinh chủ động chọn "Bổ sung thêm câu từ chương khác để đủ số câu tiêu chuẩn"
   * thì cờ này mới được bật = true.
   */
  allowCrossChapterFallback?: boolean;
};

export function buildQuizDeck(
  count: number,
  chapterId?: string,
  rng: () => number = Math.random,
  options?: DeckBuildOptions,
): GameQuizQuestion[] {
  const primary = shuffleWithRng(filterQuestionsByChapter(chapterId), rng);
  if (!chapterId || chapterId === "all" || !options?.allowCrossChapterFallback) {
    return primary.slice(0, count);
  }

  if (primary.length >= count) {
    return primary.slice(0, count);
  }
  const usedIds = new Set(primary.map((q) => q.id));
  const remainder = shuffleWithRng(
    GEO10_GAME_QUESTIONS.filter((q) => !usedIds.has(q.id)),
    rng,
  );
  return [...primary, ...remainder].slice(0, count);
}

const DIFFICULTY_ORDER: Record<QuestionDifficulty, number> = {
  recognition: 1,
  comprehension: 2,
  application: 3,
  advanced_application: 4,
};

/**
 * Tạo bộ câu hỏi cho Ai là triệu phú Địa lý:
 * - Khi chọn "all" (Toàn bộ chương trình): lấy đủ 15 câu phân tầng độ khó + bộ dự phòng đổi câu hỏi.
 * - Khi chọn 1 chương cụ thể và `allowCrossChapterFallback` = false (mặc định):
 *   CHỈ lấy các câu thuộc đúng chương đó (sắp xếp tăng dần độ khó), giữ lại 1 câu cùng chương làm dự phòng
 *   cho quyền trợ giúp "Đổi câu hỏi", hoàn toàn KHÔNG trộn câu của chương khác!
 * - Khi học sinh chủ động bật `allowCrossChapterFallback = true`: ưu tiên toàn bộ câu của chương đã chọn
 *   rồi bổ sung thêm câu từ chương khác để đủ 15 nấc thang tiêu chuẩn.
 */
export function buildMillionaireQuestionDeck(
  chapterId?: string,
  rng: () => number = Math.random,
  options?: DeckBuildOptions,
): {
  mainQuestions: GameQuizQuestion[];
  reserveQuestions: GameQuizQuestion[];
} {
  const isSingleChapter = Boolean(chapterId && chapterId !== "all");
  const allowCrossChapter = Boolean(options?.allowCrossChapterFallback);

  if (isSingleChapter && !allowCrossChapter) {
    const chapterPool = shuffleWithRng(filterQuestionsByChapter(chapterId), rng);
    if (chapterPool.length === 0) {
      return { mainQuestions: [], reserveQuestions: [] };
    }
    // Giữ lại ít nhất 1 câu dự phòng cùng chương cho quyền trợ giúp "Đổi câu hỏi"
    const reserveCount = chapterPool.length > 5 ? 1 : 0;
    const mainCount = Math.min(15, chapterPool.length - reserveCount);
    const mainQuestions = chapterPool
      .slice(0, mainCount)
      .sort((a, b) => DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty]);
    const reserveQuestions = chapterPool.slice(mainCount);
    return { mainQuestions, reserveQuestions };
  }

  const chapterPool = isSingleChapter
    ? GEO10_GAME_QUESTIONS.filter((q) => q.chapterId === chapterId)
    : [];
  const otherPool = isSingleChapter
    ? GEO10_GAME_QUESTIONS.filter((q) => q.chapterId !== chapterId)
    : GEO10_GAME_QUESTIONS;

  const pickByDifficulty = (
    difficulty: QuestionDifficulty,
    needed: number,
    used: Set<string>,
  ): GameQuizQuestion[] => {
    const first = shuffleWithRng(
      chapterPool.filter((q) => q.difficulty === difficulty && !used.has(q.id)),
      rng,
    );
    const second = shuffleWithRng(
      otherPool.filter((q) => q.difficulty === difficulty && !used.has(q.id)),
      rng,
    );
    const combined = [...first, ...second];
    const picked = combined.slice(0, needed);
    for (const item of picked) used.add(item.id);
    return picked;
  };

  const usedIds = new Set<string>();
  const tier1 = pickByDifficulty("recognition", 5, usedIds);
  const tier2 = pickByDifficulty("comprehension", 5, usedIds);
  const tier3 = pickByDifficulty("application", 3, usedIds);
  const tier4 = pickByDifficulty("advanced_application", 2, usedIds);

  const mainQuestions = [...tier1, ...tier2, ...tier3, ...tier4];

  if (mainQuestions.length < 15) {
    const extras = shuffleWithRng(
      GEO10_GAME_QUESTIONS.filter((q) => !usedIds.has(q.id)),
      rng,
    ).slice(0, 15 - mainQuestions.length);
    for (const item of extras) {
      usedIds.add(item.id);
      mainQuestions.push(item);
    }
  }

  const reserveQuestions = shuffleWithRng(
    GEO10_GAME_QUESTIONS.filter((q) => !usedIds.has(q.id)),
    rng,
  );

  return {
    mainQuestions: mainQuestions.slice(0, 15),
    reserveQuestions,
  };
}

export function buildWordCatchDeck(
  count = 10,
  chapterId?: string,
  rng: () => number = Math.random,
  options?: DeckBuildOptions,
): WordCatchPuzzle[] {
  const isSingleChapter = Boolean(chapterId && chapterId !== "all");
  const primary = shuffleWithRng(filterPuzzlesByChapter(chapterId), rng);

  if (!isSingleChapter || !options?.allowCrossChapterFallback) {
    return primary.slice(0, Math.min(count, primary.length));
  }

  const usedIds = new Set(primary.map((p) => p.id));
  const rest = shuffleWithRng(
    GEO10_WORD_PUZZLES.filter((p) => !usedIds.has(p.id)),
    rng,
  );
  return [...primary, ...rest].slice(0, Math.min(count, GEO10_WORD_PUZZLES.length));
}

export type QuestionBankValidationReport = {
  valid: boolean;
  totalQuestions: number;
  totalWordPuzzles: number;
  chapterQuestionCounts: Record<string, number>;
  chapterPuzzleCounts: Record<string, number>;
  errors: string[];
};

export function validateGameQuestionBank(
  questions: readonly GameQuizQuestion[] = GEO10_GAME_QUESTIONS,
  puzzles: readonly WordCatchPuzzle[] = GEO10_WORD_PUZZLES,
): QuestionBankValidationReport {
  const errors: string[] = [];
  const validChapterIds = new Set(geo10Chapters.map((c) => c.id));
  const lessonToChapterMap = new Map(geo10Lessons.map((l) => [l.id, l.chapterId]));

  const questionIds = new Set<string>();
  const questionContents = new Set<string>();
  const chapterQuestionCounts: Record<string, number> = {};

  for (const c of geo10Chapters) {
    chapterQuestionCounts[c.id] = 0;
  }

  for (const q of questions) {
    if (questionIds.has(q.id)) {
      errors.push(`Trùng ID câu hỏi: ${q.id}`);
    }
    questionIds.add(q.id);

    const normalizedContent = q.content.trim().toLowerCase();
    if (questionContents.has(normalizedContent)) {
      errors.push(`Trùng nội dung câu hỏi tại ID: ${q.id}`);
    }
    questionContents.add(normalizedContent);

    if (!validChapterIds.has(q.chapterId)) {
      errors.push(`Câu hỏi ${q.id} có chapterId không hợp lệ: ${q.chapterId}`);
    } else {
      chapterQuestionCounts[q.chapterId] = (chapterQuestionCounts[q.chapterId] ?? 0) + 1;
    }

    const expectedChapter = lessonToChapterMap.get(q.lessonId);
    if (!expectedChapter) {
      errors.push(`Câu hỏi ${q.id} có lessonId không tồn tại: ${q.lessonId}`);
    } else if (expectedChapter !== q.chapterId) {
      errors.push(
        `Câu hỏi ${q.id} có lessonId (${q.lessonId}) thuộc ${expectedChapter} nhưng lại khai báo ${q.chapterId}`,
      );
    }

    if (q.options.length !== 4) {
      errors.push(`Câu hỏi ${q.id} không đủ 4 phương án A, B, C, D`);
    }
    const optionIds = q.options.map((o) => o.id).join(",");
    if (optionIds !== "A,B,C,D") {
      errors.push(`Câu hỏi ${q.id} có thứ tự ID phương án sai: ${optionIds}`);
    }
    if (q.options.some((o) => !o.text.trim())) {
      errors.push(`Câu hỏi ${q.id} có phương án rỗng`);
    }
    if (!["A", "B", "C", "D"].includes(q.correctOptionId)) {
      errors.push(`Câu hỏi ${q.id} có correctOptionId không hợp lệ: ${q.correctOptionId}`);
    }
    if (!q.explanation.trim()) {
      errors.push(`Câu hỏi ${q.id} thiếu giải thích đáp án`);
    }
  }

  const puzzleIds = new Set<string>();
  const puzzleAnswers = new Set<string>();
  const chapterPuzzleCounts: Record<string, number> = {};
  for (const c of geo10Chapters) {
    chapterPuzzleCounts[c.id] = 0;
  }

  for (const p of puzzles) {
    if (puzzleIds.has(p.id)) {
      errors.push(`Trùng ID câu đố hình: ${p.id}`);
    }
    puzzleIds.add(p.id);

    const normAns = p.answerDisplay.trim().toUpperCase();
    if (!normAns) {
      errors.push(`Câu đố ${p.id} thiếu answerDisplay`);
    }
    if (puzzleAnswers.has(normAns)) {
      errors.push(`Trùng đáp án câu đố hình: ${normAns} (${p.id})`);
    }
    puzzleAnswers.add(normAns);

    if (!validChapterIds.has(p.chapterId)) {
      errors.push(`Câu đố ${p.id} có chapterId không hợp lệ: ${p.chapterId}`);
    } else {
      chapterPuzzleCounts[p.chapterId] = (chapterPuzzleCounts[p.chapterId] ?? 0) + 1;
    }

    const expectedChapter = lessonToChapterMap.get(p.lessonId);
    if (!expectedChapter || expectedChapter !== p.chapterId) {
      errors.push(`Câu đố ${p.id} có lessonId (${p.lessonId}) không khớp chapterId (${p.chapterId})`);
    }

    // Kiểm tra gợi ý không tiết lộ trực tiếp nguyên cụm đáp án
    if (p.hint.toUpperCase().includes(normAns)) {
      errors.push(`Câu đố ${p.id} để lộ trực tiếp đáp án '${normAns}' trong nội dung gợi ý!`);
    }
    if (!p.visualClues || p.visualClues.length < 2) {
      errors.push(`Câu đố ${p.id} thiếu bộ 2 mảnh ghép liên tưởng visualClues`);
    }
  }

  return {
    valid: errors.length === 0,
    totalQuestions: questions.length,
    totalWordPuzzles: puzzles.length,
    chapterQuestionCounts,
    chapterPuzzleCounts,
    errors,
  };
}
