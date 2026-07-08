'use client';
import Link from 'next/link';
import {
  UserRound, LayoutDashboard, FileText, ArrowRight, LucideIcon,
  UploadCloud, Wand2, Download, KeyRound, ShieldCheck, Rocket,
  Mail, Gauge, MessagesSquare, Contact,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/Button';

export default function Home() {
  const { user, loading } = useAuth();

  return (
    <div className="flex flex-col items-center">
      {/* Hero */}
      <div className="text-center max-w-2xl mx-auto pt-16 pb-12">
        <span className="inline-block text-xs font-semibold uppercase tracking-widest text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-full px-3 py-1 mb-6">
          Powered by Gemini AI
        </span>
        <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-6">
          Build resumes that{' '}
          <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            get you hired
          </span>
        </h1>
        <p className="text-lg text-slate-400 leading-relaxed mb-8">
          Keep one master profile, track every application, and let AI tailor an ATS-optimized
          LaTeX resume for each job in seconds — with real feedback on what's missing.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {!loading && user ? (
            <Link href="/dashboard">
              <Button className="px-8 py-3 text-base">
                Go to Dashboard <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/dashboard">
                <Button variant="secondary" className="px-8 py-3 text-base w-full sm:w-auto">
                  Continue for Free
                </Button>
              </Link>
              <Link href="/signup">
                <Button className="px-8 py-3 text-base w-full sm:w-auto">
                  Sign Up <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </>
          )}
        </div>
        {!loading && !user && (
          <p className="text-sm text-slate-500 mt-4">
            No account needed to try it out. <Link href="/login" className="text-blue-400 hover:underline">Already have one? Log in</Link>
          </p>
        )}
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-5xl mb-20">
        <FeatureCard
          icon={UserRound}
          title="Master Profile"
          desc="Keep your experience, skills, and projects in one reusable place."
          link="/profile"
          accent="from-blue-500 to-blue-600"
        />
        <FeatureCard
          icon={LayoutDashboard}
          title="Job Tracker"
          desc="Track applications, filter by status, and see your funnel."
          link="/dashboard"
          accent="from-emerald-500 to-emerald-600"
        />
        <FeatureCard
          icon={FileText}
          title="Resume Creator"
          desc="Generate tailored, ATS-safe resumes for any job in seconds."
          link="/resumes"
          accent="from-purple-500 to-purple-600"
        />
        <FeatureCard
          icon={Mail}
          title="Cover Letters"
          desc="Personalized cover letters with tone and length controls."
          link="/cover-letters"
          accent="from-pink-500 to-pink-600"
        />
        <FeatureCard
          icon={Gauge}
          title="ATS Checker"
          desc="Score your profile against a job and see what's missing."
          link="/ats-checker"
          accent="from-cyan-500 to-cyan-600"
        />
        <FeatureCard
          icon={MessagesSquare}
          title="Mock Interview"
          desc="Practice role-specific questions with instant AI feedback."
          link="/interview"
          accent="from-amber-500 to-amber-600"
        />
        <FeatureCard
          icon={Contact}
          title="LinkedIn Optimizer"
          desc="Turn your profile into a keyword-rich LinkedIn headline & About."
          link="/linkedin"
          accent="from-sky-500 to-sky-600"
        />
        <FeatureCard
          icon={UploadCloud}
          title="Import from LinkedIn"
          desc="Upload your LinkedIn PDF export and we'll fill your profile."
          link="/profile"
          accent="from-indigo-500 to-indigo-600"
        />
        <FeatureCard
          icon={Wand2}
          title="AI Chat Assistant"
          desc="Chat with Gemini to refine your content and get advice."
          link="/chat"
          accent="from-orange-500 to-orange-600"
        />
      </div>

      {/* How it works */}
      <div className="w-full max-w-4xl mb-20">
        <h2 className="text-2xl font-bold text-white text-center mb-2">How it works</h2>
        <p className="text-slate-400 text-center mb-10">Three steps from resume to application-ready.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Step icon={UploadCloud} step="1" title="Import your resume" desc="Upload a PDF or paste your existing resume — Gemini extracts your experience, skills, and projects into one master profile." />
          <Step icon={Wand2} step="2" title="Tailor it to the job" desc="Paste a job description and generate a rewritten, keyword-matched LaTeX resume in seconds, with an ATS match score and gap analysis." />
          <Step icon={Download} step="3" title="Export and apply" desc="Download as PDF or DOCX, track the application's status, and iterate with the AI chat assistant as you go." />
        </div>
      </div>

      {/* Pricing / quota explainer */}
      <div className="w-full max-w-4xl mb-20 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700">
          <Rocket className="h-8 w-8 text-blue-400 mb-3" />
          <h3 className="text-lg font-bold text-slate-100 mb-1.5">Free to try</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Every account (and guest session) gets a shared pool of free AI requests, refreshed
            every few hours — no card required.
          </p>
        </div>
        <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700">
          <KeyRound className="h-8 w-8 text-purple-400 mb-3" />
          <h3 className="text-lg font-bold text-slate-100 mb-1.5">Unlimited with your own key</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Sign up and add your own Gemini API key in Settings to remove the limit entirely —
            it's encrypted at rest and only ever used for your requests.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-slate-500 text-sm mb-16">
        <ShieldCheck className="h-4 w-4" />
        Guest sessions are private and never shared across devices.
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

const Step = ({ icon: Icon, step, title, desc }: { icon: LucideIcon; step: string; title: string; desc: string }) => (
  <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-800 relative">
    <span className="absolute -top-3 -left-3 h-7 w-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shadow-lg">
      {step}
    </span>
    <Icon className="h-7 w-7 text-blue-400 mb-3" />
    <h3 className="font-bold text-slate-100 mb-1.5">{title}</h3>
    <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
  </div>
);
