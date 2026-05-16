import React from "react";

export default function Workspace({ title, eyebrow, icon: Icon, children }) {
  return (
    <section className="min-h-[calc(100vh-124px)] rounded-lg border border-white/10 bg-white/[0.06] p-4 shadow-soft backdrop-blur">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-teal-300">
            <Icon className="h-4 w-4" />
            {eyebrow}
          </div>
          <h2 className="text-2xl font-semibold tracking-normal text-white">{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}
