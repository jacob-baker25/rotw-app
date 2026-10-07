import { db, jsonError } from "../../../lib/db.js";
import { currentWeek, ROOMMATES } from "../../../lib/constants.js";
import { isAdmin } from "../../../lib/admin.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { weekEnd, votingOpen } = currentWeek();
    const voter = new URL(request.url).searchParams.get("voter");
    const admin = await isAdmin();
    await db("rpc/finalize_rotw_due", { method: "POST", body: {} });
    const [
      candidates,
      posts,
      currentVotes,
      winners,
      legacyWins,
      closures,
      adminVotes,
      adminPosts,
    ] = await Promise.all([
      db("candidates?select=id,name,is_roommate&order=name.asc"),
      db(`posts?select=*&week_end=eq.${weekEnd}&order=created_at.desc`),
      ROOMMATES.includes(voter)
        ? db(
            `votes?select=*&week_end=eq.${weekEnd}&voter_name=eq.${encodeURIComponent(voter)}&limit=1`,
          )
        : Promise.resolve([]),
      db("weekly_winners?select=*&order=week_end.desc"),
      db("legacy_wins?select=*&order=week_end.desc.nullslast,legacy_slot.asc"),
      db("weekly_closures?select=week_end,finalized_at&order=week_end.desc"),
      admin
        ? db("votes?select=*&order=week_end.desc,updated_at.desc")
        : Promise.resolve([]),
      admin
        ? db("posts?select=*&order=created_at.desc&limit=500")
        : Promise.resolve([]),
    ]);
    return Response.json(
      {
        weekEnd,
        votingOpen,
        roommates: ROOMMATES,
        candidates,
        posts,
        myVote: currentVotes[0] || null,
        winners,
        legacyWins,
        closures,
        admin,
        ...(admin ? { adminVotes, adminPosts } : {}),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
