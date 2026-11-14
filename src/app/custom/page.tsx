import { getRankings } from "@/lib/data";
import { CustomRankingsClient } from "./CustomRankingsClient";

export const dynamic = "force-dynamic";

export default async function CustomRankingsPage() {
  const { season, rows } = await getRankings();

  const rankingRows = rows.map((r) => ({
    teamId: r.teamId,
    team: r.team,
    conference: r.conference,
    offenseRating: r.offenseRating,
    defenseRating: r.defenseRating,
    srsRating: r.srsRating,
    sosRating: r.sosRating,
    sovRating: r.sovRating,
    sososRating: r.sososRating,
    successRateNet: r.successRateNet,
    explosivenessNet: r.explosivenessNet,
    turnoverMargin: r.turnoverMargin,
    atsMargin: r.atsMargin,
    qualityWins: r.qualityWins,
    wins: r.wins,
    losses: r.losses,
    gamesPlayed: r.gamesPlayed,
    rank: r.rank,
  }));

  return <CustomRankingsClient season={season} rows={rankingRows} />;
}
