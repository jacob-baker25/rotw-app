import { db, jsonError, badRequest } from "../../../lib/db.js";
import { ROOMMATES, normalizeName, validName } from "../../../lib/constants.js";

export async function POST(request) {
  try {
    const { voter, candidate, reasonPostId, reasonText, isAnonymous } =
      await request.json();
    if (!ROOMMATES.includes(voter))
      return badRequest("Select your name first.");
    if (!validName(candidate))
      return badRequest("Choose or write in a candidate name.");
    if (
      !reasonPostId &&
      (typeof reasonText !== "string" ||
        reasonText.trim().length < 2 ||
        reasonText.trim().length > 1000)
    ) {
      return badRequest("Choose a post or write a reason (2–1000 characters).");
    }
    const body = {
      p_voter: voter,
      p_candidate_name: normalizeName(candidate),
      p_reason_post_id: reasonPostId || null,
      p_reason_text: reasonPostId ? null : reasonText.trim(),
    };
    let vote;
    try {
      vote = await db("rpc/submit_rotw_vote_v2", {
        method: "POST",
        body: { ...body, p_is_anonymous: isAnonymous === true },
      });
    } catch (error) {
      if (error.code !== "PGRST202") throw error;
      if (isAnonymous === true)
        return badRequest("Run the updated Supabase schema to enable anonymous votes.");
      vote = await db("rpc/submit_rotw_vote", { method: "POST", body });
    }
    return Response.json({ vote });
  } catch (error) {
    return jsonError(error);
  }
}
