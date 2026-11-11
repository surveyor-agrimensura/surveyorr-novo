/** Catálogo preparado para receber cursos publicados posteriormente. */
export type Course = {
  id:string;
  title:string;
  description:string;
  imageUrl?:string;
  lessons?:number;
  url:string;
};
export const publishedCourses:Course[]=[];
