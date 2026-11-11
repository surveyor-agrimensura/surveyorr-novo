/** Mantém as dimensões aproximadas dos cartões enquanto a lista é recuperada. */
export function ProjectListSkeleton({rows=4}:{rows?:number}) {
 return <div className="surveyor-project-skeletons" role="status" aria-label="Carregando projetos" aria-busy="true">
   {Array.from({length:rows},(_,i)=><div className="surveyor-project-skeleton" key={i} aria-hidden="true">
     <div className="surveyor-skeleton-block title"/><div className="surveyor-skeleton-block sub"/>
     <div className="surveyor-skeleton-block details"/>
   </div>)}
 </div>;
}
