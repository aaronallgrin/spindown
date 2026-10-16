import { useEffect, useState, type ReactNode } from 'react';
import { Btn } from '../ui';

/** A button that needs a second tap within a few seconds. */
export default function ConfirmBtn({
  children,
  confirmLabel,
  onConfirm,
  variant = 'danger',
  className = '',
  skip = false,
}: {
  children: ReactNode;
  confirmLabel: ReactNode;
  onConfirm: () => void;
  variant?: 'primary' | 'quiet' | 'danger';
  className?: string;
  /** act on the first tap, no confirmation needed */
  skip?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(t);
  }, [armed]);
  return (
    <Btn
      variant={armed ? 'danger' : variant}
      className={className}
      onClick={() => (skip || armed ? onConfirm() : setArmed(true))}
    >
      {armed ? confirmLabel : children}
    </Btn>
  );
}
