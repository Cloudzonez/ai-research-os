import React from "react";
import {
  Layers3,
  Network,
  LockKeyhole,
  Bookmark,
} from "lucide-react";
import InfoPanel from "./InfoPanel.jsx";
import { sharingLabel } from "../utils/sharingLabel.js";

export default function RightRail({ t, papers = [], trackers = [] }) {
  const recentPapers = papers.slice(0, 5);
  const recentTrackers = trackers.slice(0, 5);

  return (
    <aside className="hidden space-y-4 lg:block lg:sticky lg:top-[94px] lg:self-start">
      <InfoPanel title={t.context} icon={Layers3} dark>
        <p className="mb-3 text-sm leading-6 text-slate-300">{t.contextHint}</p>
        {recentPapers.length > 0 ? (
          <div className="space-y-2">
            {recentPapers.map((paper) => (
              <div key={paper.title} className="rounded-md bg-white/10 p-3 transition hover:bg-white/20">
                <div className="line-clamp-2 text-sm font-semibold text-white">{paper.title}</div>
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                  <span>{paper.source}</span>
                  <span className="text-slate-600">·</span>
                  <span>{sharingLabel(t, paper.sharing)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md bg-white/10 p-4 text-center text-sm text-slate-500">
            <Bookmark className="mx-auto mb-2 h-5 w-5" />
            {t.noPapers || "No papers yet"}
          </div>
        )}
      </InfoPanel>

      <InfoPanel title={t.memoryGraph} icon={Network} dark>
        {recentTrackers.length > 0 ? (
          <div className="space-y-3">
            {recentTrackers.map((tracker) => (
              <div key={tracker.name} className="flex items-center gap-3 rounded-md p-2 transition hover:bg-white/5">
                <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-teal-300" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">{tracker.name}</div>
                  <div className="text-xs text-slate-400">
                    {tracker.papers} {t.candidatePapers}
                    {" · "}
                    {tracker.cadence}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md bg-white/10 p-4 text-center text-sm text-slate-500">
            {t.noTrackers || "No trackers yet"}
          </div>
        )}
      </InfoPanel>

      <InfoPanel title={t.audit} icon={LockKeyhole} dark>
        <div className="space-y-2 text-sm text-slate-300">
          <div className="flex items-center gap-2 rounded-md bg-white/10 px-3 py-2">
            <div className="h-2 w-2 rounded-full bg-teal-400" />
            <span>External MCP: authenticated</span>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-white/10 px-3 py-2">
            <div className="h-2 w-2 rounded-full bg-teal-400" />
            <span>Privacy: task-scoped</span>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-white/10 px-3 py-2">
            <div className="h-2 w-2 rounded-full bg-teal-400" />
            <span>Sharing default: school</span>
          </div>
          <div className="mt-3 rounded-md bg-amber-950/30 border border-amber-400/20 px-3 py-2 text-xs text-amber-300">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              <span>Sandbox pending approval</span>
            </div>
          </div>
        </div>
      </InfoPanel>
    </aside>
  );
}
