import {
  Activity,
  ArrowRight,
  AtSign,
  BookOpenCheck,
  Check,
  CheckCircle2,
  CircleAlert,
  CircleDot,
  Hash,
  KeyRound,
  MessageCircleMore,
  Radio,
  Settings2,
  ShieldCheck,
  Webhook,
} from "lucide-react";

type SafeConfiguration = {
  configured: boolean;
  missingCount: number;
  keywords: string[];
  apiVersion: string | null;
  webhookReady: boolean;
  credentialsConfigured: boolean;
  replyConfigured: boolean;
  dashboardProtected: boolean;
};

function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

function Sidebar({ ready }: { ready: boolean }) {
  return (
    <aside className="sidebar">
      <div className="brand-row">
        <BrandMark />
        <div>
          <p className="brand-name">Signal Desk</p>
          <p className="brand-subtitle">Comment automation</p>
        </div>
      </div>

      <nav className="nav" aria-label="Dashboard sections">
        <a className="nav-item active" href="#overview" aria-current="page">
          <Activity size={18} />
          Overview
        </a>
        <a className="nav-item" href="#setup">
          <Settings2 size={18} />
          Setup
        </a>
        <a className="nav-item" href="#scope">
          <BookOpenCheck size={18} />
          Tutorial scope
        </a>
      </nav>

      <div className={`side-status ${ready ? "is-ready" : "is-warning"}`}>
        {ready ? <Radio size={17} /> : <CircleAlert size={17} />}
        <div>
          <strong>{ready ? "Webhook ready" : "Setup required"}</strong>
          <span>{ready ? "Listening for comments" : "Review configuration"}</span>
        </div>
      </div>
    </aside>
  );
}

function SignalRail({ ready }: { ready: boolean }) {
  return (
    <section className="signal-rail" aria-label="Automation flow">
      <div className="signal-copy">
        <p className="section-kicker">Live automation</p>
        <h2>
          {ready
            ? "Every matching comment has a clear path."
            : "Connect the path, then go live."}
        </h2>
      </div>

      <div className="flow" aria-label="Comment, keyword match, private reply">
        <div className="flow-node">
          <span className="flow-icon">
            <MessageCircleMore size={21} />
          </span>
          <span>
            <strong>Comment</strong>
            <small>Webhook received</small>
          </span>
        </div>
        <div className="flow-line"><span /></div>
        <div className="flow-node">
          <span className="flow-icon"><Hash size={21} /></span>
          <span>
            <strong>Keyword</strong>
            <small>Rule matched</small>
          </span>
        </div>
        <div className="flow-line"><span /></div>
        <div className="flow-node emphasized">
          <span className="flow-icon"><AtSign size={21} /></span>
          <span>
            <strong>Private reply</strong>
            <small>Delivered by Meta</small>
          </span>
        </div>
      </div>
    </section>
  );
}

function ReadinessStrip({ config }: { config: SafeConfiguration }) {
  const items = [
    {
      icon: Webhook,
      label: "Webhook",
      detail: config.webhookReady ? "Ready" : "Needs configuration",
      ok: config.webhookReady,
    },
    {
      icon: Hash,
      label: "Keyword rule",
      detail:
        config.keywords.length > 0
          ? `${config.keywords.length} configured`
          : "No keywords yet",
      ok: config.keywords.length > 0,
    },
    {
      icon: ShieldCheck,
      label: "Secrets",
      detail: "Server-side only",
      ok: true,
    },
  ];

  return (
    <section className="readiness-strip" aria-label="Setup overview">
      {items.map(({ icon: Icon, label, detail, ok }) => (
        <div className="readiness-item" key={label}>
          <span className={`readiness-icon ${ok ? "is-ready" : "is-warning"}`}>
            <Icon size={18} />
          </span>
          <span>
            <strong>{label}</strong>
            <small>{detail}</small>
          </span>
        </div>
      ))}
    </section>
  );
}

