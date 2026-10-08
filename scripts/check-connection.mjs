const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
const key =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url?.startsWith("https://") || !key) {
  console.error(
    "Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local first.",
  );
  process.exitCode = 1;
} else {
  for (const table of [
    "candidates",
    "posts",
    "votes",
    "test_votes",
    "weekly_winners",
    "legacy_wins",
    "weekly_closures",
  ]) {
    try {
      const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
        headers: {
          apikey: key,
          ...(key.startsWith("sb_secret_")
            ? {}
            : { Authorization: `Bearer ${key}` }),
        },
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok) {
        console.log(`${table}: OK`);
      } else {
        console.error(`${table}: ${response.status} ${body.code || "error"}`);
        process.exitCode = 1;
      }
    } catch (error) {
      console.error(
        `${table}: connection failed (${error.code || error.name})`,
      );
      process.exitCode = 1;
    }
  }
  for (const table of ["posts", "votes", "test_votes"]) {
    try {
      const response = await fetch(
        `${url}/rest/v1/${table}?select=is_anonymous&limit=0`,
        {
          headers: {
            apikey: key,
            ...(key.startsWith("sb_secret_")
              ? {}
              : { Authorization: `Bearer ${key}` }),
          },
        },
      );
      const body = await response.json().catch(() => ({}));
      if (response.ok) {
        console.log(`${table}.is_anonymous: OK`);
      } else {
        console.error(
          `${table}.is_anonymous: ${response.status} ${body.code || "error"} (rerun supabase/schema.sql)`,
        );
        process.exitCode = 1;
      }
    } catch (error) {
      console.error(
        `${table}.is_anonymous: connection failed (${error.code || error.name})`,
      );
      process.exitCode = 1;
    }
  }
}
