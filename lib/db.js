const base = () => {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("Supabase is not configured. See README.md.");
  return { url, key };
};

export async function db(path, { method = "GET", body, prefer } = {}) {
  const { url, key } = base();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      ...(key.startsWith("sb_secret_")
        ? {}
        : { Authorization: `Bearer ${key}` }),
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
  });
  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : null;
  if (!response.ok) {
    const error = new Error(
      data?.message || data?.hint || `Database error ${response.status}`,
    );
    error.status = response.status;
    error.code = data?.code;
    throw error;
  }
  return data;
}

export function jsonError(error) {
  console.error(error);
  const known = error.status && error.status < 500;
  return Response.json(
    {
      error: known ? error.message : "Something went wrong. Please try again.",
    },
    { status: known ? error.status : 500 },
  );
}

export function badRequest(message) {
  return Response.json({ error: message }, { status: 400 });
}
