/** A burst of confetti from the middle of `el`, falling away. Skipped for reduced motion. */
export function confetti(el: Element | null) {
  if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = el.getBoundingClientRect();
  const colors = ['#FFA31A', '#fffbd5', '#aae0fa', '#cbc2bf', '#f9aa8f', '#9bd3ae', '#ffffff'];
  for (let i = 0; i < 140; i++) {
    const c = document.createElement('i');
    const a = Math.random() * Math.PI * 2;
    const v = 120 + Math.random() * 260;
    c.style.cssText = `position:fixed;z-index:60;pointer-events:none;left:${r.left + r.width / 2}px;top:${r.top + 80}px;width:${6 + Math.random() * 6}px;height:${4 + Math.random() * 4}px;background:${colors[i % colors.length]};border-radius:2px`;
    document.body.appendChild(c);
    c.animate(
      [
        { transform: 'translate(0,0) rotate(0)', opacity: 1 },
        { transform: `translate(${Math.cos(a) * v}px, ${Math.sin(a) * v - 120}px) rotate(${Math.random() * 720}deg)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${Math.cos(a) * v * 1.3}px, ${Math.sin(a) * v + 520}px) rotate(${Math.random() * 1440}deg)`, opacity: 0 },
      ],
      { duration: 1800 + Math.random() * 900, easing: 'cubic-bezier(.2,.7,.4,1)' },
    ).onfinish = () => c.remove();
  }
}
