const cfg=window.MEMORIAL_CONFIG||{};
const adminCfg=window.MEMORIAL_ADMIN||{};
const db=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{auth:{persistSession:false,autoRefreshToken:true,detectSessionInUrl:false}});
const $=id=>document.getElementById(id);
let currentRole=null;
let allItems=[];
let signedUrlCache=new Map();

function esc(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function showLogin(msg=""){currentRole=null;$("dashboardView").classList.add("hidden");$("loginView").classList.remove("hidden");$("loginMessage").textContent=msg;$("password").value=""}
function showDash(role){currentRole=role;$("loginView").classList.add("hidden");$("dashboardView").classList.remove("hidden");$("roleBadge").textContent=role==="owner"?"Owner access":"Family view";$("modeNotice").textContent=role==="owner"?"Owner mode — you can view, export, and permanently delete submissions.":"View only — submissions cannot be edited or deleted from this login.";$("exportButton").classList.toggle("hidden",role!=="owner");$("ownerControls")?.classList.toggle("hidden",role!=="owner")}
function fmt(v){return new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(v))}
async function getRole(){const {data,error}=await db.rpc("get_memorial_role");return error?null:(data||null)}

async function signedUrl(path){
  if(signedUrlCache.has(path)) return signedUrlCache.get(path);
  const {data,error}=await db.storage.from(cfg.storageBucket||"memorial-uploads").createSignedUrl(path,3600);
  const url=!error&&data?.signedUrl?data.signedUrl:null;
  if(url) signedUrlCache.set(path,url);
  return url;
}

function filteredItems(){
  const q=$("searchInput").value.trim().toLowerCase();
  const filter=$("photoFilter").value;
  const sort=$("sortSelect").value;
  let items=allItems.filter(item=>{
    const hasPhotos=(item.photo_paths||[]).length>0;
    const hasStory=Boolean(item.story?.trim());
    if(filter==="photos"&&!hasPhotos)return false;
    if(filter==="stories"&&!hasStory)return false;
    if(filter==="photo-only"&&(!hasPhotos||hasStory))return false;
    if(q){
      const hay=[item.name,item.relationship,item.story].filter(Boolean).join(" ").toLowerCase();
      if(!hay.includes(q))return false;
    }
    return true;
  });
  items.sort((a,b)=>{
    if(sort==="oldest") return new Date(a.created_at)-new Date(b.created_at);
    if(sort==="name") return (a.name||"").localeCompare(b.name||"");
    return new Date(b.created_at)-new Date(a.created_at);
  });
  return items;
}

async function render(){
  const items=filteredItems();
  $("memoryGrid").innerHTML="";
  if(!items.length){$("memoryGrid").innerHTML='<div class="empty">No submissions match this view.</div>';return}

  for(const item of items){
    const urls=[];
    for(const path of item.photo_paths||[]){const url=await signedUrl(path);if(url)urls.push(url)}
    const name=item.name?.trim()||"Anonymous",rel=item.relationship?.trim(),story=item.story?.trim();
    const card=document.createElement("article");card.className="memory-card";
    card.innerHTML=`<div class="topline"><div><div class="person">${esc(name)}</div>${rel?`<div class="relationship">${esc(rel)}</div>`:""}</div><div class="date">${fmt(item.created_at)}</div></div>${story?`<p class="story">${esc(story)}</p>`:""}${urls.length?`<div class="photo-grid">${urls.map((u,i)=>`<div class="photo-wrap"><a class="photo-link" href="${u}" target="_blank" rel="noopener"><img loading="lazy" src="${u}" alt="Photo ${i+1} shared by ${esc(name)}"></a><button class="photo-download" type="button" data-url="${u}" data-name="${esc((item.photo_paths||[])[i]?.split("/").pop() || `photo-${i+1}.jpg`)}">Download photo</button></div>`).join("")}</div>`:""}${currentRole==="owner"?`<div class="card-footer"><button class="delete-btn">Delete submission</button></div>`:""}`;

    if(currentRole==="owner"){
      const btn=card.querySelector(".delete-btn");
      btn.addEventListener("click",async()=>{
        if(!confirm(`Permanently delete this submission from ${name}? This will also delete its uploaded photos.`))return;
        btn.disabled=true;btn.textContent="Deleting…";
        try{
          const paths=item.photo_paths||[];
          if(paths.length){const {error:e}=await db.storage.from(cfg.storageBucket||"memorial-uploads").remove(paths);if(e)throw e}
          const {error:e}=await db.from("memory_submissions").delete().eq("id",item.id);if(e)throw e;
          signedUrlCache.clear();await load();
        }catch(err){console.error(err);alert("The submission could not be deleted.");btn.disabled=false;btn.textContent="Delete submission"}
      });
    }
    card.querySelectorAll(".photo-download").forEach(button=>{
      button.addEventListener("click", async ()=>{
        const originalText=button.textContent;
        button.disabled=true;
        button.textContent="Downloading…";
        try{
          const response=await fetch(button.dataset.url);
          if(!response.ok) throw new Error("Download failed");
          const blob=await response.blob();
          const objectUrl=URL.createObjectURL(blob);
          const a=document.createElement("a");
          a.href=objectUrl;
          a.download=button.dataset.name || "todd-memory-photo.jpg";
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(objectUrl);
        }catch(err){
          console.error(err);
          window.open(button.dataset.url,"_blank","noopener");
        }finally{
          button.disabled=false;
          button.textContent=originalText;
        }
      });
    });

    $("memoryGrid").appendChild(card);
  }
}


