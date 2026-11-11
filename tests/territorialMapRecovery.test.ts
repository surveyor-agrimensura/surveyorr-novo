import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { clearStaleLeafletRotationRecovery, recoverFromStaleLeafletRotation } from '../src/features/map/territorialMapRecovery';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    has: (key: string) => values.has(key),
  };
}

describe('recuperação do mapa territorial', () => {
  it('recarrega uma vez quando uma sessão antiga deixa a extensão _rotate no Leaflet', () => {
    const storage = memoryStorage();
    let reloads = 0;
    const error = new Error("Cannot read properties of undefined (reading '_rotate')");

    expect(recoverFromStaleLeafletRotation(error, storage, () => reloads++)).toBe(true);
    expect(reloads).toBe(1);
    expect(recoverFromStaleLeafletRotation(error, storage, () => reloads++)).toBe(false);
    expect(reloads).toBe(1);
  });

  it('não recarrega por falhas que não são do plugin antigo', () => {
    const storage = memoryStorage();
    let reloads = 0;

    expect(recoverFromStaleLeafletRotation(new Error('Falha de rede'), storage, () => reloads++)).toBe(false);
    expect(reloads).toBe(0);
    expect(storage.has('surveyor-territorial-map-rotation-recovery')).toBe(false);
  });

  it('libera a tentativa guardada depois que o mapa carrega com sucesso', () => {
    const storage = memoryStorage();
    storage.setItem('surveyor-territorial-map-rotation-recovery', '1');

    clearStaleLeafletRotationRecovery(storage);

    expect(storage.has('surveyor-territorial-map-rotation-recovery')).toBe(false);
  });

  it('liga a recuperação ao tratamento de erro do carregador do Brasil', () => {
    const source = readFileSync(new URL('../src/features/map/TerritorialNavigator.tsx', import.meta.url), 'utf8');

    expect(source).toContain('recoverFromStaleLeafletRotation(e');
    expect(source).toContain('clearStaleLeafletRotationRecovery(');
  });
});
