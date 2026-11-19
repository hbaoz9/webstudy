import type { Lab3DModelConfig, Lab3DModelId } from "../types";

export const LAB3D_MODEL_IDS: Lab3DModelId[] = [
  "earth-rotation",
  "earth-layers",
  "plate-tectonics",
  "atmosphere-layers",
];

export const LAB3D_MODELS: Lab3DModelConfig[] = [
  {
    id: "earth-rotation",
    slug: "earth-rotation",
    title: "Trái Đất tự quay — Ngày và đêm",
    subtitle: "Hệ quả địa lí chuyển động tự quay quanh trục nghiêng 23°27'",
    chapterId: "geo10-kn-c02",
    lessonId: "geo10-kn-b05",
    lessonTitle: "Bài 5. Hệ quả địa lí các chuyển động của Trái Đất",
    badge: "CHƯƠNG 2 • TRÁI ĐẤT",
    accentColor: "#10b981",
    description:
      "Quan sát khối cầu Trái Đất với bề mặt lục địa – đại dương tự quay từ Tây sang Đông quanh trục nghiêng 66°33' trên mặt phẳng quỹ đạo (lệch 23°27' so với pháp tuyến) dưới chùm tia sáng Mặt Trời song song.",
    scientificSimulationNote:
      "Lưu ý mô phỏng khoa học (Mô phỏng không theo tỉ lệ thực tế): Tốc độ tự quay được tua nhanh để phục vụ quan sát học tập (thực tế 1 vòng = 24 giờ, tức 15° kinh tuyến/giờ). Khoảng cách và kích thước nguồn sáng Mặt Trời được thu gọn; các tia sáng chiếu tới Trái Đất được mô phỏng song song.",
    keyTakeaways: [
      "Do Trái Đất có dạng hình cầu nên lúc nào cũng chỉ được Mặt Trời chiếu sáng một nửa, sinh ra Ngày và Đêm.",
      "Nhờ Trái Đất tự quay quanh trục từ Tây sang Đông (1 vòng ~ 24 giờ), mọi nơi trên bề mặt Trái Đất đều lần lượt có ngày và đêm luân phiên.",
      "Các địa điểm nằm ở kinh tuyến phía Đông sẽ thấy Mặt Trời mọc sớm hơn và có giờ địa phương sớm hơn phía Tây (mỗi múi giờ rộng 15° kinh tuyến).",
      "Lực Coriolis sinh ra do vận động tự quay làm lệch hướng các vật chuyển động: lệch về bên phải ở bán cầu Bắc và bên trái ở bán cầu Nam.",
    ],
    observationGuide: [
      "Bấm trực tiếp vào quả cầu Trái Đất, trục nghiêng, vòng phân chia Sáng – Tối hoặc mốc Việt Nam trong khung 3D để mở thông tin kiến thức.",
      "Chuyển đổi góc nhìn học tập (Xích đạo, Cực Bắc, Ranh giới Sáng – Tối) để kiểm chứng chiều tự quay ngược kim đồng hồ khi nhìn từ Cực Bắc.",
      "Thực hiện Hoạt động Khám phá bên dưới theo quy trình: Quan sát → Dự đoán → Thay đổi tham số → Giải thích.",
    ],
    cameraPresets: [
      { id: "equator-view", label: "Góc nhìn Xích đạo & Sáng-Tối", theta: 0.35, phi: 1.32, radius: 6.2 },
      { id: "north-pole", label: "Nhìn từ Cực Bắc (Ngược kim đồng hồ)", theta: 0.0, phi: 0.42, radius: 6.4 },
      { id: "sunrise-terminator", label: "Cận cảnh Bình minh (Việt Nam 105°Đ)", theta: 0.85, phi: 1.18, radius: 5.2 },
    ],
    learningActivities: [
      {
        id: "activity-earth-rotation-1",
        title: "Thí nghiệm 1: Giờ Mặt Trời mọc và chiều quay nhìn từ Cực Bắc",
        observePrompt:
          "Quan sát mốc đỏ Việt Nam (105°Đ) và chiều dịch chuyển của các lục địa qua vòng phân chia Sáng – Tối (Terminator).",
        predictQuestion:
          "Khi nhìn thẳng từ phía trên Cực Bắc xuống và so sánh Việt Nam (105°Đ) với Luân Đôn (0°), điều gì sẽ xảy ra khi Trái Đất tự quay?",
        predictions: [
          {
            id: "pred-a",
            label: "Trái Đất quay ngược chiều kim đồng hồ; Việt Nam bước vào nửa cầu sáng (đón bình minh) sớm hơn Luân Đôn 7 giờ.",
            isCorrect: true,
            feedback:
              "Chính xác! Vì Trái Đất tự quay từ Tây sang Đông nên khi nhìn từ Cực Bắc xuống sẽ thấy quay ngược chiều kim đồng hồ, và kinh tuyến 105°Đ ở phía Đông đón ánh sáng Mặt Trời sớm hơn kinh tuyến 0° đúng 7 giờ (105° / 15° = 7).",
          },
          {
            id: "pred-b",
            label: "Trái Đất quay cùng chiều kim đồng hồ; Luân Đôn đón bình minh sớm hơn Việt Nam.",
            isCorrect: false,
            feedback:
              "Chưa đúng! Tự quay từ Tây sang Đông tương ứng với chiều ngược kim đồng hồ khi nhìn từ Cực Bắc, và các địa điểm phía Đông (như Việt Nam) luôn thấy Mặt Trời mọc sớm hơn phía Tây.",
          },
          {
            id: "pred-c",
            label: "Mọi kinh tuyến đều đón bình minh cùng một thời điểm vì tia sáng Mặt Trời chiếu song song.",
            isCorrect: false,
            feedback:
              "Chưa đúng! Do Trái Đất hình cầu nên tia sáng song song chỉ chiếu sáng một nửa cầu tại mỗi thời điểm; kinh tuyến nào quay vào vùng sáng trước sẽ có bình minh trước.",
          },
        ],
        experimentActionLabel: "Áp dụng góc nhìn Cực Bắc & tốc độ 1.6x để kiểm chứng",
        experimentPreset: {
          hotspotId: "vietnam-meridian",
          speed: 1.6,
          showGridLines: true,
          isPaused: false,
          cameraPresetId: "north-pole",
        },
        resultSummary:
          "Trên mô hình 3D nhìn từ Cực Bắc, quả cầu quay ngược chiều kim đồng hồ (Tây sang Đông). Mốc Việt Nam (105°Đ) luôn vượt qua ranh giới tối – sáng trước khu vực châu Âu (0°).",
        scientificExplanation:
          "Bề mặt Trái Đất được chia thành 24 múi giờ, mỗi múi rộng 15° kinh tuyến. Việt Nam ở múi giờ GMT+7 nên có giờ địa phương sớm hơn giờ GMT 7 tiếng.",
      },
    ],
    hotspots: [
      {
        id: "axis-tilt",
        label: "Trục tự quay nghiêng 23°27'",
        shortTag: "Góc nghiêng 66°33' so với quỹ đạo",
        depthOrAltitudeLabel: "Cực Bắc – Cực Nam",
        temperatureOrStatLabel: "Chu kì: 24 giờ / vòng",
        summary:
          "Trục tưởng tượng nối Cực Bắc và Cực Nam nghiêng một góc không đổi 66°33' trên mặt phẳng quỹ đạo (tức lệch 23°27' so với đường vuông góc).",
        details: [
          "Hướng tự quay: Từ Tây sang Đông (ngược chiều kim đồng hồ nếu nhìn từ phía trên Cực Bắc xuống).",
          "Vận tốc góc đều ở mọi vĩ độ (15°/giờ), nhưng vận tốc dài giảm dần từ Xích đạo (464 m/s) về 0 m/s tại hai cực.",
        ],
        colorHex: "#f59e0b",
        svgPos: { x: 52, y: 18 },
      },
      {
        id: "terminator-line",
        label: "Vòng phân chia Sáng – Tối",
        shortTag: "Ranh giới Ngày & Đêm",
        depthOrAltitudeLabel: "Nửa cầu Sáng / Nửa cầu Tối",
        temperatureOrStatLabel: "Luân phiên 24h",
        summary:
          "Đường ranh giới giữa nửa cầu được Mặt Trời chiếu sáng (Ban ngày) và nửa cầu khuất bóng Mặt Trời (Ban đêm).",
        details: [
          "Khi một địa điểm đi qua ranh giới từ nửa tối sang nửa sáng là lúc Bình minh (Mặt Trời mọc).",
          "Khi đi từ nửa sáng sang nửa tối là lúc Hoàng hôn (Mặt Trời lặn).",
        ],
        colorHex: "#38bdf8",
        svgPos: { x: 48, y: 52 },
      },
      {
        id: "vietnam-meridian",
        label: "Việt Nam (Múi giờ GMT+7)",
        shortTag: "Kinh tuyến ~105°Đ, Vĩ độ 8°34'B–23°23'B",
        depthOrAltitudeLabel: "Bán cầu Bắc • Đông Nam Á",
        temperatureOrStatLabel: "Sớm hơn giờ GMT 7 tiếng",
        summary:
          "Lãnh thổ Việt Nam nằm trong múi giờ thứ 7 (GMT+7), đón ánh sáng Mặt Trời sớm hơn kinh tuyến gốc Greenwich (0°) 7 giờ đồng hồ.",
        details: [
          "Do nằm trong vùng nội chí tuyến bán cầu Bắc, Việt Nam có 2 lần Mặt Trời lên thiên đỉnh trong năm.",
          "Khi kinh tuyến 105°Đ hướng thẳng về phía Mặt Trời là thời điểm 12 giờ trưa.",
        ],
        colorHex: "#ef4444",
        svgPos: { x: 62, y: 44 },
      },
      {
        id: "coriolis-equator",
        label: "Xích đạo (0°) & Hệ quả lực Coriolis",
        shortTag: "Bắc lệch Phải • Nam lệch Trái",
        depthOrAltitudeLabel: "Vĩ tuyến 0° lớn nhất (40.076 km)",
        temperatureOrStatLabel: "Độ lệch tăng dần về 2 cực",
        summary:
          "Vận động tự quay sinh ra lực Coriolis làm lệch hướng gió thổi, dòng biển và vật chuyển động trên bề mặt Trái Đất.",
        details: [
          "Ở bán cầu Bắc: Vật chuyển động bị lệch về phía bên phải theo hướng chuyển động.",
          "Ở bán cầu Nam: Vật chuyển động bị lệch về phía bên trái theo hướng chuyển động.",
        ],
        colorHex: "#10b981",
        svgPos: { x: 35, y: 58 },
      },
    ],
  },
  {
    id: "earth-layers",
    slug: "earth-layers",
    title: "Cấu tạo bên trong Trái Đất",
    subtitle: "Góc cắt 3D đồng tâm: Vỏ Trái Đất, Manti trên, Manti dưới, Nhân ngoài và Nhân trong",
    chapterId: "geo10-kn-c02",
    lessonId: "geo10-kn-b04",
    lessonTitle: "Bài 4. Sự hình thành Trái Đất, vỏ Trái Đất và vật liệu cấu tạo vỏ Trái Đất",
    badge: "CHƯƠNG 2 • TRÁI ĐẤT",
    accentColor: "#f59e0b",
    description:
      "Khám phá mặt cắt không gian 3 chiều từ bề mặt xuống tâm Trái Đất ở độ sâu 6.371 km với sự phân dị rõ rệt về độ dày, trạng thái vật chất và nhiệt độ.",
    scientificSimulationNote:
      "Lưu ý mô phỏng khoa học (Mô phỏng không theo tỉ lệ thực tế): Trong thực tế, Vỏ Trái Đất rất mỏng (5–70 km, chưa tới 1,1% bán kính 6.371 km). Mô hình phóng đại tỉ lệ độ dày lớp Vỏ để học sinh có thể nhìn thấy và bấm chọn trực tiếp trên mặt cắt 3D.",
    keyTakeaways: [
      "Vỏ Trái Đất là lớp ngoài cùng rắn chắc nhưng rất mỏng (5 km ở đại dương đến 70 km ở núi cao lục địa), gồm đá trầm tích, granit và bazan.",
      "Lớp Manti (đến độ sâu 2.900 km) chiếm hơn 80% thể tích và 68% khối lượng Trái Đất; phần Manti trên có quyển mềm quánh dẻo.",
      "Nhân Trái Đất (2.900–6.371 km) gồm Nhân ngoài ở trạng thái lỏng và Nhân trong ở trạng thái rắn (nén chặt bởi áp suất cực lớn), thành phần chủ yếu là Sắt (Fe) và Niken (Ni).",
      "Càng vào sâu trong lòng Trái Đất, nhiệt độ và áp suất càng tăng cao (tại tâm đạt khoảng 5.000°C).",
    ],
    observationGuide: [
      "Bấm trực tiếp vào từng lớp vỏ cầu đồng tâm trên khung 3D (hoặc thanh nút) để làm sáng lớp đó và đọc thông số độ sâu, trạng thái vật chất.",
      "Kéo thanh trượt 'Độ tách lớp đồng tâm' từ 0% lên 85% để tách rời 5 lớp cấu tạo và quan sát các ranh giới chuyển tiếp.",
    ],
    cameraPresets: [
      { id: "cutaway-front", label: "Chính diện mặt cắt 90°", theta: 0.45, phi: 1.22, radius: 6.3 },
      { id: "core-closeup", label: "Cận cảnh Nhân ngoài & Nhân trong", theta: 0.25, phi: 1.3, radius: 4.6 },
      { id: "exploded-side", label: "Góc nghiêng tách lớp đồng tâm", theta: 0.85, phi: 1.08, radius: 6.8 },
    ],
    learningActivities: [
      {
        id: "activity-earth-layers-1",
        title: "Thí nghiệm 2: Vì sao Nhân ngoài hóa lỏng nhưng Nhân trong lại rắn đặc?",
        observePrompt:
          "Quan sát hai lớp trong cùng của mặt cắt Trái Đất: Nhân ngoài (2.900–5.100 km) và Nhân trong (5.100–6.371 km).",
        predictQuestion:
          "Khi tách lớp mặt cắt lên 85% và đi từ Nhân ngoài vào Nhân trong, nhiệt độ tăng lên ~5.000°C nhưng trạng thái vật chất thay đổi như thế nào?",
        predictions: [
          {
            id: "pred-layers-a",
            label: "Nhân ngoài ở trạng thái lỏng (sinh ra từ trường), còn Nhân trong lại ở trạng thái rắn đặc do áp suất nén cực đại tại tâm Trái Đất.",
            isCorrect: true,
            feedback:
              "Chính xác! Dù nhiệt độ tại Nhân trong đạt ~5.000°C, áp suất khổng lồ (hơn 3,6 triệu atm) ép chặt các nguyên tử Sắt – Niken khiến chúng không thể hóa lỏng.",
          },
          {
            id: "pred-layers-b",
            label: "Cả Nhân ngoài và Nhân trong đều ở trạng thái khí siêu nóng vì nhiệt độ vượt quá 4.000°C.",
            isCorrect: false,
            feedback:
              "Chưa đúng! Mật độ vật chất ở tâm Trái Đất cực kì lớn (kim loại nặng Fe, Ni); Nhân ngoài là chất lỏng, còn Nhân trong là chất rắn.",
          },
          {
            id: "pred-layers-c",
            label: "Nhân ngoài rắn chắc còn Nhân trong nóng chảy hoàn toàn.",
            isCorrect: false,
            feedback:
              "Ngược lại mới đúng! Sóng địa chấn ngang (sóng S) không truyền qua được Nhân ngoài chứng tỏ Nhân ngoài lỏng, nhưng sóng P tăng tốc ở Nhân trong chứng tỏ Nhân trong rắn.",
          },
        ],
        experimentActionLabel: "Tách lớp 85% & Chọn trực tiếp Nhân trong để kiểm chứng",
        experimentPreset: {
          hotspotId: "inner-core",
          explodeFactor: 0.85,
          cameraPresetId: "exploded-side",
        },
        resultSummary:
          "Khi tách lớp 85%, hạt nhân trong cùng (5.100–6.371 km) lộ rõ dưới dạng khối cầu kim loại rắn đặc được bao quanh bởi lớp Nhân ngoài lỏng chuyển động đối lưu.",
        scientificExplanation:
          "Trạng thái vật chất phụ thuộc đồng thời vào nhiệt độ và áp suất. Ở Nhân ngoài, nhiệt độ cao thắng áp suất nên Fe–Ni nóng chảy; ở Nhân trong, áp suất cực đại thắng nhiệt độ nên Fe–Ni kết tinh rắn.",
      },
    ],
    hotspots: [
      {
        id: "crust",
        label: "1. Vỏ Trái Đất (Lục địa & Đại dương)",
        shortTag: "Rắn chắc • Mỏng nhất",
        depthOrAltitudeLabel: "Độ dày: 5 km – 70 km",
        temperatureOrStatLabel: "Nhiệt độ tối đa ~ 1.000°C",
        summary:
          "Lớp vỏ cứng ngoài cùng của Trái Đất, nơi tồn tại địa hình lục địa, đáy đại dương và sự sống của con người.",
        details: [
          "Vỏ lục địa (dày 35–70 km): gồm 3 tầng đá trầm tích, đá granit và đá bazan.",
          "Vỏ đại dương (dày 5–10 km): chỉ có tầng trầm tích và bazan, không có tầng đá granit.",
        ],
        colorHex: "#0ea5e9",
        svgPos: { x: 76, y: 24 },
      },
      {
        id: "upper-mantle",
        label: "2. Manti trên (Quyển mềm)",
        shortTag: "Quánh dẻo • Dòng đối lưu",
        depthOrAltitudeLabel: "Độ sâu: Từ đáy vỏ đến 700 km",
        temperatureOrStatLabel: "Nhiệt độ: 1.000°C – 1.500°C",
        summary:
          "Phần trên cùng của Manti gắn với vỏ tạo thành Thạch quyển; bên dưới là quyển mềm ở trạng thái quánh dẻo.",
        details: [
          "Sự chênh lệch nhiệt độ tạo ra các dòng đối lưu vật chất trong quyển mềm.",
          "Đây chính là nguồn động lực làm dịch chuyển các mảng kiến tạo trên bề mặt Trái Đất.",
        ],
        colorHex: "#f97316",
        svgPos: { x: 68, y: 36 },
      },
      {
        id: "lower-mantle",
        label: "3. Manti dưới",
        shortTag: "Trạng thái rắn",
        depthOrAltitudeLabel: "Độ sâu: 700 km – 2.900 km",
        temperatureOrStatLabel: "Nhiệt độ: 1.500°C – 3.700°C",
        summary:
          "Phần dưới của bao Manti chịu áp suất rất lớn nên vật chất duy trì ở trạng thái rắn chắc.",
        details: [
          "Cùng với Manti trên, toàn bộ lớp Manti chiếm tới hơn 80% thể tích của Trái Đất.",
          "Thành phần chủ yếu là các khoáng vật giàu magie và sắt.",
        ],
        colorHex: "#dc2626",
        svgPos: { x: 60, y: 48 },
      },
      {
        id: "outer-core",
        label: "4. Nhân ngoài (Outer Core)",
        shortTag: "Trạng thái lỏng (Fe - Ni)",
        depthOrAltitudeLabel: "Độ sâu: 2.900 km – 5.100 km",
        temperatureOrStatLabel: "Nhiệt độ: ~ 3.700°C – 4.500°C",
        summary:
          "Lớp nhân ngoài chứa hợp kim Sắt (Fe) và Niken (Ni) ở trạng thái lỏng nóng chảy chuyển động liên tục.",
        details: [
          "Sự chuyển động đối lưu của kim loại lỏng trong Nhân ngoài sinh ra từ trường bảo vệ Trái Đất khỏi bức xạ vũ trụ.",
        ],
        colorHex: "#facc15",
        svgPos: { x: 52, y: 58 },
      },
      {
        id: "inner-core",
        label: "5. Nhân trong (Inner Core)",
        shortTag: "Trạng thái rắn đặc (Hạt nhân)",
        depthOrAltitudeLabel: "Độ sâu: 5.100 km – 6.371 km",
        temperatureOrStatLabel: "Nhiệt độ: ~ 5.000°C • Áp suất cực đại",
        summary:
          "Tâm điểm của Trái Đất; dù nhiệt độ lên tới khoảng 5.000°C nhưng do áp suất cực lớn nên vật chất nén chặt ở trạng thái rắn.",
        details: [
          "Bán kính nhân trong khoảng 1.270 km, cấu tạo chủ yếu bởi kim loại nặng Sắt và Niken.",
        ],
        colorHex: "#fef08a",
        svgPos: { x: 44, y: 66 },
      },
    ],
  },
  {
    id: "plate-tectonics",
    slug: "plate-tectonics",
    title: "Kiến tạo mảng và núi lửa",
    subtitle: "Tương tác các mảng thạch quyển: Hút chìm tạo núi lửa, Tách giãn và Trượt ngang",
    chapterId: "geo10-kn-c03",
    lessonId: "geo10-kn-b06",
    lessonTitle: "Bài 6, 7 & 8. Thạch quyển, thuyết kiến tạo mảng, Nội lực & Vành đai núi lửa",
    badge: "CHƯƠNG 3 • THẠCH QUYỂN",
    accentColor: "#ef4444",
    description:
      "Mô phỏng trực quan 3 kiểu ranh giới mảng kiến tạo trên quyển mềm: hội tụ hút chìm một chiều tạo vực biển sâu & cung núi lửa, phân kì tách giãn tạo sống núi ngầm, và đứt gãy trượt ngang tích tụ ứng suất địa chấn.",
    scientificSimulationNote:
      "Lưu ý mô phỏng khoa học (Mô phỏng không theo tỉ lệ thực tế): Tốc độ dịch chuyển thực tế của các mảng kiến tạo chỉ từ 1–10 cm/năm. Mô hình giản lược hóa mặt cắt địa chất và thể hiện đúng chiều vận động một chiều của mảng (không lắc qua lại sai bản chất vật lí).",
    keyTakeaways: [
      "Thạch quyển gồm các mảng kiến tạo lớn nhỏ nổi trên quyển mềm và dịch chuyển do dòng đối lưu nhiệt trong Manti.",
      "Tiếp xúc hội tụ (xô vào nhau): Mảng đại dương nặng hơn bị hút chìm liên tục dưới mảng lục địa, tạo vực biển sâu, dãy núi uốn nếp và cung núi lửa phun trào.",
      "Tiếp xúc phân kì (tách xa nhau): Hai mảng tách giãn về hai phía, magma từ Manti dâng lên kết tinh tạo vỏ đại dương mới và sống núi ngầm.",
      "Tiếp xúc trượt ngang: Hai mảng trượt ngược chiều dọc đứt gãy kiến tạo, tích tụ biến dạng đàn hồi và giải phóng đột ngột gây động đất.",
    ],
    observationGuide: [
      "Chuyển đổi giữa 3 chế độ ranh giới mảng: 'Hội tụ', 'Phân kì' và 'Trượt ngang' để so sánh hướng dịch chuyển một chiều và hệ quả địa hình.",
      "Bấm trực tiếp vào mảng đại dương hút chìm, núi lửa phun trào, quyển mềm Manti hoặc đứt gãy trên mô hình 3D để xem cơ chế nhân quả.",
    ],
    cameraPresets: [
      { id: "tectonic-cross", label: "Mặt cắt địa chất trực diện", theta: 0.18, phi: 1.25, radius: 6.3 },
      { id: "volcano-trench", label: "Cận cảnh Rãnh sâu & Núi lửa", theta: 0.55, phi: 1.05, radius: 5.2 },
      { id: "fault-top", label: "Góc nhìn từ trên xuống (Đứt gãy)", theta: 0.05, phi: 0.58, radius: 6.6 },
    ],
    learningActivities: [
      {
        id: "activity-plate-tectonics-1",
        title: "Thí nghiệm 3: So sánh hệ quả địa chất giữa Ranh giới Hội tụ và Phân kì",
        observePrompt:
          "Đang ở chế độ Hội tụ (mảng đại dương chúi xuống dưới mảng lục địa). Hãy dự đoán điều gì xảy ra khi chuyển sang chế độ Phân kì (hai nhánh đối lưu Manti tách sang hai bên).",
        predictQuestion:
          "Khi chuyển tham số ranh giới mảng từ 'Hội tụ' sang 'Phân kì (Tách giãn đáy biển)', địa hình và hoạt động magma thay đổi như thế nào?",
        predictions: [
          {
            id: "pred-tec-a",
            label: "Hai mảng tách xa nhau về hai phía; magma từ quyển mềm dâng lên lấp đầy khe nứt ở giữa tạo sống núi ngầm đại dương thay vì hút chìm.",
            isCorrect: true,
            feedback:
              "Chính xác! Ở ranh giới phân kì (như sống núi giữa Đại Tây Dương), hai mảng tách giãn liên tục giúp magma bazan trào lên kiến tạo vỏ đại dương mới.",
          },
          {
            id: "pred-tec-b",
            label: "Mảng lục địa bị hút chìm sâu xuống dưới mảng đại dương tạo vực biển sâu.",
            isCorrect: false,
            feedback:
              "Chưa đúng! Hút chìm chỉ xảy ra ở ranh giới hội tụ, và mảng đại dương (nặng hơn) mới bị hút chìm dưới mảng lục địa.",
          },
          {
            id: "pred-tec-c",
            label: "Hai mảng chỉ trượt ngang qua nhau và hoàn toàn không có magma dâng lên.",
            isCorrect: false,
            feedback:
              "Đó là đặc điểm của ranh giới trượt ngang (như đứt gãy San Andreas), không phải ranh giới phân kì tách giãn.",
          },
        ],
        experimentActionLabel: "Chuyển sang chế độ '2. Phân kì (Tách giãn)' để kiểm chứng",
        experimentPreset: {
          tectonicMode: "divergent",
          hotspotId: "mantle-convection",
          isPaused: false,
          cameraPresetId: "tectonic-cross",
        },
        resultSummary:
          "Khi chuyển sang chế độ Phân kì, hai mảng thạch quyển dịch chuyển rời xa nhau về hai phía trái – phải; dòng magma đỏ rực dâng thẳng lên khe tách giãn ở chính giữa tạo sống núi ngầm.",
        scientificExplanation:
          "Hướng của hai nhánh dòng đối lưu nhiệt trong quyển mềm Manti quyết định kiểu ranh giới mảng: hai nhánh chụm vào nhau gây hút chìm (hội tụ); hai nhánh tản ra hai bên gây tách giãn (phân kì).",
      },
    ],
    hotspots: [
      {
        id: "subduction-zone",
        label: "Đới hút chìm & Vực biển sâu",
        shortTag: "Tiếp xúc hội tụ",
        depthOrAltitudeLabel: "Rãnh đại dương sâu > 6.000 m",
        temperatureOrStatLabel: "Ma sát địa chấn lớn",
        summary:
          "Khi mảng đại dương (nặng, mỏng) xô vào mảng lục địa (nhẹ, dày), mảng đại dương bị uốn cong và chúi sâu xuống dưới quyển mềm.",
        details: [
          "Tại nơi tiếp giáp hình thành các vực biển sâu (như vực Mariana, vực Nhật Bản).",
          "Quá trình hút chìm gây ma sát lớn tạo ra các trận động đất sâu và mạnh.",
        ],
        colorHex: "#0284c7",
        svgPos: { x: 38, y: 48 },
      },
      {
        id: "magma-volcano",
        label: "Buồng Magma & Cung núi lửa lục địa",
        shortTag: "Phun trào dung nham",
        depthOrAltitudeLabel: "Nóng chảy ở độ sâu ~100 km",
        temperatureOrStatLabel: "Magma: 700°C – 1.300°C",
        summary:
          "Phần mảng đại dương bị hút chìm vào Manti gặp nhiệt độ cao sẽ nóng chảy thành magma, dâng lên xuyên qua vỏ lục địa tạo núi lửa.",
        details: [
          "Giải thích vì sao Vành đai lửa Thái Bình Dương tập trung tới hơn 75% số núi lửa đang hoạt động trên Trái Đất.",
        ],
        colorHex: "#ef4444",
        svgPos: { x: 66, y: 26 },
      },
      {
        id: "mantle-convection",
        label: "Dòng đối lưu nhiệt trong Quyển mềm",
        shortTag: "Động lực nội lực",
        depthOrAltitudeLabel: "Tầng Manti trên (100–700 km)",
        temperatureOrStatLabel: "Tốc độ mảng: 1–10 cm/năm",
        summary:
          "Vật chất nóng ở sâu dâng lên, nguội đi rồi tỏa sang hai bên và chìm xuống tạo thành dòng đối lưu kéo mảng thạch quyển di chuyển.",
        details: [
          "Nếu hai nhánh đối lưu đi ngược vào nhau sẽ kéo hai mảng xô húc (hội tụ).",
          "Nếu hai nhánh đối lưu tách ra hai phía sẽ kéo hai mảng tách giãn (phân kì).",
        ],
        colorHex: "#f97316",
        svgPos: { x: 50, y: 76 },
      },
      {
        id: "transform-fault",
        label: "Đứt gãy kiến tạo & Tâm chấn động đất",
        shortTag: "Nội lực uốn nếp / đứt gãy",
        depthOrAltitudeLabel: "Tâm chấn trong thạch quyển",
        temperatureOrStatLabel: "Giải phóng năng lượng đột ngột",
        summary:
          "Tại các ranh giới trượt ngang hoặc đới hút chìm, đá bị nén ép vượt giới hạn đàn hồi sẽ trượt đứt đột ngột phát ra sóng địa chấn.",
        details: [
          "Nơi phát sinh động đất trong lòng đất gọi là Tiêu chấn; điểm chiếu vuông góc lên mặt đất gọi là Tâm chấn.",
        ],
        colorHex: "#eab308",
        svgPos: { x: 24, y: 58 },
      },
    ],
  },
  {
    id: "atmosphere-layers",
    slug: "atmosphere-layers",
    title: "Các tầng khí quyển",
    subtitle: "5 tầng cấu trúc khí quyển từ mặt đất lên vũ trụ và vai trò của lớp Ôdôn",
    chapterId: "geo10-kn-c04",
    lessonId: "geo10-kn-b09",
    lessonTitle: "Bài 9. Khí quyển, các yếu tố khí hậu",
    badge: "CHƯƠNG 4 • KHÍ QUYỂN",
    accentColor: "#06b6d4",
    description:
      "Quan sát cột cắt không gian 3D của 5 tầng khí quyển (Đối lưu, Bình lưu, Tầng giữa, Tầng nhiệt, Tầng ngoài) phía trên bề mặt địa hình Trái Đất cùng các hiện tượng mây mưa, lá chắn Ôdôn, sao băng, cực quang và vệ tinh.",
    scientificSimulationNote:
      "Lưu ý mô phỏng khoa học (Mô phỏng không theo tỉ lệ thực tế): Độ dày các tầng trên cao (tầng nhiệt 80–800 km, tầng ngoài >800 km) lớn gấp hàng chục lần tầng đối lưu (0–16 km). Mô hình sử dụng thang độ cao nén phi tuyến để học sinh quan sát rõ cả 5 tầng và các hiện tượng đặc trưng trong cùng một khung nhìn.",
    keyTakeaways: [
      "Tầng đối lưu (0–16 km): Tập trung ~80% khối lượng không khí và hầu hết hơi nước; nhiệt độ giảm 0,6°C khi lên cao 100 m; nơi sinh ra mây, mưa, gió, bão.",
      "Tầng bình lưu (16–50 km): Không khí khô, chuyển động ngang; chứa lớp Ôdôn (22–25 km) hấp thụ tia tử ngoại từ Mặt Trời làm nhiệt độ tăng theo độ cao.",
      "Tầng giữa (50–80 km): Nhiệt độ giảm mạnh xuống tới -90°C; các thiên thạch từ vũ trụ bay vào thường bốc cháy ở tầng này.",
      "Tầng nhiệt / Ion (80–800 km) & Tầng ngoài (>800 km): Chứa các hạt ion phản xạ sóng vô tuyến, hiện tượng cực quang và quỹ đạo vệ tinh.",
    ],
    observationGuide: [
      "Bấm trực tiếp vào từng tầng khí quyển trên cột không gian 3D để làm nổi bật tầng đó và quan sát hiện tượng đặc trưng bên trong.",
      "Thực hiện Hoạt động Khám phá để so sánh quy luật nhiệt độ nghịch đảo giữa Tầng đối lưu và Tầng bình lưu.",
    ],
    cameraPresets: [
      { id: "full-column", label: "Toàn cảnh 5 tầng khí quyển", theta: 0.42, phi: 1.24, radius: 7.2 },
      { id: "lower-weather", label: "Cận cảnh Đối lưu & Lớp Ôdôn", theta: 0.28, phi: 1.38, radius: 5.5 },
      { id: "upper-aurora", label: "Tầng cao: Sao băng, Cực quang & Vệ tinh", theta: 0.65, phi: 0.98, radius: 5.8 },
    ],
    learningActivities: [
      {
        id: "activity-atmosphere-1",
        title: "Thí nghiệm 4: Nghịch lý nhiệt độ giữa Tầng đối lưu và Tầng bình lưu",
        observePrompt:
          "Ở Tầng đối lưu (0–16 km), càng lên cao nhiệt độ càng giảm (trung bình giảm 0,6°C mỗi 100 m). Hãy dự đoán quy luật nhiệt độ khi bước sang Tầng bình lưu (16–50 km).",
        predictQuestion:
          "Vì sao khi lên tới Tầng bình lưu (16–50 km), nhiệt độ không khí không tiếp tục giảm mà lại TĂNG dần theo độ cao?",
        predictions: [
          {
            id: "pred-atm-a",
            label: "Vì lớp Ôdôn (O₃) ở độ cao 22–25 km hấp thụ mạnh tia tử ngoại (UV) từ bức xạ Mặt Trời và tỏa nhiệt làm nóng không khí.",
            isCorrect: true,
            feedback:
              "Chính xác! Lớp Ôdôn vừa là lá chắn bảo vệ sự sống khỏi tia UV, vừa giữ nhiệt làm nhiệt độ Tầng bình lưu tăng từ khoảng -55°C lên gần 0°C ở đỉnh tầng (50 km).",
          },
          {
            id: "pred-atm-b",
            label: "Vì Tầng bình lưu chứa nhiều mây dông và hơi nước ngưng tụ tỏa nhiệt.",
            isCorrect: false,
            feedback:
              "Chưa đúng! Hầu hết hơi nước và mây mưa tập trung ở Tầng đối lưu; không khí ở Tầng bình lưu rất khô và chuyển động theo chiều ngang.",
          },
          {
            id: "pred-atm-c",
            label: "Vì ma sát của các thiên thạch bốc cháy làm nóng Tầng bình lưu.",
            isCorrect: false,
            feedback:
              "Chưa đúng! Hiện tượng thiên thạch ma sát bốc cháy (sao băng) diễn ra chủ yếu ở Tầng giữa (50–80 km), nơi lạnh nhất khí quyển (-90°C).",
          },
        ],
        experimentActionLabel: "Chọn Tầng bình lưu & Cận cảnh Lớp Ôdôn (22–25 km)",
        experimentPreset: {
          hotspotId: "stratosphere",
          cameraPresetId: "lower-weather",
        },
        resultSummary:
          "Trên mô hình 3D, Tầng bình lưu (16–50 km) nổi bật với vòng lá chắn Ôdôn màu ngọc bích ở độ cao 22–25 km phía trên trần mây đối lưu.",
        scientificExplanation:
          "Tầng đối lưu nhận nhiệt chủ yếu từ bề mặt Trái Đất bức xạ lên nên càng xa mặt đất càng lạnh. Ngược lại, Tầng bình lưu được sưởi ấm trực tiếp từ trên xuống nhờ phân tử O₃ hấp thụ bức xạ tử ngoại Mặt Trời.",
      },
    ],
    hotspots: [
      {
        id: "troposphere",
        label: "1. Tầng đối lưu (0 – 16 km)",
        shortTag: "80% khối lượng khí • Mây & Mưa",
        depthOrAltitudeLabel: "Độ cao: 0–8 km (Cực) đến 0–16 km (Xích đạo)",
        temperatureOrStatLabel: "Giảm 0,6°C / 100 m lên cao",
        summary:
          "Tầng thấp nhất sát mặt đất, tập trung tới 80% khối lượng không khí và hầu hết hơi nước, bụi khí quyển.",
        details: [
          "Không khí chuyển động mạnh theo chiều thẳng đứng (đối lưu).",
          "Nơi diễn ra mọi hiện tượng thời tiết quen thuộc: mây, mưa, sương mù, sấm chớp, bão.",
        ],
        colorHex: "#38bdf8",
        svgPos: { x: 50, y: 82 },
      },
      {
        id: "stratosphere",
        label: "2. Tầng bình lưu & Lớp Ôdôn (16 – 50 km)",
        shortTag: "Lá chắn tia tử ngoại UV",
        depthOrAltitudeLabel: "Độ cao: Từ đỉnh đối lưu đến ~50 km",
        temperatureOrStatLabel: "Lớp Ôdôn tập trung ở 22 – 25 km",
        summary:
          "Không khí loãng, khô và chuyển động chủ yếu theo chiều ngang (rất thuận lợi cho máy bay phản lực đường dài).",
        details: [
          "Lớp khí Ôdôn (O₃) ở độ cao 22–25 km hấp thụ phần lớn tia tử ngoại (UV) từ Mặt Trời, bảo vệ sinh vật trên Trái Đất.",
          "Do Ôdôn hấp thụ bức xạ Mặt Trời nên nhiệt độ tầng này tăng dần theo độ cao (lên khoảng 0°C ở đỉnh tầng).",
        ],
        colorHex: "#10b981",
        svgPos: { x: 50, y: 64 },
      },
      {
        id: "mesosphere",
        label: "3. Tầng giữa (50 – 80 km)",
        shortTag: "Đốt cháy thiên thạch (Sao băng)",
        depthOrAltitudeLabel: "Độ cao: 50 km – 80 km",
        temperatureOrStatLabel: "Nhiệt độ hạ thấp tới -90°C",
        summary:
          "Nhiệt độ giảm mạnh theo độ cao, đạt mức lạnh nhất trong khí quyển (khoảng -80°C đến -90°C) ở đỉnh tầng.",
        details: [
          "Hầu hết các thiên thạch nhỏ từ ngoài không gian khi lao vào Trái Đất đều bị ma sát và bốc cháy tại tầng này tạo thành hiện tượng sao băng.",
        ],
        colorHex: "#60a5fa",
        svgPos: { x: 50, y: 46 },
      },
      {
        id: "thermosphere",
        label: "4. Tầng nhiệt / Tầng Ion (80 – 800 km)",
        shortTag: "Phản xạ sóng vô tuyến • Cực quang",
        depthOrAltitudeLabel: "Độ cao: 80 km – 800 km",
        temperatureOrStatLabel: "Chứa nhiều ion mang điện",
        summary:
          "Không khí cực loãng, các phân tử khí bị bức xạ Mặt Trời ion hóa mạnh tạo thành các hạt mang điện (ion).",
        details: [
          "Tầng này có khả năng phản xạ sóng vô tuyến truyền từ mặt đất, đóng vai trò quan trọng trong thông tin liên lạc.",
          "Nơi xuất hiện hiện tượng Cực quang rực rỡ ở vùng vĩ độ cao.",
        ],
        colorHex: "#a855f7",
        svgPos: { x: 50, y: 28 },
      },
      {
        id: "exosphere",
        label: "5. Tầng ngoài (Trên 800 km)",
        shortTag: "Tiếp giáp khoảng không vũ trụ",
        depthOrAltitudeLabel: "Độ cao: 800 km – 10.000 km",
        temperatureOrStatLabel: "Khí nhẹ Hydro (H) & Heli (He)",
        summary:
          "Lớp ngoài cùng của khí quyển chuyển tiếp vào vũ trụ; không khí vô cùng loãng, chủ yếu là các nguyên tử khí nhẹ.",
        details: [
          "Nhiều vệ tinh viễn thông, vệ tinh khí tượng và định vị hoạt động trên các quỹ đạo thuộc tầng này.",
        ],
        colorHex: "#f59e0b",
        svgPos: { x: 50, y: 12 },
      },
    ],
  },
];

export function getLab3DModelById(id: string | undefined): Lab3DModelConfig | undefined {
  return LAB3D_MODELS.find((m) => m.id === id);
}
