import { db, jsonError } from "../../../lib/db.js";
import { currentWeek, ROOMMATES, votingWindow } from "../../../lib/constants.js";
import { isAdmin } from "../../../lib/admin.js";
import { ownVote, publicPost, publicVote } from "../../../lib/privacy.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { weekEnd, votingOpen } = currentWeek();
    const { votingStartsAt, votingEndsAt } = votingWindow(weekEnd);
    const voter = new URL(request.url).searchParams.get("voter");
    const admin = await isAdmin();
    await db("rpc/finalize_rotw_due", { method: "POST", body: {} });
    const [
      candidates,
      posts,
      weekVotes,
      winners,
      legacyWins,
      closures,
      adminVotes,
      adminPosts,
      testState,
      anonymousReady,
    ] = await Promise.all([
      db("candidates?select=id,name,is_roommate&order=name.asc"),
      db(`posts?select=*&week_end=eq.${weekEnd}&order=created_at.desc`),
      db(`votes?select=*&week_end=eq.${weekEnd}&order=updated_at.desc`),
      db("weekly_winners?select=*&order=week_end.desc"),
      db("legacy_wins?select=*&order=week_end.desc.nullslast,legacy_slot.asc"),
      db("weekly_closures?select=week_end,finalized_at&order=week_end.desc"),
      admin
        ? db("votes?select=*&order=week_end.desc,updated_at.desc")
        : Promise.resolve([]),
      admin
        ? db("posts?select=*&order=created_at.desc&limit=500")
        : Promise.resolve([]),
      admin
        ? db(`test_votes?select=*&week_end=eq.${weekEnd}&order=updated_at.desc`)
            .then((rows) => ({ rows, ready: true }))
            .catch((error) => {
              if (["PGRST205", "42P01"].includes(error.code))
                return { rows: [], ready: false };
              throw error;
            })
        : Promise.resolve({ rows: [], ready: false }),
      Promise.all([
        db("posts?select=is_anonymous&limit=0"),
        db("votes?select=is_anonymous&limit=0"),
        db("test_votes?select=is_anonymous&limit=0"),
      ])
        .then(() => true)
        .catch((error) => {
          if (error.status === 400 || error.code === "PGRST205") return false;
          throw error;
        }),
    ]);
    const publicPosts = posts.map(publicPost);
    const publicVotes = weekVotes.map(publicVote);
    const publicTestVotes = testState.rows.map(publicVote);
    return Response.json(
      {
        weekEnd,
        votingOpen,
        votingStartsAt,
        votingEndsAt,
        serverNow: new Date().toISOString(),
        roommates: ROOMMATES,
        candidates,
        posts: publicPosts,
        weekVotes: publicVotes,
        myVote: ROOMMATES.includes(voter)
          ? ownVote(weekVotes.find((item) => item.voter_name === voter))
          : null,
        winners,
        legacyWins,
        closures,
        admin,
        anonymousReady,
        ...(admin
          ? {
              adminVotes,
              adminPosts,
              testVotes: publicTestVotes,
              testVote: ROOMMATES.includes(voter)
                ? testState.rows.find((vote) => vote.voter_name === voter) || null
                : null,
              testVotingReady: testState.ready,
            }
          : {}),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
