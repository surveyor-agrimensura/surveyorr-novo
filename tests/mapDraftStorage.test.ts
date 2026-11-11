import { describe, expect, it } from 'vitest';
import { writeMapDraftSnapshot } from '../src/features/map/mapDraftStorage';

describe('writeMapDraftSnapshot', () => {
  it('persists geometry and project details together', async () => {
    const values = new Map<string, string>();
    const storage = { setItem: (key: string, value: string) => values.set(key, value) };
    const features = [{ id: 'area-1' }];
    const project = { name: 'Sítio do Vale', city: 'Ubaíra' };

    expect(await writeMapDraftSnapshot(storage, 'draft', 'metadata', features, project)).toBe(true);
    expect(JSON.parse(values.get('draft') || 'null')).toEqual(features);
    expect(JSON.parse(values.get('metadata') || 'null')).toEqual(project);
  });

  it('reports failure when browser and IndexedDB storage are unavailable', async () => {
    const storage = { setItem: () => { throw new Error('quota exceeded'); } };

    expect(await writeMapDraftSnapshot(storage, 'draft', 'metadata', [], {})).toBe(false);
  });
});
