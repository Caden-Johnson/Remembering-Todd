const cfg = window.MEMORIAL_CONFIG || {};
const adminCfg = window.MEMORIAL_ADMIN || {};

// Important: persistSession:false means a refresh/reopen requires the password again.
const db = window.supabase.createClient(
  cfg.supabaseUrl,
  cfg.supabaseAnonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  }
);

const $ = id => document.getElementById(id);
let currentRole = null;

function esc(v="") {
  return String(v).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

function showLogin(msg="") {
  currentRole = null;
  $("dashboardView").classList.add("hidden");
  $("loginView").classList.remove("hidden");
  $("loginMessage").textContent = msg;
  $("password").value = "";
}

function showDash(role) {
  currentRole = role;
  $("loginView").classList.add("hidden");
  $("dashboardView").classList.remove("hidden");
  $("loginMessage").textContent = "";
  $("roleBadge").textContent = role === "owner" ? "Owner access" : "Family view";
  $("modeNotice").textContent = role === "owner"
    ? "Owner mode — you can view the collection and permanently delete submissions."
    : "View only — submissions cannot be edited or deleted from this login.";
}

function fmt(v) {
  return new Intl.DateTimeFormat(undefined, {
    month:"short", day:"numeric", year:"numeric", hour:"numeric", minute:"2-digit"
  }).format(new Date(v));
}

async function getRole() {
  const { data, error } = await db.rpc("get_memorial_role");
  if (error) return null;
  return data || null;
}

async function load() {
  $("dashboardMessage").textContent = "Loading memories…";
  $("memoryGrid").innerHTML = "";

  const { data, error } = await db
    .from("memory_submissions")
    .select("id,submission_id,name,relationship,story,photo_paths,created_at")
    .order("created_at", { ascending:false });

  if (error) {
    console.error(error);
    $("dashboardMessage").textContent = "This login does not have permission to view the memory collection.";
    return;
  }

  const items = data || [];
  $("submissionCount").textContent = items.length;
  $("photoCount").textContent = items.reduce((s,x) => s + (x.photo_paths || []).length, 0);

  if (!items.length) {
    $("dashboardMessage").textContent = "";
    $("memoryGrid").innerHTML = '<div class="empty">No memories have been submitted yet.</div>';
    return;
  }

  for (const item of items) {
    const urls = [];

    for (const path of item.photo_paths || []) {
      const { data:signed, error:e } = await db.storage
        .from(cfg.storageBucket || "memorial-uploads")
        .createSignedUrl(path, 3600);

      if (!e && signed?.signedUrl) urls.push(signed.signedUrl);
    }

    const name = item.name?.trim() || "Anonymous";
    const rel = item.relationship?.trim();
    const story = item.story?.trim();

    const card = document.createElement("article");
    card.className = "memory-card";
    card.innerHTML = `
      <div class="topline">
        <div>
          <div class="person">${esc(name)}</div>
          ${rel ? `<div class="relationship">${esc(rel)}</div>` : ""}
        </div>
        <div class="date">${fmt(item.created_at)}</div>
      </div>
      ${story ? `<p class="story">${esc(story)}</p>` : ""}
      ${urls.length ? `<div class="photo-grid">${urls.map((u,i) =>
        `<a href="${u}" target="_blank" rel="noopener"><img loading="lazy" src="${u}" alt="Photo ${i+1} shared by ${esc(name)}"></a>`
      ).join("")}</div>` : ""}
      ${currentRole === "owner" ? `<div class="card-footer"><button class="delete-btn" data-id="${esc(item.id)}">Delete submission</button></div>` : ""}
    `;

    if (currentRole === "owner") {
      const btn = card.querySelector(".delete-btn");
      btn.addEventListener("click", async () => {
        const ok = confirm(`Permanently delete this submission from ${name}? This will also delete its uploaded photos.`);
        if (!ok) return;

        btn.disabled = true;
        btn.textContent = "Deleting…";

        try {
          const paths = item.photo_paths || [];
          if (paths.length) {
            const { error: storageError } = await db.storage
              .from(cfg.storageBucket || "memorial-uploads")
              .remove(paths);
            if (storageError) throw storageError;
          }

          const { error: deleteError } = await db
            .from("memory_submissions")
            .delete()
            .eq("id", item.id);

          if (deleteError) throw deleteError;
          await load();
        } catch (err) {
          console.error(err);
          alert("The submission could not be deleted. Please try again.");
          btn.disabled = false;
          btn.textContent = "Delete submission";
        }
      });
    }

    $("memoryGrid").appendChild(card);
  }

  $("dashboardMessage").textContent = "";
}

async function tryLogin(email, password) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error || !data?.session) return false;

  const role = await getRole();
  if (!role) {
    await db.auth.signOut();
    return false;
  }
  return role;
}

$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  $("loginMessage").textContent = "";
  $("loginButton").disabled = true;
  $("loginButton").textContent = "Opening…";

  const password = $("password").value;

  // Try the private owner password first, then the family view password.
  let role = await tryLogin(adminCfg.ownerEmail, password);

  if (!role) {
    await db.auth.signOut();
    role = await tryLogin(adminCfg.viewerEmail, password);
  }

  $("loginButton").disabled = false;
  $("loginButton").textContent = "View memories";

  if (!role) {
    $("password").select();
    $("loginMessage").textContent = "Incorrect password.";
    return;
  }

  $("password").value = "";
  showDash(role);
  await load();
});

$("logoutButton").addEventListener("click", async () => {
  await db.auth.signOut();
  showLogin();
});

$("refreshButton").addEventListener("click", load);

// Never auto-open a prior session. Every page load starts locked.
(async () => {
  try { await db.auth.signOut(); } catch (_) {}
  showLogin();
})();
