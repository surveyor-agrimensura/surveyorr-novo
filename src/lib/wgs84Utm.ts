/** Núcleo único de projeção WGS84/UTM, preservando a fórmula histórica do SURVEYOR.
 * Não valida cobertura; fluxos de grade e SIGEF validam seus próprios limites. */
export type Wgs84Point = readonly [number, number];
export function projectWgs84ToUtm([lon,lat]:Wgs84Point,zoneOverride?:number){
 const rad=Math.PI/180, a=6378137, e2=0.00669437999014, k0=.9996;
 const zone=zoneOverride||Math.min(60,Math.max(1,Math.floor((lon+180)/6)+1));
 const phi=lat*rad,lam=(lon-(zone*6-183))*rad;
 const ep=e2/(1-e2),n=a/Math.sqrt(1-e2*Math.sin(phi)**2),t=Math.tan(phi)**2,c=ep*Math.cos(phi)**2,A=Math.cos(phi)*lam;
 const M=a*((1-e2/4-3*e2**2/64-5*e2**3/256)*phi-(3*e2/8+3*e2**2/32+45*e2**3/1024)*Math.sin(2*phi)+(15*e2**2/256+45*e2**3/1024)*Math.sin(4*phi)-(35*e2**3/3072)*Math.sin(6*phi));
 const east=k0*n*(A+(1-t+c)*A**3/6+(5-18*t+t*t+72*c-58*ep)*A**5/120)+500000;
 const north=k0*(M+n*Math.tan(phi)*(A*A/2+(5-t+9*c+4*c*c)*A**4/24+(61-58*t+t*t+600*c-330*ep)*A**6/720))+(lat<0?10000000:0);
 return {east,north,zone,hemisphere:lat<0?'S':'N'} as const;
}
