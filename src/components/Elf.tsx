/** The reveal elf: pops up from behind a card, says "Shh.", ducks back down. Restart with a new `pop` key. */
export function Elf({ pop }: { pop: number }) {
  if (!pop) return null;
  return (
    <svg key={pop} className="santa-elf" viewBox="0 0 100 120" aria-hidden>
      <path d="M6 14 q0-10 12-10 h22 q12 0 12 10 q0 10-12 10 h-14 l-8 7 l1-7 q-13 0-13-10z" fill="#fff" />
      <text x="29" y="19" textAnchor="middle" fill="#1B1B1B" fontFamily="Barlow Condensed, sans-serif" fontWeight="700" fontSize="15">
        Shh.
      </text>
      <ElfHead />
      <path d="M60 104 q2-8 3-14" fill="none" stroke="#f2c9a6" strokeWidth="5" strokeLinecap="round" />
      <path d="M44 98 l8 8 l6-7 l5 8 l5-8 l6 7 l8-8 v14 h-38z" fill="#d2492f" stroke="#1B1B1B" strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  );
}

/** Hat and face, shared by the reveal elf and the one peeking over the Home Secret Santa button. */
export function ElfHead() {
  return (
    <>
      <path d="M50 58 C 52 38, 64 28, 84 30 C 76 34, 72 40, 74 50" fill="#3f9b5a" stroke="#1B1B1B" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="85" cy="31" r="5" fill="#FFA31A" stroke="#1B1B1B" strokeWidth="2" />
      <path d="M44 60 q20-9 38 0" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
      <path d="M44 74 l-14-8 l9 15z M82 74 l14-8 l-9 15z" fill="#f2c9a6" stroke="#1B1B1B" strokeWidth="2.2" strokeLinejoin="round" />
      <ellipse cx="63" cy="78" rx="20" ry="19" fill="#f2c9a6" stroke="#1B1B1B" strokeWidth="2.5" />
      <circle cx="56" cy="76" r="2.4" fill="#1B1B1B" />
      <circle cx="70" cy="76" r="2.4" fill="#1B1B1B" />
      <circle cx="52" cy="84" r="3.2" fill="#f4a3b8" opacity=".7" />
      <circle cx="74" cy="84" r="3.2" fill="#f4a3b8" opacity=".7" />
      <path d="M57 86 q6 5 12 0" fill="none" stroke="#1B1B1B" strokeWidth="2.2" strokeLinecap="round" />
    </>
  );
}

/** Peeks over the top of whatever it sits in (needs a `relative` parent). Behind the button, bobbing. */
export function ElfPeek() {
  return (
    <span className="elf-peek" aria-hidden>
      <svg viewBox="40 26 60 64">
        <ElfHead />
      </svg>
    </span>
  );
}
