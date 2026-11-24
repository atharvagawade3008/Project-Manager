import React, { useEffect, useRef, useState } from 'react';
import { Bot, Send, AlertTriangle, Server, Loader2, Sparkles } from 'lucide-react';
import type { Project, AssistantMessage, OllamaStatus } from '../types';
import { api } from '../api/client';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

interface AiAssistantProps {
  activeProject?: Project | null;
  ollamaStatus?: OllamaStatus | null;
}

const QUICK_QUESTIONS = [
  'What should I work on next?',
  'What is blocking this project?',
  'How complete is this project really?',
  'Plan my next two weeks',
];

export const AiAssistant: React.FC<AiAssistantProps> = ({ activeProject, ollamaStatus }) => {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setMessages([]);
      setError(null);
      setModel(null);
      if (!activeProject) return;

      setLoadingHistory(true);
      try {
        const history = await api.getAssistantHistory(activeProject.id);
        if (!cancelled) setMessages(history);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Could not load the conversation.');
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [activeProject?.id]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length, sending]);

  const send = async (text?: string) => {
    const question = (text ?? input).trim();
    if (!question || sending || !activeProject) return;

    if (!ollamaStatus?.online) {
      setError('Ollama is offline. Start it with "ollama serve" and reopen this page.');
      return;
    }

    setError(null);
    setInput('');
    setSending(true);

    const optimistic: AssistantMessage = {
      id: `local-${Date.now()}`,
      role: 'USER',
      content: question,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const result = await api.sendAssistantMessage(activeProject.id, question);
      setModel(result.model);
      const history = await api.getAssistantHistory(activeProject.id);
      setMessages(history);
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(question);
      setError(err?.message || 'The assistant could not answer.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-[1000px] flex-col gap-4 px-4 py-5 sm:px-6 sm:py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] tracking-wide text-slate-500">
            Pages <span className="mx-1 text-slate-700">/</span> Assistant
          </div>
          <h1 className="mt-1.5 text-[26px] font-semibold leading-none text-white sm:text-[30px]">Assistant</h1>
          <p className="mt-1.5 truncate text-[11.5px] text-slate-500">
            {activeProject ? `Grounded in ${activeProject.name}` : 'Select a project to start'}
          </p>
        </div>

        <span
          className={`inline-flex items-center gap-2 rounded-xl border px-2.5 py-2 text-[11px] ${
            ollamaStatus?.online
              ? 'border-white/[0.08] bg-white/[0.03] text-slate-300'
              : 'border-rose-500/25 bg-rose-500/10 text-rose-300'
          }`}
        >
          <Server className="h-3.5 w-3.5" />
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: ollamaStatus?.online ? '#34d399' : '#fb7185' }} />
          {ollamaStatus?.online
            ? model || ollamaStatus.effectiveModel || ollamaStatus.activeModel
            : 'Ollama offline'}
        </span>
      </div>

      {!ollamaStatus?.online && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3 text-[11.5px] text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Ollama is not responding at {ollamaStatus?.endpoint || 'the configured endpoint'}. Start the local runtime
            with <code className="mx-1 rounded bg-black/30 px-1">ollama serve</code> to chat with the assistant.
          </span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-rose-500/25 bg-rose-500/[0.07] px-4 py-3 text-[11.5px] text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        {QUICK_QUESTIONS.map((question) => (
          <button
            key={question}
            onClick={() => send(question)}
            disabled={!activeProject || sending || !ollamaStatus?.online}
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-slate-400 transition-colors hover:border-white/[0.14] hover:text-white disabled:opacity-40"
          >
            {question}
          </button>
        ))}
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {loadingHistory ? (
            <div className="flex items-center gap-2 text-[11.5px] text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading conversation…
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-500/25 bg-cyan-500/10">
                <Sparkles className="h-5 w-5 text-cyan-400" />
              </div>
              <p className="mt-3 text-[13px] text-slate-200">
                {activeProject ? `Ask about ${activeProject.name}` : 'Select a project to begin'}
              </p>
              <p className="mt-1 max-w-sm text-[11.5px] leading-relaxed text-slate-500">
                Answers use the project's phases, task statuses, assessment scores and blockers — generated locally by
                Ollama.
              </p>
            </div>
          ) : (
            messages.map((message) => {
              const isUser = message.role === 'USER';
              return (
                <div key={message.id} className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  {!isUser && (
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04]">
                      <Bot className="h-3.5 w-3.5 text-cyan-400" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-relaxed sm:max-w-[75%] ${
                      isUser
                        ? 'bg-primary-500 text-white'
                        : 'border border-white/[0.065] bg-white/[0.03] text-slate-200'
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              );
            })
          )}

          {sending && (
            <div className="flex items-center gap-2.5 text-[11.5px] text-slate-500">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04]">
                <Bot className="h-3.5 w-3.5 text-cyan-400" />
              </div>
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {model || ollamaStatus?.effectiveModel || ollamaStatus?.activeModel || 'Ollama'} is thinking…
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-white/[0.06] bg-white/[0.015] p-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send();
            }}
            disabled={!activeProject || sending}
            placeholder={
              activeProject ? 'Ask about next steps, blockers or architecture…' : 'Select a project first'
            }
            className="flex-1 rounded-xl border border-white/[0.08] bg-[#121214] px-3.5 py-2.5 text-[12.5px] text-slate-100 placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none disabled:opacity-60"
          />
          <Button
            variant="primary"
            size="sm"
            onClick={() => send()}
            disabled={!activeProject || sending || !input.trim()}
            className="px-3 py-2.5"
            aria-label="Send message"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </Card>
    </div>
  );
};