function RulePanel({ config }: { config: SafeConfiguration }) {
  return (
    <section className="rule-panel" id="setup">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Current rule</p>
          <h2>First match wins</h2>
        </div>
        <span className={`status-pill ${config.replyConfigured ? "success" : "warning"}`}>
          <CircleDot size={14} />
          {config.replyConfigured ? "Armed" : "Incomplete"}
        </span>
      </div>

      <div className="rule-body">
        <div className="keyword-row">
          {config.keywords.length > 0 ? (
            config.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)
          ) : (
            <span className="empty-keyword">No keywords configured</span>
          )}
        </div>
        <div className="rule-action">
          <ArrowRight size={20} />
          <div>
            <strong>Send one private reply</strong>
            <span>Reply copy remains server-side</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function SystemPanel({ config }: { config: SafeConfiguration }) {
  const checks = [
    {
      label: "Webhook verification",
      detail: config.webhookReady ? "Challenge and signature ready" : "Variables incomplete",
      ok: config.webhookReady,
      icon: Webhook,
    },
    {
      label: "Meta private reply",
      detail: config.credentialsConfigured
        ? `Credentials set · ${config.apiVersion ?? "version set"}`
        : "Credentials incomplete",
      ok: config.credentialsConfigured,
      icon: KeyRound,
    },
    {
      label: "Reply rule",
      detail: config.replyConfigured ? "Keyword and message set" : "Rule incomplete",
      ok: config.replyConfigured,
      icon: MessageCircleMore,
    },
    {
      label: "Dashboard access",
      detail: config.dashboardProtected ? "Protected in production" : "Add dashboard credentials",
      ok: config.dashboardProtected,
      icon: ShieldCheck,
    },
  ];

  return (
    <section className="system-panel" aria-label="System checks">
      <div className="panel-heading compact">
        <div>
          <p className="section-kicker">System checks</p>
          <h2>Setup state</h2>
        </div>
      </div>
      <div className="check-list">
        {checks.map(({ label, detail, ok, icon: Icon }) => (
          <div className="check-row" key={label}>
            <Icon size={18} />
            <span>
              <strong>{label}</strong>
              <small>{detail}</small>
            </span>
            {ok ? (
              <Check size={17} className="check-ok" />
            ) : (
              <CircleAlert size={17} className="check-bad" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function ScopePanel() {
  return (
    <section className="scope-panel" id="scope">
      <div className="scope-mark" aria-hidden="true">
        <BookOpenCheck size={24} />
      </div>
      <div className="scope-copy">
        <p className="section-kicker">Tutorial scope</p>
        <h2>Simple now. Durable later.</h2>
        <p>
          This version processes each webhook in memory and keeps no counters,
          comment history, or delivery records.
        </p>
      </div>
      <div className="scope-detail">
        <strong>Not included</strong>
        <span>Cross-request idempotency</span>
        <span>Persistent activity history</span>
      </div>
    </section>
  );
}

export function Dashboard({ config }: { config: SafeConfiguration }) {
  const ready = config.configured;

  return (
    <div className="dashboard-shell">
      <Sidebar ready={ready} />
      <main className="dashboard-main">
        <header className="page-header" id="overview">
          <div>
            <p className="section-kicker">Operations overview</p>
            <h1>Good signals in. Useful replies out.</h1>
            <p>See whether your Instagram comment automation is ready.</p>
          </div>
          <div className={`header-state ${ready ? "ready" : "warning"}`}>
            {ready ? <CheckCircle2 size={18} /> : <CircleAlert size={18} />}
            <span>
              <strong>{ready ? "Automation is ready" : "Automation needs setup"}</strong>
              <small>
                {ready
                  ? "Webhook and reply rule configured"
                  : `${config.missingCount} server value${config.missingCount === 1 ? "" : "s"} missing`}
              </small>
            </span>
          </div>
        </header>

        <SignalRail ready={ready} />
        <ReadinessStrip config={config} />

        <div className="detail-grid">
          <RulePanel config={config} />
          <SystemPanel config={config} />
        </div>

        <ScopePanel />

        <footer className="dashboard-footer">
          <span>Signal Desk</span>
          <span>Stateless tutorial build</span>
        </footer>
      </main>
    </div>
  );
}
