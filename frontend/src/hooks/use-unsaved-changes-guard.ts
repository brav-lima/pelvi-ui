import { useEffect, useRef } from 'react';

/**
 * Warns before losing unsaved changes. React Router's `useBlocker` only works with
 * data routers; the app uses <BrowserRouter>, so this guards:
 *  - tab close / reload / external navigation via `beforeunload`;
 *  - in-app navigation by intercepting clicks on internal <a href> (capture phase),
 *    handing the destination to `onBlockedNavigation` so the page can confirm and navigate.
 * The browser back button cannot be intercepted this way.
 */
export function useUnsavedChangesGuard(
  dirty: boolean,
  onBlockedNavigation: (path: string) => void,
): void {
  const blockedRef = useRef(onBlockedNavigation);
  blockedRef.current = onBlockedNavigation;

  useEffect(() => {
    if (!dirty) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank' || anchor.origin !== window.location.origin) return;
      event.preventDefault();
      event.stopPropagation();
      blockedRef.current(anchor.pathname + anchor.search + anchor.hash);
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty]);
}
