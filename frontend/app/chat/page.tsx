'use client';
import { useState, useEffect, useRef } from 'react';
import { Bot, Send, Sparkles, ShieldAlert } from 'lucide-react';
import { apiJson } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';

export default function ChatPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startSession();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const startSession = async () => {
    try {
      setError('');
      const data = await apiJson('/api/ai/start', 'POST', { contextType: 'General' });
      setSessionId(data._id);
      setMessages(data.history || []);
    } catch (error) {
      console.error('Error starting chat:', error);
      setError('Failed to start chat session. Check backend.');
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !sessionId) return;

    const userMsg = { role: 'user', parts: [{ text: input }] };
    setMessages((prev) => [...(prev || []), userMsg]);
    setInput('');
    setSending(true);
    setError('');

    try {
      const data = await apiJson('/api/ai/send', 'POST', { sessionId, message: userMsg.parts[0].text });
      setMessages(data.history || []);
    } catch (error: any) {
      if (error.code === 'QUOTA_EXCEEDED' || (error.message && error.message.toLowerCase().includes('quota exceeded'))) {
        setMessages((prev) => [...prev, { role: 'model', isQuotaError: true, parts: [{ text: error.message }] }]);
      } else {
        const errorText = error.message || 'Could not reach server.';
        setMessages((prev) => [...prev, { role: 'model', parts: [{ text: `Error: ${errorText}` }] }]);
      }
    }
    setSending(false);
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto h-[85vh] flex flex-col">
      <h1 className="text-3xl font-bold mb-6 text-[#202124] flex items-center gap-2">
        <Sparkles className="h-6 w-6 text-[#1a73e8]" />
        AI Chat Assistant
      </h1>

      {error && (
        <div className="bg-[#fce8e6] text-[#d93025] p-3 rounded-xl mb-4 border border-[#d93025] text-sm flex items-center justify-between gap-3">
          <span>{error}</span>
          {!sessionId && (
            <button onClick={startSession} className="shrink-0 font-semibold underline hover:text-[#202124]">Retry</button>
          )}
        </div>
      )}

      <div
        ref={scrollRef}
        className="flex-1 bg-[#f8f9fa]/60 border border-[#dadce0] rounded-2xl shadow-lg backdrop-blur-sm p-6 overflow-y-auto mb-4 space-y-4 custom-scrollbar"
      >
        {(!messages || messages.length === 0) && (
          <div className="text-center text-[#5f6368] mt-20">
            <Bot className="h-10 w-10 mx-auto mb-4 text-[#5f6368]" />
            <p>Start a conversation with Gemini AI about your resume or job applications.</p>
          </div>
        )}
        {messages && messages.map((msg, idx) => {
          if (msg.isQuotaError) {
            return (
              <div key={idx} className="flex justify-center my-4">
                <div className="bg-[#fce8e6] border border-[#d93025] rounded-xl p-6 text-center max-w-sm shadow-sm">
                  <ShieldAlert className="w-8 h-8 text-[#d93025] mx-auto mb-3" />
                  <h3 className="text-[#d93025] font-bold text-lg mb-2">Token Limit Reached</h3>
                  <p className="text-[#5f6368] text-sm mb-4">
                    You have consumed all your free AI tokens. Add your own Gemini API key to continue chatting!
                  </p>
                  <Button onClick={() => router.push('/profile')} className="bg-[#d93025] text-white hover:bg-[#b3261e] w-full">
                    Add API Key in Settings
                  </Button>
                </div>
              </div>
            );
          }
          return (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-[#1a73e8] text-white rounded-br-none'
                  : 'bg-white text-[#202124] rounded-bl-none'
              }`}>
                {msg.parts && msg.parts[0] ? msg.parts[0].text : '...'}
              </div>
            </div>
          );
        })}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-white text-[#5f6368] p-3 rounded-lg animate-pulse italic rounded-bl-none">
              Gemini is typing...
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="flex gap-4">
        <input
          className="flex-1 border border-[#dadce0] bg-[#f8f9fa] text-[#202124] p-4 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition placeholder-slate-500"
          placeholder="Ask for advice..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
        />
        <Button type="submit" disabled={sending || !input.trim()} className="px-8">
          <Send className="h-4 w-4" />
          Send
        </Button>
      </form>
    </div>
  );
}
