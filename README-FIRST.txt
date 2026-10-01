FULL CLEAN RE-UPLOAD

DO NOT replace:
- config.js
- admin-config.js

Those contain your existing Supabase connection/login configuration and should stay as they are.

REPLACE these 6 GitHub files:
1. index.html
2. styles.css
3. app.js
4. admin.html
5. admin.css
6. admin.js

THEN in Supabase:
1. Open SQL Editor
2. New query
3. Paste all of `owner-control-complete.sql`
4. Click Run

WHY THIS PACKAGE:
- Every browser file uses the same fresh cache version: 20261001a
- Public page has compact mountain header
- No middle Remembering Todd section
- No quote strip on public page
- Public obituary link goes to https://www.toddjohnsonmemorial.com/
- Photo compression remains
- Family admin warning remains
- Maddy quote remains on dashboard
- Owner can search/filter/sort/export/delete/download
- Owner has phone-friendly service controls
- Pause/reopen uses a security-definer Supabase RPC
- Admin now displays the ACTUAL Supabase error if pause/reopen fails

TEST AFTER DEPLOY:
1. Wait 1–2 minutes after committing all six files.
2. Open admin page in a private/incognito tab.
3. Log in with owner password.
4. Press Pause submissions.
5. Green badge should become red “Submissions paused.”
6. Open public page: form should be replaced by pause message.
7. Reopen submissions.
8. Public form should return.

If Pause still fails, copy the exact red error shown under Service controls. It will now identify the Supabase issue directly.
