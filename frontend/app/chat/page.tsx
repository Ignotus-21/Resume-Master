'use client';
import { useState, useEffect } from 'react';

export default function ChatPage() {
  const [sessionId, setSessionId] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    startSession();
  }, []);

  const startSession = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/ai/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextType: 'General' }),
      });
      const data = await res.json();
      if (res.ok) {
        setSessionId(data._id);
        setMessages(data.history || []);
      } else {
        setError('Failed to start chat session. Check backend.');
      }
    } catch (error) {
      console.error('Error starting chat:', error);
      setError('Network error starting chat.');
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
      const res = await fetch('http://localhost:5000/api/ai/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: userMsg.parts[0].text }),
      });
      const data = await res.json();
      
      if (res.ok && data.history) {
        setMessages(data.history);
      } else {
        // Fallback or error display
        const errorText = data.message || 'Error from AI agent';
        setMessages((prev) => [...prev, { role: 'model', parts: [{ text: `Error: ${errorText}` }] }]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prev) => [...prev, { role: 'model', parts: [{ text: 'Error: Could not reach server.' }] }]);
    }
    setSending(false);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto h-[85vh] flex flex-col">
      <h1 className="text-3xl font-bold mb-6 text-slate-100">AI Chat Assistant</h1>
      
      {error && <div className="bg-red-900/50 text-red-200 p-3 rounded mb-4 border border-red-800">{error}</div>}

      <div className="flex-1 bg-slate-800 border border-slate-700 rounded-xl shadow-lg p-6 overflow-y-auto mb-4 space-y-4">
        {(!messages || messages.length === 0) && (
            <div className="text-center text-slate-500 mt-20">
                <span className="text-4xl mb-4 block">🤖</span>
                <p>Start a conversation with Gemini AI about your resume or job applications.</p>
            </div>
        )}
        {messages && messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${
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
        <button 
          type="submit" 
          disabled={sending || !input.trim()}
          className="bg-blue-600 text-white px-8 rounded-xl font-semibold hover:bg-blue-500 disabled:opacity-50 transition shadow-lg shadow-blue-900/50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
