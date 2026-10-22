import { forwardRef, useCallback, type ComponentProps } from 'react';
import { Link as RRLink, useNavigate as useRRNavigate, type NavigateOptions, type To } from 'react-router-dom';

/**
 * Link and navigate with View Transitions on by default, so moving between pages
 * cross-fades (and matching view-transition-names glide) instead of cutting.
 * Browsers without the API just navigate normally.
 */
export const Link = forwardRef<HTMLAnchorElement, ComponentProps<typeof RRLink>>(function Link(props, ref) {
  return <RRLink ref={ref} viewTransition {...props} />;
});

export function useNavigate() {
  const nav = useRRNavigate();
  return useCallback(
    (to: To | number, opts?: NavigateOptions) =>
      typeof to === 'number' ? nav(to) : nav(to, { viewTransition: true, ...opts }),
    [nav],
  );
}
