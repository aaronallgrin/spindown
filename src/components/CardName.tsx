import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getCardImages } from '../scryfall';

/** A card name you can tap to see the card. */
export default function CardName({ name, className = '' }: { name: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          // card names can sit inside links; show the card instead of navigating
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={`text-left underline decoration-dotted decoration-bone/40 underline-offset-[3px] hover:text-brass ${className}`}
      >
        {name}
      </button>
      {open && createPortal(<CardViewer name={name} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

/** "A + B" (commander and partner) as two tappable names. */
export function CardNames({ text, className }: { text: string; className?: string }) {
  const parts = text.split(' + ');
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && ' + '}
          <CardName name={p} className={className} />
        </span>
      ))}
    </>
  );
}

function CardViewer({ name, onClose }: { name: string; onClose: () => void }) {
  const [card, setCard] = useState<{ name: string; images: string[]; uri?: string } | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    getCardImages(name)
      .then(setCard)
      .catch((e) => setErr(navigator.onLine ? (e as Error).message : 'Card pictures need an internet connection.'));
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [name, onClose]);
  return (
    <div
      role="dialog"
      aria-label={name}
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 overflow-y-auto bg-black/85 p-5 backdrop-blur-sm pt-[calc(1.25rem+env(safe-area-inset-top))] pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
    >
      {err && <p className="rounded-xl bg-felt-2 p-4 text-dim">{err}</p>}
      {!card && !err && <div className="aspect-[5/7] w-[min(80vw,340px)] animate-pulse rounded-[4.5%] bg-felt-2" />}
      {card && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {card.images.map((src) => (
            <img
              key={src}
              src={src}
              alt={card.name}
              className="w-[min(80vw,340px)] rounded-[4.5%] shadow-2xl"
              style={{ maxHeight: card.images.length > 1 ? '42vh' : '75vh', width: 'auto' }}
            />
          ))}
        </div>
      )}
      <div className="flex gap-4 text-sm">
        {card?.uri && (
          <a href={card.uri} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-brass">
            Open on Scryfall
          </a>
        )}
        <button onClick={onClose} className="text-dim hover:text-bone">
          Close
        </button>
      </div>
    </div>
  );
}
