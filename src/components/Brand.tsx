import { Link } from 'react-router-dom';

export function Wordmark({ className = '' }: { className?: string }) {
  return <img className={`wordmark ${className}`} src="/brand/nome.png" alt="SURVEYOR" />;
}
export function BrandLink({ to = '/', className = '' }: { to?: string; className?: string }) {
  return <Link className={`brand-link ${className}`} to={to} aria-label="Surveyor, página inicial"><Wordmark /></Link>;
}
export function RoundLogo({ className = '' }: { className?: string }) {
  return <img className={className} src="/brand/logo.png" alt="" aria-hidden="true" />;
}
