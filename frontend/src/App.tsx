import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Bot,
  Check,
  CheckCheck,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  FileText,
  Inbox,
  LoaderCircle,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Play,
  QrCode,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  Wifi,
  X,
  Zap,
} from "lucide-react";

type Status = "new" | "in_progress" | "awaiting_payment_confirmation" | "resolved" | "cancelled";
type AiMode = "autonomous" | "assisted" | "triage" | "paused" | "human_exclusive";

type Conversation = {
  id: string;
  contact_name?: string | null;
  phone: string;
  status: Status;
  ai_mode: AiMode;
  handoff_reason?: string | null;
  last_message?: string | null;
  updated_at: string;
  unread?: number;
};

type ChatMessage = {
  id: string;
  direction: "in" | "out";
  content: string;
  media_type?: string | null;
  status?: string;
  created_at: string;
  actor?: "ai" | "human";
};

const now = Date.now();
const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

const DEMO_CONVERSATIONS: Conversation[] = [
  {
    id: "demo-ana",
    contact_name: "Ana Souza",
    phone: "5584998761234",
    status: "awaiting_payment_confirmation",
    ai_mode: "paused",
    handoff_reason: "payment_proof_media",
    last_message: "Pronto, já fiz o Pix. Segue o comprovante.",
    updated_at: ago(2),
    unread: 1,
  },
  {
    id: "demo-joao",
    contact_name: "João Santos",
    phone: "5584987654321",
    status: "in_progress",
    ai_mode: "autonomous",
    last_message: "Quero entender como funciona o acesso",
    updated_at: ago(7),
  },
  {
    id: "demo-marina",
    contact_name: "Marina Costa",
    phone: "5584992443188",
    status: "new",
    ai_mode: "autonomous",
    last_message: "Qual é o valor e como faço o Pix?",
    updated_at: ago(14),
    unread: 2,
  },
  {
    id: "demo-carlos",
    contact_name: "Carlos Lima",
    phone: "5584991129900",
    status: "resolved",
    ai_mode: "human_exclusive",
    last_message: "Acesso recebido. Obrigado!",
    updated_at: ago(52),
  },
];

const DEMO_MESSAGES: Record<string, ChatMessage[]> = {
  "demo-ana": [
    { id: "a1", direction: "in", content: "Oi, vi a oferta e quero saber como funciona.", created_at: ago(18) },
    { id: "a2", direction: "out", content: "Oi, Ana! Claro. O acesso é liberado após a confirmação do pagamento. O que você quer saber primeiro?", created_at: ago(17), actor: "ai", status: "read" },
    { id: "a3", direction: "in", content: "Pode me mandar a chave Pix?", created_at: ago(8) },
    { id: "a4", direction: "out", content: "Posso sim. Depois de pagar, mande o comprovante aqui para a equipe conferir.", created_at: ago(7), actor: "ai", status: "read" },
    { id: "a5", direction: "in", content: "Pronto, já fiz o Pix. Segue o comprovante.", media_type: "image", created_at: ago(2) },
    { id: "a6", direction: "out", content: "Recebi. Vou encaminhar agora para a equipe conferir o Pix e liberar seu acesso.", created_at: ago(2), actor: "ai", status: "delivered" },
  ],
  "demo-joao": [
    { id: "j1", direction: "in", content: "Boa tarde! Quero entender como funciona o acesso.", created_at: ago(8) },
    { id: "j2", direction: "out", content: "Boa tarde, João! Me diz qual opção chamou sua atenção que eu te explico direitinho.", created_at: ago(7), actor: "ai", status: "read" },
  ],
  "demo-marina": [
    { id: "m1", direction: "in", content: "Oi", created_at: ago(16) },
    { id: "m2", direction: "out", content: "Oi, Marina! Como posso te ajudar hoje?", created_at: ago(15), actor: "ai", status: "read" },
    { id: "m3", direction: "in", content: "Qual é o valor e como faço o Pix?", created_at: ago(14) },
  ],
  "demo-carlos": [
    { id: "c1", direction: "out", content: "Pagamento confirmado! Aqui está o seu acesso: https://exemplo.com/acesso", created_at: ago(58), actor: "human", status: "read" },
    { id: "c2", direction: "in", content: "Acesso recebido. Obrigado!", created_at: ago(52) },
  ],
};

