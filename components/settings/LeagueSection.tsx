"use client";

import { Mail } from "lucide-react";
import { FlagIcon } from "@/components/ui/FlagIcon";
import type { Country } from "@/lib/constants/countries";

interface LeagueSectionProps {
  countryCode: string;
  country: Country;
  username?: string | null;
}

export default function LeagueSection({ countryCode, country, username }: LeagueSectionProps) {
  const mailSubject = encodeURIComponent("[CCgather] Country Change Request");
  const mailBody = encodeURIComponent(
    `Hi CCgather Team,

I would like to request a country change for my account.

Username: ${username || "(your username)"}
Current Country: ${country.name}
New Country: (please fill in)

Reason for change:
(e.g., moved to a new country, selected wrong country during signup, etc.)

Thank you!`
  );

  return (
    <section>
      <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">League</h2>
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--border-default)]">
        <FlagIcon countryCode={countryCode} size="md" />
        <span className="flex-1 text-sm font-medium text-[var(--color-text-primary)]">
          {country.name}
        </span>
        <a
          href={`mailto:contact@ccgather.com?subject=${mailSubject}&body=${mailBody}`}
          className="p-1.5 rounded-md hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
          title="Request country change"
        >
          <Mail className="w-4 h-4" />
        </a>
      </div>
    </section>
  );
}
