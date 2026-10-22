import { Link } from '../nav';

/** Stats and the game list are one screen with two tabs. */
export default function StatsTabs({ active }: { active: 'stats' | 'games' }) {
  const tab = (to: string, label: string, on: boolean) => (
    <Link
      to={to}
      replace
      aria-current={on ? 'page' : undefined}
      className={`flex-1 rounded-full px-2 py-2 text-center text-sm transition ${
        on ? 'bg-bone font-semibold text-felt shadow' : 'text-dim hover:text-bone'
      }`}
    >
      {label}
    </Link>
  );
  return (
    <div className="mb-5 flex rounded-full bg-white/[.05] p-1 ring-1 ring-white/[.05]">
      {tab('/stats', 'Stats', active === 'stats')}
      {tab('/history', 'Games', active === 'games')}
    </div>
  );
}
