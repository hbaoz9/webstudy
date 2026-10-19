export default function ContourBackground({ className = "" }: { className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 800 800" preserveAspectRatio="xMidYMid slice" className={`pointer-events-none ${className}`} fill="none">
    <g stroke="currentColor" strokeWidth="1.4">
      {Array.from({ length: 8 }, (_, index) => <path key={index} d={`M-160 ${240 + index * 40} C${-70 + index * 15} ${30 + index * 40} ${130 - index * 5} ${10 + index * 35} ${230 - index * 20} ${150 + index * 30} S500 ${350 + index * 40} 940 ${50 + index * 40}`} />)}
    </g>
  </svg>;
}
