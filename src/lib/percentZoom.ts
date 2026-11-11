/** Zoom cartográfico da interface: porcentagem inteira, sem saltos ao arrastar.
 * A conversão preserva o intervalo 8..22 usado pelas versões anteriores. */
export const zoomToPercent = (zoom: number): number =>
  Math.max(1, Math.min(100, Math.round(((zoom - 8) / 14) * 100)));

export const percentToZoom = (percent: number): number =>
  Math.round((8 + Math.max(1, Math.min(100, Math.round(percent))) * 0.14) * 100) / 100;

/** Ajuste RELATIVO ao fit geográfico do imóvel; não converte percentual
 * em zoom absoluto do WebMercator. Em 50% o imóvel cabe automaticamente.
 * Em 1% a escala é ~0,51x; em 100%, 2x. Cada passo é contínuo. */
export const percentToFitZoomOffset=(percent:number):number => {
  const safe=Number.isFinite(percent)?Math.max(1,Math.min(100,percent)):50;
  return (safe-50)/50;
};
