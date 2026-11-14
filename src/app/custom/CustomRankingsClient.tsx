"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

export interface CustomRankingRow {
  teamId: number;
  team: string;
  conference: string | null;
  offenseRating: number;
  defenseRating: number;
  srsRating: number | null;
  sosRating: number | null;
  sovRating: number | null;
  wins: number;
  losses: number;
  gamesPlayed: number;
  rank: number | null;
}

type MetricKey = "offense" | "defense" | "margin" | "sos" | "sov" | "winPct";

const METRICS: { key: MetricKey; label: string; hint: string }[] = [
  { key: "offense", label: "Offense", hint: "Adjusted offensive efficiency (PPA/play)" },
  { key: "defense", label: "Defense", hint: "Adjusted defensive efficiency (lower PPA/play allowed is better - handled automatically)" },
  { key: "margin", label: "Scoring margin", hint: "Opponent-adjusted average point margin (SRS)" },
  { key: "sos", label: "Strength of schedule", hint: "Average rating of all opponents played" },
  { key: "sov", label: "Strength of victory", hint: "Average rating of opponents beaten" },
  { key: "winPct", label: "Win percentage", hint: "Wins / games played" },
];

type Weights = Record<MetricKey, number>;

const PRESETS: { label: string; weights: Weights }[] = [
  {
    label: "Equal weights",
    weights: { offense: 1, defense: 1, margin: 1, sos: 1, sov: 1, winPct: 1 },
  },
  {
    label: "Efficiency-focused (close to site rating)",
    weights: { offense: 1.4, defense: 1.4, margin: 0.6, sos: 0, sov: 0, winPct: 0 },
  },
  {
    label: "Resume-focused",
    weights: { offense: 0.3, defense: 0.3, margin: 0.5, sos: 1, sov: 1.5, winPct: 1.5 },
  },
  {
    label: "Pure results (wins + schedule only)",
    weights: { offense: 0, defense: 0, margin: 0, sos: 1, sov: 1, winPct: 2 },
  },
];

const STORAGE_KEY = "cfp-stats:custom-weights";

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[], avg: number): number {
  if (values.length === 0) return 0;
  return Math.sqrt(mean(values.map((v) => (v - avg) ** 2)));
}

function zScores(values: number[]): number[] {
  const avg = mean(values);
  const sd = stdDev(values, avg);
  if (sd === 0) return values.map(() => 0);
  return values.map((v) => (v - avg) / sd);
}

export function CustomRankingsClient({
  season,
  rows,
}: {
  season: number;
  rows: CustomRankingRow[];
}) {
  const [weights, setWeights] = useState<Weights>(PRESETS[0].weights);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // One-time hydration from localStorage on mount - window/localStorage
    // don't exist during server rendering, so this can't be a lazy useState
    // initializer; the resulting extra render is intentional and harmless.
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setWeights({ ...PRESETS[0].weights, ...JSON.parse(saved) });
      }
    } catch {
      // localStorage can throw (private mode, blocked storage) - just fall back to defaults.
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(weights));
    } catch {
      // ignore - this is a per-browser convenience, not required state.
    }
  }, [weights, loaded]);

  const ranked = useMemo(() => {
    const winPct = rows.map((r) => {
      const gp = r.wins + r.losses;
      return gp > 0 ? r.wins / gp : 0;
    });

    const z: Record<MetricKey, number[]> = {
      offense: zScores(rows.map((r) => r.offenseRating)),
      // Defense is "PPA/play allowed" - lower is better - so negate before
      // z-scoring. A positive defense weight then always rewards good defense.
      defense: zScores(rows.map((r) => -r.defenseRating)),
      margin: zScores(rows.map((r) => r.srsRating ?? 0)),
      sos: zScores(rows.map((r) => r.sosRating ?? 0)),
      sov: zScores(rows.map((r) => r.sovRating ?? 0)),
      winPct: zScores(winPct),
    };

    const scored = rows.map((r, i) => {
      const customScore = METRICS.reduce(
        (sum, m) => sum + weights[m.key] * z[m.key][i],
        0
      );
      return { ...r, customScore, winPct: winPct[i] };
    });

    scored.sort((a, b) => b.customScore - a.customScore);
    return scored;
  }, [rows, weights]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Build Your Own {season} Ranking
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-600 dark:text-neutral-300">
          Weight each component however you like. Every metric is converted to a z-score
          (standard deviations from the FBS average) before weighting, so a weight of
          &quot;2&quot; means roughly twice as influential as a weight of &quot;1&quot;,
          regardless of the metric&apos;s raw scale. This is independent from the{" "}
          <Link href="/rankings" className="underline">
            site&apos;s main rating
          </Link>
          .
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => setWeights(preset.weights)}
            className="rounded-full border border-black/10 px-3 py-1 text-xs text-neutral-700 hover:bg-black/5 dark:border-white/10 dark:text-neutral-200 dark:hover:bg-white/10"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 rounded-lg border border-black/10 p-4 sm:grid-cols-2 dark:border-white/10">
        {METRICS.map((m) => (
          <label key={m.key} className="flex flex-col gap-1 text-sm">
            <span className="flex items-center justify-between">
              <span className="font-medium">{m.label}</span>
              <span className="font-mono text-neutral-500">{weights[m.key].toFixed(1)}</span>
            </span>
            <input
              type="range"
              min={-2}
              max={2}
              step={0.1}
              value={weights[m.key]}
              onChange={(e) =>
                setWeights((w) => ({ ...w, [m.key]: Number(e.target.value) }))
              }
              className="w-full"
            />
            <span className="text-xs text-neutral-500">{m.hint}</span>
          </label>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-black/[.03] dark:bg-white/[.04] text-left">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Team</th>
              <th className="px-3 py-2">Conf</th>
              <th className="px-3 py-2 text-right">Record</th>
              <th className="px-3 py-2 text-right">Custom score</th>
              <th className="px-3 py-2 text-right">Site rank</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((r, i) => (
              <tr key={r.teamId} className="border-t border-black/5 dark:border-white/5">
                <td className="px-3 py-2">{i + 1}</td>
                <td className="px-3 py-2">
                  <Link href={`/teams/${r.teamId}`} className="hover:underline">
                    {r.team}
                  </Link>
                </td>
                <td className="px-3 py-2 text-neutral-500">{r.conference ?? "—"}</td>
                <td className="px-3 py-2 text-right font-mono text-neutral-500">
                  {r.wins}-{r.losses}
                </td>
                <td className="px-3 py-2 text-right font-mono">{r.customScore.toFixed(2)}</td>
                <td className="px-3 py-2 text-right text-neutral-500">
                  {r.rank ? `#${r.rank}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
