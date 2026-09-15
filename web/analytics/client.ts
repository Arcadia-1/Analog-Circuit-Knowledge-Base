import { useEffect, useState } from "react";

export type VisitStats = {
  pv: number;
  uv: number;
  scope: "all";
};

/** Record navigation and expose the lifetime counters returned by the server. */
export function useVisitStats(path: string, skip = false): VisitStats | null {
  const [stats, setStats] = useState<VisitStats | null>(null);

  useEffect(() => {
    if (
      skip
      || navigator.doNotTrack === "1"
      || path !== window.location.pathname
      || /^\/analytics\/?$/.test(path)
    ) return;

    let referrerOrigin = "";
    try {
      const referrer = new URL(document.referrer);
      if (referrer.protocol === "http:" || referrer.protocol === "https:") {
        referrerOrigin = referrer.origin;
      }
    } catch {
      /* direct visit or opaque referrer */
    }

    const campaignSource = new URLSearchParams(window.location.search)
      .get("utm_source")
      ?.trim()
      .toLowerCase()
      .slice(0, 40) ?? "";

    void fetch("/api/hit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
      cache: "no-store",
      body: JSON.stringify({ p: path, r: referrerOrigin, s: campaignSource }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Visit tracking failed (${response.status})`);
        if (response.status === 204) return null;
        setStats((await response.json()) as VisitStats);
      })
      .catch(() => {
        /* Analytics must never break the host page. */
      });
  }, [path, skip]);

  return stats;
}
