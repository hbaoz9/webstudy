import type { WordCatchPuzzle, WordIllustrationKind, WordPuzzleVisualClue } from "../types";
import { GEO10_WORD_PUZZLES } from "../data/geo10GameQuestions";

function renderClueMotifSvg(motif: WordPuzzleVisualClue["motif"], accentHex: string) {
  switch (motif) {
    case "sun-summer":
      return (
        <svg viewBox="0 0 120 90" className="h-24 w-full" aria-hidden="true">
          <defs>
            <radialGradient id="sunGlow" cx="50%" cy="40%" r="50%">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="100%" stopColor="#f97316" stopOpacity="0.15" />
            </radialGradient>
          </defs>
          <circle cx="60" cy="36" r="28" fill="url(#sunGlow)" />
          <circle cx="60" cy="36" r="15" fill="#facc15" stroke="#ea580c" strokeWidth="2" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <line
              key={deg}
              x1="60"
              y1="14"
              x2="60"
              y2="6"
              stroke="#f59e0b"
              strokeWidth="3"
              strokeLinecap="round"
              transform={`rotate(${deg} 60 36)`}
            />
          ))}
          <path d="M10 68 Q35 52 60 66 T110 64 L110 86 L10 86 Z" fill="#0284c7" opacity="0.85" />
          <path d="M10 62 L32 45 L46 62 Z" fill="#ca8a04" />
        </svg>
      );

    case "dragon-islands":
      return (
        <svg viewBox="0 0 120 90" className="h-24 w-full" aria-hidden="true">
          <path
            d="M18 48 C30 20, 52 18, 64 38 C76 58, 92 22, 105 26"
            fill="none"
            stroke="#fbbf24"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <circle cx="105" cy="26" r="6" fill="#f59e0b" />
          <polygon points="109,22 118,18 112,29" fill="#ef4444" />
          <path d="M16 74 L32 44 L48 74 Z" fill="#0f766e" />
          <path d="M52 74 L70 36 L88 74 Z" fill="#115e59" />
          <path d="M80 74 L94 48 L108 74 Z" fill="#0d9488" />
          <rect x="8" y="72" width="104" height="10" rx="4" fill="#0ea5e9" />
        </svg>
      );

    case "rock-crystal":
      return (
        <svg viewBox="0 0 120 90" className="h-24 w-full" aria-hidden="true">
          <polygon points="60,12 86,34 76,76 44,76 34,34" fill="#d97706" stroke="#fef3c7" strokeWidth="2" />
          <polygon points="60,12 86,34 60,48" fill="#f59e0b" />
          <polygon points="60,12 34,34 60,48" fill="#fbbf24" />
          <polygon points="24,46 42,36 46,76 18,76" fill="#92400e" />
          <polygon points="96,44 78,36 74,76 102,76" fill="#b45309" />
        </svg>
      );

    case "globe-shell":
    case "shield-earth":
    case "sphere-harmony":
      return (
        <svg viewBox="0 0 120 90" className="h-24 w-full" aria-hidden="true">
          <circle cx="60" cy="45" r="32" fill="none" stroke={accentHex} strokeWidth="4" strokeDasharray="7 4" />
          <circle cx="60" cy="45" r="24" fill="#0284c7" />
          <path d="M46 34 Q58 28 66 38 T72 56 Q56 62 46 50 Z" fill="#22c55e" />
          <ellipse cx="60" cy="45" rx="36" ry="13" fill="none" stroke="#38bdf8" strokeWidth="2" />
        </svg>
      );

    case "layers-sky":
      return (
        <svg viewBox="0 0 120 90" className="h-24 w-full" aria-hidden="true">
          <rect x="14" y="12" width="92" height="12" rx="6" fill="#312e81" />
          <rect x="14" y="27" width="92" height="12" rx="6" fill="#4338ca" />
          <rect x="14" y="42" width="92" height="12" rx="6" fill="#0284c7" />
          <rect x="14" y="57" width="92" height="12" rx="6" fill="#38bdf8" />
          <circle cx="34" cy="63" r="6" fill="#ffffff" />
          <circle cx="42" cy="63" r="5" fill="#e0f2fe" />
          <text x="82" y="67" fill="#fff" fontSize="9" fontWeight="bold">O₂ • N₂</text>
        </svg>
      );

    case "water-drop":
      return (
        <svg viewBox="0 0 120 90" className="h-24 w-full" aria-hidden="true">
          <path
            d="M60 12 C60 12, 86 44, 86 60 C86 74, 74 82, 60 82 C46 82, 34 74, 34 60 C34 44, 60 12, 60 12 Z"
            fill="#0ea5e9"
            stroke="#bae6fd"
            strokeWidth="2.5"
          />
          <path d="M48 54 Q46 66 56 72" fill="none" stroke="#e0f2fe" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );

    case "moon-waves":
      return (
        <svg viewBox="0 0 120 90" className="h-24 w-full" aria-hidden="true">
          <path
            d="M72 14 A16 16 0 1 0 90 36 A12 12 0 1 1 72 14 Z"
            fill="#fde047"
          />
          <path d="M34 26 L34 48 M28 32 L34 24 L40 32" fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
          <path d="M10 62 Q30 46 50 62 T90 62 T112 58 L112 82 L10 82 Z" fill="#0284c7" />
          <path d="M10 72 Q30 60 50 72 T90 72" fill="none" stroke="#bae6fd" strokeWidth="2.5" />
        </svg>
      );

    case "sail-wind":
      return (
        <svg viewBox="0 0 120 90" className="h-24 w-full" aria-hidden="true">
          <path d="M14 28 Q40 20 58 28 M10 42 Q38 34 54 42" fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
          <polygon points="66,16 66,62 98,56" fill="#f8fafc" stroke="#0284c7" strokeWidth="2" />
          <polygon points="62,24 62,62 42,58" fill="#bae6fd" />
          <polygon points="36,64 102,64 92,76 46,76" fill="#b45309" />
        </svg>
      );

    case "merchant-route":
      return (
        <svg viewBox="0 0 120 90" className="h-24 w-full" aria-hidden="true">
          <circle cx="24" cy="64" r="8" fill="#f59e0b" />
          <circle cx="96" cy="26" r="8" fill="#10b981" />
          <path
            d="M32 60 Q58 20 86 28"
            fill="none"
            stroke="#fbbf24"
            strokeWidth="3.5"
            strokeDasharray="5 4"
          />
          <rect x="48" y="42" width="26" height="20" rx="4" fill="#d97706" stroke="#fef3c7" strokeWidth="2" />
          <line x1="48" y1="52" x2="74" y2="52" stroke="#fef3c7" strokeWidth="2" />
        </svg>
      );

    case "city-towers":
      return (
        <svg viewBox="0 0 120 90" className="h-24 w-full" aria-hidden="true">
          <rect x="20" y="34" width="22" height="46" rx="2" fill="#2563eb" />
          <rect x="46" y="16" width="28" height="64" rx="2" fill="#1d4ed8" />
          <rect x="78" y="28" width="22" height="52" rx="2" fill="#3b82f6" />
          {[24, 34, 44, 54, 64].map((y) => (
            <g key={y} fill="#fde047">
              <rect x="52" y={y} width="6" height="5" rx="1" />
              <rect x="62" y={y} width="6" height="5" rx="1" />
            </g>
          ))}
        </svg>
      );

    case "arrow-expand":
    case "growth-chart":
      return (
        <svg viewBox="0 0 120 90" className="h-24 w-full" aria-hidden="true">
          <rect x="22" y="54" width="14" height="24" rx="3" fill="#38bdf8" />
          <rect x="44" y="42" width="14" height="36" rx="3" fill="#0ea5e9" />
          <rect x="66" y="28" width="14" height="50" rx="3" fill="#0284c7" />
          <path d="M20 46 L52 26 L88 14" fill="none" stroke="#facc15" strokeWidth="4" strokeLinecap="round" />
          <polygon points="88,8 100,14 90,24" fill="#facc15" />
        </svg>
      );

    case "red-soil":
      return (
        <svg viewBox="0 0 120 90" className="h-24 w-full" aria-hidden="true">
          <rect x="16" y="24" width="88" height="16" rx="4" fill="#ea580c" />
          <rect x="16" y="42" width="88" height="18" rx="4" fill="#c2410c" />
          <rect x="16" y="62" width="88" height="16" rx="4" fill="#7c2d12" />
          <path d="M60 24 L60 10 M60 14 Q70 6 76 12 M60 16 Q50 8 44 14" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );

    case "fe-al-atoms":
      return (
        <svg viewBox="0 0 120 90" className="h-24 w-full" aria-hidden="true">
          <circle cx="40" cy="45" r="22" fill="#dc2626" stroke="#fecaca" strokeWidth="2.5" />
          <text x="40" y="51" textAnchor="middle" fill="#fff" fontSize="16" fontWeight="900">Fe</text>
          <text x="63" y="50" textAnchor="middle" fill="#fbbf24" fontSize="18" fontWeight="900">+</text>
          <circle cx="84" cy="45" r="20" fill="#ea580c" stroke="#fed7aa" strokeWidth="2.5" />
          <text x="84" y="51" textAnchor="middle" fill="#fff" fontSize="15" fontWeight="900">Al</text>
        </svg>
      );

    case "sprout-life":
    case "eco-leaf":
      return (
        <svg viewBox="0 0 120 90" className="h-24 w-full" aria-hidden="true">
          <path
            d="M60 76 L60 36 C60 20, 88 16, 92 34 C92 50, 72 54, 60 46"
            fill="#22c55e"
            stroke="#bbf7d0"
            strokeWidth="2.5"
          />
          <path
            d="M60 54 C60 38, 32 32, 28 48 C28 62, 48 64, 60 56"
            fill="#16a34a"
            stroke="#bbf7d0"
            strokeWidth="2"
          />
          <line x1="60" y1="78" x2="60" y2="38" stroke="#15803d" strokeWidth="4" strokeLinecap="round" />
        </svg>
      );

    case "compass-map":
      return (
        <svg viewBox="0 0 120 90" className="h-24 w-full" aria-hidden="true">
          <polygon points="18,22 44,14 74,22 102,14 102,68 74,76 44,68 18,76" fill="#065f46" stroke="#34d399" strokeWidth="2" />
          <circle cx="60" cy="45" r="18" fill="#0f172a" stroke="#fbbf24" strokeWidth="2.5" />
          <polygon points="60,29 66,45 60,41 54,45" fill="#ef4444" />
          <polygon points="60,61 66,45 60,49 54,45" fill="#e2e8f0" />
        </svg>
      );

    case "binary-screen":
      return (
        <svg viewBox="0 0 120 90" className="h-24 w-full" aria-hidden="true">
          <rect x="20" y="14" width="80" height="54" rx="8" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
          <text x="60" y="38" textAnchor="middle" fill="#38bdf8" fontSize="14" fontWeight="900" fontFamily="monospace">10110</text>
          <text x="60" y="56" textAnchor="middle" fill="#4ade80" fontSize="13" fontWeight="900" fontFamily="monospace">GPS•GIS</text>
          <rect x="46" y="70" width="28" height="6" rx="3" fill="#64748b" />
        </svg>
      );

    case "rain-cloud":
      return (
        <svg viewBox="0 0 120 90" className="h-24 w-full" aria-hidden="true">
          <path
            d="M34 48 A14 14 0 0 1 48 26 A18 18 0 0 1 82 30 A12 12 0 0 1 88 52 L34 52 Z"
            fill="#cbd5e1"
          />
          {[38, 54, 70, 84].map((x) => (
            <line
              key={x}
              x1={x}
              y1="58"
              x2={x - 6}
              y2="76"
              stroke="#38bdf8"
              strokeWidth="3"
              strokeLinecap="round"
            />
          ))}
        </svg>
      );

    case "mountain-barrier":
    case "uplift-mountain":
    case "snow-peak-belts":
      return (
        <svg viewBox="0 0 120 90" className="h-24 w-full" aria-hidden="true">
          <polygon points="14,78 52,18 90,78" fill="#047857" />
          <polygon points="52,18 39,38 52,34 65,38" fill="#f8fafc" />
          <polygon points="54,78 82,32 110,78" fill="#065f46" />
          <line x1="22" y1="56" x2="82" y2="56" stroke="#fde047" strokeWidth="2" strokeDasharray="4 3" />
          <line x1="32" y1="40" x2="72" y2="40" stroke="#fde047" strokeWidth="2" strokeDasharray="4 3" />
        </svg>
      );

    case "pyramid-steps":
    case "age-gender-bars":
      return (
        <svg viewBox="0 0 120 90" className="h-24 w-full" aria-hidden="true">
          {[
            { y: 16, w: 20 },
            { y: 30, w: 38 },
            { y: 44, w: 58 },
            { y: 58, w: 78 },
            { y: 72, w: 94 },
          ].map((row, idx) => (
            <g key={idx}>
              <rect x={60 - row.w / 2} y={row.y} width={row.w / 2 - 1} height="10" rx="2" fill="#3b82f6" />
              <rect x={61} y={row.y} width={row.w / 2 - 1} height="10" rx="2" fill="#ec4899" />
            </g>
          ))}
        </svg>
      );

    default:
      return (
        <svg viewBox="0 0 120 90" className="h-24 w-full" aria-hidden="true">
          <circle cx="60" cy="45" r="28" fill={accentHex} opacity="0.2" />
          <circle cx="60" cy="45" r="20" fill="none" stroke={accentHex} strokeWidth="3" />
          <path d="M36 45 L84 45 M60 21 L60 69" stroke="#f8fafc" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="60" cy="45" r="6" fill="#facc15" />
        </svg>
      );
  }
}

