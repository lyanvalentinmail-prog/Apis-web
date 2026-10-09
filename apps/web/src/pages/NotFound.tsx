import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-5 px-4 py-28 text-center">
      <p className="font-mono text-6xl font-black text-brat">404</p>
      <h1 className="text-2xl font-bold">Esta ruta no existe</h1>
      <p className="text-sm text-muted">
        Quizá buscabas la <Link to="/docs" className="text-brat hover:underline">documentación</Link> o el{' '}
        <Link to="/endpoints" className="text-brat hover:underline">explorador de endpoints</Link>.
      </p>
      <Link to="/" className="btn-primary">
        Volver al inicio
      </Link>
    </div>
  );
}
