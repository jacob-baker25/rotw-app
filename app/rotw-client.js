"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const SHORT_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function dateLabel(value, short = false) {
  if (!value) return "Date unknown";
  const date = new Date(`${value}T12:00:00Z`);
  return (short ? SHORT_DATE : DATE_FORMAT).format(date);
}

function formatTime(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(new Date(value));
}

function formatCountdown(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainder = seconds % 60;
  const pad = (value) => String(value).padStart(2, "0");
  return `${days ? `${days}d ` : ""}${pad(hours)}h ${pad(minutes)}m ${pad(remainder)}s`;
}

function VotingCountdown({ state, refresh }) {
  const [tick, setTick] = useState(Date.now());
  const target = Date.parse(
    state.votingOpen ? state.votingEndsAt : state.votingStartsAt,
  );
  const serverTime = Date.parse(state.serverNow) + tick - state.receivedAt;
  const remaining = Math.max(0, target - serverTime);

  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const serverTimeNow = Date.parse(state.serverNow) + Date.now() - state.receivedAt;
    const timer = setTimeout(refresh, Math.max(1000, target - serverTimeNow + 1000));
    return () => clearTimeout(timer);
  }, [target, state.serverNow, state.receivedAt, refresh]);

  return (
    <span
      className="voting-countdown"
      role="timer"
      title={
        state.votingOpen
          ? "Voting closes Monday at 12:00 a.m. Eastern"
          : "Voting opens Sunday at 12:00 a.m. Eastern"
      }
    >
      {state.votingOpen ? "Voting ends in" : "Voting begins in"}
      <strong>{formatCountdown(remaining)}</strong>
      <small>ET</small>
    </span>
  );
}

function reasonHeading(post) {
  return post?.source === "vote_reason" ? post.body : post?.title || "";
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

function CandidatePicker({ candidates, value, onChange, id, label = "Name" }) {
  const known = candidates.some((person) => person.name === value);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={known ? value : value ? "__writein" : ""}
        onChange={(event) =>
          onChange(
            event.target.value === "__writein"
              ? "__writein"
              : event.target.value,
          )
        }
      >
        <option value="">Choose a person</option>
        {candidates.map((person) => (
          <option key={person.id} value={person.name}>
            {person.name}
          </option>
        ))}
        <option value="__writein">Write someone in…</option>
      </select>
      {(value === "__writein" || (value && !known)) && (
        <input
          aria-label="Write-in name"
          maxLength={40}
          value={value === "__writein" ? "" : value}
          onChange={(event) => onChange(event.target.value || "__writein")}
        />
      )}
    </div>
  );
}

