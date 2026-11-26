# Seif's Cut

The 1,300 kcal plan and exercise-bike programme as a public page. The site keeps one copy of the progress online
(ticks, weigh-ins, exercise, swaps), so anyone who opens the link sees the same progress, on any phone or laptop, with
no sign-in. Anyone who has the link can also change it.

## Put it online (Vercel, free)

1. On vercel.com: **Add New → Project**, import this repo and press **Deploy**. Nothing to configure.
2. In the project: **Storage → Create Database → Upstash for Redis** (free plan), then connect it to this project.
3. **Deployments →** the latest one **→ Redeploy**, so the site picks up the database.

Until step 3 is done, the page works but says "Not saving online yet", and only the device you're on keeps your progress.

To bring progress over from the Claude version: there, **Settings → Copy backup code**; here, **Settings → Restore**
and paste it.

## Files

- `index.html`: the page. It is built from the plan, so it isn't edited by hand.
- `api/state.js`: reads and saves the progress (Upstash Redis through its REST API, no packages). A save that crosses
  another device's save is refused, read again, merged and saved again, so a tick is never lost.
