import { type ChangeEvent, type ComponentType, type FormEvent, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Bot,
  Check,
  CheckCheck,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  ContactRound,
  Download,
  FileText,
  Inbox,
  KanbanSquare,
  LoaderCircle,
  Megaphone,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Play,
  PlugZap,
  QrCode,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  Workflow,
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
  media_url?: string | null;
  mime_type?: string | null;
  file_name?: string | null;
  status?: string;
  created_at: string;
  actor?: "ai" | "human";
};

type CrmUser = { id: string; name: string; email: string; role: string; active: boolean; created_at: string };

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "inbox", label: "Atendimentos", icon: Inbox },
  { id: "funnel", label: "Funil", icon: KanbanSquare },
  { id: "contacts", label: "Contatos", icon: ContactRound },
  { id: "campaigns", label: "Campanhas", icon: Megaphone },
  { id: "automations", label: "Automações", icon: Workflow },
  { id: "ai", label: "Inteligência artificial", icon: Sparkles },
  { id: "payments", label: "Financeiro", icon: CircleDollarSign },
  { id: "reports", label: "Relatórios", icon: BarChart3 },
  { id: "team", label: "Equipe", icon: Users },
  { id: "connection", label: "Conexões", icon: PlugZap },
  { id: "settings", label: "Configurações", icon: Settings },
];

