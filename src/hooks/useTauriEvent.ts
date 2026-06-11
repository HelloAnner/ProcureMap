import { useEffect } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { ProgressEvent } from '@/api';

type ProgressHandler = (event: ProgressEvent) => void;

export function useTauriEvent(handler: ProgressHandler) {
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    const setup = async () => {
      try {
        // Rust emits on "progress" (not "progress-update")
        unlisten = await listen<ProgressEvent>('progress', (event) => {
          handler(event.payload);
        });
      } catch {
        // Tauri environment not available (e.g. browser dev mode)
      }
    };

    setup();

    return () => {
      if (unlisten) unlisten();
    };
  }, [handler]);
}
