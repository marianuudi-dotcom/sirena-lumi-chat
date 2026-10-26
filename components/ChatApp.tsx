"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Menu,
  X,
  Plus,
  Trash2,
  Send,
  Paperclip,
  SlidersHorizontal,
  Sparkles,
  MessageSquare,
  Pencil,
  Eraser,
  TriangleAlert,
  Lightbulb,
} from "lucide-react";

type ChatSummary = { id: string; title: string; updatedAt: string };
type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachmentName?: string | null;
  source?: string | null;
  related?: string[];
  createdAt: string;
};
type Chat = {
  id: string;
  title: string;
  model: string;
  promptId: string | null;
  temperature: number;
  topP: number;
  messages: Message[];
};
type Prompt = { id: string; name: string; content: string };

const MODELS = ["Lumi Basic", "Lumi Detailed", "Lumi Quick Tips"];
const MAX_LEN = 2000;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  } catch {
    throw new Error("Cannot reach the server. Please check your internet connection.");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Something went wrong (${res.status}).`);
  return data as T;
}

function time(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function dateTime(ts: string) {
  const d = new Date(ts);
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? time(ts)
    : d.toLocaleDateString([], { day: "numeric", month: "short" }) + " " + time(ts);
}

function LumiAvatar({ size = 32 }: { size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-lumi-500 to-warm-400 text-white shadow-sm"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Sparkles size={size * 0.5} />
    </div>
  );
}

export default function ChatApp() {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [chat, setChat] = useState<Chat | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [welcome, setWelcome] = useState<{ tip: string | null; starters: string[] }>({ tip: null, starters: [] });
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadChats = useCallback(async () => {
    const list = await api<ChatSummary[]>("/api/chats");
    setChats(list);
    return list;
  }, []);

  const openChat = useCallback(async (id: string) => {
    setError(null);
    try {
      setChat(await api<Chat>(`/api/chats/${id}`));
      setSidebarOpen(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [list, ps, w] = await Promise.all([
          loadChats(),
          api<Prompt[]>("/api/prompts"),
          api<{ tip: string | null; starters: string[] }>("/api/tips"),
        ]);
        setPrompts(ps);
        setWelcome(w);
        if (list[0]) await openChat(list[0].id);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadChats, openChat]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat?.messages.length, typing]);

  useEffect(() => {
    const t = textRef.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = Math.min(t.scrollHeight, 180) + "px";
  }, [input]);

  async function newChat(): Promise<Chat | null> {
    setError(null);
    try {
      const created = await api<Chat>("/api/chats", {
        method: "POST",
        body: JSON.stringify({ model: chat?.model, promptId: chat?.promptId ?? prompts[0]?.id }),
      });
      const full = { ...created, messages: [] };
      setChat(full);
      await loadChats();
      setSidebarOpen(false);
      return full;
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }

  async function deleteChat(id: string) {
    setError(null);
    try {
      await api(`/api/chats/${id}`, { method: "DELETE" });
      const list = await loadChats();
      if (chat?.id === id) {
        if (list[0]) await openChat(list[0].id);
        else setChat(null);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function updateChat(patch: Partial<Chat> & { clearMessages?: boolean }) {
    if (!chat) return;
    setChat({ ...chat, ...patch, messages: patch.clearMessages ? [] : chat.messages } as Chat);
    try {
      await api(`/api/chats/${chat.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      if (patch.clearMessages) await loadChats();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function send(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (typing) return;
    if (!text && !file) {
      setError("Please type a message first.");
      return;
    }
    if (text.length > MAX_LEN) {
      setError(`Your message is too long (${text.length}/${MAX_LEN} characters). Please shorten it.`);
      return;
    }
    setError(null);
    let current = chat;
    if (!current) current = await newChat();
    if (!current) return;

    const optimistic: Message = {
      id: "tmp-" + Date.now(),
      role: "user",
      content: text || `(attached file: ${file?.name})`,
      attachmentName: file?.name ?? null,
      createdAt: new Date().toISOString(),
    };
    const sentFile = file;
    setChat({ ...current, messages: [...current.messages, optimistic] });
    setInput("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
    setTyping(true);
    try {
      const res = await api<{ user: Message; assistant: Message }>(`/api/chats/${current.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ text, attachmentName: sentFile?.name }),
      });
      setChat((c) =>
        c && c.id === current!.id
          ? { ...c, messages: [...c.messages.filter((m) => m.id !== optimistic.id), res.user, res.assistant] }
          : c
      );
      await loadChats();
    } catch (e) {
      setChat((c) => (c ? { ...c, messages: c.messages.filter((m) => m.id !== optimistic.id) } : c));
      setInput(text);
      setError((e as Error).message);
    } finally {
      setTyping(false);
    }
  }

  const activePrompt = prompts.find((p) => p.id === chat?.promptId);

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setSidebarOpen(false)} aria-hidden />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-zinc-200 bg-white transition-transform md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-700">Chat History</h2>
          <button className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 md:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          {chats.length === 0 && !loading && <p className="px-2 py-4 text-sm text-zinc-400">No conversations yet.</p>}
          {chats.map((c) => (
            <div
              key={c.id}
              className={`group mb-1 flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                chat?.id === c.id ? "bg-lumi-50 text-lumi-700" : "text-zinc-700 hover:bg-zinc-100"
              }`}
              onClick={() => openChat(c.id)}
            >
              <MessageSquare size={16} className="shrink-0 opacity-60" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{c.title}</div>
                <div className="text-xs text-zinc-400">{dateTime(c.updatedAt)}</div>
              </div>
              <button
                className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 md:opacity-0 md:group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteChat(c.id);
                }}
                aria-label={`Delete chat ${c.title}`}
                title="Delete chat"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </nav>
        <div className="sticky bottom-0 border-t border-zinc-100 bg-white p-3">
          <button
            onClick={() => newChat()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-lumi-600 px-3 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-lumi-700"
          >
            <Plus size={16} /> New Chat
          </button>
        </div>
      </aside>

      {/* Main panel */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-white px-3 py-2 sm:px-4">
          <button className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 md:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open chat history">
            <Menu size={20} />
          </button>
          <div className="mr-auto flex items-center gap-2">
            <LumiAvatar size={30} />
            <div className="leading-tight">
              <div className="text-sm font-semibold">Lumi</div>
              <div className="hidden text-xs text-zinc-500 sm:block">Sirena Kids&apos; Room Guide</div>
            </div>
          </div>
          <select
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-lumi-500"
            value={chat?.model ?? MODELS[0]}
            onChange={(e) => updateChat({ model: e.target.value })}
            disabled={!chat}
            aria-label="Answer model"
            title="Answer model"
          >
            {MODELS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
          <select
            className="max-w-[150px] rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-lumi-500"
            value={chat?.promptId ?? ""}
            onChange={(e) => updateChat({ promptId: e.target.value || null })}
            disabled={!chat}
            aria-label="Persona"
            title="Persona (system prompt)"
          >
            <option value="">No persona</option>
            {prompts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowPrompts(true)}
            className="flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
            title="Manage Prompts"
          >
            <Pencil size={15} /> <span className="hidden sm:inline">Manage Prompts</span>
          </button>
          <button
            onClick={() => setShowSettings((s) => !s)}
            className={`rounded-lg border px-2 py-1.5 text-sm ${showSettings ? "border-lumi-500 bg-lumi-50 text-lumi-700" : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"}`}
            title="Advanced settings"
            aria-label="Advanced settings"
          >
            <SlidersHorizontal size={16} />
          </button>
        </header>

        {showSettings && chat && (
          <div className="grid gap-4 border-b border-zinc-200 bg-white px-4 py-3 sm:grid-cols-2">
            {(["temperature", "topP"] as const).map((k) => (
              <label key={k} className="text-sm">
                <div className="mb-1 flex justify-between">
                  <span className="font-medium">{k === "temperature" ? "Temperature" : "Top-P"}</span>
                  <span className="tabular-nums text-lumi-700">{chat[k].toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={chat[k]}
                  onChange={(e) => setChat({ ...chat, [k]: Number(e.target.value) })}
                  onMouseUp={(e) => updateChat({ [k]: Number((e.target as HTMLInputElement).value) })}
                  onTouchEnd={(e) => updateChat({ [k]: Number((e.target as HTMLInputElement).value) })}
                  onKeyUp={(e) => updateChat({ [k]: Number((e.target as HTMLInputElement).value) })}
                  className="w-full"
                />
                <div className="text-xs text-zinc-400">
                  {k === "temperature" ? "Above 0.6 Lumi adds an extra tip." : "Below 0.4 answers are shorter."} Saved for this chat.
                </div>
              </label>
            ))}
          </div>
        )}

        {error && (
          <div className="mx-3 mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:mx-4" role="alert">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} aria-label="Dismiss error">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Chat window */}
        <section className="flex-1 overflow-y-auto px-3 py-4 sm:px-6">
          {loading ? (
            <p className="mt-10 text-center text-sm text-zinc-400">Loading…</p>
          ) : !chat || chat.messages.length === 0 ? (
            <div className="mx-auto mt-6 max-w-xl text-center">
              <div className="mx-auto mb-3 w-fit">
                <LumiAvatar size={56} />
              </div>
              <h1 className="text-xl font-semibold">Hi, I&apos;m Lumi!</h1>
              <p className="mt-1 text-sm text-zinc-500">
                I help you plan a safe, cosy and practical room for your child – safety, layout, storage, sleep, lighting and play.
              </p>
              {welcome.tip && (
                <div className="mx-auto mt-4 flex items-start gap-2 rounded-lg bg-warm-100 px-3 py-2 text-left text-sm text-amber-900">
                  <Lightbulb size={16} className="mt-0.5 shrink-0" />
                  <span>
                    <b>Tip of the moment:</b> {welcome.tip}
                  </span>
                </div>
              )}
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {welcome.starters.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-left text-sm text-zinc-700 shadow-sm hover:border-lumi-500 hover:text-lumi-700"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-4">
              {chat.messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="flex flex-col items-end">
                    <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-lumi-600 px-4 py-2.5 text-sm text-white shadow-sm">
                      {m.content}
                      {m.attachmentName && m.content.indexOf(m.attachmentName) === -1 && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-lumi-100">
                          <Paperclip size={12} /> {m.attachmentName}
                        </div>
                      )}
                    </div>
                    <span className="mt-1 text-[11px] text-zinc-400">{time(m.createdAt)}</span>
                  </div>
                ) : (
                  <div key={m.id} className="flex gap-2">
                    <LumiAvatar size={28} />
                    <div className="flex max-w-[85%] flex-col items-start">
                      <div className="whitespace-pre-wrap break-words rounded-2xl rounded-bl-md border border-zinc-200 bg-zinc-100 px-4 py-2.5 text-sm text-zinc-800">
                        {m.content}
                      </div>
                      {m.source && <span className="mt-1 text-[11px] text-zinc-500">Source: {m.source}</span>}
                      {m.related && m.related.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {m.related.map((q) => (
                            <button
                              key={q}
                              onClick={() => send(q)}
                              disabled={typing}
                              className="rounded-full border border-lumi-100 bg-lumi-50 px-3 py-1 text-xs text-lumi-700 hover:bg-lumi-100 disabled:opacity-50"
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      )}
                      <span className="mt-1 text-[11px] text-zinc-400">{time(m.createdAt)}</span>
                    </div>
                  </div>
                )
              )}
              {typing && (
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <LumiAvatar size={28} />
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-100 px-4 py-2.5">
                    Typing<span className="typing-dot">.</span>
                    <span className="typing-dot">.</span>
                    <span className="typing-dot">.</span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </section>

        {/* Input */}
        <footer className="border-t border-zinc-200 bg-white px-3 py-3 sm:px-4">
          <div className="mx-auto max-w-3xl">
            {file && (
              <div className="mb-2 flex w-fit items-center gap-2 rounded-lg bg-zinc-100 px-2 py-1 text-xs text-zinc-700">
                <Paperclip size={12} /> {file.name}
                <button
                  onClick={() => {
                    setFile(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                  aria-label="Remove file"
                >
                  <X size={12} />
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <button
                onClick={() => fileRef.current?.click()}
                className="rounded-lg p-2.5 text-zinc-500 hover:bg-zinc-100"
                title="Attach File"
                aria-label="Attach File"
              >
                <Paperclip size={18} />
              </button>
              <textarea
                ref={textRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Ask Lumi about your child's room..."
                className="max-h-[180px] min-h-[42px] flex-1 resize-none rounded-lg border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lumi-500"
              />
              <button
                onClick={() => {
                  if (chat && chat.messages.length) updateChat({ clearMessages: true });
                }}
                className="hidden items-center gap-1 rounded-lg border border-zinc-200 px-3 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 sm:flex"
                title="Clear Chat"
              >
                <Eraser size={15} /> Clear Chat
              </button>
              <button
                onClick={() => {
                  if (chat && chat.messages.length) updateChat({ clearMessages: true });
                }}
                className="rounded-lg border border-zinc-200 p-2.5 text-zinc-700 hover:bg-zinc-50 sm:hidden"
                aria-label="Clear Chat"
              >
                <Eraser size={16} />
              </button>
              <button
                onClick={() => send()}
                disabled={typing}
                className="flex items-center gap-1 rounded-lg bg-lumi-600 px-3 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-lumi-700 disabled:opacity-50"
                aria-label="Send"
              >
                <Send size={15} /> <span className="hidden sm:inline">Send</span>
              </button>
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-zinc-400">
              <span>{activePrompt ? `Persona: ${activePrompt.name}` : "No persona"} · Lumi gives general guidance only.</span>
              <span className={input.length > MAX_LEN ? "text-red-600" : ""}>
                {input.length > 0 ? `${input.length}/${MAX_LEN}` : ""}
              </span>
            </div>
            <p className="mt-1 text-center text-[11px] text-zinc-400">© 2026 Sirena Invest OÜ. Built with Claude Code</p>
          </div>
        </footer>
      </main>

      {showPrompts && (
        <PromptManager
          prompts={prompts}
          onClose={() => setShowPrompts(false)}
          onChange={async () => setPrompts(await api<Prompt[]>("/api/prompts"))}
        />
      )}
    </div>
  );
}

function PromptManager({
  prompts,
  onClose,
  onChange,
}: {
  prompts: Prompt[];
  onClose: () => void;
  onChange: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<Prompt | null>(null);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function startEdit(p: Prompt | null) {
    setEditing(p);
    setName(p?.name ?? "");
    setContent(p?.content ?? "");
    setErr(null);
  }

  async function save() {
    setErr(null);
    try {
      if (editing) await api(`/api/prompts/${editing.id}`, { method: "PUT", body: JSON.stringify({ name, content }) });
      else await api("/api/prompts", { method: "POST", body: JSON.stringify({ name, content }) });
      await onChange();
      startEdit(null);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function remove(id: string) {
    setErr(null);
    try {
      await api(`/api/prompts/${id}`, { method: "DELETE" });
      await onChange();
      setConfirmDelete(null);
      if (editing?.id === id) startEdit(null);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Manage Prompts"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">Manage Prompts</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-zinc-100" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <ul className="mb-4 space-y-2">
          {prompts.map((p) => (
            <li key={p.id} className="rounded-lg border border-zinc-200 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{p.name}</span>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(p)} className="rounded p-1 text-zinc-500 hover:bg-zinc-100" aria-label={`Edit ${p.name}`}>
                    <Pencil size={15} />
                  </button>
                  {confirmDelete === p.id ? (
                    <button onClick={() => remove(p.id)} className="rounded bg-red-600 px-2 text-xs text-white">
                      Confirm delete
                    </button>
                  ) : (
                    <button onClick={() => setConfirmDelete(p.id)} className="rounded p-1 text-zinc-500 hover:bg-red-50 hover:text-red-600" aria-label={`Delete ${p.name}`}>
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{p.content}</p>
            </li>
          ))}
          {prompts.length === 0 && <li className="text-sm text-zinc-400">No personas yet.</li>}
        </ul>
        <div className="space-y-2 rounded-lg bg-zinc-50 p-3">
          <div className="text-sm font-medium">{editing ? `Edit “${editing.name}”` : "Add a new persona"}</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name, e.g. Storage Expert"
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lumi-500"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Describe how Lumi should answer…"
            rows={3}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lumi-500"
          />
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex justify-end gap-2">
            {editing && (
              <button onClick={() => startEdit(null)} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm">
                Cancel
              </button>
            )}
            <button onClick={save} className="rounded-lg bg-lumi-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-lumi-700">
              {editing ? "Save changes" : "Add persona"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
