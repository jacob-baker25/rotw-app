import { db, jsonError, badRequest } from "../../../lib/db.js";
import { ROOMMATES, normalizeName, validName } from "../../../lib/constants.js";

export async function POST(request) {
  try {
    const { author, candidate, title, body } = await request.json();
    if (!ROOMMATES.includes(author))
      return badRequest("Select your name first.");
    if (!validName(candidate))
      return badRequest("Enter a valid candidate name.");
    if (
      typeof title !== "string" ||
      title.trim().length < 2 ||
      title.trim().length > 100
    )
      return badRequest("Title must be 2–100 characters.");
    if (
      typeof body !== "string" ||
      body.trim().length < 2 ||
      body.trim().length > 1000
    )
      return badRequest("Description must be 2–1000 characters.");
    const post = await db("rpc/create_rotw_post", {
      method: "POST",
      body: {
        p_author: author,
        p_candidate_name: normalizeName(candidate),
        p_title: title.trim(),
        p_body: body.trim(),
      },
    });
    return Response.json({ post }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
