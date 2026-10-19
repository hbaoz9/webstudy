import type {
  CurriculumChapter,
  CurriculumLesson,
  CurriculumPart,
} from "../types/curriculum";

export const geo10Parts: CurriculumPart[] = [
  {
    id: "geo10-kn-p01",
    number: 1,
    title: "Một số vấn đề chung",
  },
  { id: "geo10-kn-p02", number: 2, title: "Địa lí tự nhiên" },
  { id: "geo10-kn-p03", number: 3, title: "Địa lí kinh tế - xã hội" },
];

export const geo10Chapters: CurriculumChapter[] = [
  {
    id: "geo10-kn-c01",
    partId: "geo10-kn-p01",
    number: 1,
    title: "Sử dụng bản đồ",
  },
  { id: "geo10-kn-c02", partId: "geo10-kn-p02", number: 2, title: "Trái Đất" },
  {
    id: "geo10-kn-c03",
    partId: "geo10-kn-p02",
    number: 3,
    title: "Thạch quyển",
  },
  { id: "geo10-kn-c04", partId: "geo10-kn-p02", number: 4, title: "Khí quyển" },
  {
    id: "geo10-kn-c05",
    partId: "geo10-kn-p02",
    number: 5,
    title: "Thủy quyển",
  },
  {
    id: "geo10-kn-c06",
    partId: "geo10-kn-p02",
    number: 6,
    title: "Sinh quyển",
  },
  {
    id: "geo10-kn-c07",
    partId: "geo10-kn-p02",
    number: 7,
    title: "Một số quy luật của vỏ địa lí",
  },
  {
    id: "geo10-kn-c08",
    partId: "geo10-kn-p03",
    number: 8,
    title: "Địa lí dân cư",
  },
  {
    id: "geo10-kn-c09",
    partId: "geo10-kn-p03",
    number: 9,
    title: "Các nguồn lực, một số tiêu chí đánh giá sự phát triển kinh tế",
  },
  {
    id: "geo10-kn-c10",
    partId: "geo10-kn-p03",
    number: 10,
    title: "Địa lí ngành nông nghiệp, lâm nghiệp, thủy sản",
  },
  {
    id: "geo10-kn-c11",
    partId: "geo10-kn-p03",
    number: 11,
    title: "Địa lí ngành công nghiệp",
  },
  {
    id: "geo10-kn-c12",
    partId: "geo10-kn-p03",
    number: 12,
    title: "Địa lí ngành dịch vụ",
  },
  {
    id: "geo10-kn-c13",
    partId: "geo10-kn-p03",
    number: 13,
    title: "Phát triển bền vững và tăng trưởng xanh",
  },
];

