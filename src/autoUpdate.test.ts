import { beforeEach, describe, expect, it, vi } from 'vitest';

// tiny stand-ins for the browser pieces autoUpdate touches
type Fn = () => void;
let listeners: Record<string, Fn[]>;
const on = (k: string) => (type: string, f: Fn) => void (listeners[`${k}:${type}`] ??= []).push(f);
const fire = (k: string, type: string) => listeners[`${k}:${type}`]?.forEach((f) => f());
const reload = vi.fn();
const update = vi.fn(async () => {});

function setup(controller: object | null, hash = '#/') {
  listeners = {};
  reload.mockClear();
  update.mockClear();
  vi.stubGlobal('location', { hash, reload });
  vi.stubGlobal('window', { addEventListener: on('window') });
  vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: on('document') });
  vi.stubGlobal('navigator', {
    serviceWorker: { controller, addEventListener: on('sw'), getRegistration: async () => ({ update }) },
  });
}

const { startAutoUpdate } = await import('./autoUpdate');

describe('auto-update', () => {
  beforeEach(() => setup({}));

  it('reloads right away on Home once the new version takes over', () => {
    startAutoUpdate();
    expect(reload).not.toHaveBeenCalled();
    fire('sw', 'controllerchange');
    expect(reload).toHaveBeenCalledOnce();
  });

  it('waits during a game, then reloads back on Home', () => {
    setup({}, '#/play');
    startAutoUpdate();
    fire('sw', 'controllerchange');
    expect(reload).not.toHaveBeenCalled();
    (location as { hash: string }).hash = '#/';
    fire('window', 'hashchange');
    expect(reload).toHaveBeenCalledOnce();
  });

  it('never reloads on Home when nothing new came in', () => {
    startAutoUpdate();
    fire('window', 'hashchange');
    expect(reload).not.toHaveBeenCalled();
  });

  it('checks for a new version each time the app is opened', async () => {
    startAutoUpdate();
    fire('document', 'visibilitychange');
    await vi.waitFor(() => expect(update).toHaveBeenCalledOnce());
  });

  it('does nothing on the very first install', () => {
    setup(null);
    startAutoUpdate();
    expect(listeners['sw:controllerchange']).toBeUndefined();
  });
});