const navItems = [
  { id: "dashboard", label: "Visão geral", icon: BarChart3 },
  { id: "inbox", label: "Atendimentos", icon: Inbox },
  { id: "payments", label: "Pagamentos", icon: CircleDollarSign },
  { id: "connection", label: "Conexão WhatsApp", icon: QrCode },
  { id: "settings", label: "Configurações", icon: Settings },
];

const statusText: Record<Status, string> = {
  new: "Novo",
  in_progress: "Em atendimento",
  awaiting_payment_confirmation: "Conferir Pix",
  resolved: "Resolvido",
  cancelled: "Cancelado",
};

const aiText: Record<AiMode, string> = {
  autonomous: "IA atendendo",
  assisted: "IA assistida",
  triage: "Triagem",
  paused: "IA pausada",
  human_exclusive: "Atendimento humano",
};

async function crmApi<T>(path: string, options?: RequestInit): Promise<T> {
  const apiPrefix = import.meta.env.VITE_CRM_API_PREFIX || "/api/crm";
  const response = await fetch(`${apiPrefix}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `Erro ${response.status}`);
  }
  return response.json();
}

function initials(name?: string | null) {
  return (name || "Cliente")
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function clock(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function phone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 13) return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  return value;
}

export default function App() {
  const [section, setSection] = useState("dashboard");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [apiOnline, setApiOnline] = useState(false);
  const [apiError, setApiError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pix" | "ai" | "resolved">("all");
  const [mobileChat, setMobileChat] = useState(false);

  const selected = conversations.find((item) => item.id === selectedId) || conversations[0];
  const currentMessages = selected ? messages[selected.id] || [] : [];

  useEffect(() => {
    let active = true;
    async function refreshConversations() {
      try {
        const items = await crmApi<Conversation[]>("/conversations");
        if (!active) return;
        setApiOnline(true);
        setApiError("");
        setConversations(items);
        setSelectedId((current) => items.some((item) => item.id === current) ? current : (items[0]?.id || current));
      } catch (error) {
        if (active) {
          setApiOnline(false);
          setApiError(error instanceof Error ? error.message : "Backend indisponível");
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    refreshConversations();
    const timer = window.setInterval(refreshConversations, 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!apiOnline || !selectedId) return;
    let active = true;
    async function refreshMessages() {
      try {
        const items = await crmApi<ChatMessage[]>(`/conversations/${selectedId}/messages`);
        if (active) setMessages((old) => ({ ...old, [selectedId]: items }));
      } catch {
        // A próxima atualização tenta novamente sem interromper o atendimento.
      }
    }
    refreshMessages();
    const timer = window.setInterval(refreshMessages, 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, [apiOnline, selectedId]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    return conversations.filter((item) => {
      const matchesSearch = !term || `${item.contact_name} ${item.phone} ${item.last_message}`.toLowerCase().includes(term);
      const matchesFilter =
        filter === "all" ||
        (filter === "pix" && item.status === "awaiting_payment_confirmation") ||
        (filter === "ai" && item.ai_mode === "autonomous") ||
        (filter === "resolved" && item.status === "resolved");
      return matchesSearch && matchesFilter;
    });
  }, [conversations, filter, search]);

  const stats = useMemo(
    () => ({
      total: conversations.length,
      ai: conversations.filter((item) => item.ai_mode === "autonomous").length,
      pix: conversations.filter((item) => item.status === "awaiting_payment_confirmation").length,
      resolved: conversations.filter((item) => item.status === "resolved").length,
    }),
    [conversations],
  );

  function showNotice(text: string) {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 3500);
  }

  function updateConversation(id: string, patch: Partial<Conversation>) {
    setConversations((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function sendMessage() {
    if (!selected || !draft.trim() || sending) return;
    if (!apiOnline) {
      showNotice("Sistema desconectado. A mensagem não foi enviada.");
      return;
    }
    const content = draft.trim();
    setSending(true);
    try {
      const sent = await crmApi<ChatMessage>(`/conversations/${selected.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      setMessages((old) => ({ ...old, [selected.id]: [...(old[selected.id] || []), sent] }));
      updateConversation(selected.id, { ai_mode: "human_exclusive", status: selected.status === "new" ? "in_progress" : selected.status, last_message: content, updated_at: sent.created_at });
      setDraft("");
      showNotice("Mensagem enviada pelo WhatsApp.");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Não foi possível enviar.");
    } finally {
      setSending(false);
    }
  }

  async function confirmPayment() {
    if (!selected || selected.status !== "awaiting_payment_confirmation") return;
    if (!apiOnline) {
      showNotice("Sistema desconectado. O pagamento não foi confirmado.");
      return;
    }
    if (!window.confirm("Você já conferiu o Pix no banco e quer enviar o acesso agora?")) return;
    setSending(true);
    try {
      await crmApi(`/conversations/${selected.id}/confirm-payment`, { method: "POST", body: "{}" });
      const content = "Acesso enviado após a confirmação do pagamento.";
      const sent: ChatMessage = { id: `access-${Date.now()}`, direction: "out", content, created_at: new Date().toISOString(), actor: "human", status: "sent" };
      setMessages((old) => ({ ...old, [selected.id]: [...(old[selected.id] || []), sent] }));
      updateConversation(selected.id, { status: "resolved", ai_mode: "human_exclusive", last_message: content, updated_at: sent.created_at });
      showNotice("Pix confirmado e acesso enviado.");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Não foi possível confirmar.");
    } finally {
      setSending(false);
    }
  }

  async function resumeAi() {
    if (!selected) return;
    if (!apiOnline) {
      showNotice("Sistema desconectado. Não foi possível retomar a IA.");
      return;
    }
    try {
      await crmApi(`/conversations/${selected.id}/resume-ai`, { method: "POST", body: "{}" });
      updateConversation(selected.id, { ai_mode: "autonomous", status: "in_progress", handoff_reason: null });
      showNotice("IA retomada nesta conversa.");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Não foi possível retomar a IA.");
    }
  }

  function navigate(id: string) {
    setSection(id);
    setMobileMenu(false);
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "is-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><MessageCircle size={22} strokeWidth={2.5} /></div>
          <div><strong>Atende</strong><span>CRM</span></div>
          <button className="mobile-close" onClick={() => setMobileMenu(false)} aria-label="Fechar menu"><X size={20} /></button>
        </div>
        <div className="company-switch">
          <span className="company-avatar">ME</span>
          <span><b>Minha empresa</b><small>Espaço principal</small></span>
          <ChevronDown size={16} />
        </div>
        <nav>
          <p className="nav-label">NAVEGAÇÃO</p>
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} className={section === id ? "active" : ""} onClick={() => navigate(id)}>
              <Icon size={19} />
              <span>{label}</span>
              {id === "payments" && stats.pix > 0 && <em>{stats.pix}</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className={`system-state ${apiOnline ? "online" : "demo"}`}>
            <span className="pulse" />
            <div><b>{apiOnline ? "Sistema conectado" : "Sistema desconectado"}</b><small>{apiOnline ? "Dados em tempo real" : apiError || "Verifique o servidor"}</small></div>
          </div>
          <div className="profile">
            <span className="profile-avatar">MI</span>
            <div><b>Administrador</b><small>Conta principal</small></div>
            <MoreHorizontal size={18} />
          </div>
        </div>
      </aside>

      {mobileMenu && <button className="sidebar-overlay" onClick={() => setMobileMenu(false)} aria-label="Fechar menu" />}

      <main className="main-area">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMobileMenu(true)} aria-label="Abrir menu"><Menu size={21} /></button>
          <div>
            <h1>{navItems.find((item) => item.id === section)?.label}</h1>
            <p>{section === "dashboard" ? "Acompanhe seu atendimento em tempo real" : section === "connection" ? "Conecte e monitore seu número" : "Gerencie sua operação em um só lugar"}</p>
          </div>
          <div className="topbar-actions">
            <span className={`mode-pill ${apiOnline ? "real" : "demo"}`}><span />{apiOnline ? "AO VIVO" : "OFFLINE"}</span>
            <span className="top-avatar">MI</span>
          </div>
        </header>

        {notice && <div className="toast"><CheckCircle />{notice}</div>}

        {section === "dashboard" && (
          <Dashboard stats={stats} conversations={conversations} onOpen={(id) => { setSelectedId(id); setSection("inbox"); }} />
        )}
        {section === "inbox" && (
          <InboxView
            loading={loading}
            conversations={filtered}
            selected={selected}
            selectedId={selectedId}
            messages={currentMessages}
            filter={filter}
            search={search}
            draft={draft}
            sending={sending}
            onFilter={setFilter}
            onSearch={setSearch}
            onSelect={(id) => { setSelectedId(id); setMobileChat(true); }}
            onDraft={setDraft}
            onSend={sendMessage}
            onConfirm={confirmPayment}
            onResume={resumeAi}
            mobileOpen={mobileChat}
            onMobileBack={() => setMobileChat(false)}
          />
        )}
        {section === "payments" && <PaymentsView conversations={conversations} onOpen={(id) => { setSelectedId(id); setSection("inbox"); }} />}
        {section === "connection" && <ConnectionView apiOnline={apiOnline} showNotice={showNotice} />}
        {section === "settings" && <SettingsView apiOnline={apiOnline} showNotice={showNotice} />}
      </main>
    </div>
  );
}

