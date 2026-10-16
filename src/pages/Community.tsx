import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import {
  COMMUNITY_LINKEDIN_URL,
  COMMUNITY_WHATSAPP_GROUP_URL,
  isLinkedInUrl,
  normalizeLinkedInUrl,
  waMeUrl,
} from "../lib/config";
import { cx } from "../lib/utils";
import { Badge, Button, Card, Empty, ErrorNote, Field, Input, PageHeader, Spinner, Textarea } from "../components/ui";

interface Member {
  user_id: string;
  name: string | null;
  intended_major: string | null;
  linkedin_url: string | null;
  joined_at: string;
}

interface Post {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  author_name: string;
  tags: string[] | null;
  reactions: Record<string, number> | null;
  comment_count: number | null;
}

interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
}

const REACTIONS = [
  { kind: "like", emoji: "👍", label: "Like this post" },
  { kind: "love", emoji: "❤️", label: "Love this post" },
  { kind: "helpful", emoji: "💡", label: "Find this helpful" },
] as const;

function extractTags(text: string): string[] {
  const found = text.match(/#[\p{L}\p{N}_-]{2,24}/gu) ?? [];
  return Array.from(new Set(found.map((t) => t.slice(1).toLowerCase()))).slice(0, 5);
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function initials(name: string | null): string {
  const parts = (name ?? "Student").trim().split(/\s+/);
  return (parts[0]?.[0] ?? "S").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

export default function Community() {
  const { session, profile, studentProfile, refresh } = useAuth();
  const joined = !!studentProfile?.community_joined_at;

  const [members, setMembers] = useState<Member[] | null>(null);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [linkedin, setLinkedin] = useState(studentProfile?.linkedin_url ?? "");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [myReactions, setMyReactions] = useState<Record<string, string | null>>({});
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [fq, setFq] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [cdraft, setCdraft] = useState<Record<string, string>>({});
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [refCount, setRefCount] = useState(0);

  const load = useCallback(async () => {
    const [feed, dir] = await Promise.all([
      supabase.rpc("community_feed"),
      joined ? supabase.rpc("community_members") : Promise.resolve({ data: null, error: null }),
    ]);
    const ps = (feed.data as Post[] | null) ?? [];
    setPosts(ps);
    if (feed.error) setErr(feed.error.message);
    if (session && ps.length) {
      const ids = ps.map((p) => p.id);
      const [reacts, bms, cms] = await Promise.all([
        supabase.from("post_reactions").select("post_id, kind").eq("student_id", session.user.id).in("post_id", ids),
        supabase.from("post_bookmarks").select("post_id").eq("student_id", session.user.id).in("post_id", ids),
        supabase.rpc("post_comments_feed", { p_post_ids: ids }),
      ]);
      const rm: Record<string, string | null> = {};
      for (const p of ps) rm[p.id] = null;
      for (const r of reacts.data ?? []) rm[r.post_id as string] = r.kind as string;
      setMyReactions(rm);
      setBookmarks(new Set((bms.data ?? []).map((r) => r.post_id as string)));
      setComments((cms.data as Comment[]) ?? []);
    } else {
      setMyReactions({});
      setBookmarks(new Set());
      setComments([]);
    }
    if (joined) {
      setMembers((dir.data as Member[] | null) ?? []);
      if (dir.error) setErr(dir.error.message);
    } else {
      setMembers(null);
    }
  }, [joined, session]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("referrer_id", session.user.id)
      .then(({ count }) => setRefCount(count ?? 0));
  }, [session]);

  async function join(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    setErr(null);
    setNote(null);
    const li = normalizeLinkedInUrl(linkedin);
    if (li && !isLinkedInUrl(li)) {
      setErr("That doesn't look like a LinkedIn profile URL (linkedin.com/in/…).");
      return;
    }
    setBusy("join");
    try {
      const { error } = await supabase
        .from("student_profiles")
        .update({ community_joined_at: new Date().toISOString(), linkedin_url: li || null })
        .eq("user_id", session.user.id);
      if (error) throw error;
      setNote("Welcome to the community! Your profile is now visible to other members.");
      await refresh();
      await load();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Could not join");
    } finally {
      setBusy(null);
    }
  }

  async function leave() {
    if (!session) return;
    setErr(null);
    setBusy("leave");
    try {
      const { error } = await supabase
        .from("student_profiles")
        .update({ community_joined_at: null })
        .eq("user_id", session.user.id);
      if (error) throw error;
      setNote("You left the community. Your profile is hidden from the directory.");
      await refresh();
      await load();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Could not leave");
    } finally {
      setBusy(null);
    }
  }

  async function saveLinkedIn(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    setErr(null);
    setNote(null);
    const li = normalizeLinkedInUrl(linkedin);
    if (li && !isLinkedInUrl(li)) {
      setErr("That doesn't look like a LinkedIn profile URL (linkedin.com/in/…).");
      return;
    }
    setBusy("li");
    try {
      const { error } = await supabase
        .from("student_profiles")
        .update({ linkedin_url: li || null })
        .eq("user_id", session.user.id);
      if (error) throw error;
      setNote("LinkedIn saved.");
      await refresh();
      if (joined) await load();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Could not save");
    } finally {
      setBusy(null);
    }
  }

  async function addPost(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    const text = body.trim();
    if (!text) return;
    setErr(null);
    setBusy("post");
    try {
      const { error } = await supabase
        .from("community_posts")
        .insert({ author_id: session.user.id, body: text, tags: extractTags(text) });
      if (error) throw error;
      setBody("");
      await load();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Could not post");
    } finally {
      setBusy(null);
    }
  }

  async function deletePost(id: string) {
    setErr(null);
    setBusy(`del-${id}`);
    try {
      const { error } = await supabase.from("community_posts").delete().eq("id", id);
      if (error) throw error;
      await load();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Could not delete");
    } finally {
      setBusy(null);
    }
  }

  async function toggleReaction(p: Post, kind: string) {
    if (!session) return;
    const cur = myReactions[p.id] ?? null;
    const next = cur === kind ? null : kind;
    setMyReactions({ ...myReactions, [p.id]: next });
    setPosts(
      (rows) =>
        rows?.map((x) => {
          if (x.id !== p.id) return x;
          const rc = { ...(x.reactions ?? {}) };
          if (cur) rc[cur] = Math.max(0, (rc[cur] ?? 0) - 1);
          if (next) rc[kind] = (rc[kind] ?? 0) + 1;
          return { ...x, reactions: rc };
        }) ?? null,
    );
    if (cur === kind) {
      await supabase.from("post_reactions").delete().eq("post_id", p.id).eq("student_id", session.user.id);
    } else {
      await supabase
        .from("post_reactions")
        .upsert({ post_id: p.id, student_id: session.user.id, kind }, { onConflict: "post_id,student_id" });
    }
  }

  async function toggleBookmark(p: Post) {
    if (!session) return;
    const has = bookmarks.has(p.id);
    const next = new Set(bookmarks);
    if (has) next.delete(p.id);
    else next.add(p.id);
    setBookmarks(next);
    if (has) {
      await supabase.from("post_bookmarks").delete().eq("post_id", p.id).eq("student_id", session.user.id);
    } else {
      await supabase.from("post_bookmarks").insert({ post_id: p.id, student_id: session.user.id });
    }
  }

  async function addComment(p: Post) {
    if (!session) return;
    const text = (cdraft[p.id] ?? "").trim();
    if (!text) return;
    setErr(null);
    const { error } = await supabase
      .from("post_comments")
      .insert({ post_id: p.id, author_id: session.user.id, body: text.slice(0, 1000) });
    if (error) {
      setErr(error.message);
      return;
    }
    setCdraft({ ...cdraft, [p.id]: "" });
    setOpenComments(new Set([...openComments, p.id]));
    const cms = await supabase.rpc("post_comments_feed", { p_post_ids: [p.id] });
    const fresh = (cms.data as Comment[]) ?? [];
    setComments([...comments.filter((c) => c.post_id !== p.id), ...fresh]);
    setPosts(
      (rows) => rows?.map((x) => (x.id === p.id ? { ...x, comment_count: (x.comment_count ?? 0) + 1 } : x)) ?? null,
    );
  }

  async function deleteComment(c: Comment) {
    setErr(null);
    const { error } = await supabase.from("post_comments").delete().eq("id", c.id);
    if (error) {
      setErr(error.message);
      return;
    }
    setComments(comments.filter((x) => x.id !== c.id));
    setPosts(
      (rows) =>
        rows?.map((x) => (x.id === c.post_id ? { ...x, comment_count: Math.max(0, (x.comment_count ?? 1) - 1) } : x)) ??
        null,
    );
  }

  function postUrl(p: Post): string {
    return `${window.location.origin}/community#${p.id}`;
  }

  function postShareText(p: Post): string {
    const snippet = p.body.length > 140 ? `${p.body.slice(0, 140)}…` : p.body;
    return `${p.author_name} on the Scholars Abroad community: "${snippet}"\n${postUrl(p)}`;
  }

  function sharePostWa(p: Post) {
    window.open(waMeUrl(postShareText(p)), "_blank", "noopener,noreferrer");
  }

  function sharePostEmail(p: Post) {
    window.location.href = `mailto:?subject=${encodeURIComponent("A post from the Scholars Abroad community")}&body=${encodeURIComponent(postShareText(p))}`;
  }

  function showCopied(key: string) {
    setCopiedId(key);
    window.setTimeout(() => setCopiedId((v) => (v === key ? null : v)), 1500);
  }

  async function copyPostLink(p: Post) {
    try {
      await navigator.clipboard.writeText(postUrl(p));
      showCopied(p.id);
    } catch {
      setErr("Could not copy the link automatically — copy it from the address bar instead.");
    }
  }

  const inviteUrl = session ? `${window.location.origin}/signup?ref=${session.user.id}` : null;
  const inviteText = `Join me on Scholars Abroad — free Australian university shortlist, deadline tracker and student community: ${inviteUrl ?? ""}`;

  function shareInviteWa() {
    if (inviteUrl) window.open(waMeUrl(inviteText), "_blank", "noopener,noreferrer");
  }

  function shareInviteEmail() {
    if (inviteUrl) window.location.href = `mailto:?subject=${encodeURIComponent("Join me on Scholars Abroad")}&body=${encodeURIComponent(inviteText)}`;
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      showCopied("invite");
    } catch {
      setErr("Could not copy the invite link.");
    }
  }

  const allTags = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of posts ?? []) for (const t of p.tags ?? []) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [posts]);

  const shownPosts = (posts ?? []).filter((p) => {
    if (bookmarkedOnly && !bookmarks.has(p.id)) return false;
    if (activeTag && !(p.tags ?? []).includes(activeTag)) return false;
    const needle = fq.trim().toLowerCase();
    if (needle && !p.body.toLowerCase().includes(needle)) return false;
    return true;
  });

  const hasCommunityLinks = COMMUNITY_LINKEDIN_URL || COMMUNITY_WHATSAPP_GROUP_URL;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student community"
        subtitle="Join to appear in the member directory, share your LinkedIn, and ask questions with fellow Scholars Abroad students."
      />

      {err ? <ErrorNote>{err}</ErrorNote> : null}
      {note ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {note}
        </p>
      ) : null}

      {/* Join / leave + LinkedIn */}
      <Card className="space-y-4">
        {!joined ? (
          <form onSubmit={join} className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Join the community</h2>
              <p className="mt-1 text-sm text-slate-600">
                Only members can see the directory. We publish your name, intended course and LinkedIn — never your
                marks, budget or documents.
              </p>
            </div>
            <Field
              label="LinkedIn profile (optional)"
              hint="linkedin.com/in/… — helps counsellors and peers find you"
            >
              <Input
                type="url"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                placeholder="https://www.linkedin.com/in/your-profile"
              />
            </Field>
            <div className="flex gap-3">
              <Button type="submit" disabled={busy === "join"}>
                {busy === "join" ? "Joining…" : "Join community"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-11 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800">
                  {initials(profile?.name ?? null)}
                </span>
                <div>
                  <p className="font-bold text-slate-900">{profile?.name ?? "You"}</p>
                  <p className="text-sm text-slate-500">
                    {studentProfile?.intended_major ?? "Course not set"}
                    {studentProfile?.community_joined_at
                      ? ` · joined ${new Date(studentProfile.community_joined_at).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
              </div>
              {studentProfile?.linkedin_url ? (
                <a
                  href={studentProfile.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:border-sky-400"
                >
                  <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
                    <path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.5 8h4V24h-4V8zm7.5 0h3.8v2.2h.05c.53-1 1.83-2.2 3.77-2.2 4.03 0 4.78 2.65 4.78 6.1V24h-4v-7.9c0-1.9-.03-4.3-2.6-4.3-2.6 0-3 2-3 4.15V24h-4V8z" />
                  </svg>
                  View LinkedIn
                </a>
              ) : (
                <form onSubmit={saveLinkedIn} className="mt-3 flex flex-wrap items-end gap-2">
                  <div className="min-w-64 grow">
                    <Field label="Add your LinkedIn">
                      <Input
                        type="url"
                        value={linkedin}
                        onChange={(e) => setLinkedin(e.target.value)}
                        placeholder="https://www.linkedin.com/in/your-profile"
                      />
                    </Field>
                  </div>
                  <Button type="submit" variant="ghost" disabled={busy === "li"}>
                    {busy === "li" ? "Saving…" : "Save"}
                  </Button>
                </form>
              )}
            </div>
            <Button variant="ghost" onClick={leave} disabled={busy === "leave"}>
              {busy === "leave" ? "Leaving…" : "Leave community"}
            </Button>
          </div>
        )}
      </Card>

      {/* Official community links */}
      {hasCommunityLinks ? (
        <Card className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-slate-700">Official channels:</span>
          {COMMUNITY_LINKEDIN_URL ? (
            <a
              href={COMMUNITY_LINKEDIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:border-sky-400"
            >
              LinkedIn community
            </a>
          ) : null}
          {COMMUNITY_WHATSAPP_GROUP_URL ? (
            <a
              href={COMMUNITY_WHATSAPP_GROUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:border-emerald-400"
            >
              WhatsApp group
            </a>
          ) : null}
        </Card>
      ) : null}

      {/* Refer a friend */}
      {inviteUrl ? (
        <Card className="flex flex-wrap items-center gap-4">
          <div className="min-w-64 grow">
            <p className="text-sm font-bold text-slate-900">Refer a friend</p>
            <p className="text-xs text-slate-500">
              Send them your invite link — when they sign up you'll see them here.
            </p>
            <p className="mt-1 select-all truncate rounded-lg bg-slate-50 px-2 py-1 font-mono text-xs text-slate-600">
              {inviteUrl}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" className="px-3" onClick={copyInvite}>
              {copiedId === "invite" ? "Copied!" : "Copy link"}
            </Button>
            <Button variant="wa" className="px-3" onClick={shareInviteWa}>
              WhatsApp
            </Button>
            <Button variant="ghost" className="px-3" onClick={shareInviteEmail}>
              Email
            </Button>
          </div>
          {refCount > 0 ? (
            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">
              {refCount} friend{refCount > 1 ? "s" : ""} joined
            </Badge>
          ) : null}
        </Card>
      ) : null}

      {/* Directory */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold text-slate-900">Members</h2>
          {joined && members ? <span className="text-sm text-slate-500">{members.length} joined</span> : null}
        </div>
        {!joined ? (
          <Empty title="Members-only directory" body="Join the community to see who else is heading to Australia." />
        ) : members === null ? (
          <div className="flex justify-center py-10">
            <Spinner className="size-7" />
          </div>
        ) : members.length === 0 ? (
          <Empty title="No members yet" body="You'll be the first — welcome!" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((m) => (
              <Card key={m.user_id} className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">
                  {initials(m.name)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{m.name ?? "Student"}</p>
                  <p className="truncate text-xs text-slate-500">{m.intended_major ?? "Course not set"}</p>
                </div>
                <div className="ml-auto">
                  {m.linkedin_url ? (
                    <a
                      href={m.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700 hover:border-sky-400"
                    >
                      LinkedIn
                    </a>
                  ) : (
                    <Badge>-</Badge>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Discussion */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-slate-900">Discussion</h2>
        <Card>
          <form onSubmit={addPost} className="space-y-3">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Ask a question, share an update on your applications, or help a peer…"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {body.length}/2000 · up to 5 #hashtags become searchable tags
              </span>
              <Button type="submit" disabled={busy === "post" || !body.trim()}>
                {busy === "post" ? "Posting…" : "Post"}
              </Button>
            </div>
          </form>
        </Card>
        {/* Search + bookmarks + tag filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={fq}
            onChange={(e) => setFq(e.target.value)}
            placeholder="Search posts…"
            aria-label="Search posts"
            className="min-w-48 grow"
          />
          <Button
            variant={bookmarkedOnly ? "primary" : "ghost"}
            className="px-3"
            onClick={() => setBookmarkedOnly(!bookmarkedOnly)}
            title="Only show posts you bookmarked"
          >
            {bookmarkedOnly ? "★ Bookmarked only" : "☆ Bookmarks"}
          </Button>
          {activeTag ? (
            <Button variant="primary" className="px-3" onClick={() => setActiveTag(null)}>
              #{activeTag} ✕
            </Button>
          ) : null}
        </div>
        {allTags.length ? (
          <div className="flex flex-wrap gap-1.5">
            {allTags.map(([t, n]) => (
              <button
                key={t}
                onClick={() => setActiveTag(activeTag === t ? null : t)}
                className={cx(
                  "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
                  activeTag === t
                    ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700",
                )}
              >
                #{t} · {n}
              </button>
            ))}
          </div>
        ) : null}

        {posts === null ? (
          <div className="flex justify-center py-10">
            <Spinner className="size-7" />
          </div>
        ) : posts.length === 0 ? (
          <Empty title="No posts yet" body="Start the conversation — first post is yours." />
        ) : shownPosts.length === 0 ? (
          <Empty title="No posts match" body="Clear the search, tag or bookmark filter to see everything." />
        ) : (
          <div className="space-y-3">
            {shownPosts.map((p) => {
              const postComments = comments.filter((c) => c.post_id === p.id);
              return (
                <Card key={p.id} id={p.id} className="scroll-mt-24 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                      {initials(p.author_name)}
                    </span>
                    <span className="text-sm font-semibold text-slate-900">{p.author_name}</span>
                    <span className="text-xs text-slate-400">{timeAgo(p.created_at)}</span>
                    <span className="ml-auto flex items-center gap-2">
                      <button
                        className="text-lg leading-none transition hover:scale-110"
                        onClick={() => toggleBookmark(p)}
                        title={bookmarks.has(p.id) ? "Remove bookmark" : "Bookmark this post"}
                        aria-label={bookmarks.has(p.id) ? "Remove bookmark" : "Bookmark this post"}
                      >
                        <span className={bookmarks.has(p.id) ? "text-amber-500" : "text-slate-300 hover:text-amber-400"}>
                          {bookmarks.has(p.id) ? "★" : "☆"}
                        </span>
                      </button>
                      {p.author_id === session?.user.id ? (
                        <button
                          className="text-xs font-semibold text-slate-400 hover:text-rose-600 disabled:opacity-50"
                          disabled={busy === `del-${p.id}`}
                          onClick={() => deletePost(p.id)}
                        >
                          Delete
                        </button>
                      ) : null}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-slate-700">{p.body}</p>
                  {(p.tags ?? []).length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {p.tags!.map((t) => (
                        <button
                          key={t}
                          onClick={() => setActiveTag(activeTag === t ? null : t)}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700"
                        >
                          #{t}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2">
                    {REACTIONS.map((r) => {
                      const active = myReactions[p.id] === r.kind;
                      const n = (p.reactions ?? {})[r.kind] ?? 0;
                      return (
                        <button
                          key={r.kind}
                          onClick={() => toggleReaction(p, r.kind)}
                          title={r.label}
                          aria-label={r.label}
                          className={cx(
                            "rounded-full border px-2.5 py-1 text-xs font-semibold transition",
                            active
                              ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                              : "border-slate-200 text-slate-600 hover:border-slate-300",
                          )}
                        >
                          {r.emoji}
                          {n ? ` ${n}` : ""}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => {
                        const next = new Set(openComments);
                        if (next.has(p.id)) next.delete(p.id);
                        else next.add(p.id);
                        setOpenComments(next);
                      }}
                      className="ml-1 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300"
                      aria-expanded={openComments.has(p.id)}
                    >
                      💬 {p.comment_count ?? 0} comment{(p.comment_count ?? 0) === 1 ? "" : "s"}
                    </button>
                    <span className="ml-auto flex gap-1.5">
                      <button
                        onClick={() => sharePostWa(p)}
                        className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:border-emerald-400"
                        title="Share on WhatsApp"
                      >
                        WhatsApp
                      </button>
                      <button
                        onClick={() => sharePostEmail(p)}
                        className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300"
                        title="Share by email"
                      >
                        Email
                      </button>
                      <button
                        onClick={() => copyPostLink(p)}
                        className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300"
                        title="Copy link to this post"
                      >
                        {copiedId === p.id ? "Copied!" : "Copy link"}
                      </button>
                    </span>
                  </div>
                  {openComments.has(p.id) ? (
                    <div className="border-t border-slate-100 pt-2">
                      {postComments.length ? (
                        <ul className="space-y-2">
                          {postComments.map((c) => (
                            <li key={c.id} className="rounded-lg bg-slate-50 px-3 py-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-800">{c.author_name}</span>
                                <span className="text-[10px] text-slate-400">{timeAgo(c.created_at)}</span>
                                {c.author_id === session?.user.id ? (
                                  <button
                                    className="ml-auto text-[10px] font-semibold text-slate-400 hover:text-rose-600"
                                    onClick={() => deleteComment(c)}
                                  >
                                    Delete
                                  </button>
                                ) : null}
                              </div>
                              <p className="mt-0.5 text-xs text-slate-600">{c.body}</p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-400">No comments yet.</p>
                      )}
                      <div className="mt-2 flex gap-2">
                        <Input
                          value={cdraft[p.id] ?? ""}
                          onChange={(e) => setCdraft({ ...cdraft, [p.id]: e.target.value })}
                          placeholder="Add a comment…"
                          maxLength={1000}
                          aria-label="Add a comment"
                        />
                        <Button
                          className="shrink-0 px-3"
                          disabled={!(cdraft[p.id] ?? "").trim()}
                          onClick={() => addComment(p)}
                        >
                          Reply
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
