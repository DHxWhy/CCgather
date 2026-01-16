"use client";

import { Trash2 } from "lucide-react";

interface DangerZoneProps {
  onDeleteClick: () => void;
}

export default function DangerZone({ onDeleteClick }: DangerZoneProps) {
  return (
    <section className="mt-16 pt-6 border-t border-[var(--border-default)]">
      <h2 className="text-sm font-medium text-red-400/80 mb-3">Danger Zone</h2>
      <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-zinc-300">Delete Account</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              All data will be deleted (recoverable within 3 days)
            </p>
          </div>
          <button
            onClick={onDeleteClick}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors w-full sm:w-auto"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </section>
  );
}
