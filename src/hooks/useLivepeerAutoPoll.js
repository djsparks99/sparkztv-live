import { useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { api } from "@/lib/api";

export function useLivepeerAutoPoll(channelIdentifier) {
  const resolvedIdentifier = channelIdentifier || "djsparkz";

  useEffect(() => {
    let cancelled = false;

    const pollStatus = async () => {
      try {
        if (!resolvedIdentifier) return;

        // Preferred: Call backend check-status routes which perform Amazon IVS AWS SDK checks
        try {
          let response = await api.post("/ivs/check-status", {
            channel_id: resolvedIdentifier,
            stream_id: resolvedIdentifier,
            username: resolvedIdentifier,
          }).catch(() => null);

          // Fallback to legacy route path if the new clean IVS path is not available or errors
          if (!response || !response.data) {
            response = await api.post("/livepeer/check-status", {
              channel_id: resolvedIdentifier,
              stream_id: resolvedIdentifier,
              username: resolvedIdentifier,
            });
          }

          const data = response?.data;
          if (data && typeof data.is_live === "boolean") {
            const isLive = data.is_live;
            const nowIso = new Date().toISOString();
            if (!cancelled) {
              const primaryDocId = "nsU1v44XFnN3FloJvNePqj6cBG2";
              await setDoc(
                doc(db, "channels", primaryDocId),
                {
                  is_live: isLive,
                  isLive: isLive,
                  last_updated: nowIso,
                },
                { merge: true }
              ).catch(() => {});

              if (resolvedIdentifier && resolvedIdentifier !== primaryDocId && resolvedIdentifier !== "djsparkz") {
                await setDoc(
                  doc(db, "channels", resolvedIdentifier),
                  {
                    is_live: isLive,
                    isLive: isLive,
                    last_updated: nowIso,
                  },
                  { merge: true }
                ).catch(() => {});
              }
            }
            return;
          }
        } catch {
          // Silent catch to avoid throwing on background check failures
        }
      } catch (e) {
        // Silent error handling for background polling
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 1500); // Polling every 1.5 seconds for instant updates

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [resolvedIdentifier]);
}