function CheckCircle() {
  return <span className="toast-check"><Check size={14} /></span>;
}

function Dashboard({ stats, conversations, onOpen }: { stats: Record<string, number>; conversations: Conversation[]; onOpen: (id: string) => void }) {
  const cards = [
    { label: "Atendimentos", value: stats.total, hint: "conversas recentes", icon: MessageCircle, tone: "purple" },
    { label: "IA atendendo", value: stats.ai, hint: "respostas automáticas", icon: Bot, tone: "blue" },
    { label: "Aguardando Pix", value: stats.pix, hint: "precisam de você", icon: Clock3, tone: "amber" },
    { label: "Concluídos", value: stats.resolved, hint: "acessos enviados", icon: CheckCheck, tone: "green" },
  ];
  return (
    <div className="page dashboard-page">
      <section className="welcome-card">
        <div><span className="eyebrow"><Sparkles size={14} /> OPERAÇÃO INTELIGENTE</span><h2>Seu atendimento, sob controle.</h2><p>A IA conversa com os clientes. Você entra apenas quando o Pix precisa ser conferido.</p></div>
        <div className="welcome-visual"><span><Bot size={30} /></span><i /><span><ShieldCheck size={30} /></span></div>
      </section>
      <section className="stat-grid">
        {cards.map(({ label, value, hint, icon: Icon, tone }) => (
          <article className="stat-card" key={label}>
            <span className={`stat-icon ${tone}`}><Icon size={21} /></span>
            <div><p>{label}</p><strong>{value}</strong><small>{hint}</small></div>
          </article>
        ))}
      </section>
      <section className="dashboard-grid">
        <article className="panel recent-panel">
          <div className="panel-heading"><div><h3>Atendimentos recentes</h3><p>Fila atual do WhatsApp</p></div><button onClick={() => conversations[0] && onOpen(conversations[0].id)}>Ver todos</button></div>
          <div className="recent-list">
            {conversations.slice(0, 5).map((item) => (
              <button key={item.id} onClick={() => onOpen(item.id)}>
                <span className="avatar">{initials(item.contact_name)}</span>
                <span className="recent-copy"><b>{item.contact_name || "Cliente"}</b><small>{item.last_message || "Sem mensagens"}</small></span>
                <span className={`status-chip ${item.status}`}>{statusText[item.status]}</span>
                <time>{clock(item.updated_at)}</time>
              </button>
            ))}
          </div>
        </article>
        <article className="panel flow-panel">
          <div className="panel-heading"><div><h3>Fluxo do atendimento</h3><p>Automação com segurança</p></div><Zap size={20} /></div>
          <div className="flow-step"><span className="blue"><MessageCircle size={18} /></span><div><b>Cliente chama</b><small>Mensagem chega pelo WhatsApp</small></div></div>
          <div className="flow-line" />
          <div className="flow-step"><span className="purple"><Bot size={18} /></span><div><b>IA atende</b><small>Texto, imagem, áudio e vídeo</small></div></div>
          <div className="flow-line" />
          <div className="flow-step"><span className="amber"><CircleDollarSign size={18} /></span><div><b>Cliente informa o Pix</b><small>A conversa é pausada</small></div></div>
          <div className="flow-line" />
          <div className="flow-step"><span className="green"><ShieldCheck size={18} /></span><div><b>Humano confirma</b><small>O acesso é enviado</small></div></div>
        </article>
      </section>
    </div>
  );
}

