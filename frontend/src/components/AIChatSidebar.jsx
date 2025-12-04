import React, { useState, useEffect, useRef } from 'react';

export default function AIChatSidebar({ apiUrl = 'http://localhost:5000/api/gemini', storageKey = 'ai-chat-sidebar-history', maxContextMessages = 12 }) {
  // messages: { role: 'user'|'assistant'|'system', text: string, id: string, ts: number }
  const [messages, setMessages] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn('Failed to parse chat history', e);
      return [];
    }
  });

  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const [position, setPosition] = useState({ x: 20, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const listEndRef = useRef(null);
  const dragHandleRef = useRef(null);

  useEffect(() => {
    // save history to localStorage whenever messages change (debounced-ish)
    const id = setTimeout(() => {
      try { localStorage.setItem(storageKey, JSON.stringify(messages)); } catch (e) { console.warn(e); }
    }, 200);
    return () => clearTimeout(id);
  }, [messages, storageKey]);

  useEffect(() => {
    // scroll to bottom whenever messages change
    if (listEndRef.current) {
      listEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages]);

  // Drag handlers (React 19 compatible, no findDOMNode)
  useEffect(() => {
    const dragHandle = dragHandleRef.current;
    if (!dragHandle) return;

    const onPointerDown = (e) => {
      if (e.button !== 0) return; // left click only
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    };

    const onPointerMove = (e) => {
      if (!isDragging) return;
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      // constrain to viewport (left-docked UX)
      const maxX = window.innerWidth - 400;
      const maxY = window.innerHeight - 200;
      
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    };

    const onPointerUp = () => {
      setIsDragging(false);
    };

    dragHandle.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      dragHandle.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [isDragging, dragOffset, position]);

  function generateId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
  }

  function appendMessage(msg) {
    setMessages(prev => [...prev, msg]);
  }

  async function sendMessage(text) {
    if (!text.trim()) return;
    setError(null);
    setIsSending(true);

    const userMsg = { role: 'user', text: text.trim(), id: generateId(), ts: Date.now() };
    appendMessage(userMsg);
    setInput('');

    // prepare context: last N messages (including system)
    const context = [...messages, userMsg].slice(-maxContextMessages);

    try {
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: context })
      });

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Server error: ${resp.status} ${txt}`);
      }

      // Server returns: { assistant: { text: '...' }, raw: {...optional Gemini raw...} }
      const data = await resp.json();
      const assistantText = data?.assistant?.text ?? (data?.text ?? 'No response');

      const assistantMsg = { role: 'assistant', text: assistantText, id: generateId(), ts: Date.now() };
      appendMessage(assistantMsg);

    } catch (err) {
      console.error('sendMessage error', err);
      setError(err.message || String(err));
      // keep a visible assistant-like error message
      appendMessage({ role: 'assistant', text: `Error: ${err.message || 'Failed to get response'}`, id: generateId(), ts: Date.now() });
    } finally {
      setIsSending(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function clearHistory() {
    setMessages([]);
    localStorage.removeItem(storageKey);
  }

  return (
    <aside
      ref={containerRef}
      className="w-96 max-w-[90vw] h-full min-h-0 bg-slate-900 text-white shadow-2xl rounded-xl flex flex-col overflow-hidden"
      style={{ cursor: isDragging ? 'grabbing' : 'default' }}
    >
      {/* Header / drag handle */}
      <div
        ref={dragHandleRef}
        className="ai-handle flex items-center justify-between px-3 py-2 cursor-grab bg-gradient-to-r from-sky-500 to-indigo-600 text-white"
        style={{ userSelect: isDragging ? 'none' : 'auto' }}
      >
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3-3 3 3m0 6l-3 3-3-3" />
          </svg>
          <span className="font-semibold">AI Chat</span>
          <span className="ml-1 text-xs opacity-80">(DeepSeek)</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={clearHistory} title="Clear conversation" className="text-sm opacity-90 hover:opacity-100">Clear</button>
          <button
            onClick={() => {
              // collapse: move to right edge and shrink, simple UX
              const el = containerRef.current;
              if (!el) return;
              if (el.classList.contains('!h-12')) {
                el.classList.remove('!h-12');
              } else {
                el.classList.add('!h-12');
              }
            }}
            title="Collapse"
            className="text-sm opacity-90 hover:opacity-100"
          >Toggle</button>
        </div>
      </div>

      {/* Conversation area */}
      <div className="flex-1 overflow-auto p-3 bg-slate-900 text-white">
        <div className="flex flex-col gap-3">
          {messages.length === 0 && (
            <div className="text-sm text-slate-300">Say hi — your conversation will be saved locally.</div>
          )}

          {messages.map(m => (
            <div key={m.id} className={`max-w-full break-words ${m.role === 'user' ? 'self-end text-right' : 'self-start text-left'}`}>
              <div className={`${m.role === 'user' ? 'inline-block bg-sky-600 text-white rounded-xl px-3 py-2' : 'inline-block bg-slate-700 text-white rounded-xl px-3 py-2'}`}>
                <div className="whitespace-pre-wrap">{m.text}</div>
              </div>
            </div>
          ))}
          <div ref={listEndRef} />
        </div>
      </div>

      {/* Footer input area */}
      <div className="px-3 py-2 bg-slate-800 border-t border-slate-700">
        <div className="flex items-end gap-2">
          <textarea
            aria-label="Type a message"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={isSending ? 'Waiting for response...' : 'Type a message — Enter to send, Shift+Enter for newline'}
            className="flex-1 min-h-[42px] max-h-36 resize-none rounded-md px-3 py-2 shadow-sm border border-slate-700 bg-slate-800 text-white text-sm focus:outline-none"
          />
          <div className="flex flex-col gap-2">
            <button
              disabled={isSending}
              onClick={() => sendMessage(input)}
              className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm disabled:opacity-50"
            >{isSending ? 'Sending...' : 'Send'}</button>
            <button title="Insert system prompt" onClick={() => {
              const systemPrompt = "You are a helpful assistant for my travel web app. Keep answers short and provide links where relevant.";
              appendMessage({ role: 'system', text: systemPrompt, id: generateId(), ts: Date.now() });
            }} className="text-xs opacity-80">Add system</button>
          </div>
        </div>
        {error && <div className="text-xs text-red-500 mt-2">{error}</div>}
      </div>
    </aside>
  );
}
