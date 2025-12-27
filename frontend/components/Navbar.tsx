import Link from 'next/link';

const Navbar = () => {
  return (
    <nav className="bg-slate-800 text-white p-4 shadow-lg border-b border-slate-700">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-xl font-bold tracking-tight text-blue-400">Super Master Resume</Link>
        <div className="space-x-6 text-sm font-medium">
          <Link href="/dashboard" className="hover:text-blue-400 transition">Job Tracker</Link>
          <Link href="/profile" className="hover:text-blue-400 transition">Master Profile</Link>
          <Link href="/resumes" className="hover:text-blue-400 transition">Resumes</Link>
          <Link href="/chat" className="hover:text-blue-400 transition">AI Chat</Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
