import { useSyncExternalStore } from "react";

/**
 * Shared "splash screen is covering the page" signal. The Loader is the only writer; anything
 * that must not appear on top of the splash (the chat button) reads it. No loader mounted means
 * "not covering", so pages without a splash are unaffected.
 */
let covering = false;
const listeners = new Set<() => void>();

export function setLoaderCovering(next: boolean) {
  if (covering === next) return;
  covering = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLoaderCovering() {
  return useSyncExternalStore(
    subscribe,
    () => covering,
    () => false,
  );
}
