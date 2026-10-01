const cfg=window.MEMORIAL_CONFIG||{};
const adminCfg=window.MEMORIAL_ADMIN||{};
const db=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
const $=id=>document.getElementById(id);

function esc(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function showLogin(msg=""){$("dashboardView").classList.add("hidden");$("loginView").classList.remove("hidden");$("loginMessage").textContent=msg}
function showDash(){$("loginView").classList.add("hidden");$("dashboardView").classList.remove("hidden");$("loginMessage").textContent=""}
function fmt(v){return new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(v))}

async function load(){
  $("dashboardMessage").textContent="Loading memories…";
  $("memoryGrid").innerHTML="";

  const {data,error}=await db
    .from("memory_submissions")
    .select("id,submission_id,name,relationship,story,photo_paths,created_at")
    .order("created_at",{ascending:false});

  if(error){
    console.error(error);
    $("dashboardMessage").textContent="This login does not have permission to view the memory collection.";
    return;
  }

  const items=data||[];
  $("submissionCount").textContent=items.length;
  $("photoCount").textContent=items.reduce((s,x)=>s+(x.photo_paths||[]).length,0);

  if(!items.length){
    $("dashboardMessage").textContent="";
    $("memoryGrid").innerHTML='<div class="empty">No memories have been submitted yet.</div>';
    return;
  }

  for(const item of items){
    const urls=[];
    for(const path of item.photo_paths||[]){
      const {data:signed,error:e}=await db.storage
        .from(cfg.storageBucket||"memorial-uploads")
        .createSignedUrl(path,3600);
      if(!e&&signed?.signedUrl) urls.push(signed.signedUrl);
    }

    const name=item.name?.trim()||"Anonymous";
    const rel=item.relationship?.trim();
    const story=item.story?.trim();

    const card=document.createElement("article");
    card.className="memory-card";
    card.innerHTML=`
      <div class="topline">
        <div>
          <div class="person">${esc(name)}</div>
          ${rel?`<div class="relationship">${esc(rel)}</div>`:""}
        </div>
        <div class="date">${fmt(item.created_at)}</div>
      </div>
      ${story?`<p class="story">${esc(story)}</p>`:""}
      ${urls.length?`<div class="photo-grid">${urls.map((u,i)=>`<a href="${u}" target="_blank" rel="noopener"><img loading="lazy" src="${u}" alt="Photo ${i+1} shared by ${esc(name)}"></a>`).join("")}</div>`:""}
    `;
    $("memoryGrid").appendChild(card);
  }

  $("dashboardMessage").textContent="";
}

$("loginForm").addEventListener("submit",async e=>{
  e.preventDefault();
  $("loginMessage").textContent="";
  $("loginButton").disabled=true;
  $("loginButton").textContent="Opening…";

  const password=$("password").value;
  const email=adminCfg.loginEmail;

  if(!email){
    $("loginMessage").textContent="Admin login is not configured.";
    $("loginButton").disabled=false;
    $("loginButton").textContent="View memories";
    return;
  }

  const {error}=await db.auth.signInWithPassword({email,password});

  $("loginButton").disabled=false;
  $("loginButton").textContent="View memories";

  if(error){
    $("password").select();
    $("loginMessage").textContent="Incorrect password.";
    return;
  }

  $("password").value="";
  showDash();
  await load();
});

$("logoutButton").addEventListener("click",async()=>{await db.auth.signOut();showLogin()});
$("refreshButton").addEventListener("click",load);

(async()=>{
  if(!cfg.supabaseUrl||!cfg.supabaseAnonKey){showLogin("The site is not connected to Supabase.");return}
  const {data:{session}}=await db.auth.getSession();
  if(session){showDash();await load()}else showLogin();
})();
