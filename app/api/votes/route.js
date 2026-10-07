import { db, jsonError, badRequest } from "../../../lib/db.js";
import { ROOMMATES, normalizeName, validName } from "../../../lib/constants.js";

export async function POST(request) {
  try {
    const { voter, candidate, reasonPostId, reasonText } = await request.json();
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
    const vote = await db("rpc/submit_rotw_vote", {
      method: "POST",
      body: {
        p_voter: voter,
        p_candidate_name: normalizeName(candidate),
        p_reason_post_id: reasonPostId || null,
        p_reason_text: reasonPostId ? null : reasonText.trim(),
      },
    });
    return Response.json({ vote });
  } catch (error) {
    return jsonError(error);
  }
}
