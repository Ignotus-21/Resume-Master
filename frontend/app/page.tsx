import Link from 'next/link';
import { UserRound, LayoutDashboard, FileText, MessageSquareText, ArrowRight, LucideIcon } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col items-center min-h-[80vh]">
      <div className="text-center max-w-2xl mx-auto pt-16 pb-20">
        <span className="inline-block text-xs font-semibold uppercase tracking-widest text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-full px-3 py-1 mb-6">
          Powered by Gemini AI
        </span>
        <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-6">
          Build resumes that{' '}
          <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            get you hired
          </span>
        </h1>
        <p className="text-lg text-slate-400 leading-relaxed">
          Automate your job application process. Manage your master profile, track jobs,
          and generate ATS-optimized LaTeX resumes tailored to every role.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
        <FeatureCard
          icon={UserRound}
          title="Master Profile"
          desc="Update your core experience, skills, and projects in one place."
          link="/profile"
          accent="from-blue-500 to-blue-600"
        />
        <FeatureCard
          icon={LayoutDashboard}
          title="Job Tracker"
          desc="Track applications and analyze job descriptions at a glance."
          link="/dashboard"
          accent="from-emerald-500 to-emerald-600"
        />
        <FeatureCard
          icon={FileText}
          title="Resume Creator"
          desc="Generate tailored LaTeX resumes for specific jobs, instantly."
          link="/resumes"
          accent="from-purple-500 to-purple-600"
        />
        <FeatureCard
          icon={MessageSquareText}
          title="AI Chat Assistant"
          desc="Chat with Gemini to refine your content and get feedback."
          link="/chat"
          accent="from-orange-500 to-orange-600"
        />
      </div>
    </div>
  );
}

const FeatureCard = ({
  icon: Icon,
  title,
  desc,
  link,
  accent,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  link: string;
  accent: string;
}) => (
  <Link href={link} className="group block h-full">
    <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700 h-full transition hover:border-slate-600 hover:shadow-xl hover:shadow-black/20 hover:-translate-y-0.5">
      <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${accent} flex items-center justify-center mb-4 shadow-lg`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <h2 className="text-lg font-bold text-slate-100 mb-1.5 flex items-center gap-1.5">
        {title}
        <ArrowRight className="h-4 w-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition text-blue-400" />
      </h2>
      <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
    </div>
  </Link>
);
