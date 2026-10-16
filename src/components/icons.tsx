type P = { size?: number | string; className?: string };

export const Crown = ({ size = 20, className }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor" aria-hidden>
    <path d="M3 8l4.5 4L12 4l4.5 8L21 8l-2 11H5L3 8z" />
  </svg>
);

/** Phyrexian-style drop for poison */
export const Poison = ({ size = 20, className }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M12 3c3 4.2 6 7.4 6 11a6 6 0 1 1-12 0c0-3.6 3-6.8 6-11z" fill="currentColor" fillOpacity=".18" />
    <path d="M12 9v9M9 12.5a3 3 0 0 0 6 0" strokeLinecap="round" />
  </svg>
);

export const Sword = ({ size = 20, className }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M14.5 3H21v6.5L10 20.5 3.5 14z" fill="currentColor" fillOpacity=".15" />
    <path d="M4 20l3-3M7 14l3 3" />
  </svg>
);

export const Skull = ({ size = 20, className }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor" aria-hidden>
    <path d="M12 2C7 2 3.5 5.4 3.5 10c0 2.6 1.2 4.7 3 6v3.5h3V18h1v1.5h3V18h1v1.5h3V16c1.8-1.3 3-3.4 3-6C20.5 5.4 17 2 12 2zm-3.5 11a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm7 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" />
  </svg>
);

export const Gavel = ({ size = 22, className }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14 4l6 6M11.5 6.5l6 6M13 5l-4.5 4.5 6 6L19 11M10.5 12.5L4 19" />
    <path d="M3 21h8" />
  </svg>
);

export const Bars = ({ size = 22, className }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
    <path d="M5 20V12M10 20V5M15 20v-9M20 20V8" />
  </svg>
);

export const Ask = ({ size = 22, className }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5M9 9.2a2.2 2.2 0 1 1 3 2c-.6.3-1 .8-1 1.4M11 15h.01" />
  </svg>
);

export const Cloud = ({ size = 22, className }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M7 18h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.1 9.5 4.3 4.3 0 0 0 7 18z" />
  </svg>
);

export const Chevron = ({ size = 20, className }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);
