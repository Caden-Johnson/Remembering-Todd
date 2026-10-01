OWNER CONTROL PANEL UPDATE

Upload/replace these website files:
- index.html
- styles.css
- app.js
- admin.html
- admin.css
- admin.js

Then run:
- owner-control-setup.sql
in the Supabase SQL Editor ONE TIME.

NEW ADMIN FEATURES
- Family login warning: “Family access only — please don’t share this admin page or family password outside the family.”
- Owner-only mobile control panel
- Pause / reopen public submissions
- Copy public memorial link
- Open the public memorial page
- Copy Todd’s obituary link
- Existing Refresh, Export CSV, Delete submission, and Download photo controls remain

PUBLIC PAGE
- If the owner pauses submissions, the form disappears and guests see a polite temporary-pause message.
- If the settings request ever fails, the public form defaults to OPEN so a settings glitch does not unexpectedly block guests.

IMPORTANT
Run the SQL before testing the Pause Submissions button.
No passwords or service-role keys are added to GitHub.