type InboxProps = {
  loading: boolean;
  conversations: Conversation[];
  selected?: Conversation;
  selectedId: string;
  messages: ChatMessage[];
  filter: "all" | "pix" | "ai" | "resolved";
  search: string;
  draft: string;
  sending: boolean;
  onFilter: (value: "all" | "pix" | "ai" | "resolved") => void;
  onSearch: (value: string) => void;
  onSelect: (id: string) => void;
  onDraft: (value: string) => void;
  onSend: () => void;
  onConfirm: () => void;
  onResume: () => void;
  mobileOpen: boolean;
  onMobileBack: () => void;
};

function InboxView(props: InboxProps) {
  const { selected } = props;
  return (
    <div className="inbox-layout">
      <section className="conversation-column">
        <div className="search-box"><Search size={17} /><input value={props.search} onChange={(e) => props.onSearch(e.target.value)} placeholder="Buscar cliente..." /></div>
        <div className="filters">
          {[{ id: "all", label: "Todos" }, { id: "pix", label: "Pix" }, { id: "ai", label: "Com IA" }, { id: "resolved", label: "Resolvidos" }].map((item) => (
            <button key={item.id} className={props.filter === item.id ? "active" : ""} onClick={() => props.onFilter(item.id as InboxProps["filter"])}>{item.label}</button>
          ))}
        </div>
        <div className="conversation-list">
          {props.loading && <div className="loading-list"><LoaderCircle className="spin" size={20} />Atualizando fila...</div>}
          {!props.loading && !props.conversations.length && <div className="empty-list"><Inbox size={26} /><b>Nenhuma conversa</b><small>Tente outro filtro.</small></div>}
          {props.conversations.map((item) => (
            <button key={item.id} className={props.selectedId === item.id ? "selected" : ""} onClick={() => props.onSelect(item.id)}>
              <span className="avatar">{initials(item.contact_name)}</span>
              <span className="conversation-copy"><span><b>{item.contact_name || "Cliente"}</b><time>{clock(item.updated_at)}</time></span><small>{item.last_message || "Sem mensagens"}</small><em className={`mini-state ${item.ai_mode}`}>{aiText[item.ai_mode]}</em></span>
              {!!item.unread && <i className="unread">{item.unread}</i>}
            </button>
          ))}
        </div>
      </section>

      <section className={`chat-column ${props.mobileOpen ? "mobile-open" : ""}`}>
        {!selected ? <div className="no-chat"><MessageCircle size={38} /><h3>Selecione uma conversa</h3></div> : <>
          <div className="chat-header">
            <button className="mobile-back" onClick={props.onMobileBack} aria-label="Voltar para conversas">‹</button>
            <span className="avatar large">{initials(selected.contact_name)}</span>
            <div><h3>{selected.contact_name || "Cliente"}</h3><p>{phone(selected.phone)} · WhatsApp</p></div>
            <span className={`ai-status ${selected.ai_mode}`}><Bot size={15} />{aiText[selected.ai_mode]}</span>
            <button className="icon-button"><MoreHorizontal size={19} /></button>
          </div>
          {selected.status === "awaiting_payment_confirmation" && (
            <div className="handoff-banner"><span><ShieldCheck size={20} /></span><div><b>Intervenção humana necessária</b><p>O cliente informou o pagamento. Confira o Pix no banco antes de liberar o acesso.</p></div></div>
          )}
          <div className="message-area">
            <div className="day-divider"><span>Hoje</span></div>
            {!props.messages.length && <div className="messages-loading"><LoaderCircle className="spin" />Carregando histórico...</div>}
            {props.messages.map((message) => (
              <div className={`message-row ${message.direction}`} key={message.id}>
                <div className="bubble">
                  {message.media_type && <div className="media-preview"><FileText size={22} /><span>{message.media_type === "image" ? "Comprovante recebido" : `Mídia: ${message.media_type}`}</span></div>}
                  <p>{message.content}</p>
                  <span className="message-meta">{message.actor === "ai" && <><Bot size={12} /> IA · </>}{message.actor === "human" && <>Você · </>}{clock(message.created_at)}{message.direction === "out" && <CheckCheck size={13} />}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="composer">
            <textarea value={props.draft} onChange={(e) => props.onDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); props.onSend(); } }} placeholder="Digite uma mensagem como atendente humano..." rows={1} />
            <button className="send-button" onClick={props.onSend} disabled={!props.draft.trim() || props.sending}>{props.sending ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />}</button>
          </div>
          <div className="composer-note"><ShieldCheck size={13} />Ao enviar manualmente, a IA permanece pausada nesta conversa.</div>
        </>}
      </section>

      <aside className="details-column">
        {selected && <>
          <div className="contact-card"><span className="avatar xl">{initials(selected.contact_name)}</span><h3>{selected.contact_name || "Cliente"}</h3><p>{phone(selected.phone)}</p><span className={`status-chip ${selected.status}`}>{statusText[selected.status]}</span></div>
          <div className="details-section"><h4>ATENDIMENTO</h4><dl><div><dt>Status</dt><dd>{statusText[selected.status]}</dd></div><div><dt>Responsável</dt><dd>{selected.ai_mode === "autonomous" ? "Inteligência artificial" : "Equipe humana"}</dd></div><div><dt>Canal</dt><dd><MessageCircle size={14} /> WhatsApp</dd></div></dl></div>
          {selected.status === "awaiting_payment_confirmation" && (
            <div className="payment-action"><span className="payment-icon"><CircleDollarSign size={23} /></span><h4>Confirmar pagamento</h4><p>Confira primeiro o extrato da conta. O sistema não valida o banco automaticamente.</p><button className="primary-action" onClick={props.onConfirm} disabled={props.sending}><Check size={17} />Confirmar Pix e enviar acesso</button></div>
          )}
          {selected.ai_mode !== "autonomous" && selected.status !== "resolved" && <button className="secondary-action" onClick={props.onResume}><Play size={16} />Retomar atendimento da IA</button>}
          <div className="safety-note"><ShieldCheck size={16} /><p><b>Regra de segurança</b><br />Acesso só é enviado após a confirmação humana.</p></div>
        </>}
      </aside>
    </div>
  );
}

