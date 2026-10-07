import { db, jsonError, badRequest } from "../../../../lib/db.js";
import { requireAdmin } from "../../../../lib/admin.js";
import {
  ROOMMATES,
  validName,
  normalizeName,
} from "../../../../lib/constants.js";

const TABLES = {
  post: "posts",
  vote: "votes",
  legacy: "legacy_wins",
  winner: "weekly_winners",
  candidate: "candidates",
};

function allowedFields(kind, value) {
  const fields = {
    post: ["week_end", "candidate_id", "author_name", "title", "body"],
    vote: ["week_end", "voter_name", "candidate_id", "reason_post_id"],
    legacy: ["candidate_id", "week_end", "reason"],
    winner: [
      "week_end",
      "candidate_id",
      "vote_count",
      "reason_title",
      "reason_body",
    ],
    candidate: ["name"],
  }[kind];
  return Object.fromEntries(
    Object.entries(value || {}).filter(([key]) => fields?.includes(key)),
  );
}

function validate(kind, value) {
  if (
    kind === "candidate" &&
    value.name !== undefined &&
    !validName(value.name)
  )
    return "Candidate name must be 2–40 letters.";
  if (kind === "post") {
    if (
      value.author_name !== undefined &&
      !ROOMMATES.includes(value.author_name)
    )
      return "Choose a roommate as author.";
    if (
      value.title !== undefined &&
      (typeof value.title !== "string" ||
        value.title.trim().length < 2 ||
        value.title.length > 100)
    )
      return "Post title must be 2–100 characters.";
    if (
      value.body !== undefined &&
      (typeof value.body !== "string" ||
        value.body.trim().length < 2 ||
        value.body.length > 1000)
    )
      return "Post description must be 2–1000 characters.";
  }
  if (
    kind === "vote" &&
    value.voter_name !== undefined &&
    !ROOMMATES.includes(value.voter_name)
  )
    return "Choose a roommate as voter.";
  if (
    kind === "winner" &&
    value.vote_count !== undefined &&
    (!Number.isInteger(value.vote_count) || value.vote_count < 1)
  )
    return "Win votes must be at least 1.";
  if (
    kind === "legacy" &&
    value.reason !== null &&
    value.reason !== undefined &&
    (typeof value.reason !== "string" || value.reason.length > 1000)
  )
    return "Reason must be under 1000 characters.";
  return null;
}

export async function POST(request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  try {
    const { action, kind, id, data, weekEnd } = await request.json();
    if (action === "finalize") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(weekEnd || ""))
        return badRequest("Choose a valid week ending date.");
      await db("rpc/finalize_rotw_week", {
        method: "POST",
        body: { p_week_end: weekEnd },
      });
      return Response.json({ ok: true });
    }
    const table = TABLES[kind];
    if (!table) return badRequest("Unknown record type.");
    if (action === "delete") {
      if (!id) return badRequest("Missing record ID.");
      await db(`${table}?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      return Response.json({ ok: true });
    }
    if (!["create", "update"].includes(action))
      return badRequest("Unknown action.");
    const clean = allowedFields(kind, data);
    if (kind === "candidate" && clean.name)
      clean.name = normalizeName(clean.name);
    const error = validate(kind, clean);
    if (error) return badRequest(error);
    if (!Object.keys(clean).length) return badRequest("No changes supplied.");
    if (action === "update") {
      if (!id) return badRequest("Missing record ID.");
      await db(`${table}?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: clean,
      });
    } else {
      if (kind === "candidate" && !clean.name)
        return badRequest("Enter a candidate name.");
      await db(table, { method: "POST", body: clean });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
