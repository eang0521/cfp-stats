import Link from "next/link";
import { getRankings } from "@/lib/data";
import { fmtRating } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RankingsPage() {
  const { season, rows } = await getRankings();

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{season} Rankings</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
        Overall rating blends opponent-adjusted offensive/defensive efficiency (70%) with a
        margin-based strength-of-schedule rating (30%). SOS is the average overall rating of
        a team&apos;s opponents played so far.
      </p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-black/[.03] dark:bg-white/[.04] text-left">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Team</th>
              <th className="px-3 py-2">Conf</th>
              <th className="px-3 py-2 text-right">Overall</th>
              <th className="px-3 py-2 text-right">Off</th>
              <th className="px-3 py-2 text-right">Def</th>
              <th className="px-3 py-2 text-right">SOS</th>
              <th className="px-3 py-2 text-right">GP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.teamId} className="border-t border-black/5 dark:border-white/5">
                <td className="px-3 py-2">{r.rank}</td>
                <td className="px-3 py-2">
                  <Link href={`/teams/${r.teamId}`} className="hover:underline">
                    {r.team}
                  </Link>
                </td>
                <td className="px-3 py-2 text-neutral-500">{r.conference ?? "—"}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtRating(r.overallRating)}</td>
                <td className="px-3 py-2 text-right font-mono text-neutral-500">
                  {r.offenseRating.toFixed(3)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-neutral-500">
                  {r.defenseRating.toFixed(3)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-neutral-500">
                  {fmtRating(r.sosRating)}
                </td>
                <td className="px-3 py-2 text-right text-neutral-500">{r.gamesPlayed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