const sectionDescriptions: Record<string, string> = {
  dashboard: "Acompanhe sua operação em tempo real.", inbox: "Converse, distribua e acompanhe cada atendimento.",
  funnel: "Acompanhe cada conversa até a conclusão.", contacts: "Base unificada de clientes e oportunidades.",
  campaigns: "Comunicação segmentada e controle de envio.", automations: "Gatilhos, condições e ações da operação.",
  ai: "Agentes, base de conhecimento e regras seguras.", payments: "Confirmações de Pix e liberações humanas.",
  reports: "Indicadores operacionais, comerciais e financeiros.", team: "Usuários, setores e permissões.",
  connection: "WhatsApp, webhooks e integrações.", settings: "Personalize o CRM e sua empresa.",
};

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
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(body.detail || `Erro ${response.status}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return response.json();
}

async function crmUpload<T>(path: string, form: FormData): Promise<T> {
  const apiPrefix = import.meta.env.VITE_CRM_API_PREFIX || "/api/crm";
  const response = await fetch(`${apiPrefix}${path}`, { method: "POST", credentials: "same-origin", body: form });
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
  const [loginRequired, setLoginRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pix" | "ai" | "resolved">("all");
  const [mobileChat, setMobileChat] = useState(false);
  const [profileMenu, setProfileMenu] = useState(false);

  const selected = conversations.find((item) => item.id === selectedId) || conversations[0];
  const currentMessages = selected ? messages[selected.id] || [] : [];

  useEffect(() => {
    let active = true;
    async function refreshConversations() {
      try {
        const items = await crmApi<Conversation[]>("/conversations");
        if (!active) return;
        setApiOnline(true);
        setLoginRequired(false);
        setApiError("");
        setConversations(items);
        setSelectedId((current) => items.some((item) => item.id === current) ? current : (items[0]?.id || current));
      } catch (error) {
        if (active) {
          setApiOnline(false);
          setApiError(error instanceof Error ? error.message : "Backend indisponível");
          setLoginRequired(true);
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

  async function sendMedia(file: File) {
    if (!selected || sending) return;
    if (!apiOnline) { showNotice("Sistema desconectado. O arquivo não foi enviado."); return; }
    const form = new FormData();
    form.append("file", file);
    form.append("caption", draft.trim());
    setSending(true);
    try {
      const sent = await crmUpload<ChatMessage>(`/conversations/${selected.id}/media`, form);
      setMessages((old) => ({ ...old, [selected.id]: [...(old[selected.id] || []), sent] }));
      updateConversation(selected.id, { ai_mode: "human_exclusive", last_message: draft.trim() || file.name, updated_at: sent.created_at });
      setDraft("");
      showNotice("Arquivo enviado pelo WhatsApp.");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Não foi possível enviar o arquivo.");
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

  async function logout() {
    await crmApi("/auth/logout", { method: "POST", body: "{}" }).catch(() => undefined);
    window.location.reload();
  }

  if (loginRequired) return <LoginView />;

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
              {id === "inbox" && stats.pix > 0 && <em>{stats.pix}</em>}
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
            <button className="profile-menu-button" onClick={() => setProfileMenu((open) => !open)} aria-label="Opções da conta"><MoreHorizontal size={18} /></button>
            {profileMenu && <div className="profile-menu"><button onClick={() => navigate("team")}>Gerenciar usuários</button><button onClick={logout}>Sair do sistema</button></div>}
          </div>
        </div>
      </aside>

      {mobileMenu && <button className="sidebar-overlay" onClick={() => setMobileMenu(false)} aria-label="Fechar menu" />}

      <main className="main-area">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMobileMenu(true)} aria-label="Abrir menu"><Menu size={21} /></button>
          <div>
            <h1>{navItems.find((item) => item.id === section)?.label}</h1>
            <p>{sectionDescriptions[section]}</p>
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
            onMedia={sendMedia}
            onConfirm={confirmPayment}
            onResume={resumeAi}
            mobileOpen={mobileChat}
            onMobileBack={() => setMobileChat(false)}
          />
        )}
        {section === "funnel" && <FunnelView conversations={conversations} onOpen={(id) => { setSelectedId(id); setSection("inbox"); }} />}
        {section === "contacts" && <ContactsView conversations={conversations} onOpen={(id) => { setSelectedId(id); setSection("inbox"); }} />}
        {section === "campaigns" && <ModuleEmptyView icon={Megaphone} title="Campanhas" description="Crie campanhas segmentadas sem misturar dados de demonstração com sua operação real." action="Nova campanha" />}
        {section === "automations" && <AutomationsView />}
        {section === "ai" && <AiView onConfigure={() => setSection("settings")} />}
        {section === "payments" && <PaymentsView conversations={conversations} onOpen={(id) => { setSelectedId(id); setSection("inbox"); }} />}
        {section === "reports" && <ReportsView conversations={conversations} />}
        {section === "team" && <TeamView showNotice={showNotice} />}
        {section === "connection" && <ConnectionView apiOnline={apiOnline} showNotice={showNotice} />}
        {section === "settings" && <SettingsView apiOnline={apiOnline} showNotice={showNotice} />}
      </main>
    </div>
  );
}

function LoginView() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(event: FormEvent) {
    event.preventDefault();
    if (!username.trim() || !password || loading) return;
    setLoading(true);
    setError("");
    try {
      await crmApi("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      window.location.reload();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand"><span><MessageCircle size={25} /></span><div><strong>Atende</strong><b>CRM</b></div></div>
        <h1>Entrar no painel</h1>
        <p>Entre com o administrador do servidor ou com o e-mail cadastrado pela equipe.</p>
        <form onSubmit={login}>
          <label>Usuário ou e-mail<input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} /></label>
          <label>Senha<input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus /></label>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" disabled={loading || !username.trim() || !password}>{loading ? <LoaderCircle className="spin" size={18} /> : <ShieldCheck size={18} />}{loading ? "Entrando..." : "Entrar"}</button>
        </form>
      </section>
    </main>
  );
}

function CheckCircle() {
  return <span className="toast-check"><Check size={14} /></span>;
}

function Dashboard({ stats, conversations, onOpen }: { stats: Record<string, number>; conversations: Conversation[]; onOpen: (id: string) => void }) {
  const cards = [
    { label: "Conversas abertas", value: conversations.filter((c) => !["resolved", "cancelled"].includes(c.status)).length, hint: "operação real", icon: MessageCircle, tone: "purple" },
    { label: "Conferir Pix", value: stats.pix, hint: "entrada humana", icon: Clock3, tone: "amber" },
    { label: "IA atendendo", value: stats.ai, hint: "automáticas", icon: Bot, tone: "blue" },
    { label: "Atendimento humano", value: conversations.filter((c) => c.ai_mode === "human_exclusive").length, hint: "em andamento", icon: Users, tone: "green" },
  ];
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (6 - index));
    const end = new Date(date); end.setDate(end.getDate() + 1);
    return { label: new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(date).replace(".", ""), value: conversations.filter((c) => { const updated = new Date(c.updated_at); return updated >= date && updated < end; }).length };
  });
  const maxDay = Math.max(1, ...days.map((day) => day.value));
  const funnel = [
    ["Novos", conversations.filter((c) => c.status === "new").length], ["Em atendimento", conversations.filter((c) => c.status === "in_progress").length],
    ["Pagamento", stats.pix], ["Finalizados", stats.resolved],
  ];
  return (
    <div className="page dashboard-page">
      <section className="stat-grid">
        {cards.map(({ label, value, hint, icon: Icon, tone }) => (
          <article className="stat-card" key={label}>
            <span className={`stat-icon ${tone}`}><Icon size={21} /></span>
            <div><p>{label}</p><strong>{value}</strong><small>{hint}</small></div>
          </article>
        ))}
      </section>
      <section className="dashboard-reference-grid">
        <article className="panel volume-panel"><div className="panel-heading"><div><h3>Volume de atendimentos</h3><p>Últimos 7 dias</p></div></div><div className="volume-bars">{days.map((day) => <div key={day.label}><span style={{ height: `${Math.max(8, day.value / maxDay * 100)}%` }} title={`${day.value} atendimento(s)`} /><small>{day.label}</small></div>)}</div></article>
        <article className="panel recent-panel">
          <div className="panel-heading"><div><h3>Fila atual</h3><p>Prioridade e etapa</p></div><button onClick={() => conversations[0] && onOpen(conversations[0].id)}>Ver todas</button></div>
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
        <article className="panel owners-panel"><div className="panel-heading"><div><h3>Responsáveis</h3><p>Distribuição atual</p></div></div><div className="owner-item"><span><Bot size={17} /></span><div><b>IA</b><small>conversas</small></div><strong>{stats.ai}</strong></div><div className="owner-item"><span><Users size={17} /></span><div><b>Humano</b><small>conversas</small></div><strong>{conversations.filter((c) => c.ai_mode !== "autonomous").length}</strong></div><div className="owner-item"><span><CircleDollarSign size={17} /></span><div><b>Aguardando Pix</b><small>conversas</small></div><strong>{stats.pix}</strong></div></article>
        <article className="panel funnel-summary"><div className="panel-heading"><div><h3>Funil resumido</h3><p>Oportunidades ativas</p></div></div>{funnel.map(([label, value]) => <div className="funnel-summary-row" key={label}><span>{label}</span><strong>{value}</strong></div>)}</article>
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
  onMedia: (file: File) => void;
  onConfirm: () => void;
  onResume: () => void;
  mobileOpen: boolean;
  onMobileBack: () => void;
};

function InboxView(props: InboxProps) {
  const { selected } = props;
  const [chatMenu, setChatMenu] = useState(false);
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
            <button className="icon-button" onClick={() => setChatMenu((open) => !open)} aria-label="Opções da conversa"><MoreHorizontal size={19} /></button>
            {chatMenu && <div className="chat-options"><button onClick={() => { props.onResume(); setChatMenu(false); }} disabled={selected.ai_mode === "autonomous"}>Retomar atendimento da IA</button><button onClick={() => setChatMenu(false)}>Fechar menu</button></div>}
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
                  {message.media_type === "image" && message.media_url && <a className="media-content" href={message.media_url} target="_blank" rel="noreferrer"><img src={message.media_url} alt={message.file_name || "Imagem recebida"} /></a>}
                  {message.media_type === "video" && message.media_url && <video className="media-content" src={message.media_url} controls />}
                  {message.media_type === "audio" && message.media_url && <audio className="audio-content" src={message.media_url} controls />}
                  {message.media_type === "document" && message.media_url && <a className="document-content" href={message.media_url} download={message.file_name || "documento"}><FileText size={20} /><span>{message.file_name || "Baixar documento"}</span></a>}
                  {message.media_type && !message.media_url && <div className="media-preview"><FileText size={22} /><span>{message.media_type === "image" ? "Imagem recebida" : `Mídia: ${message.media_type}`}</span></div>}
                  <p>{message.content}</p>
                  <span className="message-meta">{message.actor === "ai" && <><Bot size={12} /> IA · </>}{message.actor === "human" && <>Você · </>}{clock(message.created_at)}{message.direction === "out" && <CheckCheck size={13} />}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="composer">
            <label className={`attachment-button ${props.sending ? "disabled" : ""}`} title="Enviar imagem, áudio, vídeo ou documento"><Paperclip size={18} /><input type="file" accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" disabled={props.sending} onChange={(event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) props.onMedia(file); event.target.value = ""; }} /></label>
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

function PageIntro({ title, description, action, icon: Icon }: { title: string; description: string; action?: string; icon?: ComponentType<{ size?: number }> }) {
  return <div className="module-intro"><div><h2>{title}</h2><p>{description}</p></div>{action && <button className="module-action" disabled>{Icon && <Icon size={16} />}{action}</button>}</div>;
}

function FunnelView({ conversations, onOpen }: { conversations: Conversation[]; onOpen: (id: string) => void }) {
  const columns = [
    { title: "Novos leads", values: conversations.filter((c) => c.status === "new") },
    { title: "Em atendimento", values: conversations.filter((c) => c.status === "in_progress") },
    { title: "Confirmação humana", values: conversations.filter((c) => c.status === "awaiting_payment_confirmation") },
    { title: "Finalizados", values: conversations.filter((c) => c.status === "resolved") },
  ];
  return <div className="page module-page"><PageIntro title="Funil de atendimento" description="Acompanhe cada conversa até a conclusão." action="Nova oportunidade" />
    <div className="funnel-board">{columns.map((column) => <section className="funnel-column" key={column.title}><header><strong>{column.title}</strong><span>{column.values.length}</span></header><div>{column.values.map((item) => <button key={item.id} onClick={() => onOpen(item.id)}><span className="avatar">{initials(item.contact_name)}</span><b>{item.contact_name || "Cliente"}</b><p>{item.last_message || "Sem mensagens"}</p><small>{aiText[item.ai_mode]} · {clock(item.updated_at)}</small></button>)}{!column.values.length && <p className="column-empty">Nenhum registro</p>}</div></section>)}</div>
  </div>;
}

function ContactsView({ conversations, onOpen }: { conversations: Conversation[]; onOpen: (id: string) => void }) {
  return <div className="page module-page"><PageIntro title="Contatos" description="Base unificada de clientes e oportunidades." action="Novo contato" />
    <div className="panel data-panel"><div className="data-head"><span>Contato</span><span>WhatsApp</span><span>Etapa</span><span>Responsável</span></div>{conversations.map((item) => <button className="data-row" key={item.id} onClick={() => onOpen(item.id)}><span className="person-cell"><i className="avatar">{initials(item.contact_name)}</i><b>{item.contact_name || "Cliente"}</b></span><span>{phone(item.phone)}</span><span><i className={`status-chip ${item.status}`}>{statusText[item.status]}</i></span><span>{item.ai_mode === "autonomous" ? "IA" : "Humano"}</span></button>)}{!conversations.length && <div className="truthful-empty">Nenhum contato recebido pelo WhatsApp.</div>}</div>
  </div>;
}

function ModuleEmptyView({ icon: Icon, title, description, action }: { icon: ComponentType<{ size?: number }>; title: string; description: string; action: string }) {
  return <div className="page module-page"><PageIntro title={title} description={description} action={action} icon={Icon} /><div className="panel module-empty"><span><Icon size={28} /></span><h3>Módulo sem registros</h3><p>Esta área faz parte do CRM original. Ela está visível, mas só será liberada quando houver persistência e regras correspondentes no backend.</p></div></div>;
}

function TeamView({ showNotice }: { showNotice: (text: string) => void }) {
  const [users, setUsers] = useState<CrmUser[]>([]);
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [role, setRole] = useState("agent");
  const [saving, setSaving] = useState(false);
  useEffect(() => { crmApi<CrmUser[]>("/users").then(setUsers).catch((error) => showNotice(error instanceof Error ? error.message : "Não foi possível carregar usuários.")); }, []);
  async function create(event: FormEvent) {
    event.preventDefault(); if (!name.trim() || !email.trim() || password.length < 8 || saving) return; setSaving(true);
    try {
      const user = await crmApi<CrmUser>("/users", { method: "POST", body: JSON.stringify({ name, email, password, role }) });
      setUsers((old) => [...old, user].sort((a, b) => a.name.localeCompare(b.name))); setName(""); setEmail(""); setPassword(""); showNotice("Usuário criado. Ele já pode entrar com o e-mail e a senha cadastrados.");
    } catch (error) { showNotice(error instanceof Error ? error.message : "Não foi possível criar o usuário."); } finally { setSaving(false); }
  }
  async function toggle(user: CrmUser) {
    try { const updated = await crmApi<CrmUser>(`/users/${user.id}`, { method: "PUT", body: JSON.stringify({ active: !user.active }) }); setUsers((old) => old.map((item) => item.id === user.id ? updated : item)); showNotice(updated.active ? "Usuário ativado." : "Usuário desativado."); }
    catch (error) { showNotice(error instanceof Error ? error.message : "Não foi possível atualizar o usuário."); }
  }
  return <div className="page module-page"><PageIntro title="Equipe e permissões" description="Crie acessos reais para administradores, supervisores e atendentes." />
    <form className="panel user-form" onSubmit={create}><label>Nome<input value={name} onChange={(e) => setName(e.target.value)} required /></label><label>E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label><label>Senha<input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" required /></label><label>Perfil<select value={role} onChange={(e) => setRole(e.target.value)}><option value="agent">Atendente</option><option value="supervisor">Supervisor</option><option value="finance">Financeiro</option><option value="marketing">Marketing</option><option value="admin">Administrador</option></select></label><button className="module-action" disabled={saving}>{saving ? "Criando..." : "Criar usuário"}</button></form>
    <div className="panel user-list"><div className="data-head"><span>Usuário</span><span>E-mail</span><span>Perfil</span><span>Status</span></div>{users.map((user) => <div className="data-row" key={user.id}><span className="person-cell"><i className="avatar">{initials(user.name)}</i><b>{user.name}</b></span><span>{user.email}</span><span>{user.role}</span><button className={`user-state ${user.active ? "active" : ""}`} onClick={() => toggle(user)}>{user.active ? "Ativo" : "Inativo"}</button></div>)}{!users.length && <div className="truthful-empty">Nenhum usuário cadastrado no banco.</div>}</div>
  </div>;
}

function AutomationsView() {
  const rules = [
    ["Atendimento automático por IA", "Nova mensagem", "A IA responde usando somente o contexto autorizado."],
    ["Cliente informou pagamento", "Pix ou comprovante", "Pausa a IA e encaminha para confirmação humana."],
    ["Pix confirmado pelo humano", "Confirmação no CRM", "Envia o acesso e conclui a conversa."],
  ];
  return <div className="page module-page"><PageIntro title="Automações" description="Gatilhos e ações que já fazem parte da operação real." /> <div className="automation-list">{rules.map((r, index) => <article className="panel automation-card" key={r[0]}><span>{index + 1}</span><div><strong>{r[0]}</strong><small>Gatilho: {r[1]}</small><p>{r[2]}</p></div><em>Ativa</em></article>)}</div></div>;
}

function AiView({ onConfigure }: { onConfigure: () => void }) {
  const [status, setStatus] = useState<{ enabled: boolean; configured: boolean; model: string } | null>(null);
  const [testing, setTesting] = useState(false); const [answer, setAnswer] = useState(""); const [error, setError] = useState("");
  useEffect(() => { crmApi<{ enabled: boolean; configured: boolean; model: string }>("/ai/status").then(setStatus).catch((reason) => setError(reason instanceof Error ? reason.message : "Falha ao consultar Gemini")); }, []);
  async function testAgent() { setTesting(true); setError(""); setAnswer(""); try { const result = await crmApi<{ answer: string }>("/ai/test", { method: "POST", body: JSON.stringify({ message: "Olá, explique brevemente como você pode atender um cliente desta empresa." }) }); setAnswer(result.answer); } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha no teste do Gemini"); } finally { setTesting(false); } }
  const operational = !!status?.enabled && !!status?.configured;
  return <div className="page module-page"><PageIntro title="Inteligência artificial" description="Estado real do agente conectado ao backend." /><div className="panel ai-module"><span><Sparkles size={24} /></span><div><strong>Atendimento comercial</strong><small>{status ? `${status.model} · texto, imagem, áudio e vídeo` : "Consultando backend..."}</small></div><em className={operational ? "" : "offline"}>{operational ? "Operacional" : "Não configurado"}</em></div><div className="panel ai-rules"><h3>Diagnóstico do Gemini</h3><p>API habilitada: {status?.enabled ? "✓ Sim" : "✕ Não"}</p><p>Chave configurada: {status?.configured ? "✓ Sim" : "✕ Não"}</p><p>Modelo: {status?.model || "—"}</p>{error && <div className="ai-test-error">{error}</div>}{answer && <div className="ai-test-answer"><b>Resposta real do Gemini</b><p>{answer}</p></div>}<div className="ai-actions"><button className="module-action" onClick={testAgent} disabled={testing || !operational}>{testing ? "Testando..." : "Testar Gemini agora"}</button><button className="secondary-action compact" onClick={onConfigure}><Settings size={15} />Configurar contexto</button></div></div></div>;
}

function ReportsView({ conversations }: { conversations: Conversation[] }) {
  const cards = [
    ["Atendimento", `${conversations.length} conversas`],
    ["IA", `${conversations.filter((c) => c.ai_mode === "autonomous").length} automáticas`],
    ["Financeiro", `${conversations.filter((c) => c.status === "awaiting_payment_confirmation").length} pendências`],
    ["Finalizados", `${conversations.filter((c) => c.status === "resolved").length} concluídos`],
  ];
  return <div className="page module-page"><PageIntro title="Relatórios" description="Indicadores calculados somente com dados reais." action="Exportar relatório" icon={Download} /><div className="report-grid">{cards.map((card) => <article className="panel report-card" key={card[0]}><BarChart3 size={21} /><strong>{card[0]}</strong><p>{card[1]}</p></article>)}</div></div>;
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
