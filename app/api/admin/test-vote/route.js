import { db, jsonError, badRequest } from "../../../../lib/db.js";
import { requireAdmin } from "../../../../lib/admin.js";
import {
  ROOMMATES,
  normalizeName,
  validName,
} from "../../../../lib/constants.js";

export async function POST(request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  try {
    const { voter, candidate, reasonPostId, reasonText, isAnonymous } =
      await request.json();
    if (!ROOMMATES.includes(voter))
      return badRequest("Select your name first.");
    if (!validName(candidate)) return badRequest("Choose or enter a name.");
    if (
      !reasonPostId &&
      (typeof reasonText !== "string" ||
        reasonText.trim().length < 2 ||
        reasonText.trim().length > 1000)
    ) {
      return badRequest("Choose a post or write a reason (2–1000 characters).");
    }
    const candidateName = normalizeName(candidate);
    try {
      const vote = await db("rpc/submit_rotw_test_vote_v2", {
        method: "POST",
        body: {
          p_voter: voter,
          p_candidate_name: candidateName,
          p_reason_post_id: reasonPostId || null,
          p_reason_text: reasonPostId ? null : reasonText.trim(),
          p_is_anonymous: isAnonymous === true,
        },
      });
      return Response.json({ vote });
    } catch (error) {
      if (error.code !== "PGRST202") throw error;
      if (isAnonymous === true)
        return badRequest("Run the updated Supabase schema to enable anonymous votes.");
    }

    // Keep ordinary test voting available until the updated schema is installed.
    let createdPost = null;
    try {
      if (!reasonPostId) {
        const reason = reasonText.trim();
        createdPost = await db("rpc/create_rotw_post", {
          method: "POST",
          body: {
            p_author: voter,
            p_candidate_name: candidateName,
            p_title: reason.slice(0, 100),
            p_body: reason,
          },
        });
      }
      const vote = await db("rpc/submit_rotw_test_vote", {
        method: "POST",
        body: {
          p_voter: voter,
          p_candidate_name: candidateName,
          p_reason_post_id: reasonPostId || createdPost?.id || null,
          p_reason_text: null,
        },
      });
      return Response.json({ vote });
    } catch (error) {
      if (createdPost?.id) {
        await db(`posts?id=eq.${encodeURIComponent(createdPost.id)}`, {
          method: "DELETE",
        }).catch((cleanupError) => console.error(cleanupError));
      }
      throw error;
    }
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  try {
    const voter = new URL(request.url).searchParams.get("voter");
    if (!ROOMMATES.includes(voter))
      return badRequest("Select your name first.");
    await db(`test_votes?voter_name=eq.${encodeURIComponent(voter)}`, {
      method: "DELETE",
    });
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
