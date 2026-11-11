import { describe, expect, it } from 'vitest';
import { mergeNoticeStates, updateNoticeState } from './NotificationCenter';

describe('notification state persistence', () => {
  it('merges account and browser state without duplicating notice ids', () => {
    expect(mergeNoticeStates(
      { readIds: ['n-1'], dismissedIds: ['n-2'] },
      { readIds: ['n-1', 'n-3'], dismissedIds: ['n-4'] }
    )).toEqual({ readIds: ['n-1', 'n-3'], dismissedIds: ['n-2', 'n-4'] });
  });

  it('can mark a notice unread without changing other saved notices', () => {
    const current = { readIds: ['n-1', 'n-2'], dismissedIds: ['n-3'] };
    expect(updateNoticeState(current, 'n-2', 'read', false)).toEqual({
      readIds: ['n-1'], dismissedIds: ['n-3']
    });
  });
});
