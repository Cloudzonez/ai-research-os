import React from "react";
import { cn } from "../utils/cn.js";

export default function InfoPanel({ title, icon: Icon, children, dark = false }) {
  return (
    <section
      className={cn(
        "rounded-lg border p-4 shadow-soft",
        dark ? "border-white/10 bg-white/[0.06]" : "border-white/10 bg-white text-slate-950",
      )}
    >
      <div className={cn("mb-3 flex items-center gap-2 font-bold", dark ? "text-white" : "text-slate-950")}>
        <Icon className={cn("h-5 w-5", dark ? "text-teal-300" : "text-jade")} />
        {title}
      </div>
      {children}
    </section>
  );
}
