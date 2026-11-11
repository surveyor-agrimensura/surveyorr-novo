/** Cor herdada dos atributos geográficos, usada quando não há estilo de documento salvo. */
export function polygonSourceColors(props:Record<string,unknown>):{fill:string;stroke:string}{
 const valid=(value:unknown):value is string=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
 const fill=valid(props.fillColor)?props.fillColor:valid(props.lotColor)?props.lotColor:'';
 const stroke=valid(props.strokeColor)?props.strokeColor:fill;
 return {fill,stroke};
}
