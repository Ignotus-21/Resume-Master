import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-8">
      <h1 className="text-4xl font-bold text-center">
        Welcome to <span className="text-blue-600">Super Master Resume</span>
      </h1>
      <p className="text-xl text-gray-600 text-center max-w-2xl">
        Automate your job application process. Manage your master profile, track jobs, 
        and generate ATS-optimized LaTeX resumes with the power of Gemini AI.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
        <Card 
          title="Master Profile" 
          desc="Update your core experience, skills, and projects."
          link="/profile"
          color="bg-blue-500"
        />
        <Card 
          title="Job Tracker" 
          desc="Track applications and analyze job descriptions."
          link="/dashboard"
          color="bg-green-500"
        />
        <Card 
          title="Resume Creator" 
          desc="Generate tailored LaTeX resumes for specific jobs."
          link="/resumes"
          color="bg-purple-500"
        />
        <Card 
          title="AI Chat Assistant" 
          desc="Chat with Gemini to refine your content."
          link="/chat"
          color="bg-orange-500"
        />
      </div>
    </div>
  );
}

const Card = ({ title, desc, link, color }: { title: string, desc: string, link: string, color: string }) => (
  <Link href={link} className="block group">
    <div className={`p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200 h-full`}>
      <h2 className={`text-2xl font-bold mb-2 ${color} bg-clip-text text-transparent bg-gradient-to-r from-gray-800 to-gray-600 group-hover:text-blue-600`}>
        {title}
      </h2>
      <p className="text-gray-600">{desc}</p>
    </div>
  </Link>
);
