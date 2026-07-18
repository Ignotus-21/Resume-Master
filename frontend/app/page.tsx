'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, Variants } from 'framer-motion';
import {
  UserRound, LayoutDashboard, FileText, ArrowRight, LucideIcon,
  UploadCloud, Wand2, Download, KeyRound, ShieldCheck, Rocket,
  Mail, Gauge, MessagesSquare, Contact,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
};

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  return (
    <div className="flex flex-col items-center overflow-x-hidden">
      {/* Hero */}
      <div className="relative w-full overflow-hidden flex justify-center pt-24 pb-20 px-4">
        {/* Animated Background Blobs */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-full z-0 opacity-50 pointer-events-none">
          <div className="absolute top-0 -left-10 w-96 h-96 bg-[#1a73e8] rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
          <div className="absolute top-0 -right-10 w-96 h-96 bg-[#34a853] rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-20 left-20 w-96 h-96 bg-[#ea4335] rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative z-10 text-center max-w-3xl mx-auto"
        >
          <h1 className="text-5xl md:text-7xl font-extrabold text-[#202124] leading-tight mb-8 tracking-tight">
            Master your career with <br className="hidden md:block"/>
            <span className="bg-gradient-to-r from-[#1a73e8] via-[#ea4335] to-[#f9ab00] bg-clip-text text-transparent animate-gradient-x">
              an AI-powered platform.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-[#5f6368] leading-relaxed mb-10 max-w-2xl mx-auto font-light">
            Keep one master profile, track every application, and let AI tailor an ATS-optimized
            LaTeX resume for each job in seconds, with real feedback on what&apos;s missing.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            {!loading && user ? (
              <Button className="px-8 py-4 text-lg rounded-full shadow-[0_4px_14px_0_rgba(0,0,0,0.1)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)] transition-all group" onClick={() => router.push('/dashboard')}>
                Go to Dashboard <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            ) : (
              <>
                <Button variant="secondary" className="px-8 py-4 text-lg rounded-full w-full sm:w-auto bg-white" onClick={() => router.push('/dashboard')}>
                  Continue for Free
                </Button>
                <Button className="px-8 py-4 text-lg rounded-full shadow-[0_4px_14px_0_rgba(0,0,0,0.1)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)] transition-all w-full sm:w-auto group" onClick={() => router.push('/signup')}>
                  Sign Up <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </>
            )}
          </div>
          {!loading && !user && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="text-sm text-[#5f6368] mt-6">
              No account needed to try it out. <Link href="/login" className="text-[#1a73e8] hover:text-[#174ea6] hover:underline transition">Already have one? Log in</Link>
            </motion.p>
          )}
        </motion.div>
      </div>

      {/* Feature cards */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl mb-32 px-4"
      >
        <FeatureCard icon={UserRound} title="Master Profile" desc="Keep your experience, skills, and projects in one reusable place." link="/profile" accent="from-blue-500 to-cyan-400" />
        <FeatureCard icon={LayoutDashboard} title="Job Tracker" desc="Track applications, filter by status, and see your funnel." link="/dashboard" accent="from-emerald-500 to-teal-400" />
        <FeatureCard icon={FileText} title="Resume Creator" desc="Generate tailored, ATS-safe resumes for any job in seconds." link="/resumes" accent="from-purple-500 to-pink-400" />
        <FeatureCard icon={Mail} title="Cover Letters" desc="Personalized cover letters with tone and length controls." link="/cover-letters" accent="from-pink-500 to-rose-400" />
        <FeatureCard icon={Gauge} title="ATS Checker" desc="Score your profile against a job and see what's missing." link="/ats-checker" accent="from-cyan-500 to-blue-400" />
        <FeatureCard icon={MessagesSquare} title="Mock Interview" desc="Practice role-specific questions with instant AI feedback." link="/interview" accent="from-amber-500 to-orange-400" />
        <FeatureCard icon={Contact} title="LinkedIn Optimizer" desc="Turn your profile into a keyword-rich LinkedIn headline & About." link="/linkedin" accent="from-indigo-500 to-purple-400" />
        <FeatureCard icon={UploadCloud} title="Import from LinkedIn" desc="Upload your LinkedIn PDF export and we'll fill your profile." link="/profile" accent="from-sky-500 to-blue-400" />
        <FeatureCard icon={Wand2} title="Bullet Coach" desc="Turn thin bullet points into strong, metric-driven ones with AI." link="/resumes" accent="from-orange-500 to-red-400" />
      </motion.div>

      {/* How it works */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-5xl mb-32 px-4"
      >
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-[#202124] mb-4">How it works</h2>
          <p className="text-[#5f6368] text-lg">Three steps from resume to application-ready.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          <div className="hidden md:block absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#dadce0] to-transparent -translate-y-1/2 z-0" />
          <Step icon={UploadCloud} step="1" title="Import your resume" desc="Upload a PDF or paste your existing resume, and Gemini extracts your experience, skills, and projects into one master profile." />
          <Step icon={Wand2} step="2" title="Tailor it to the job" desc="Paste a job description and generate a rewritten, keyword-matched LaTeX resume in seconds, with an ATS match score and gap analysis." />
          <Step icon={Download} step="3" title="Export and apply" desc="Download as PDF or DOCX, track the application's status, and iterate as you go." />
        </div>
      </motion.div>

      {/* Pricing / quota explainer */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-4xl mb-24 grid grid-cols-1 md:grid-cols-2 gap-6 px-4"
      >
        <Card className="p-8">
          <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-6 border border-blue-100">
            <Rocket className="h-6 w-6 text-[#1a73e8]" />
          </div>
          <h3 className="text-xl font-bold text-[#202124] mb-3">Free to try</h3>
          <p className="text-[#5f6368] text-sm leading-relaxed">
            Every account (and guest session) gets a shared pool of free AI requests, refreshed
            every few hours, no card required.
          </p>
        </Card>
        <Card className="p-8 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-[#f8f9fa] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-6 border border-blue-100 relative z-10">
            <KeyRound className="h-6 w-6 text-[#1a73e8]" />
          </div>
          <h3 className="text-xl font-bold text-[#202124] mb-3 relative z-10">Unlimited with your own key</h3>
          <p className="text-[#5f6368] text-sm leading-relaxed relative z-10">
            Sign up and add your own Gemini API key in Settings to remove the limit entirely.
            It&apos;s encrypted at rest and only ever used for your requests.
          </p>
        </Card>
      </motion.div>

      <div className="flex items-center gap-2 text-[#5f6368] text-sm mb-16 pb-10 border-b border-[#dadce0] w-full justify-center">
        <ShieldCheck className="h-4 w-4" />
        Guest sessions are private and never shared across devices.
      </div>
    </div>
  );
}

const FeatureCard = ({ icon: Icon, title, desc, link, accent }: { icon: LucideIcon; title: string; desc: string; link: string; accent: string; }) => (
  <motion.div variants={itemVariants} className="h-full">
    <Link href={link} className="block h-full outline-none">
      <Card hoverable className="p-6 h-full flex flex-col group cursor-pointer">
        <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${accent} flex items-center justify-center mb-6 shadow-lg transform group-hover:scale-110 transition-transform duration-300`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-xl font-bold text-[#202124] mb-2 flex items-center gap-2">
          {title}
          <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-[#1a73e8]" />
        </h2>
        <p className="text-[#5f6368] text-sm leading-relaxed font-light">{desc}</p>
      </Card>
    </Link>
  </motion.div>
);

const Step = ({ icon: Icon, step, title, desc }: { icon: LucideIcon; step: string; title: string; desc: string }) => (
  <Card className="p-8 relative z-10">
    <div className="absolute -top-4 -left-4 h-10 w-10 rounded-full bg-[#202124] text-white font-bold flex items-center justify-center shadow-lg border-4 border-white">
      {step}
    </div>
    <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center mb-6 mt-2 border border-blue-100">
      <Icon className="h-6 w-6 text-[#1a73e8]" />
    </div>
    <h3 className="text-xl font-bold text-[#202124] mb-3">{title}</h3>
    <p className="text-[#5f6368] text-sm leading-relaxed font-light">{desc}</p>
  </Card>
);