function PaymentsView({ conversations, onOpen }: { conversations: Conversation[]; onOpen: (id: string) => void }) {
  const items = conversations.filter((item) => item.status === "awaiting_payment_confirmation" || item.status === "resolved");
  return (
    <div className="page narrow-page">
      <div className="section-title"><div><h2>Pagamentos e liberações</h2><p>Somente um humano confirma o Pix e autoriza o envio do acesso.</p></div><span className="secure-badge"><ShieldCheck size={16} />Confirmação protegida</span></div>
      <div className="panel payment-table">
        <div className="table-head"><span>Cliente</span><span>Última mensagem</span><span>Situação</span><span>Horário</span><span /></div>
        {items.map((item) => <button className="table-row" key={item.id} onClick={() => onOpen(item.id)}><span className="person-cell"><i className="avatar">{initials(item.contact_name)}</i><b>{item.contact_name}</b></span><span>{item.last_message}</span><span><i className={`status-chip ${item.status}`}>{statusText[item.status]}</i></span><time>{clock(item.updated_at)}</time><em>Abrir</em></button>)}
      </div>
    </div>
  );
}

function ConnectionView({ apiOnline, showNotice }: { apiOnline: boolean; showNotice: (text: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [qr, setQr] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      if (!apiOnline) {
        setConnected(false);
        setQr("");
        return;
      }
      const state = await crmApi<Record<string, unknown>>("/connections/state");
      const serialized = JSON.stringify(state).toLowerCase();
      setConnected(serialized.includes("open") || serialized.includes("connected"));
      if (!serialized.includes("open") && !serialized.includes("connected")) {
        const response = await crmApi<Record<string, unknown>>("/connections/qr");
        const raw = String(response.base64 || response.qrcode || response.code || "");
        setQr(raw ? (raw.startsWith("data:") ? raw : `data:image/png;base64,${raw}`) : "");
      }
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Não foi possível consultar a conexão.");
    } finally {
      setLoading(false);
    }
  }

  async function prepare() {
    setLoading(true);
    try {
      if (!apiOnline) {
        showNotice("Sistema desconectado. Não foi possível preparar o WhatsApp.");
        return;
      }
      await crmApi("/connections/setup", { method: "POST", body: "{}" });
      showNotice("Instância e webhook preparados. Atualizando o QR Code...");
      await refresh();
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Não foi possível preparar a conexão.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, [apiOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="page narrow-page connection-page">
      <div className="section-title"><div><h2>Conectar WhatsApp</h2><p>Escaneie o QR Code com o número que será atendido pelo sistema.</p></div><span className={`connection-badge ${connected ? "connected" : "waiting"}`}><span />{connected ? "WhatsApp conectado" : "Aguardando conexão"}</span></div>
      <div className="connection-grid">
        <article className="panel qr-panel">
          <div className="qr-heading"><span><QrCode size={21} /></span><div><h3>QR Code da instância</h3><p>Atualização segura pela Evolution API</p></div></div>
          <div className="qr-frame">
            {connected ? <div className="connected-visual"><CheckCheck size={50} /><b>Número conectado</b><small>Pronto para receber mensagens</small></div> : qr ? <img src={qr} alt="QR Code do WhatsApp" /> : <div className="connected-visual"><Wifi size={42} /><b>QR Code indisponível</b><small>{apiOnline ? "Clique em preparar conexão" : "Backend desconectado"}</small></div>}
          </div>
          <div className="qr-actions">
            <button className="prepare-button" onClick={prepare} disabled={loading}><Zap size={17} />Preparar conexão</button>
            <button className="refresh-button" onClick={refresh} disabled={loading}>{loading ? <LoaderCircle className="spin" size={17} /> : <RefreshCw size={17} />}Atualizar QR Code</button>
          </div>
        </article>
        <div className="connection-help">
          <article className="panel steps-panel"><h3>Como conectar</h3><ol><li><span>1</span><p>Abra o WhatsApp no celular usado pela empresa.</p></li><li><span>2</span><p>Toque em <b>Aparelhos conectados</b> e depois em <b>Conectar aparelho</b>.</p></li><li><span>3</span><p>Aponte a câmera para o QR Code ao lado.</p></li><li><span>4</span><p>Aguarde o indicador mudar para conectado.</p></li></ol></article>
          <article className="panel security-panel"><ShieldCheck size={22} /><div><h4>Importante</h4><p>Use um número comercial. Não compartilhe a chave da Evolution API nem o arquivo <code>.env</code>.</p></div></article>
        </div>
      </div>
    </div>
  );
}

function DemoQr() {
  const bits = "111111101010101111111100000101110101000001101110101011101011101101110100101010111011011101011101011101101110100110101011101100000101010101000001111111101010101111111000000000110100000000101110111011101100101010010001011001101110010111010101010111100001011101101001101011111010100101101010001010000011001101001010111110100111111010101001100010100000101110111011101101110100100101111011011101011010101010100000101101001111001011111111101011101010101";
  return <div className="demo-qr">{bits.slice(0, 441).split("").map((bit, index) => <i key={index} className={bit === "1" ? "on" : ""} />)}<span><MessageCircle size={25} /></span></div>;
}

function SettingsView({ apiOnline, showNotice }: { apiOnline: boolean; showNotice: (text: string) => void }) {
  const [company, setCompany] = useState("Minha Empresa");
  const [access, setAccess] = useState("https://seu-link-de-acesso");
  const [context, setContext] = useState("Descreva aqui seus produtos, valores, regras e respostas autorizadas.");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!apiOnline) return;
    crmApi<{ name: string; access_url?: string | null; ai_context?: string | null }>("/settings")
      .then((data) => {
        setCompany(data.name);
        setAccess(data.access_url || "");
        setContext(data.ai_context || "");
      })
      .catch((error) => showNotice(error instanceof Error ? error.message : "Não foi possível carregar as configurações."));
  }, [apiOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!company.trim() || saving) return;
    setSaving(true);
    try {
      if (!apiOnline) throw new Error("Sistema desconectado. Nada foi salvo.");
      await crmApi("/settings", {
        method: "PUT",
        body: JSON.stringify({ name: company, access_url: access, ai_context: context }),
      });
      showNotice("Configurações salvas no sistema.");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Não foi possível salvar as configurações.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="page narrow-page settings-page">
      <div className="section-title"><div><h2>Configurações da empresa</h2><p>Personalize o sistema para qualquer tipo de negócio.</p></div><span className={`mode-pill ${apiOnline ? "real" : "demo"}`}><span />{apiOnline ? "BACKEND ATIVO" : "BACKEND OFFLINE"}</span></div>
      <div className="settings-grid">
        <section className="panel form-panel"><div className="form-heading"><span><Settings size={21} /></span><div><h3>Dados principais</h3><p>Informações usadas no atendimento</p></div></div><label>Nome da empresa<input value={company} onChange={(e) => setCompany(e.target.value)} disabled={!apiOnline} /></label><label>Link enviado após confirmar o Pix<input value={access} onChange={(e) => setAccess(e.target.value)} disabled={!apiOnline} /></label><label>Contexto da IA<textarea rows={7} value={context} onChange={(e) => setContext(e.target.value)} disabled={!apiOnline} /></label><button className="primary-action save-button" onClick={save} disabled={saving || !company.trim() || !apiOnline}>{saving ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}{saving ? "Salvando..." : "Salvar configurações"}</button></section>
        <div className="settings-side"><article className="panel rule-card"><span><Bot size={22} /></span><div><h4>Atendimento da IA</h4><p>Responde mensagens e entende mídias usando apenas o contexto cadastrado.</p></div></article><article className="panel rule-card amber"><span><Clock3 size={22} /></span><div><h4>Pausa automática</h4><p>Ao detectar “já fiz o Pix” ou um comprovante, a IA encerra a atuação.</p></div></article><article className="panel rule-card green"><span><ShieldCheck size={22} /></span><div><h4>Liberação humana</h4><p>O atendente confere o banco, confirma no CRM e o acesso é enviado.</p></div></article><article className="settings-info"><b>Salvamento permanente</b><p>Com o backend ativo, o botão salva nome, contexto e link diretamente no banco de dados do sistema.</p></article></div>
      </div>
    </div>
  );
}
