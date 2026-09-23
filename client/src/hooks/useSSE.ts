import { useEffect, useRef } from "react";
import { apiBase } from "../lib/api";

export function useSSE(url: string | null, onMessage: (data: unknown) => void) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!url) return;

    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      source = new EventSource(`${apiBase}${url}`);

      source.onmessage = (event) => {
        try {
          onMessageRef.current(JSON.parse(event.data));
        } catch {
          onMessageRef.current(event.data);
        }
      };

      source.onerror = () => {
        source?.close();
        if (!stopped) {
          reconnectTimer = setTimeout(connect, 2000);
        }
      };
    };

    connect();

    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      source?.close();
    };
  }, [url]);
}
