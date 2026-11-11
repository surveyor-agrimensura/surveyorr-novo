import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { dispatchRouteTransitionRequest } from '../lib/routeTransitions';

type HistorySnapshot = { href: string; state: unknown; index: number | null };

export function readHistoryIndex(state: unknown): number | null {
  if (!state || typeof state !== 'object') return null;
  const index = (state as { idx?: unknown }).idx;
  return typeof index === 'number' && Number.isInteger(index) ? index : null;
}

export function reversePopDelta(currentIndex: number | null, destinationIndex: number | null): number | null {
  if (currentIndex === null || destinationIndex === null || currentIndex === destinationIndex) return null;
  return currentIndex - destinationIndex;
}

export function RouteTransitionGuard() {
  const location = useLocation();
  const current = useRef<HistorySnapshot | null>(null);
  const restoring = useRef(false);

  useEffect(() => {
    const state = window.history.state;
    current.current = { href: window.location.href, state, index: readHistoryIndex(state) };
  }, [location.hash, location.key, location.pathname, location.search]);

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const destination: HistorySnapshot = {
        href: window.location.href,
        state: event.state,
        index: readHistoryIndex(event.state)
      };
      if (restoring.current) {
        restoring.current = false;
        current.current = destination;
        return;
      }

      const previous = current.current;
      if (!previous) {
        current.current = destination;
        return;
      }

      const request = dispatchRouteTransitionRequest();
      if (request.allowed && !request.confirmations.length) {
        current.current = destination;
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      const delta = reversePopDelta(previous.index, destination.index);
      if (delta !== null) {
        restoring.current = true;
        window.history.go(delta);
      }else{
        try {
          window.history.pushState(previous.state, '', previous.href);
        } catch {
          window.history.replaceState(previous.state, '', previous.href);
        }
        current.current = { ...previous, index: readHistoryIndex(window.history.state) };
      }
      if(request.confirmations.length){
        void Promise.all(request.confirmations).then(results=>{
          if(!results.every(Boolean))return;
          if(delta!==null){
            restoring.current=true;
            window.history.go(delta);
          }else{
            window.history.pushState(destination.state,'',destination.href);
            current.current={...destination,index:readHistoryIndex(window.history.state)};
          }
        });
      }
    };

    window.addEventListener('popstate', onPopState, true);
    return () => window.removeEventListener('popstate', onPopState, true);
  }, []);

  return null;
}
