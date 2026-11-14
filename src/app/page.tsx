import Link from "next/link";
import { getCfpProjection, getRankings } from "@/lib/data";
import { fmtRating } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { season, rows } = await getRankings();
  const top10 = rows.slice(0, 10);
  const { field } = await getCfpProjection(season);

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">
          {season} College Football Ratings
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-600 dark:text-neutral-300">
          Opponent-adjusted efficiency ratings for every FBS team, refreshed automatically
          from live results. Used to predict games, rank teams, and project the 12-team
          College Football Playoff field.
        </p>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium">Top 10</h2>
          <Link href="/rankings" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
            Full rankings &rarr;
          </Link>
        </div>
        <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-black/[.03] dark:bg-white/[.04] text-left">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Team</th>
                <th className="px-3 py-2">Conf</th>
                <th className="px-3 py-2 text-right">Rating</th>
              </tr>
            </thead>
            <tbody>
              {top10.map((r) => (
                <tr key={r.teamId} className="border-t border-black/5 dark:border-white/5">
                  <td className="px-3 py-2">{r.rank}</td>
                  <td className="px-3 py-2">
                    <Link href={`/teams/${r.teamId}`} className="hover:underline">
                      {r.team}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-neutral-500">{r.conference ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtRating(r.overallRating)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium">Projected CFP Field</h2>
          <Link href="/cfp" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
            Full bracket &rarr;
          </Link>
        </div>
        <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {field.map((t) => (
            <li
              key={t.team}
              className="flex items-center justify-between rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10"
            >
              <span>
                <span className="mr-2 font-mono text-neutral-500">{t.seed}</span>
                {t.team}
                {t.bye && (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                    bye
                  </span>
                )}
              </span>
              <span className="text-xs text-neutral-500">{t.conference}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
