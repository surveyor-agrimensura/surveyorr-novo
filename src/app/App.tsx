import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { HomePage } from '../features/home/HomePage';
import { WorkspaceLayout } from '../components/layout/WorkspaceLayout';
import { PageErrorBoundary } from '../components/PageErrorBoundary';
import { RouteTransitionGuard } from './RouteTransitionGuard';
import { CookiePreferences } from '../components/CookiePreferences';
import {ConfirmDialogHost} from '../components/ConfirmDialogHost';
import { migrateLegacyOfflineDrafts } from '../lib/offlineDraftStore';
const LoginPage = lazy(() => import('../features/auth/LoginPage').then(module => ({ default: module.LoginPage })));
const ProjectsPage = lazy(() => import('../features/projects/ProjectsPage').then(module => ({ default: module.ProjectsPage })));
const SupportPage = lazy(() => import('../features/support/SupportPage').then(module => ({ default: module.SupportPage })));
const OfficialPage = lazy(() => import('../features/official/OfficialPage').then(module => ({ default: module.OfficialPage })));
const CoursesPage = lazy(() => import('../features/courses/CoursesPage').then(module => ({ default: module.CoursesPage })));
const TerritorialNavigator = lazy(() => import('../features/map/TerritorialNavigator').then(module => ({ default: module.TerritorialNavigator })));
const AdminPage = lazy(() => import('../features/admin/AdminPage').then(module => ({ default: module.AdminPage })));
const CustomizationPage = lazy(() => import('../features/customization/CustomizationPage').then(module => ({ default: module.CustomizationPage })));
const MemorialPage = lazy(() => import('../features/memorial/MemorialPage').then(module => ({ default: module.MemorialPage })));
const CroquiPage = lazy(() => import('../features/croqui/CroquiPage').then(module => ({ default: module.CroquiPage })));
const TechnicalSheetsPage = lazy(() => import('../features/documents/TechnicalSheetsPage').then(module => ({ default: module.TechnicalSheetsPage })));
const ConfrontationPage = lazy(() => import('../features/documents/ConfrontationPage').then(module => ({ default: module.ConfrontationPage })));
const ProjectSpreadsheetPage = lazy(() => import('../features/documents/ProjectSpreadsheetPage').then(module => ({ default: module.ProjectSpreadsheetPage })));
const EnvironmentalReportPage = lazy(() => import('../features/documents/EnvironmentalReportPage').then(module => ({ default: module.EnvironmentalReportPage })));
const PublicCarPage = lazy(() => import('../features/documents/PublicCarPage').then(module => ({ default: module.PublicCarPage })));
const MDTPage = lazy(() => import('../features/generations/MDTPage').then(module => ({ default: module.MDTPage })));
const AzimuthPage = lazy(() => import('../features/generations/AzimuthPage').then(module => ({ default: module.AzimuthPage })));
const REURBPage = lazy(() => import('../features/generations/REURBPage').then(module => ({ default: module.REURBPage })));
const LotCenterPage = lazy(() => import('../features/generations/LotCenterPage').then(module => ({ default: module.LotCenterPage })));
const PublicMapPage = lazy(() => import('../features/public/PublicMapPage').then(module => ({ default: module.PublicMapPage })));
const OperationalMap = lazy(() => import('../features/map/OperationalMap').then(module => ({ default: module.OperationalMap })));
const names:Record<string,string> = { '/':'Visão geral','/nuvem/':'Projetos','/suporte/':'Suporte','/acervos/':'Acervos oficiais','/cursos/':'Cursos','/mapa/':'Mapa e Cadastro','/mapa/trabalho/':'Editor de mapa','/admin/':'Administração','/customizacao/':'Personalização','/memorial/':'Memorial descritivo','/mapas/':'Mapas e croquis','/pranchas/':'Pranchas técnicas','/confrontacao/':'Cartas de confrontação','/ods/':'Planilha ODS','/consulta-car/':'Consulta Pública CAR','/ambiental/':'Relatório Ambiental','/planialtimetria/':'Planialtimetria / MDT','/perimetro-azimute/':'Perímetro por Azimute','/loteamento-reurb/':'Loteamento / REURB','/central-lotes/':'Central de Lotes' };
function PageTitle(){ const {pathname}=useLocation();useEffect(()=>{document.title=`${pathname.startsWith('/login')?'Entrar':names[pathname]||'Surveyor'} — Surveyor`;},[pathname]);return null;}
function OfflineDraftRecovery(){useEffect(()=>{void migrateLegacyOfflineDrafts();},[]);return null;}
function MapEntry(){
 const {session}=useAuth(); const location=useLocation();
 const previouslyOpened=Boolean(session&&sessionStorage.getItem('surveyor-map-visited-session-v1')==='1'&&sessionStorage.getItem('surveyor-map-place-v1'));
 if(previouslyOpened&&!new URLSearchParams(location.search).has('novo'))return <Navigate to="/mapa/trabalho/" replace/>;
 return <TerritorialNavigator/>;
}
function AdminGuard(){ const {session}=useAuth(); if(String(session?.user?.role||'').toLowerCase()!=='admin')return <Navigate to="/" replace/>;return <AdminPage/>; }
function Protected({children,home=false,bare=false}:{children:ReactNode;home?:boolean;bare?:boolean}){
 const {session,status,error,retry}=useAuth();
 if(status==='checking')return <div className="page-loading" role="status"><span className="loader"/>Validando sua sessão...</div>;
 if(status==='offline')return <div className="page-loading"><h1>Conexão indisponível</h1><p>{error}</p><button className="button primary" onClick={()=>void retry()}>Tentar novamente</button></div>;
 if(!session)return <Navigate to="/login/" replace/>;
 if(bare)return <PageErrorBoundary>{children}</PageErrorBoundary>;
 return <WorkspaceLayout home={home}><PageErrorBoundary>{children}</PageErrorBoundary></WorkspaceLayout>;
}
export function App(){return <><OfflineDraftRecovery/><RouteTransitionGuard/><PageTitle/><Suspense fallback={<div className="surveyor-route-loading" role="status" aria-label="Carregando módulo"><div className="surveyor-route-skeleton"/><div className="surveyor-route-skeleton short"/><div className="surveyor-route-skeleton wide"/></div>}><Routes>
 <Route path="/login/*" element={<LoginPage/>}/>
 <Route path="/publico/imovel/" element={<PublicMapPage/>}/>
 <Route path="/" element={<Protected home><HomePage/></Protected>}/>
 <Route path="/nuvem/" element={<Protected><ProjectsPage/></Protected>}/>
 <Route path="/suporte/" element={<Protected><SupportPage/></Protected>}/>
 <Route path="/acervos/" element={<Protected><OfficialPage/></Protected>}/>
 <Route path="/cursos/" element={<Protected><CoursesPage/></Protected>}/>
 <Route path="/mapa/" element={<Protected><MapEntry/></Protected>}/>
 <Route path="/admin/" element={<Protected><AdminGuard/></Protected>}/>
 <Route path="/memorial/" element={<Protected><MemorialPage/></Protected>}/>
 <Route path="/mapas/" element={<Protected><CroquiPage/></Protected>}/>
 <Route path="/pranchas/" element={<Protected><TechnicalSheetsPage/></Protected>}/>
 <Route path="/confrontacao/" element={<Protected><ConfrontationPage/></Protected>}/>
 <Route path="/ods/" element={<Protected><ProjectSpreadsheetPage/></Protected>}/>
 <Route path="/consulta-car/" element={<Protected><PublicCarPage/></Protected>}/>
 <Route path="/ambiental/" element={<Protected><EnvironmentalReportPage/></Protected>}/>
 <Route path="/planialtimetria/" element={<Protected><MDTPage/></Protected>}/>
 <Route path="/perimetro-azimute/" element={<Protected><AzimuthPage/></Protected>}/>
 <Route path="/loteamento-reurb/" element={<Protected><REURBPage/></Protected>}/>
 <Route path="/central-lotes/" element={<Protected><LotCenterPage/></Protected>}/>
 <Route path="/glebas/*" element={<Protected><Navigate to="/mapa/" replace/></Protected>}/>
 <Route path="/customizacao/" element={<Protected><CustomizationPage/></Protected>}/>
 <Route path="/mapa/trabalho/" element={<Protected bare><OperationalMap/></Protected>}/>
 <Route path="*" element={<Navigate to="/" replace/>}/>
 </Routes></Suspense><CookiePreferences/><ConfirmDialogHost/></>}
