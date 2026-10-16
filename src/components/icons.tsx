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
