/** Decorative map contours; no learning data is encoded in this illustration. */
export function GeographyArtwork({ className = "" }: { className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 420 280" fill="none" className={className}>
    <circle cx="285" cy="136" r="112" fill="#E8F5EF" />
    <circle cx="285" cy="136" r="86" stroke="#A7D7C0" strokeWidth="2" />
    <circle cx="285" cy="136" r="58" stroke="#A7D7C0" strokeWidth="2" />
    <path d="M14 199c39-43 85-50 125-16 34 29 62 27 96-8 34-36 69-41 102-17 25 19 49 17 69-1" stroke="#69B69B" strokeWidth="3" strokeLinecap="round" />
    <path d="M18 227c47-37 85-38 121-9 34 27 68 27 103-3 30-27 62-29 96-11 24 14 47 13 69-3" stroke="#A7D7C0" strokeWidth="2" strokeLinecap="round" />
    <path d="M18 251c46-27 90-26 124-3 36 24 71 19 106-4 32-22 62-21 92-8 22 9 46 7 67-3" stroke="#A7D7C0" strokeWidth="2" strokeLinecap="round" />
    <path d="M285 57l14 65 65 14-65 14-14 65-14-65-65-14 65-14 14-65Z" fill="#FFFFFF" stroke="#14846C" strokeWidth="3" strokeLinejoin="round" />
    <circle cx="285" cy="136" r="12" fill="#14846C" />
    <path d="M54 63c23-17 49-18 76-3M42 88c33-20 70-20 102 1M55 112c23-12 47-11 70 0" stroke="#A7D7C0" strokeWidth="2" strokeLinecap="round" />
  </svg>;
}
