'use client';

export function FeedbackPanel({
  analyzing,
  recommendations,
}: {
  analyzing: boolean;
  recommendations: any;
}) {
  return (
    <div className="w-full min-h-[600px] border border-[#dadce0] p-6 rounded-xl bg-[#f8f9fa] text-[#202124]">
      {analyzing ? (
          <div className="text-center py-20 animate-pulse text-[#1a73e8]">AI Analysis in progress...</div>
      ) : recommendations ? (
          <div className="space-y-6">
              <div className="flex items-center gap-4 border-b border-[#dadce0] pb-4">
                  <div className="text-4xl font-bold text-[#1e8e3e]">{recommendations.matchScore}%</div>
                  <div>
                      <div className="text-lg font-bold text-[#202124]">Match Score</div>
                      <div className="text-sm text-[#5f6368]">Based on Job Description</div>
                  </div>
              </div>

              <div>
                  <h3 className="text-lg font-bold text-[#d93025] mb-2">Missing Skills</h3>
                  <div className="flex flex-wrap gap-2">
                      {recommendations.missingSkills?.map((s: string, i: number) => (
                          <span key={i} className="bg-[#fce8e6] text-[#d93025] px-3 py-1 rounded-full text-sm border border-[#d93025]">{s}</span>
                      ))}
                  </div>
              </div>

              <div>
                  <h3 className="text-lg font-bold text-[#f9ab00] mb-2">Missing Keywords</h3>
                  <div className="flex flex-wrap gap-2">
                      {recommendations.missingKeywords?.map((k: string, i: number) => (
                          <span key={i} className="bg-yellow-50 text-yellow-700 px-3 py-1 rounded-full text-sm border border-yellow-200">{k}</span>
                      ))}
                  </div>
              </div>

              <div>
                  <h3 className="text-lg font-bold text-[#1a73e8] mb-2">Gap Analysis</h3>
                  <p className="text-[#202124] leading-relaxed bg-[#f8f9fa] p-4 rounded-lg border border-[#dadce0]">
                      {recommendations.gapAnalysis}
                  </p>
              </div>

              <div>
                  <h3 className="text-lg font-bold text-[#1e8e3e] mb-2">Recommended Improvements</h3>
                  <ul className="list-disc list-outside ml-5 text-[#202124] space-y-2">
                      {recommendations.improvements?.map((imp: string, i: number) => (
                          <li key={i}>{imp}</li>
                      ))}
                  </ul>
              </div>
          </div>
      ) : (
          <div className="text-center py-20 text-[#5f6368]">
              Click &quot;Feedback&quot; to analyze your resume against the job description.
          </div>
      )}
    </div>
  );
}
