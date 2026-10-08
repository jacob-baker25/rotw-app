# ROTW

A weekly board for posts, Sunday voting, and winner history. Built with Next.js, Vercel, and Supabase. It works on phones and laptops without accounts.

## What the app does

- Each of the six voters (Jacob, Will, Brandon, Cole, Tommy, Xan) selects their name and posts a title and details about anyone, including a write-in.
- Each voter has one Sunday ballot. They can change it until **Sunday 11:59:59 p.m. Eastern**. The database locks voting at **Monday 12:00 a.m. Eastern**.
- The header counts down to voting opening at Sunday 12:00 a.m. Eastern, then to closing at Monday 12:00 a.m. Eastern.
- Each ballot chooses a post about that person or includes a new written reason. Written reasons become posts that later voters can choose.
- A ballot can be shown anonymously in the vote list. A reason written with that ballot is anonymous on the board too. The selected name is still stored to enforce one vote per person and is visible in Admin.
- The Vote page shows current vote totals and each ballot's reason. At the deadline, the top vote getter wins. Tied leaders each receive one full win.
- The most selected post among the winner's ballots is saved as the featured reason.
- History starts with the 20 wins you supplied: Will 12, Tommy 5, Sarah 1, Xan 1, Brandon 1. Xan is dated September 13, Will September 20, and Brandon September 27, 2026. The other dates and reasons are blank.
- A passcode-protected Admin area can correct posts, ballots, candidate names, past wins, and finalized winner entries.
- On weekdays, an admin can submit an isolated test ballot from the Vote tab. It is stored separately and never affects the leaderboard or real results. A typed reason becomes a board post that others can select.

## 1. Create the Supabase project

1. At [Supabase](https://supabase.com/dashboard), create a new project. Give it any name, such as `rotw`, and save its **database password** somewhere safe. The app uses an API key, not this password.
2. When the project is ready, open **SQL Editor** and create a new query.
3. Paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql) and run it. This creates the tables, voting rules, anonymous ballot fields, isolated test ballots, and the 20 historical wins. If you ran an earlier version, run this updated file again; the seed is idempotent.
4. Create another query, paste [`supabase/cron.sql`](supabase/cron.sql), and run it. The scheduled job saves winners at Eastern midnight in both daylight and standard time. If a scheduled run is delayed, the first app request after the deadline also saves the result. Either way, late ballots are refused at the deadline.
5. In **Table Editor**, check `legacy_wins`: there should be 20 rows. `candidates` should include the six original names plus Sarah. The new `test_votes` table should also exist.

During Supabase project creation, choose **Enable Data API: on**, **Automatically expose new tables: off**, and **Enable automatic RLS: on**. The SQL file explicitly grants Data API access to the server's `service_role` and revokes table access from browser roles. If you ran an earlier copy of `schema.sql`, run the updated file again to apply these grants; the historical seed is idempotent.

The schema enables row level security and adds **no browser access policies**. Only the Next.js server uses the [Supabase secret key](https://supabase.com/docs/guides/getting-started/api-keys). Never put that key in client code or in a variable beginning with `NEXT_PUBLIC_`.

## 2. Configure the app

Install Node.js 22 or newer if needed. In a new PowerShell window, check with `node --version` and `npm.cmd --version`. In this folder, copy the template only if `.env.local` does not already exist:

```powershell
Copy-Item .env.example .env.local
```

Edit `.env.local` and fill in:

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SECRET_KEY=sb_secret_YOUR_SECRET_KEY
ADMIN_PASSCODE=your-private-passcode-at-least-12-characters
ADMIN_SESSION_SECRET=a-separate-random-secret-at-least-32-characters
```

Find the project URL and secret key in Supabase's **Connect** dialog or **Settings → API Keys**. The secret key starts with `sb_secret_`. A legacy service role key also works through `SUPABASE_SERVICE_ROLE_KEY`, but the new secret key is preferred.

Choose an admin passcode that is hard to guess and share it only with whoever should edit records. The session secret signs the admin login cookie; generate one on your own computer with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Then run:

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`. The site will show a setup error until the Supabase variables are filled and `schema.sql` has run.
Run `npm.cmd run check:db` to check each required table and anonymous ballot column without printing keys or records. If a table or `is_anonymous` column check fails, rerun the updated `schema.sql` in Supabase SQL Editor.
The local dev server writes generated files to `.next-dev`, while production builds use `.next`. Stop the dev server before running `npm.cmd run build`. If a local error reports a missing file in `.next-dev`, stop the dev server, run `Remove-Item .next-dev -Recurse -Force` from this folder, then run `npm.cmd run dev` again.

## 3. Deploy on Vercel

1. Put this `rotw-app` folder in a GitHub repository. If this folder is one directory inside a larger repository, set the Vercel project's **Root Directory** to `rotw-app`.
2. In [Vercel](https://vercel.com/new), import that repository as a Next.js project.
3. In the Vercel project's **Settings → Environment Variables**, add the same four values from `.env.local`: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `ADMIN_PASSCODE`, `ADMIN_SESSION_SECRET`. Select Production (and Preview if you use preview deployments).
4. Deploy or redeploy. Open the live URL on a phone and laptop. In **Admin**, sign in with the passcode to review the seeded history.
5. Share the URL with the six voters. They select their own names; there are no accounts or invitations.

Do not upload `.env.local` to GitHub. It is ignored by `.gitignore`.

## Useful checks

```powershell
npm test
npm run build
```

`npm test` checks the Eastern deadline across daylight and standard time. The live Supabase flow can only be checked after the project and environment variables exist: add a post, confirm it appears on another device, and try a Sunday vote. You can correct data later in Admin.

## How weeks and corrections work

The week runs Monday through Sunday in `America/New_York`. The board always accepts posts into the current week. Voting is available only on Sunday. The SQL functions use Eastern time too, so a browser's local clock cannot extend the deadline.

The automatic winner is a saved snapshot. If you correct a finalized ballot in Admin, also correct the finalized winner entry if the result changes. An admin can add a second winner to a closed week to record a shared win.

Because there are no accounts, choosing a name is an honor system. Anyone with the URL can choose any of the six names and submit a post or ballot. The database still enforces one ballot **per selected name** per week. Admin changes require the passcode.

To test voting before Sunday, log in under **Admin**, then open **Vote**. The page will show **Test ballot**. You can submit, update, or clear it. This ballot remains separate from real votes and results. On Sunday, the normal ballot opens instead.

### Official references

- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase Cron](https://supabase.com/docs/guides/cron)
- [Vercel deploying a Next.js app](https://vercel.com/docs/frameworks/full-stack/nextjs)