export function WordPuzzleIllustration({
  kind,
  puzzle,
}: {
  kind: WordIllustrationKind;
  puzzle?: WordCatchPuzzle;
}) {
  const resolvedPuzzle =
    puzzle ?? GEO10_WORD_PUZZLES.find((item) => item.illustrationKind === kind);
  const clues = resolvedPuzzle?.visualClues;

  if (clues && clues.length >= 2) {
    const [clue1, clue2] = clues;
    return (
      <div
        className="relative overflow-hidden rounded-2xl border-2 border-indigo-400/30 bg-gradient-to-br from-[#0b1528] via-[#132342] to-[#0f172a] p-3.5 text-white shadow-inner sm:p-5"
        role="img"
        aria-label={`Câu đố liên tưởng gồm 2 mảnh ghép: ${clue1.title} kết hợp với ${clue2.title}`}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-amber-300">
            🧩 Liên tưởng 2 mảnh ghép hình ảnh
          </span>
          <span className="text-[11px] font-semibold text-slate-300">
            Quan sát Hình 1 + Hình 2 để suy luận từ khóa
          </span>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr]">
          {/* Mảnh ghép 1 */}
          <div className="flex flex-col justify-between rounded-xl border border-white/15 bg-white/5 p-3 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span
                className="rounded-md px-2 py-0.5 text-[10px] font-black uppercase text-white"
                style={{ backgroundColor: clue1.accentHex }}
              >
                {clue1.badge}
              </span>
              <span className="text-xs font-bold text-slate-400">#1</span>
            </div>
            <div className="my-2 flex items-center justify-center rounded-lg bg-slate-950/50 py-2">
              {renderClueMotifSvg(clue1.motif, clue1.accentHex)}
            </div>
            <div>
              <p className="text-sm font-extrabold text-white">{clue1.title}</p>
              <p className="mt-0.5 text-xs text-slate-300">{clue1.caption}</p>
            </div>
          </div>

          {/* Dấu cộng liên tưởng */}
          <div className="flex items-center justify-center">
            <div className="flex size-10 items-center justify-center rounded-full border-2 border-amber-400/60 bg-amber-500/20 text-xl font-black text-amber-300 shadow-md">
              +
            </div>
          </div>

          {/* Mảnh ghép 2 */}
          <div className="flex flex-col justify-between rounded-xl border border-white/15 bg-white/5 p-3 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span
                className="rounded-md px-2 py-0.5 text-[10px] font-black uppercase text-white"
                style={{ backgroundColor: clue2.accentHex }}
              >
                {clue2.badge}
              </span>
              <span className="text-xs font-bold text-slate-400">#2</span>
            </div>
            <div className="my-2 flex items-center justify-center rounded-lg bg-slate-950/50 py-2">
              {renderClueMotifSvg(clue2.motif, clue2.accentHex)}
            </div>
            <div>
              <p className="text-sm font-extrabold text-white">{clue2.title}</p>
              <p className="mt-0.5 text-xs text-slate-300">{clue2.caption}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-48 w-full items-center justify-center rounded-2xl bg-slate-900 p-4 text-white">
      <p className="text-sm font-bold">Hình ảnh câu đố Địa lí 10</p>
    </div>
  );
}
