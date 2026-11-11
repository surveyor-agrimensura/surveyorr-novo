/** Cor da borda externa do texto vetorial. Evita branco sobre branco e
 * preto sobre preto mantendo o preenchimento escolhido pelo usuário. */
export function svgTextOutline(fill: string): '#142238' | '#ffffff' {
 if (!/^#[0-9a-f]{6}$/i.test(fill)) return '#ffffff';
 const channels = [1, 3, 5].map(at => parseInt(fill.slice(at, at + 2), 16) / 255);
 const [r, g, b] = channels.map(v => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
 const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
 return luminance >= 0.31 ? '#142238' : '#ffffff';
}
