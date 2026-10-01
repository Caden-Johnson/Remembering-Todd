# Todd Memorial Website — GitHub Pages + Supabase

This package is set up for:

- **GitHub Pages** to host the memorial website
- **Supabase** to privately store stories and uploaded photos
- **QR code** to point guests directly to the published website

The site itself is plain HTML/CSS/JavaScript, so there is no build step.

## Folder contents

- `index.html` — main memorial page
- `styles.css` — design and responsive styling
- `app.js` — form handling, validation, photo upload, and Supabase submission logic
- `config.js` — the only file where you paste your Supabase public project values
- `supabase-setup.sql` — creates the private story table, private image bucket, and submission policies
- `.nojekyll` — tells GitHub Pages to serve the site as-is
- `README.md` — this guide

## Recommended architecture

Guest scans QR code → GitHub Pages website opens → guest writes a memory and/or uploads photos → browser sends submission directly to Supabase → family reviews submissions in Supabase.

The site does **not** display guest submissions publicly.

## A. Create the Supabase backend

1. Go to https://supabase.com and create a project.
2. Name it something like `Todd Memorial`.
3. Save your database password somewhere safe.
4. Open the project.
5. Go to **SQL Editor**.
6. Create a new query.
7. Copy the full contents of `supabase-setup.sql` into the editor.
8. Click **Run**.

This creates:

- table: `memory_submissions`
- storage bucket: `memorial-uploads`
- insert-only policies for anonymous visitors
- no public read access to the stories or uploaded photos

## B. Add the browser-safe Supabase values

In Supabase, open your project settings/API section and copy:

- Project URL
- anon/public key (or the publishable client key shown by Supabase for browser use)

Open `config.js` and replace the blank values:

```js
window.MEMORIAL_CONFIG = {
  supabaseUrl: "https://YOURPROJECT.supabase.co",
  supabaseAnonKey: "YOUR_PUBLIC_BROWSER_KEY",
  storageBucket: "memorial-uploads"
};
```

Do **not** put a `service_role`/secret server key in this file.

## C. Test locally

Double-click `index.html` and confirm the page looks correct.

A local browser test is useful for appearance, but the most important test is after the site is live on GitHub Pages.

## D. Create the GitHub repository

Recommended approach: use a normal project repository such as:

`remembering-todd`

1. Sign in to GitHub.
2. Click **New repository**.
3. Repository name: `remembering-todd`.
4. Set the repository to **Public** if you are using GitHub Free and want GitHub Pages with the simplest setup.
5. Create the repository.
6. Upload every file in this folder to the root of the repository.

The root of the repository should look like:

```text
remembering-todd/
  index.html
  styles.css
  app.js
  config.js
  supabase-setup.sql
  README.md
  .nojekyll
```

## E. Turn on GitHub Pages

1. Open the repository on GitHub.
2. Click **Settings**.
3. In the left sidebar, click **Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Branch: `main`.
6. Folder: `/ (root)`.
7. Click **Save**.

GitHub will publish the site at a URL like:

`https://YOUR-USERNAME.github.io/remembering-todd/`

Publication can take several minutes.

## F. Test the real submission flow

Open the published GitHub Pages URL on your phone.

Test all of these:

1. Submit only a text memory.
2. Submit only a photo.
3. Submit a story + photo together.
4. Try from cellular data, not just home Wi-Fi.
5. Test on at least one iPhone and one Android if possible.

Then verify in Supabase:

### Text/story
Go to **Table Editor** → `memory_submissions`.

### Photos
Go to **Storage** → `memorial-uploads`.

The photos are stored privately. Guests cannot browse the bucket.

## G. Finalize the QR code

Only create the permanent QR code after the GitHub Pages URL is final.

Recommended printed wording:

**SHARE A MEMORY OF TODD**

Scan to share a story, photo, or favorite memory with Todd's family.

[QR CODE]

*Your submission will be saved privately for the family.*

## H. Optional custom domain

You can keep the free GitHub URL, or connect a custom domain later.

A custom URL could be something like:

- `rememberingtodd.com`
- `toddjohnsonmemorial.com`
- `memoriesoftodd.com`

GitHub Pages supports custom domains through **Repository → Settings → Pages → Custom domain**. Configure GitHub first, then update the DNS records with your domain registrar.

## I. Before the service: checklist

- [ ] Supabase SQL ran without errors
- [ ] `config.js` contains the correct Project URL and public browser key
- [ ] GitHub Pages is live
- [ ] Story-only submission tested
- [ ] Photo-only submission tested
- [ ] Story + photo submission tested
- [ ] Photos visible to family in Supabase
- [ ] Guest submissions are not publicly readable
- [ ] QR code tested with multiple phones
- [ ] QR code printed large enough to scan from a comfortable distance
- [ ] One person in the family knows how to check Supabase afterward
- [ ] Final site URL will not be changed after QR codes are printed

## Important security note

GitHub Pages is public static hosting. Everything committed to the repository is public if the repository is public. Never commit:

- database passwords
- Supabase service-role keys
- secret API keys
- private family documents

The browser-safe Supabase project URL and public/anon client key are intended for frontend use. Access control is enforced through Supabase Row Level Security and Storage policies in `supabase-setup.sql`.