export const geo10Lessons: CurriculumLesson[] = [
  {
    id: "geo10-kn-b01",
    chapterId: "geo10-kn-c01",
    number: 1,
    title: "Môn Địa lí với định hướng nghề nghiệp",
  },
  {
    id: "geo10-kn-b02",
    chapterId: "geo10-kn-c01",
    number: 2,
    title: "Một số phương pháp biểu hiện các đối tượng địa lí trên bản đồ",
  },
  {
    id: "geo10-kn-b03",
    chapterId: "geo10-kn-c01",
    number: 3,
    title:
      "Sử dụng bản đồ trong học tập và đời sống, một số ứng dụng của GPS và bản đồ số trong đời sống",
  },
  {
    id: "geo10-kn-b04",
    chapterId: "geo10-kn-c02",
    number: 4,
    title:
      "Sự hình thành Trái Đất, vỏ Trái Đất và vật liệu cấu tạo vỏ Trái Đất",
  },
  {
    id: "geo10-kn-b05",
    chapterId: "geo10-kn-c02",
    number: 5,
    title: "Hệ quả địa lí các chuyển động của Trái Đất",
  },
  {
    id: "geo10-kn-b06",
    chapterId: "geo10-kn-c03",
    number: 6,
    title: "Thạch quyển, thuyết kiến tạo mảng",
  },
  {
    id: "geo10-kn-b07",
    chapterId: "geo10-kn-c03",
    number: 7,
    title: "Nội lực và ngoại lực",
  },
  {
    id: "geo10-kn-b08",
    chapterId: "geo10-kn-c03",
    number: 8,
    title: "Thực hành: Sự phân bố các vành đai động đất, núi lửa",
  },
  {
    id: "geo10-kn-b09",
    chapterId: "geo10-kn-c04",
    number: 9,
    title: "Khí quyển, các yếu tố khí hậu",
  },
  {
    id: "geo10-kn-b10",
    chapterId: "geo10-kn-c04",
    number: 10,
    title:
      "Thực hành: Đọc bản đồ các đới và các kiểu khí hậu trên Trái Đất, phân tích biểu đồ một số kiểu khí hậu",
  },
  {
    id: "geo10-kn-b11",
    chapterId: "geo10-kn-c05",
    number: 11,
    title: "Thủy quyển, nước trên lục địa",
  },
  {
    id: "geo10-kn-b12",
    chapterId: "geo10-kn-c05",
    number: 12,
    title: "Nước biển và đại dương",
  },
  {
    id: "geo10-kn-b13",
    chapterId: "geo10-kn-c05",
    number: 13,
    title: "Thực hành: Phân tích chế độ nước của sông Hồng",
  },
  {
    id: "geo10-kn-b14",
    chapterId: "geo10-kn-c06",
    number: 14,
    title: "Đất trên Trái Đất",
  },
  {
    id: "geo10-kn-b15",
    chapterId: "geo10-kn-c06",
    number: 15,
    title: "Sinh quyển",
  },
  {
    id: "geo10-kn-b16",
    chapterId: "geo10-kn-c06",
    number: 16,
    title: "Thực hành: Tìm hiểu sự phân bố đất và sinh vật trên Trái Đất",
  },
  {
    id: "geo10-kn-b17",
    chapterId: "geo10-kn-c07",
    number: 17,
    title: "Vỏ địa lí, quy luật thống nhất và hoàn chỉnh của vỏ địa lí",
  },
  {
    id: "geo10-kn-b18",
    chapterId: "geo10-kn-c07",
    number: 18,
    title: "Quy luật địa đới và quy luật phi địa đới",
  },
  {
    id: "geo10-kn-b19",
    chapterId: "geo10-kn-c08",
    number: 19,
    title: "Quy mô dân số, gia tăng dân số và cơ cấu dân số thế giới",
  },
  {
    id: "geo10-kn-b20",
    chapterId: "geo10-kn-c08",
    number: 20,
    title: "Phân bố dân cư và đô thị hóa trên thế giới",
  },
  {
    id: "geo10-kn-b21",
    chapterId: "geo10-kn-c09",
    number: 21,
    title: "Các nguồn lực phát triển kinh tế",
  },
  {
    id: "geo10-kn-b22",
    chapterId: "geo10-kn-c09",
    number: 22,
    title: "Cơ cấu kinh tế, tổng sản phẩm trong nước và tổng thu nhập quốc gia",
  },
  {
    id: "geo10-kn-b23",
    chapterId: "geo10-kn-c10",
    number: 23,
    title:
      "Vai trò, đặc điểm, các nhân tố ảnh hưởng tới sự phát triển và phân bố nông nghiệp, lâm nghiệp, thủy sản",
  },
  {
    id: "geo10-kn-b24",
    chapterId: "geo10-kn-c10",
    number: 24,
    title: "Địa lí ngành nông nghiệp",
  },
  {
    id: "geo10-kn-b25",
    chapterId: "geo10-kn-c10",
    number: 25,
    title: "Địa lí ngành lâm nghiệp và ngành thủy sản",
  },
  {
    id: "geo10-kn-b26",
    chapterId: "geo10-kn-c10",
    number: 26,
    title:
      "Tổ chức lãnh thổ nông nghiệp, một số vấn đề phát triển nông nghiệp hiện đại trên thế giới và định hướng phát triển nông nghiệp trong tương lai",
  },
  {
    id: "geo10-kn-b27",
    chapterId: "geo10-kn-c10",
    number: 27,
    title:
      "Thực hành: Vẽ và nhận xét biểu đồ về sản lượng lương thực của thế giới",
  },
  {
    id: "geo10-kn-b28",
    chapterId: "geo10-kn-c11",
    number: 28,
    title:
      "Vai trò, đặc điểm, cơ cấu ngành công nghiệp, các nhân tố ảnh hưởng tới sự phát triển và phân bố công nghiệp",
  },
  {
    id: "geo10-kn-b29",
    chapterId: "geo10-kn-c11",
    number: 29,
    title: "Địa lí một số ngành công nghiệp",
  },
  {
    id: "geo10-kn-b30",
    chapterId: "geo10-kn-c11",
    number: 30,
    title: "Tổ chức lãnh thổ công nghiệp",
  },
  {
    id: "geo10-kn-b31",
    chapterId: "geo10-kn-c11",
    number: 31,
    title:
      "Tác động của công nghiệp đối với môi trường, phát triển năng lượng tái tạo, định hướng phát triển công nghiệp trong tương lai",
  },
  {
    id: "geo10-kn-b32",
    chapterId: "geo10-kn-c11",
    number: 32,
    title: "Thực hành: Viết báo cáo tìm hiểu một vấn đề về công nghiệp",
  },
  {
    id: "geo10-kn-b33",
    chapterId: "geo10-kn-c12",
    number: 33,
    title:
      "Cơ cấu, vai trò, đặc điểm, các nhân tố ảnh hưởng đến sự phát triển và phân bố dịch vụ",
  },
  {
    id: "geo10-kn-b34",
    chapterId: "geo10-kn-c12",
    number: 34,
    title: "Địa lí ngành giao thông vận tải",
  },
  {
    id: "geo10-kn-b35",
    chapterId: "geo10-kn-c12",
    number: 35,
    title: "Địa lí ngành bưu chính viễn thông",
  },
  {
    id: "geo10-kn-b36",
    chapterId: "geo10-kn-c12",
    number: 36,
    title: "Địa lí ngành du lịch",
  },
  {
    id: "geo10-kn-b37",
    chapterId: "geo10-kn-c12",
    number: 37,
    title: "Địa lí ngành thương mại và ngành tài chính ngân hàng",
  },
  {
    id: "geo10-kn-b38",
    chapterId: "geo10-kn-c12",
    number: 38,
    title: "Thực hành: Viết báo cáo tìm hiểu về một ngành dịch vụ",
  },
  {
    id: "geo10-kn-b39",
    chapterId: "geo10-kn-c13",
    number: 39,
    title: "Môi trường và tài nguyên thiên nhiên",
  },
  {
    id: "geo10-kn-b40",
    chapterId: "geo10-kn-c13",
    number: 40,
    title: "Phát triển bền vững và tăng trưởng xanh",
  },
];

export function getLessonsByChapter(chapterId: string) {
  return geo10Lessons
    .filter((lesson) => lesson.chapterId === chapterId)
    .sort((a, b) => a.number - b.number);
}
