import { notFound } from "next/navigation";
import Link from "next/link";
import { getTeamDetail } from "@/lib/data";
import { fmtRating } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ team: string }>;
}) {
  const { team: teamIdParam } = await params;
  const teamId = Number(teamIdParam);
  if (!Number.isFinite(teamId)) notFound();

  const { team, rating, games, season } = await getTeamDetail(teamId);
  if (!team) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/rankings" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          &larr; All rankings
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{team.school}</h1>
        <p className="text-sm text-neutral-500">
          {team.mascot} &middot; {team.conference ?? "Independent"}
        </p>
      </div>

      {rating ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Overall rank" value={`#${rating.rank}`} />
          <Stat label="Overall rating" value={fmtRating(rating.overallRating)} />
          <Stat label="Adj. offense" value={rating.offenseRating.toFixed(3)} />
          <Stat label="Adj. defense" value={rating.defenseRating.toFixed(3)} />
          <Stat label="Strength of schedule" value={fmtRating(rating.sosRating)} />
          <Stat label="Margin (SRS)" value={fmtRating(rating.srsRating)} />
          <Stat label="Games played" value={String(rating.gamesPlayed)} />
          <Stat label="Season" value={String(season)} />
        </div>
      ) : (
        <p className="text-sm text-neutral-500">No rating computed yet for {season}.</p>
      )}

      <div>
        <h2 className="mb-3 text-lg font-medium">Schedule</h2>
        <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-black/[.03] dark:bg-white/[.04] text-left">
              <tr>
                <th className="px-3 py-2">Week</th>
                <th className="px-3 py-2">Matchup</th>
                <th className="px-3 py-2 text-right">Result</th>
              </tr>
            </thead>
            <tbody>
              {games.map((g) => {
                const isHome = g.homeTeam === team.school;
                const opponent = isHome ? g.awayTeam : g.homeTeam;
                const teamPoints = isHome ? g.homePoints : g.awayPoints;
                const oppPoints = isHome ? g.awayPoints : g.homePoints;
                const result =
                  teamPoints === null || oppPoints === null
                    ? "—"
                    : `${teamPoints > oppPoints ? "W" : teamPoints < oppPoints ? "L" : "T"} ${teamPoints}-${oppPoints}`;
                return (
                  <tr key={g.id} className="border-t border-black/5 dark:border-white/5">
                    <td className="px-3 py-2">{g.week}</td>
                    <td className="px-3 py-2">
                      {isHome ? "vs" : "@"} {opponent}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{result}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-black/10 p-3 dark:border-white/10">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="font-mono text-lg">{value}</div>
    </div>
  );
}