function publicMemorialUrl(){
  const url = new URL(window.location.href);
  url.pathname = url.pathname.replace(/admin\.html$/, "");
  url.search = "";
  url.hash = "";
  return url.toString();
}

function setOwnerControlMessage(text){
  const el=$("ownerControlMessage");
  if(!el) return;
  el.textContent=text;
  clearTimeout(setOwnerControlMessage._timer);
  setOwnerControlMessage._timer=setTimeout(()=>{el.textContent=""},3500);
}

async function copyText(text,label){
  try{
    await navigator.clipboard.writeText(text);
    setOwnerControlMessage(`${label} copied.`);
  }catch(_){
    prompt(`Copy ${label.toLowerCase()}:`,text);
  }
}

async function loadSiteSettings(){
  if(currentRole!=="owner") return;
  const {data,error}=await db.from("memorial_settings").select("submissions_open").eq("id","site").maybeSingle();
  if(error||!data){
    setOwnerControlMessage("Could not load submission controls.");
    return;
  }
  const open=data.submissions_open!==false;
  const pill=$("submissionStatusPill");
  pill.textContent=open?"Submissions open":"Submissions paused";
  pill.className=`status-pill ${open?"open":"paused"}`;
  $("toggleSubmissionsTitle").textContent=open?"Pause submissions":"Reopen submissions";
  $("toggleSubmissionsButton").dataset.open=open?"true":"false";
  $("toggleSubmissionsButton").querySelector(".control-icon").textContent=open?"⏸":"▶";
}

async function toggleSubmissions(){
  if(currentRole!=="owner") return;
  const button=$("toggleSubmissionsButton");
  const isOpen=button.dataset.open!=="false";
  const next=!isOpen;
  const wording=next?"reopen":"pause";
  if(!confirm(`Are you sure you want to ${wording} public memory submissions?`)) return;

  button.disabled=true;
  const {data,error}=await db.rpc("set_memorial_submissions_open",{new_open:next});
  button.disabled=false;

  if(error){
    console.error(error);
    setOwnerControlMessage(`Could not change submission status: ${error.message || "permission error"}`);
    return;
  }
  setOwnerControlMessage(next?"Public submissions reopened.":"Public submissions paused.");
  await loadSiteSettings();
}

async function load(){
  $("dashboardMessage").textContent="Loading memories…";
  const {data,error}=await db.from("memory_submissions").select("id,submission_id,name,relationship,story,photo_paths,created_at").order("created_at",{ascending:false});
  if(error){$("dashboardMessage").textContent="This login does not have permission to view the memory collection.";return}
  allItems=data||[];
  $("submissionCount").textContent=allItems.length;
  $("photoCount").textContent=allItems.reduce((s,x)=>s+(x.photo_paths||[]).length,0);
  $("dashboardMessage").textContent="";
  await render();
}

async function tryLogin(email,password){
  const {data,error}=await db.auth.signInWithPassword({email,password});
  if(error||!data?.session)return false;
  const role=await getRole();
  if(!role){await db.auth.signOut();return false}
  return role;
}

$("loginForm").addEventListener("submit",async e=>{
  e.preventDefault();$("loginButton").disabled=true;$("loginButton").textContent="Opening…";$("loginMessage").textContent="";
  const password=$("password").value;
  let role=await tryLogin(adminCfg.ownerEmail,password);
  if(!role){await db.auth.signOut();role=await tryLogin(adminCfg.viewerEmail,password)}
  $("loginButton").disabled=false;$("loginButton").textContent="View memories";
  if(!role){$("password").select();$("loginMessage").textContent="Incorrect password.";return}
  $("password").value="";showDash(role);await load();await loadSiteSettings();
});

$("logoutButton").addEventListener("click",async()=>{await db.auth.signOut();showLogin()});
$("refreshButton").addEventListener("click",async()=>{signedUrlCache.clear();await load();await loadSiteSettings()});
$("searchInput").addEventListener("input",render);
$("photoFilter").addEventListener("change",render);
$("sortSelect").addEventListener("change",render);


$("toggleSubmissionsButton")?.addEventListener("click",toggleSubmissions);
$("copyMemorialButton")?.addEventListener("click",()=>copyText(publicMemorialUrl(),"Memorial link"));
$("openMemorialButton")?.addEventListener("click",()=>window.open(publicMemorialUrl(),"_blank","noopener"));
$("copyObituaryButton")?.addEventListener("click",()=>copyText("https://www.toddjohnsonmemorial.com/","Obituary link"));

$("exportButton").addEventListener("click",()=>{
  if(currentRole!=="owner")return;
  const rows=[["Name","Relationship","Story","Photo Count","Photo Paths","Submitted"]];
  for(const item of allItems){
    rows.push([
      item.name||"",
      item.relationship||"",
      item.story||"",
      String((item.photo_paths||[]).length),
      (item.photo_paths||[]).join(" | "),
      item.created_at
    ]);
  }
  const csv=rows.map(row=>row.map(value=>`"${String(value).replace(/"/g,'""')}"`).join(",")).join("\r\n");
  const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=`todd-memory-collection-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
});

(async()=>{try{await db.auth.signOut()}catch(_){}showLogin()})();
