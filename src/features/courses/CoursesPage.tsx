import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, DraftingCompass, ExternalLink, FileText, FolderOpen, Map } from 'lucide-react';
import { publishedCourses } from './courseCatalog';

const guides = [
  {
    title: 'Prepare o imóvel no mapa',
    description: 'Localize a área, confira os dados do imóvel e organize os arquivos de trabalho.',
    steps: ['Abra um projeto salvo ou inicie um novo.', 'Importe ou desenhe o perímetro e confira a localização.', 'Salve o projeto antes de seguir para os documentos.'],
    path: '/mapa/',
    action: 'Abrir mapa',
    icon: Map,
  },
  {
    title: 'Monte o croqui',
    description: 'Revise a geometria e os elementos visuais do croqui antes de compartilhar ou imprimir.',
    steps: ['Selecione o projeto e o imóvel.', 'Ajuste rótulos, cotas e elementos da planta.', 'Confira a prévia e salve as alterações.'],
    path: '/mapas/',
    action: 'Abrir croqui',
    icon: DraftingCompass,
  },
  {
    title: 'Gere o memorial',
    description: 'Confira os dados e as confrontações para preparar o memorial descritivo.',
    steps: ['Escolha o projeto e a área correspondente.', 'Revise os vértices e os confrontantes.', 'Confira o texto gerado antes de exportar.'],
    path: '/memorial/',
    action: 'Abrir memorial',
    icon: FileText,
  },
  {
    title: 'Finalize a prancha técnica',
    description: 'Organize a apresentação técnica do levantamento e confira a saída antes de exportar.',
    steps: ['Selecione o projeto e a gleba.', 'Ajuste o formato da folha e os elementos visíveis.', 'Revise a prévia antes de imprimir ou baixar.'],
    path: '/pranchas/',
    action: 'Abrir pranchas',
    icon: BookOpen,
  },
  {
    title: 'Retome um projeto salvo',
    description: 'Encontre seus trabalhos na nuvem e continue a edição de onde parou.',
    steps: ['Pesquise pelo nome do imóvel ou projeto.', 'Abra o trabalho que deseja continuar.', 'Salve as mudanças para sincronizar a versão atual.'],
    path: '/nuvem/',
    action: 'Ver projetos',
    icon: FolderOpen,
  },
];

export function CoursesPage() {
  return (
    <main className="workspace-main courses-page">
      <div className="workspace-container">
        <div className="page-heading">
          <span className="heading-icon"><BookOpen size={28} /></span>
          <h1>Guias e treinamentos</h1>
        </div>
        <p className="courses-lead">Acesse cada ferramenta e siga um roteiro curto para avançar no seu trabalho.</p>

        <section className="courses-guides" aria-labelledby="courses-guides-title">
          <div className="courses-section-heading">
            <div>
              <span>ACADEMIA SURVEYOR</span>
              <h2 id="courses-guides-title">Roteiros práticos</h2>
            </div>
            <p>Você pode abrir qualquer etapa diretamente e voltar a este guia quando precisar.</p>
          </div>
          <div className="course-grid">
            {guides.map(({ title, description, steps, path, action, icon: Icon }) => (
              <article className="course-card course-guide-card" key={path}>
                <span className="course-guide-icon"><Icon size={21} /></span>
                <div className="course-guide-copy">
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
                <ol className="course-guide-steps">{steps.map(step => <li key={step}>{step}</li>)}</ol>
                <Link className="official-open" to={path}>{action}<ArrowRight size={15} /></Link>
              </article>
            ))}
          </div>
        </section>

        {publishedCourses.length > 0 && (
          <section className="courses-published" aria-labelledby="published-courses-title">
            <div className="courses-section-heading">
              <div><span>CONTEÚDO PUBLICADO</span><h2 id="published-courses-title">Cursos e treinamentos</h2></div>
            </div>
            <div className="course-grid">
              {publishedCourses.map(course => (
                <article className="course-card" key={course.id}>
                  {course.imageUrl && <img src={course.imageUrl} alt="" loading="lazy" />}
                  <h3>{course.title}</h3>
                  <p>{course.description}</p>
                  {typeof course.lessons === 'number' && <small>{course.lessons} aulas</small>}
                  <a className="official-open" href={course.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={14} /> Acessar curso
                  </a>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
