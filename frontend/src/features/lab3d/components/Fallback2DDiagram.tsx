import type { Lab3DHotspot, Lab3DModelConfig, TectonicBoundaryMode } from "../types";

export function Fallback2DDiagram({
  model,
  activeHotspotId,
  onSelectHotspot,
  tectonicMode = "convergent",
  explodeFactor = 0,
}: {
  model: Lab3DModelConfig;
  activeHotspotId: string;
  onSelectHotspot: (id: string) => void;
  tectonicMode?: TectonicBoundaryMode;
  explodeFactor?: number;
}) {
  return (
    <div
      className="relative h-[380px] w-full overflow-hidden rounded-2xl bg-[#090f1e] sm:h-[460px]"
      data-testid="lab3d-2d-fallback"
    >
      {model.id === "earth-rotation" && (
        <svg
          viewBox="0 0 700 420"
          className="h-full w-full"
          role="img"
          aria-label="Sơ đồ 2D Trái Đất tự quay quanh trục nghiêng và hiện tượng Ngày - Đêm"
        >
          {/* Tia sáng Mặt Trời từ bên phải */}
          {[90, 150, 210, 270, 330].map((y) => (
            <g key={y}>
              <line
                x1="670"
                y1={y}
                x2="495"
                y2={y}
                stroke="#fde047"
                strokeWidth="3"
                strokeDasharray="8 6"
              />
              <polygon points={`495,${y} 507,${y - 5} 507,${y + 5}`} fill="#fde047" />
            </g>
          ))}
          <text x="605" y="55" textAnchor="middle" fill="#fde047" fontSize="14" fontWeight="bold">
            Tia sáng Mặt Trời
          </text>

          {/* Pháp tuyến thẳng đứng */}
          <line
            x1="330"
            y1="35"
            x2="330"
            y2="385"
            stroke="#64748b"
            strokeWidth="2"
            strokeDasharray="5 5"
          />

          {/* Khối cầu Trái Đất */}
          <circle cx="330" cy="210" r="130" fill="#0284c7" />
          {/* Lục địa */}
          <path
            d="M275 135 Q325 120 355 155 Q385 185 365 235 Q335 260 295 240 Z"
            fill="#10b981"
          />
          <circle cx="378" cy="178" r="6" fill="#ef4444" />
          {/* Nửa cầu đêm (bên trái) */}
          <path
            d="M330 80 A130 130 0 0 0 330 340 Z"
            fill="#020617"
            fillOpacity="0.72"
          />
          {/* Đường phân chia sáng - tối */}
          <line x1="330" y1="80" x2="330" y2="340" stroke="#38bdf8" strokeWidth="3" />

          {/* Trục nghiêng 23°27' */}
          <line x1="395" y1="52" x2="265" y2="368" stroke="#f59e0b" strokeWidth="4" />
          <text x="415" y="55" fill="#f59e0b" fontSize="14" fontWeight="bold">
            Cực Bắc (23°27')
          </text>
          <text x="220" y="388" fill="#f59e0b" fontSize="14" fontWeight="bold">
            Cực Nam
          </text>

          {/* Xích đạo nghiêng */}
          <line
            x1="210"
            y1="160"
            x2="450"
            y2="260"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeDasharray="6 4"
          />
          <text x="150" y="130" fill="#94a3b8" fontSize="14" fontWeight="bold">
            BAN ĐÊM
          </text>
          <text x="455" y="130" fill="#fde047" fontSize="14" fontWeight="bold">
            BAN NGÀY
          </text>
        </svg>
      )}

      {model.id === "earth-layers" && (
        <svg
          viewBox="0 0 700 420"
          className="h-full w-full"
          role="img"
          aria-label="Sơ đồ mặt cắt đồng tâm cấu tạo bên trong Trái Đất"
        >
          <g transform={`translate(${-explodeFactor * 15}, 0)`}>
            {/* 1. Vỏ Trái Đất */}
            <circle cx="320" cy="215" r="165" fill="#0ea5e9" stroke="#38bdf8" strokeWidth="4" />
            {/* 2. Manti trên */}
            <circle cx="320" cy="215" r="145" fill="#f97316" />
            {/* 3. Manti dưới */}
            <circle cx="320" cy="215" r="112" fill="#dc2626" />
            {/* 4. Nhân ngoài */}
            <circle cx="320" cy="215" r="76" fill="#facc15" />
            {/* 5. Nhân trong */}
            <circle cx="320" cy="215" r="38" fill="#fef08a" />
          </g>
          <text x="320" y="220" textAnchor="middle" fill="#0f172a" fontSize="12" fontWeight="bold">
            Nhân trong
          </text>
          <text x="320" y="398" textAnchor="middle" fill="#e2e8f0" fontSize="14" fontWeight="bold">
            Bán kính Trái Đất: 6.371 km (Nhiệt độ tâm ~ 5.000°C)
          </text>
        </svg>
      )}

      {model.id === "plate-tectonics" && (
        <svg
          viewBox="0 0 700 420"
          className="h-full w-full"
          role="img"
          aria-label="Sơ đồ tương tác mảng kiến tạo và núi lửa"
        >
          {/* Quyển mềm Manti */}
          <rect x="40" y="245" width="620" height="135" rx="16" fill="#c2410c" />
          <text x="350" y="355" textAnchor="middle" fill="#ffedd5" fontSize="15" fontWeight="bold">
            QUYỂN MỀM (MANTI TRÊN) — DÒNG ĐỐI LƯU NHIỆT
          </text>

          {tectonicMode === "convergent" && (
            <>
              {/* Mảng đại dương hút chìm bên trái */}
              <path d="M40 165 L290 185 L430 295 L410 325 L265 225 L40 215 Z" fill="#475569" />
              <rect x="40" y="130" width="235" height="40" fill="#0284c7" opacity="0.8" />
              {/* Mảng lục địa + núi lửa bên phải */}
              <path
                d="M275 185 L380 120 L445 70 L505 130 L660 135 L660 245 L275 245 Z"
                fill="#15803d"
              />
              {/* Buồng magma phun trào */}
              <path d="M435 280 L445 70" stroke="#ef4444" strokeWidth="12" strokeLinecap="round" />
              <circle cx="445" cy="60" r="18" fill="#ef4444" />
              <text x="350" y="38" textAnchor="middle" fill="#fde047" fontSize="16" fontWeight="bold">
                Ranh giới Hội tụ: Mảng đại dương hút chìm tạo vực sâu &amp; núi lửa lục địa
              </text>
            </>
          )}

          {tectonicMode === "divergent" && (
            <>
              <rect x="40" y="160" width="275" height="85" fill="#475569" />
              <rect x="385" y="160" width="275" height="85" fill="#475569" />
              <path d="M350 290 L350 145" stroke="#ef4444" strokeWidth="18" strokeLinecap="round" />
              <text x="350" y="45" textAnchor="middle" fill="#fde047" fontSize="16" fontWeight="bold">
                Ranh giới Phân kì: Hai mảng tách xa nhau, magma dâng lên tạo sống núi ngầm
              </text>
            </>
          )}

          {tectonicMode === "transform" && (
            <>
              <rect x="60" y="145" width="285" height="100" fill="#0f766e" />
              <rect x="355" y="165" width="285" height="100" fill="#15803d" />
              <line x1="350" y1="120" x2="350" y2="280" stroke="#fde047" strokeWidth="5" />
              <circle cx="350" cy="200" r="28" fill="none" stroke="#ef4444" strokeWidth="3" />
              <circle cx="350" cy="200" r="48" fill="none" stroke="#ef4444" strokeWidth="2" />
              <text x="350" y="45" textAnchor="middle" fill="#fde047" fontSize="16" fontWeight="bold">
                Ranh giới Trượt ngang: Hai mảng trượt dọc đứt gãy gây chấn động địa chấn
              </text>
            </>
          )}
        </svg>
      )}

      {model.id === "atmosphere-layers" && (
        <svg
          viewBox="0 0 700 420"
          className="h-full w-full"
          role="img"
          aria-label="Sơ đồ 5 tầng khí quyển của Trái Đất"
        >
          <rect x="70" y="20" width="560" height="65" rx="8" fill="#0f172a" stroke="#f59e0b" />
          <rect x="70" y="92" width="560" height="68" rx="8" fill="#1e1b4b" stroke="#a855f7" />
          <rect x="70" y="168" width="560" height="68" rx="8" fill="#1e3a8a" stroke="#60a5fa" />
          <rect x="70" y="244" width="560" height="72" rx="8" fill="#065f46" stroke="#10b981" />
          <rect x="70" y="324" width="560" height="74" rx="8" fill="#0284c7" stroke="#38bdf8" />

          <text x="95" y="58" fill="#fde047" fontSize="15" fontWeight="bold">
            5. Tầng ngoài (&gt; 800 km) • Vệ tinh nhân tạo
          </text>
          <text x="95" y="132" fill="#e9d5ff" fontSize="15" fontWeight="bold">
            4. Tầng nhiệt / Ion (80 – 800 km) • Phản xạ sóng vô tuyến &amp; Cực quang
          </text>
          <text x="95" y="208" fill="#bae6fd" fontSize="15" fontWeight="bold">
            3. Tầng giữa (50 – 80 km) • Lạnh tới -90°C, đốt cháy thiên thạch
          </text>
          <text x="95" y="285" fill="#a7f3d0" fontSize="15" fontWeight="bold">
            2. Tầng bình lưu (16 – 50 km) • Lớp Ôdôn (22–25 km) ngăn tia UV
          </text>
          <text x="95" y="366" fill="#ffffff" fontSize="15" fontWeight="bold">
            1. Tầng đối lưu (0 – 16 km) • 80% không khí, mây mưa, giảm 0,6°C/100m
          </text>
        </svg>
      )}

      {/* Các nút Hotspot tương tác đè lên sơ đồ */}
      <div className="pointer-events-none absolute inset-0">
        {model.hotspots.map((spot: Lab3DHotspot, index: number) => {
          const isSelected = spot.id === activeHotspotId;
          return (
            <button
              key={spot.id}
              type="button"
              onClick={() => onSelectHotspot(spot.id)}
              style={{
                left: `${spot.svgPos.x}%`,
                top: `${spot.svgPos.y}%`,
              }}
              aria-label={`Chọn chú thích: ${spot.label}`}
              aria-pressed={isSelected}
              className={`pointer-events-auto -translate-x-1/2 -translate-y-1/2 absolute flex min-h-9 items-center gap-1.5 rounded-full border-2 px-3 py-1 text-xs font-extrabold shadow-lg transition ${
                isSelected
                  ? "scale-105 border-white bg-[#f59e0b] text-[#0f1e36]"
                  : "border-white/50 bg-[#0f1e36]/90 text-white hover:border-amber"
              }`}
            >
              <span className="grid size-5 place-items-center rounded-full bg-black/25 text-[11px]">
                {index + 1}
              </span>
              <span className="hidden sm:inline">{spot.label.split("(")[0].trim()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