function Identity({ roommates, identity, onChange }) {
  return (
    <div className="identity">
      <div>
        <strong>Who’s here?</strong>
        <small>Select your name to post and vote.</small>
      </div>
      <select
        aria-label="Your name"
        value={identity}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select your name</option>
        {roommates.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}

function Board({ state, identity, refresh, setNotice }) {
  const [candidate, setCandidate] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("all");
  const candidateById = Object.fromEntries(
    state.candidates.map((person) => [person.id, person]),
  );
  const posts = state.posts.filter(
    (post) => filter === "all" || post.candidate_id === filter,
  );

  async function submit(event) {
    event.preventDefault();
    if (!identity) return setNotice("Choose your name above first.");
    if (!candidate || candidate === "__writein")
      return setNotice("Choose or enter the person this is about.");
    setBusy(true);
    try {
      await api("/api/posts", {
        method: "POST",
        body: JSON.stringify({ author: identity, candidate, title, body }),
      });
      setCandidate("");
      setTitle("");
      setBody("");
      setNotice("Added to this week’s board.");
      await refresh();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="two-column">
      <section className="panel compose-panel">
        <h2>What did they do?</h2>
        <form onSubmit={submit} className="stack">
          <CandidatePicker
            candidates={state.candidates}
            value={candidate}
            onChange={setCandidate}
            id="post-person"
          />
          <div className="field">
            <label htmlFor="post-title">Title</label>
            <input
              id="post-title"
              required
              minLength={2}
              maxLength={100}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="post-body">Details</label>
            <textarea
              id="post-body"
              required
              minLength={2}
              maxLength={1000}
              rows={5}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </div>
          <button className="button primary" disabled={busy || !identity}>
            {busy ? "Posting…" : "Post"}
          </button>
          {!identity && (
            <small className="hint">
              Select your name above to start posting.
            </small>
          )}
        </form>
      </section>
      <section className="board-column">
        <div className="section-heading">
          <div>
            <h2>
              This week <span className="count">{state.posts.length}</span>
            </h2>
          </div>
          <select
            aria-label="Filter posts by person"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="all">Everyone</option>
            {state.candidates.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </div>
        {posts.length ? (
          <div className="post-list">
            {posts.map((post) => (
              <article className="post-card" key={post.id}>
                <div className="post-top">
                  <span className="person-pill">
                    {candidateById[post.candidate_id]?.name || "Someone"}
                  </span>
                  <time>{formatTime(post.created_at)}</time>
                </div>
                <h3>{post.title}</h3>
                {post.body !== post.title && <p>{post.body}</p>}
                <div className="post-foot">
                  Added by {post.author_name}
                  {post.source === "vote_reason" && (
                    <span> · Shared from a vote</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">
            <h3>No posts yet.</h3>
            <p>Add the first post for this week.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function Vote({ state, identity, refresh, setNotice }) {
  const personById = Object.fromEntries(
    state.candidates.map((person) => [person.id, person]),
  );
  const testMode = !state.votingOpen && state.admin && state.testVotingReady;
  const votingEnabled = state.votingOpen || testMode;
  const savedVote = testMode ? state.testVote : state.myVote;
  const visibleVotes = testMode ? state.testVotes || [] : state.weekVotes || [];
  const postsById = Object.fromEntries(state.posts.map((post) => [post.id, post]));
  const totals = Object.entries(
    visibleVotes.reduce((counts, vote) => {
      const name = testMode
        ? vote.candidate_name
        : personById[vote.candidate_id]?.name || "Unknown";
      counts[name] = (counts[name] || 0) + 1;
      return counts;
    }, {}),
  ).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const [candidate, setCandidate] = useState("");
  const [reasonId, setReasonId] = useState("");
  const [reasonText, setReasonText] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ballotOpen, setBallotOpen] = useState(false);
  useEffect(() => setBallotOpen(false), [identity, testMode]);
  useEffect(() => {
    if (savedVote?.is_anonymous) {
      setCandidate("");
      setReasonId("");
      setReasonText("");
      setIsAnonymous(true);
    } else if (savedVote) {
      setCandidate(
        testMode
          ? savedVote.candidate_name
          : personById[savedVote.candidate_id]?.name || "",
      );
      setReasonId(savedVote.reason_post_id || "");
      setReasonText(testMode ? savedVote.reason_text || "" : "");
      setIsAnonymous(savedVote.is_anonymous === true);
    } else {
      setCandidate("");
      setReasonId("");
      setReasonText("");
      setIsAnonymous(false);
    }
  }, [identity, testMode, savedVote?.id, savedVote?.updated_at, savedVote?.is_anonymous, state.candidates.length]);
  const chosen = state.candidates.find(
    (person) => person.name.toLowerCase() === candidate.toLowerCase(),
  );
  const reasons = state.posts.filter(
    (post) => post.candidate_id === chosen?.id,
  );
  const currentReason = state.posts.find(
    (post) => post.id === savedVote?.reason_post_id,
  );

  async function submit(event) {
    event.preventDefault();
    if (!identity) return setNotice("Choose your name above first.");
    if (!candidate || candidate === "__writein")
      return setNotice("Choose or write in a candidate.");
    if (!reasonId && reasonText.trim().length < 2)
      return setNotice("Choose a post or write your reason.");
    setBusy(true);
    try {
      await api(testMode ? "/api/admin/test-vote" : "/api/votes", {
        method: "POST",
        body: JSON.stringify({
          voter: identity,
          candidate,
          reasonPostId: reasonId || null,
          reasonText,
          isAnonymous,
        }),
      });
      setNotice(
        testMode
          ? "Test ballot saved. It does not count toward the weekly result."
          : "Vote saved. You can change it until Sunday ends.",
      );
      setReasonText("");
      setBallotOpen(false);
      await refresh();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function clearTest() {
    setBusy(true);
    try {
      await api(`/api/admin/test-vote?voter=${encodeURIComponent(identity)}`, {
        method: "DELETE",
      });
      setNotice("Test ballot cleared.");
      setBallotOpen(false);
      await refresh();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`vote-layout ${savedVote ? "has-voted" : ""}`}>
      <section className="panel vote-panel">
        <h2>{testMode ? "Test vote" : "Vote"}</h2>
        {votingEnabled ? (
          <>
            <p className="muted">
              {testMode
                ? "Admin test votes are separate from Sunday's result."
                : "One vote per person. You can change yours until midnight Eastern."}
            </p>
            {savedVote && (
              <div className="current-vote">
                <strong>Your current {testMode ? "test vote" : "vote"}</strong>
                {savedVote.is_anonymous ? (
                  <span>Saved anonymously. Choose Change vote to enter a new pick.</span>
                ) : (
                  <span>
                    {testMode
                      ? savedVote.candidate_name
                      : personById[savedVote.candidate_id]?.name ||
                        "Write-in"}{" "}
                    ·{" "}
                    {reasonHeading(currentReason) ||
                      savedVote.reason_text ||
                      "Reason saved"}
                  </span>
                )}
              </div>
            )}
            <div className="ballot-actions">
              <button
                type="button"
                className="button primary"
                disabled={!identity || busy}
                onClick={() => setBallotOpen((open) => !open)}
                aria-expanded={ballotOpen}
              >
                {ballotOpen
                  ? "Close ballot"
                  : savedVote
                    ? "Change vote"
                    : "Vote"}
              </button>
              {testMode && savedVote && (
                <button
                  type="button"
                  className="button subtle"
                  disabled={busy}
                  onClick={clearTest}
                >
                  Clear test vote
                </button>
              )}
            </div>
            {!identity && (
              <small className="hint">Select your name above to vote.</small>
            )}
            {ballotOpen && (
              <form onSubmit={submit} className="stack ballot-form">
                <CandidatePicker
                  candidates={state.candidates}
                  value={candidate}
                  onChange={(value) => {
                    setCandidate(value);
                    setReasonId("");
                    setReasonText("");
                  }}
                  id="vote-person"
                  label="Your pick"
                />
                {candidate && candidate !== "__writein" && (
                  <fieldset className="reason-fieldset">
                    <legend>Reason:</legend>
                    {reasons.length > 0 && (
                      <div className="reason-list">
                        {reasons.map((post) => (
                          <label
                            className={`reason-option ${reasonId === post.id ? "selected" : ""}`}
                            key={post.id}
                          >
                            <input
                              type="radio"
                              name="reason"
                              checked={reasonId === post.id}
                              onChange={() => setReasonId(post.id)}
                            />
                            <strong>{reasonHeading(post)}</strong>
                          </label>
                        ))}
                      </div>
                    )}
                    <label
                      className={`reason-option own-reason ${!reasonId ? "selected" : ""}`}
                    >
                      <input
                        type="radio"
                        name="reason"
                        checked={!reasonId}
                        onChange={() => setReasonId("")}
                      />
                      <strong>Write my own reason</strong>
                    </label>
                    {!reasonId && (
                      <>
                        <p className="hint">Your reason becomes a post that others can select.</p>
                        <textarea
                          aria-label="Your reason"
                          maxLength={1000}
                          rows={3}
                          value={reasonText}
                          onChange={(event) => setReasonText(event.target.value)}
                        />
                      </>
                    )}
                  </fieldset>
                )}
                <div className="privacy-choice">
                  <label>
                    <input
                      type="checkbox"
                      checked={isAnonymous}
                      disabled={!state.anonymousReady}
                      onChange={(event) => setIsAnonymous(event.target.checked)}
                    />
                    <span>Vote anonymously</span>
                  </label>
                  <small>
                    {state.anonymousReady
                      ? "Your name is hidden on the board and vote list. Admin can still see who voted."
                      : "Run the updated Supabase schema to enable this option."}
                  </small>
                </div>
                <button className="button primary" disabled={busy || !identity}>
                  {busy ? "Saving…" : savedVote ? "Save change" : "Submit vote"}
                </button>
              </form>
            )}
          </>
        ) : (
          <div className="vote-closed">
            <h3>Voting opens Sunday.</h3>
            <p>
              {state.admin && !state.testVotingReady
                ? "Run the updated supabase/schema.sql to enable weekday test ballots."
                : "Voting opens Sunday and closes Monday at 12:00 a.m. Eastern. Admins can use a test ballot on weekdays."}
            </p>
          </div>
        )}
      </section>
      <section className="panel vote-results">
        <div className="section-heading">
          <div>
            <h2>{testMode ? "Test votes" : "Current votes"}</h2>
            <p className="muted">
              {testMode
                ? "These ballots do not count toward the weekly result."
                : `Week ending ${dateLabel(state.weekEnd)}`}
            </p>
          </div>
          <span className="vote-count">
            {visibleVotes.length} {visibleVotes.length === 1 ? "vote" : "votes"}
          </span>
        </div>
        {visibleVotes.length ? (
          <>
            <div className="vote-totals" aria-label="Vote totals by person">
              {totals.map(([name, count]) => (
                <div className="vote-total" key={name}>
                  <strong>{name}</strong>
                  <span>{count}</span>
                </div>
              ))}
            </div>
            <div className="vote-records">
              {visibleVotes.map((vote, index) => {
                const post = postsById[vote.reason_post_id];
                const name = testMode
                  ? vote.candidate_name
                  : personById[vote.candidate_id]?.name || "Unknown";
                return (
                  <article className="vote-record" key={vote.id || `${vote.updated_at}-${index}`}>
                    <div className="vote-record-top">
                      <strong>{vote.voter_name}</strong>
                      <span>voted for {name}</span>
                    </div>
                    <div className="vote-record-reason">
                      <strong>{reasonHeading(post) || vote.reason_text || "Reason unavailable"}</strong>
                      {post && post.body !== reasonHeading(post) && (
                        <p>{post.body}</p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        ) : (
          <div className="empty">
            <h3>No votes yet.</h3>
          </div>
        )}
      </section>
    </div>
  );
}

function History({ state }) {
  const [filter, setFilter] = useState("all");
  const people = Object.fromEntries(
    state.candidates.map((candidate) => [candidate.id, candidate]),
  );
  const counts = new Map();
  for (const win of [...state.legacyWins, ...state.winners])
    counts.set(win.candidate_id, (counts.get(win.candidate_id) || 0) + 1);
  const leaders = [...counts.entries()]
    .map(([id, wins]) => ({ id, name: people[id]?.name || "Unknown", wins }))
    .sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name));
  const grouped = new Map();
  for (const win of state.winners) {
    const key = `week-${win.week_end}`;
    if (!grouped.has(key))
      grouped.set(key, { date: win.week_end, wins: [], type: "weekly" });
    grouped.get(key).wins.push(win);
  }
  const items = [
    ...grouped.values(),
    ...state.legacyWins.map((win) => ({
      date: win.week_end,
      wins: [win],
      type: "legacy",
      slot: win.legacy_slot,
    })),
  ]
    .sort(
      (a, b) =>
        (b.date || "").localeCompare(a.date || "") ||
        (a.slot || 0) - (b.slot || 0),
    )
    .filter(
      (item) =>
        filter === "all" ||
        item.wins.some((win) => win.candidate_id === filter),
    );

  return (
    <div className="history-layout">
      <section>
        <div className="section-heading history-heading">
          <div>
            <h2>History</h2>
          </div>
          <select
            aria-label="Filter history by person"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="all">All winners</option>
            {leaders.map((leader) => (
              <option key={leader.id} value={leader.id}>
                {leader.name}
              </option>
            ))}
          </select>
        </div>
        <div className="history-list">
          {items.map((item, index) => (
            <article
              className="history-card"
              key={`${item.type}-${item.date || "unknown"}-${item.slot || index}`}
            >
              <div className="history-date">
                <span>
                  {item.date
                    ? `Week ending ${dateLabel(item.date)}`
                    : "Earlier win · date unknown"}
                </span>
                {item.wins.length > 1 && <em>Shared win</em>}
              </div>
              <div className="history-winners">
                {item.wins.map((win) => (
                  <div className="history-winner" key={win.id}>
                    <h3>{people[win.candidate_id]?.name || "Unknown"}</h3>
                    {item.type === "weekly" && (
                      <span>
                        {win.vote_count}{" "}
                        {win.vote_count === 1 ? "vote" : "votes"}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {item.wins.map((win) => (
                <div className="history-reason" key={`reason-${win.id}`}>
                  {item.type === "weekly" ? (
                    win.reason_body ? (
                      <>
                        <strong>{win.reason_title}</strong>
                        <p>{win.reason_body}</p>
                      </>
                    ) : (
                      <p>Reason not recorded.</p>
                    )
                  ) : (
                    <p>{win.reason || "Reason not recorded."}</p>
                  )}
                </div>
              ))}
            </article>
          ))}
        </div>
      </section>
      <aside className="leaderboard panel">
        <h2>Leaderboard</h2>
        <p className="muted">All-time wins</p>
        <div className="leader-list">
          {leaders.map((leader, index) => (
            <div className="leader-row" key={leader.id}>
              <span className="rank">{String(index + 1).padStart(2, "0")}</span>
              <strong>{leader.name}</strong>
              <span className="wins">
                {leader.wins}{" "}
                <small>{leader.wins === 1 ? "win" : "wins"}</small>
              </span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function AdminPanel({ state, refresh, setNotice }) {
  const [passcode, setPasscode] = useState("");
  const [newCandidate, setNewCandidate] = useState("");
  const [newLegacyCandidate, setNewLegacyCandidate] = useState("");
  const [newLegacyDate, setNewLegacyDate] = useState("");
  const [newLegacyReason, setNewLegacyReason] = useState("");
  const [newWinnerWeek, setNewWinnerWeek] = useState("");
  const [newWinnerCandidate, setNewWinnerCandidate] = useState("");
  const [newWinnerVotes, setNewWinnerVotes] = useState(1);
  const [busy, setBusy] = useState(false);
  const names = Object.fromEntries(
    state.candidates.map((person) => [person.id, person.name]),
  );
  const postsById = Object.fromEntries(
    (state.adminPosts || []).map((post) => [post.id, post]),
  );

  async function manage(payload, success = "Saved.") {
    setBusy(true);
    try {
      await api("/api/admin/manage", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setNotice(success);
      await refresh();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function login(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api("/api/admin/session", {
        method: "POST",
        body: JSON.stringify({ passcode }),
      });
      setPasscode("");
      setNotice("Admin controls unlocked.");
      await refresh();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    await api("/api/admin/session", { method: "DELETE" });
    setNotice("Admin controls locked.");
    await refresh();
  }

  if (!state.admin)
    return (
      <section className="panel admin-login">
        <h2>Admin</h2>
        <p className="muted">Enter the admin passcode.</p>
        <form onSubmit={login} className="stack">
          <div className="field">
            <label htmlFor="passcode">Admin passcode</label>
            <input
              id="passcode"
              type="password"
              autoComplete="current-password"
              required
              value={passcode}
              onChange={(event) => setPasscode(event.target.value)}
            />
          </div>
          <button className="button primary" disabled={busy}>
            Unlock admin
          </button>
        </form>
      </section>
    );

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <h2>Admin</h2>
          <p className="muted">Manage posts, votes, winners, and names.</p>
        </div>
        <button className="button subtle" onClick={logout}>
          Lock admin
        </button>
      </div>
      <section className="panel admin-section">
        <h3>Add a historical win</h3>
        <p className="muted">
          The 20 known wins are already loaded. Dates and reasons may be left
          blank.
        </p>
        <form
          className="admin-create"
          onSubmit={(event) => {
            event.preventDefault();
            manage(
              {
                action: "create",
                kind: "legacy",
                data: {
                  candidate_id: newLegacyCandidate,
                  week_end: newLegacyDate || null,
                  reason: newLegacyReason || null,
                },
              },
              "Historical win added.",
            );
            setNewLegacyDate("");
            setNewLegacyReason("");
          }}
        >
          <select
            required
            aria-label="Historical winner"
            value={newLegacyCandidate}
            onChange={(event) => setNewLegacyCandidate(event.target.value)}
          >
            <option value="">Winner</option>
            {state.candidates.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            aria-label="Week ending date, optional"
            value={newLegacyDate}
            onChange={(event) => setNewLegacyDate(event.target.value)}
          />
          <input
            aria-label="Reason, optional"
            placeholder="Reason (optional)"
            value={newLegacyReason}
            onChange={(event) => setNewLegacyReason(event.target.value)}
          />
          <button className="button primary" disabled={busy}>
            Add win
          </button>
        </form>
        <div className="admin-records">
          {state.legacyWins.map((win) => (
            <EditableRecord
              key={win.id}
              title={`${names[win.candidate_id] || "Unknown"} · ${win.week_end ? dateLabel(win.week_end, true) : "date unknown"}`}
              fields={{
                candidate_id: win.candidate_id,
                week_end: win.week_end || "",
                reason: win.reason || "",
              }}
              options={state.candidates}
              kind="legacy"
              id={win.id}
              manage={manage}
              busy={busy}
            />
          ))}
        </div>
      </section>
      <section className="panel admin-section">
        <h3>Board posts</h3>
        <p className="muted">
          A reason typed during voting appears here as a post.
        </p>
        <div className="admin-records">
          {state.adminPosts?.map((post) => (
            <EditableRecord
              key={post.id}
              title={`${post.title} · ${names[post.candidate_id] || "Unknown"}`}
              fields={{
                candidate_id: post.candidate_id,
                author_name: post.author_name,
                title: post.title,
                body: post.body,
                week_end: post.week_end,
                ...(state.anonymousReady ? { is_anonymous: post.is_anonymous } : {}),
              }}
              options={state.candidates}
              roommates={state.roommates}
              kind="post"
              id={post.id}
              manage={manage}
              busy={busy}
            />
          ))}
        </div>
      </section>
      <section className="panel admin-section">
        <h3>Ballots</h3>
        <p className="muted">
          These are admin-only. Changing an old ballot does not rewrite a locked
          winner; edit that result below if needed.
        </p>
        <div className="admin-records">
          {state.adminVotes?.map((vote) => (
            <EditableRecord
              key={vote.id}
              title={`${vote.voter_name} → ${names[vote.candidate_id] || "Unknown"} · ${dateLabel(vote.week_end, true)}`}
              fields={{
                voter_name: vote.voter_name,
                candidate_id: vote.candidate_id,
                reason_post_id: vote.reason_post_id,
                week_end: vote.week_end,
                ...(state.anonymousReady ? { is_anonymous: vote.is_anonymous } : {}),
              }}
              options={state.candidates}
              roommates={state.roommates}
              posts={state.adminPosts || []}
              kind="vote"
              id={vote.id}
              manage={manage}
              busy={busy}
            />
          ))}
        </div>
      </section>
      <section className="panel admin-section">
        <h3>Finalized winners</h3>
        <p className="muted">
          Correct the winner, vote count, or featured reason here. To add a
          shared winner, choose a closed week.
        </p>
        <form
          className="admin-create"
          onSubmit={(event) => {
            event.preventDefault();
            manage(
              {
                action: "create",
                kind: "winner",
                data: {
                  week_end: newWinnerWeek,
                  candidate_id: newWinnerCandidate,
                  vote_count: Number(newWinnerVotes),
                },
              },
              "Winner added.",
            );
          }}
        >
          <select
            required
            aria-label="Closed week"
            value={newWinnerWeek}
            onChange={(event) => setNewWinnerWeek(event.target.value)}
          >
            <option value="">Closed week</option>
            {state.closures.map((week) => (
              <option key={week.week_end} value={week.week_end}>
                {dateLabel(week.week_end)}
              </option>
            ))}
          </select>
          <select
            required
            aria-label="Winner"
            value={newWinnerCandidate}
            onChange={(event) => setNewWinnerCandidate(event.target.value)}
          >
            <option value="">Winner</option>
            {state.candidates.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
          <input
            aria-label="Vote count"
            type="number"
            min="1"
            value={newWinnerVotes}
            onChange={(event) => setNewWinnerVotes(event.target.value)}
          />
          <button className="button primary" disabled={busy}>
            Add winner
          </button>
        </form>
        <div className="admin-records">
          {state.winners.map((win) => (
            <EditableRecord
              key={win.id}
              title={`${names[win.candidate_id] || "Unknown"} · ${dateLabel(win.week_end, true)}`}
              fields={{
                candidate_id: win.candidate_id,
                vote_count: win.vote_count,
                reason_title: win.reason_title || "",
                reason_body: win.reason_body || "",
              }}
              options={state.candidates}
              kind="winner"
              id={win.id}
              manage={manage}
              busy={busy}
            />
          ))}
        </div>
      </section>
      <section className="panel admin-section">
        <h3>Candidate names</h3>
        <p className="muted">
          Add or correct write-in names. A name with posts or wins cannot be
          deleted until those records are removed.
        </p>
        <form
          className="admin-create"
          onSubmit={(event) => {
            event.preventDefault();
            manage(
              {
                action: "create",
                kind: "candidate",
                data: { name: newCandidate },
              },
              "Candidate added.",
            );
            setNewCandidate("");
          }}
        >
          <input
            required
            minLength={2}
            maxLength={40}
            placeholder="New candidate name"
            value={newCandidate}
            onChange={(event) => setNewCandidate(event.target.value)}
          />
          <button className="button primary" disabled={busy}>
            Add person
          </button>
        </form>
        <div className="admin-records">
          {state.candidates.map((person) => (
            <EditableRecord
              key={person.id}
              title={`${person.name}${person.is_roommate ? "" : " · write-in"}`}
              fields={{ name: person.name }}
              kind="candidate"
              id={person.id}
              manage={manage}
              busy={busy}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function EditableRecord({
  title,
  fields,
  options = [],
  roommates = [],
  posts = [],
  kind,
  id,
  manage,
  busy,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(fields);
  useEffect(() => {
    if (!editing) setDraft(fields);
  }, [JSON.stringify(fields), editing]);
  function change(key, value) {
    setDraft((previous) => ({ ...previous, [key]: value }));
  }
  return (
    <div className="admin-record">
      <div className="admin-record-head">
        <strong>{title}</strong>
        <button className="text-button" onClick={() => setEditing(!editing)}>
          {editing ? "Cancel" : "Edit"}
        </button>
      </div>
      {editing && (
        <div className="edit-form">
          {Object.entries(draft).map(([key, value]) => (
            <label key={key} className={key === "is_anonymous" ? "edit-checkbox" : ""}>
              <span>{key.replaceAll("_", " ")}</span>
              {key === "candidate_id" ? (
                <select
                  value={value || ""}
                  onChange={(event) => change(key, event.target.value)}
                >
                  {options.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              ) : key === "voter_name" || key === "author_name" ? (
                <select
                  value={value || ""}
                  onChange={(event) => change(key, event.target.value)}
                >
                  {roommates.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              ) : key === "reason_post_id" ? (
                <select
                  value={value || ""}
                  onChange={(event) => change(key, event.target.value)}
                >
                  {posts
                    .filter(
                      (post) =>
                        post.week_end === draft.week_end &&
                        post.candidate_id === draft.candidate_id,
                    )
                    .map((post) => (
                      <option key={post.id} value={post.id}>
                        {post.title}
                      </option>
                    ))}
                </select>
              ) : key === "is_anonymous" ? (
                <input
                  type="checkbox"
                  checked={value === true}
                  onChange={(event) => change(key, event.target.checked)}
                />
              ) : key === "body" ||
                key === "reason_body" ||
                key === "reason" ? (
                <textarea
                  rows={3}
                  value={value || ""}
                  onChange={(event) => change(key, event.target.value)}
                />
              ) : (
                <input
                  type={
                    key === "week_end"
                      ? "date"
                      : key === "vote_count"
                        ? "number"
                        : "text"
                  }
                  min={key === "vote_count" ? 1 : undefined}
                  value={value ?? ""}
                  onChange={(event) =>
                    change(
                      key,
                      key === "vote_count"
                        ? Number(event.target.value)
                        : event.target.value,
                    )
                  }
                />
              )}
            </label>
          ))}
          <div className="edit-actions">
            <button
              className="button primary small"
              disabled={busy}
              onClick={() => {
                const data = { ...draft };
                if (kind === "legacy") {
                  data.week_end ||= null;
                  data.reason ||= null;
                }
                manage({ action: "update", kind, id, data });
                setEditing(false);
              }}
            >
              Save changes
            </button>
            <button
              className="button danger small"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`Delete ${title}?`))
                  manage({ action: "delete", kind, id }, "Deleted.");
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [state, setState] = useState(null);
  const [identity, setIdentity] = useState("");
  const [tab, setTab] = useState("board");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    setIdentity(localStorage.getItem("rotw_identity") || "");
  }, []);
  useEffect(() => {
    if (identity) localStorage.setItem("rotw_identity", identity);
    else localStorage.removeItem("rotw_identity");
  }, [identity]);
  const refresh = useCallback(async () => {
    try {
      const next = await api(
        `/api/state?voter=${encodeURIComponent(identity)}`,
      );
      setState({ ...next, receivedAt: Date.now() });
      setError("");
    } catch (cause) {
      setError(cause.message);
    }
  }, [identity]);
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 20000);
    return () => clearInterval(timer);
  }, [refresh]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  const weekLabel = useMemo(
    () => (state ? dateLabel(state.weekEnd) : "This week"),
    [state?.weekEnd],
  );

  return (
    <main>
      <header className="site-header">
        <div className="shell header-inner">
          <button
            className="brand"
            onClick={() => setTab("board")}
            aria-label="ROTW home"
          >
            ROTW
          </button>
          <nav aria-label="Main navigation">
            <button
              className={tab === "board" ? "active" : ""}
              onClick={() => setTab("board")}
            >
              The board
            </button>
            <button
              className={tab === "vote" ? "active" : ""}
              onClick={() => setTab("vote")}
            >
              Vote{state?.votingOpen && <span className="live-dot" />}
            </button>
            <button
              className={tab === "history" ? "active" : ""}
              onClick={() => setTab("history")}
            >
              History
            </button>
            <button
              className={tab === "admin" ? "active" : ""}
              onClick={() => setTab("admin")}
            >
              Admin
            </button>
          </nav>
        </div>
      </header>
      <div className="shell">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">WEEKLY BOARD</div>
            <h1>ROTW</h1>
            <div className="hero-meta">
              <span className="meta-badge">
                WEEK ENDING {weekLabel.toUpperCase()}
              </span>
              {state?.votingOpen && (
                <span className="meta-status">
                  <span className="status-dot green" />
                  Voting open
                </span>
              )}
              {state && <VotingCountdown state={state} refresh={refresh} />}
            </div>
          </div>
        </section>
        {notice && (
          <div className="notice" role="status">
            {notice}
            <button onClick={() => setNotice("")} aria-label="Dismiss">
              ×
            </button>
          </div>
        )}
        {error && (
          <div className="notice error" role="alert">
            {error}
            <button onClick={refresh}>Retry</button>
          </div>
        )}
        {state ? (
          <>
            <Identity
              roommates={state.roommates}
              identity={identity}
              onChange={setIdentity}
            />
            <div className="content" key={tab}>
              {tab === "board" ? (
                <Board
                  state={state}
                  identity={identity}
                  refresh={refresh}
                  setNotice={setNotice}
                />
              ) : tab === "vote" ? (
                <Vote
                  state={state}
                  identity={identity}
                  refresh={refresh}
                  setNotice={setNotice}
                />
              ) : tab === "history" ? (
                <History state={state} />
              ) : (
                <AdminPanel
                  state={state}
                  refresh={refresh}
                  setNotice={setNotice}
                />
              )}
            </div>
          </>
        ) : !error ? (
          <div className="loading">Loading ROTW…</div>
        ) : null}
      </div>
      <footer className="site-footer">
        <div className="shell">
          <span>ROTW</span>
          <span>Weekly results</span>
        </div>
      </footer>
    </main>
  );
}
