# TrailBuilt

The solution to trail maintenance efficiency

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). On a phone, use your computer’s LAN address over HTTPS or a localhost tunnel—browsers require a secure context for precise geolocation outside localhost.

### Roles

New accounts start as `user` (can report hazards). Promote people in the Supabase Table Editor (`profiles.role`):

- `user` — report hazards on the map
- `crew` — accept / complete tasks in Crew Panel
- `admin` — same as crew, plus delete any marker and change trail open status

Example SQL:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
update public.profiles set role = 'crew' where email = 'crew@example.com';
```

If trail status editing isn’t set up yet, run `supabase/migration_trail_statuses.sql` once in the Supabase SQL Editor.

To make sure hazards, map markers, and crew task assignments sync for everyone, run `supabase/migration_shared_hazards.sql` once (paste the file contents into the SQL Editor).



## Deploy on Railway

Railway builds with Nixpacks (`npm run build`) and serves the static site with `serve`.

1. Deploy from the GitHub repo.
2. Add env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (must be present at **build** time).
3. In the service **Settings → Networking**, click **Generate Domain**.

GPS needs HTTPS; Railway’s public domain provides that.

## How to use

1. Create an account on the landing page (or sign in).
2. Open the map and report a hazard on a trail.
3. Hazards sync through Supabase for every signed-in user.
4. Crew / admin accounts open **Crew Panel** to accept and complete tasks.

Trail GPX geometry still seeds locally in IndexedDB; hazards live in Postgres.