import { Outlet, Link } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { Navbar } from './Navbar';

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

function Footer() {
  const cols = [
    { title: 'e-learning', links: [['About', '/about'], ['Careers', '/careers'], ['Blog', '/blog'], ['Help & Support', '/help']] },
    { title: 'Learn', links: [['Browse courses', '/browse'], ['Become an instructor', '/teach'], ['Categories', '/browse']] },
    { title: 'Legal', links: [['Terms', '/terms'], ['Privacy', '/privacy'], ['Refund Policy', '/refund-policy'], ['Cookie Policy', '/cookies']] },
  ];
  return (
    <footer className="mt-16 bg-ink-900 text-gray-300">
      <div className="container-page grid grid-cols-2 gap-8 py-12 md:grid-cols-4">
        {cols.map((col) => (
          <div key={col.title}>
            <h4 className="mb-3 font-bold text-white">{col.title}</h4>
            <ul className="space-y-2 text-sm">
              {col.links.map(([label, to]) => (
                <li key={label}>
                  <Link to={to} className="hover:text-white">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <h4 className="mb-3 font-bold text-white">Stay in the loop</h4>
          <p className="text-sm text-gray-400">Learn anything, teach everything.</p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-5 text-sm text-gray-400 sm:flex-row">
          <div className="flex items-center gap-1.5 text-white">
            <GraduationCap className="h-5 w-5" />
            <span className="font-bold">e-learning</span>
          </div>
          <p>© {new Date().getFullYear()} e-learning, Inc. Built as a Phase-1 MVP.</p>
        </div>
      </div>
    </footer>
  );
}
