'use client';

// Compile-result pane shared by the Preview view and the Code view's right
// half: progress bar while compiling, error log, or the PDF itself.
// Parent must be position:relative for the progress bar.
export function PdfPane({
  isCompiling,
  compileError,
  pdfData,
}: {
  isCompiling: boolean;
  compileError: string | null;
  pdfData: string | null;
}) {
  return (
    <>
      {isCompiling && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-purple-500 animate-pulse z-10"></div>
      )}
      {compileError ? (
        <div className="p-4 bg-[#fce8e6] text-[#d93025] h-full overflow-auto font-mono text-xs whitespace-pre-wrap">
          <div className="font-bold mb-2">Compilation Error:</div>
          {compileError}
        </div>
      ) : pdfData ? (
        <iframe
          src={`data:application/pdf;base64,${pdfData}#toolbar=0&navpanes=0&scrollbar=0`}
          className="w-full h-full bg-white"
          title="Resume PDF Preview"
        />
      ) : (
        <div className="flex items-center justify-center h-full text-[#5f6368]">
          {isCompiling ? 'Compiling Preview...' : 'Generating Preview...'}
        </div>
      )}
    </>
  );
}
