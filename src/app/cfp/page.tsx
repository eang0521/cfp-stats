import Link from "next/link";
import { getCfpProjection, getRankings } from "@/lib/data";
import type { CfpTeam } from "@/lib/ratings/cfp";
import { fmtRating } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CfpPage() {
  const { season, rows } = await getRankings();
  const { field, champions, asOfWeek } = await getCfpProjection(season);

  const teamIdByName = new Map(rows.map((r) => [r.team, r.teamId]));
  const byeTeams = field.filter((t) => t.bye);
  const fieldTeams = field.filter((t) => !t.bye);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        {season} Projected 12-Team CFP Field
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-neutral-600 dark:text-neutral-300">
        As of week {asOfWeek}. The 5 highest-rated conference champions earn automatic bids
        (the top 4 get a first-round bye); the remaining 7 spots go to the highest-rated
        at-large teams. Champions are detected from conference championship game results
        when available, otherwise from best conference record.
      </p>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-medium">Seeds 1&ndash;4 (byes)</h2>
          <TeamList teams={byeTeams} teamIdByName={teamIdByName} />
        </div>
        <div>
          <h2 className="mb-3 text-lg font-medium">Seeds 5&ndash;12</h2>
          <TeamList teams={fieldTeams} teamIdByName={teamIdByName} />
        </div>
      </div>

      <div className="mt-10">
        <h2 className="mb-3 text-lg font-medium">Conference champions used</h2>
        <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-black/[.03] dark:bg-white/[.04] text-left">
              <tr>
                <th className="px-3 py-2">Conference</th>
                <th className="px-3 py-2">Champion</th>
                <th className="px-3 py-2">Source</th>
              </tr>
            </thead>
            <tbody>
              {champions
                .sort((a, b) => a.conference.localeCompare(b.conference))
                .map((c) => (
                  <tr key={c.conference} className="border-t border-black/5 dark:border-white/5">
                    <td className="px-3 py-2">{c.conference}</td>
                    <td className="px-3 py-2">{c.team}</td>
                    <td className="px-3 py-2 text-neutral-500">
                      {c.source === "championship-game" ? "Championship game" : "Best conf. record"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TeamList({
  teams,
  teamIdByName,
}: {
  teams: CfpTeam[];
  teamIdByName: Map<string, number>;
}) {
  return (
    <ol className="flex flex-col gap-2">
      {teams.map((t) => {
        const id = teamIdByName.get(t.team);
        return (
          <li
            key={t.team}
            className="flex items-center justify-between rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10"
          >
            <span className="flex items-center gap-2">
              <span className="font-mono text-neutral-500">{t.seed}</span>
              {id ? (
                <Link href={`/teams/${id}`} className="hover:underline">
                  {t.team}
                </Link>
              ) : (
                t.team
              )}
              {t.bidType === "champion-bye" || t.bidType === "champion" ? (
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                  auto bid
                </span>
              ) : (
                <span className="rounded bg-sky-100 px-1.5 py-0.5 text-xs text-sky-800 dark:bg-sky-900/40 dark:text-sky-300">
                  at-large
                </span>
              )}
            </span>
            <span className="flex items-center gap-3 text-xs text-neutral-500">
              <span>{t.conference}</span>
              <span className="font-mono">{fmtRating(t.overallRating)}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
