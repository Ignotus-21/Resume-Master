'use client';
import { useState, useEffect, useRef } from 'react';
import { Bot, Send, Sparkles } from 'lucide-react';
import { apiJson } from '@/lib/api';
import { Button } from '@/components/ui/Button';

export default function ChatPage() {
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
      const errorText = error.message || 'Could not reach server.';
      setMessages((prev) => [...prev, { role: 'model', parts: [{ text: `Error: ${errorText}` }] }]);
    }
    setSending(false);
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto h-[85vh] flex flex-col">
      <h1 className="text-3xl font-bold mb-6 text-slate-100 flex items-center gap-2">
        <Sparkles className="h-6 w-6 text-blue-400" />
        AI Chat Assistant
      </h1>

      {error && <div className="bg-red-900/50 text-red-200 p-3 rounded-xl mb-4 border border-red-800 text-sm">{error}</div>}

      <div
        ref={scrollRef}
        className="flex-1 bg-slate-800/60 border border-slate-700 rounded-2xl shadow-lg backdrop-blur-sm p-6 overflow-y-auto mb-4 space-y-4 custom-scrollbar"
      >
        {(!messages || messages.length === 0) && (
          <div className="text-center text-slate-500 mt-20">
            <Bot className="h-10 w-10 mx-auto mb-4 text-slate-600" />
            <p>Start a conversation with Gemini AI about your resume or job applications.</p>
          </div>
        )}
        {messages && messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white rounded-br-none'
                : 'bg-slate-700 text-slate-100 rounded-bl-none'
            }`}>
              {msg.parts && msg.parts[0] ? msg.parts[0].text : '...'}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-slate-700 text-slate-400 p-3 rounded-lg animate-pulse italic rounded-bl-none">
              Gemini is typing...
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="flex gap-4">
        <input
          className="flex-1 border border-slate-700 bg-slate-900 text-white p-4 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition placeholder-slate-500"
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
