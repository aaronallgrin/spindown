import { afterEach, expect, it, vi } from 'vitest';
import { mustInstall } from './install';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15';

function phone(ua: string, installed = false) {
  vi.stubGlobal('navigator', { userAgent: ua, standalone: installed });
  vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
}
afterEach(() => vi.unstubAllGlobals());

it('sends phones in a browser tab to the install screen', () => {
  phone(IPHONE);
  expect(mustInstall('#/')).toBe(true);
  phone(ANDROID);
  expect(mustInstall('#/santa')).toBe(true);
});

it('lets the installed app, computers, and poll/join links through', () => {
  phone(IPHONE, true);
  expect(mustInstall('#/')).toBe(false);
  phone(MAC);
  expect(mustInstall('#/')).toBe(false);
  phone(IPHONE);
  expect(mustInstall('#/poll/abc123')).toBe(false);
  expect(mustInstall('#/join/xyz')).toBe(false);
});
