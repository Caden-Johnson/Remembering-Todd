TODD MEMORIAL POLISH UPGRADE

Replace these files in the ROOT of your GitHub repository:
- index.html
- styles.css
- app.js
- admin.html
- admin.css
- admin.js

No new SQL is required.

WHAT CHANGED

PUBLIC PAGE
- Cleaner hero sizing and spacing
- Fixes quote wrapping
- Better mobile layout
- Improved readability
- Photo upload explains automatic optimization
- Upload button shows photo-by-photo optimization/upload progress
- Basic anti-spam protections:
  * invisible honeypot
  * 2-second minimum form time
  * 15-second local cooldown after successful submission
- Existing Supabase submission behavior stays the same

OPTIONAL TODD HERO PHOTO
The new CSS looks for a file named:
  todd-hero.jpg

If that file exists in the GitHub root, it becomes the hero background automatically.
If it does not exist, the current blue fallback still works.

ADMIN PAGE
- Search by name, relationship, or story text
- Filter: all / has photos / has story / photo only
- Sort: newest / oldest / name
- Owner-only Export CSV button
- Existing owner delete behavior remains
- Family password remains view-only
- Admin page still locks on every refresh/reopen

RECOMMENDED TESTS
1. Public: submit one story with no photo.
2. Public: submit one large phone photo and watch optimization/upload status.
3. Admin family password: verify no delete/export.
4. Admin owner password: verify delete + Export CSV.
5. Test mobile on an iPhone/Android if available.
