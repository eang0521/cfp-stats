import Link from "next/link";
import { getRankings, getWeekSchedule } from "@/lib/data";
import { predictMatchup, type RatingRow } from "@/lib/ratings/engine";
import { fmtPct, fmtRating } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PredictionsPage() {
  const { season, rows } = await getRankings();
  const { week, games } = await getWeekSchedule(season);

  const ratingByTeam = new Map<string, RatingRow>(
    rows.map((r) => [
      r.team,
      {
        teamId: r.teamId,
        team: r.team,
        conference: r.conference,
        offenseRating: r.offenseRating,
        defenseRating: r.defenseRating,
        overallRating: r.overallRating,
        srsRating: r.srsRating ?? 0,
        sosRating: r.sosRating ?? 0,
        gamesPlayed: r.gamesPlayed,
        rank: r.rank ?? 0,
      },
    ])
  );

  const teamIdByName = new Map(rows.map((r) => [r.team, r.teamId]));

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        {season} Week {week ?? "—"} Predictions
      </h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
        Predicted margin and win probability from each team&apos;s current overall rating,
        plus a small home-field adjustment. Teams without a computed rating yet are skipped.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {games.map((g) => {
          const home = ratingByTeam.get(g.homeTeam);
          const away = ratingByTeam.get(g.awayTeam);
          if (!home || !away) {
            return (
              <div
                key={g.id}
                className="rounded-lg border border-black/10 p-4 text-sm text-neutral-500 dark:border-white/10"
              >
                {g.awayTeam} @ {g.homeTeam} — rating unavailable
              </div>
            );
          }

          const { predictedMargin, winProbA } = predictMatchup(home, away, {
            neutralSite: g.neutralSite,
          });
          const favoredHome = predictedMargin >= 0;
          const favorite = favoredHome ? home : away;
          const favoriteProb = favoredHome ? winProbA : 1 - winProbA;
          const favoriteId = teamIdByName.get(favorite.team);

          return (
            <div
              key={g.id}
              className="flex items-center justify-between rounded-lg border border-black/10 p-4 dark:border-white/10"
            >
              <div className="text-sm">
                <div className="font-medium">
                  {g.awayTeam} @ {g.homeTeam}
                  {g.neutralSite && <span className="ml-2 text-xs text-neutral-500">(neutral)</span>}
                </div>
                <div className="text-neutral-500">
                  {home.team} {fmtRating(home.overallRating)} vs {away.team}{" "}
                  {fmtRating(away.overallRating)}
                </div>
              </div>
              <div className="text-right text-sm">
                <div className="font-medium">
                  {favoriteId ? (
                    <Link href={`/teams/${favoriteId}`} className="hover:underline">
                      {favorite.team}
                    </Link>
                  ) : (
                    favorite.team
                  )}{" "}
                  by {Math.abs(predictedMargin).toFixed(1)}
                </div>
                <div className="text-neutral-500">{fmtPct(favoriteProb)} win prob</div>
              </div>
            </div>
          );
        })}

        {games.length === 0 && (
          <p className="text-sm text-neutral-500">No scheduled games found for this week.</p>
        )}
      </div>
    </div>
  );
}
