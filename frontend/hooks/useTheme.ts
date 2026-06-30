"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "pdfqa:theme";

/**
 * The theme lives in two places that need to stay in sync:
 *   1. <html data-theme="..."> — the source of truth that CSS reads.
 *   2. localStorage["pdfqa:theme"] — the user's explicit choice.
 *
 * An inline <script> in <head> sets (1) before React hydrates so we never
 * flash the wrong theme. useSyncExternalStore lets us treat (1) as a
 * reactive store, with a server snapshot of "light" so the first client
 * render matches the SSR output and React doesn't warn about hydration
 * mismatches.
 */

function getHtml(): HTMLElement | null {
  return typeof document === "undefined" ? null : document.documentElement;
}

function getThemeSnapshot(): Theme {
  const el = getHtml();
  if (!el) return "light";
  return el.dataset.theme === "dark" ? "dark" : "light";
}

function getServerSnapshot(): Theme {
  // Always "light" on the server so the SSR markup matches the first
  // client render. The live value is picked up on the next render after
  // the inline bootstrap script has populated data-theme.
  return "light";
}

function subscribe(notify: () => void): () => void {
  if (typeof document === "undefined") return () => undefined;
  const el = document.documentElement;
  const obs = new MutationObserver(notify);
  obs.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
}

function applyTheme(next: Theme) {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = next;
  }
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore quota / private-mode errors */
  }
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getThemeSnapshot, getServerSnapshot);

  // React to OS-level preference changes only when the user hasn't explicitly
  // chosen a theme yet.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => {
      try {
        if (localStorage.getItem(STORAGE_KEY)) return;
      } catch {
        /* ignore */
      }
      applyTheme(event.matches ? "dark" : "light");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setTheme = useCallback((next: Theme) => applyTheme(next), []);

  const toggle = useCallback(() => {
    // Read from the DOM rather than from React state so the click handler
    // always uses the most recent value, even if React hasn't re-rendered
    // yet after a programmatic change.
    const current = getThemeSnapshot();
    applyTheme(current === "dark" ? "light" : "dark");
  }, []);

  return { theme, setTheme, toggle };
}