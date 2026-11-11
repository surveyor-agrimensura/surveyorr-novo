declare module 'shpjs' {
  const readShapefile: (input: ArrayBuffer) => Promise<unknown>;
  export default readShapefile;
}
