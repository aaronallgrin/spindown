import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Btn } from '../ui';

/** QR code a new player scans to open Spindown, already connected to the group's games. */
export default function AppQr() {
  const link = `${location.origin}${location.pathname}`;
  const [svg, setSvg] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    QRCode.toString(link, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1b1b1b', light: '#ffffff' } })
      .then(setSvg)
      .catch(() => setSvg(''));
  }, [link]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  };
  return (
    <div className="rounded-xl bg-felt-2 p-4">
      <div className="mb-1 font-cond text-xl font-bold">Get a new player set up</div>
      <p className="mb-3 text-sm text-dim">
        Scan with their phone's camera to open Spindown. Then Share, Add to Home Screen (iPhone) or Install app (Android).
      </p>
      {svg ? (
        <div className="mx-auto w-full max-w-[240px] overflow-hidden rounded-lg bg-white p-2" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="mx-auto aspect-square w-full max-w-[240px] rounded-lg bg-felt-3" />
      )}
      <Btn onClick={copy} className="mt-3 w-full text-sm">
        {copied ? 'Link copied' : 'Copy link'}
      </Btn>
    </div>
  );
}
