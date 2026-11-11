import { describe, expect, it } from 'vitest';
import { addRouteTransitionConfirmation, resolveRouteTransitionRequest, type RouteTransitionDetail } from '../src/lib/routeTransitions';

describe('confirmações de navegação', () => {
  it('interrompe a navegação síncrona enquanto aguarda o diálogo compartilhado', () => {
    const confirmation = Promise.resolve(true);
    const detail: RouteTransitionDetail = { confirmations: [] };
    const event = new CustomEvent<RouteTransitionDetail>('surveyor:before-route-change', { cancelable: true, detail });

    addRouteTransitionConfirmation(event, confirmation);

    expect(event.defaultPrevented).toBe(true);
    expect(detail.confirmations).toEqual([confirmation]);
  });

  it('só retoma a navegação depois da confirmação e respeita o cancelamento', async () => {
    await expect(resolveRouteTransitionRequest({ allowed: false, confirmations: [Promise.resolve(true)] })).resolves.toBe(true);
    await expect(resolveRouteTransitionRequest({ allowed: false, confirmations: [Promise.resolve(false)] })).resolves.toBe(false);
    await expect(resolveRouteTransitionRequest({ allowed: false, confirmations: [] })).resolves.toBe(false);
  });
});
