const form = document.getElementById("memoryForm");
const photoInput = document.getElementById("photos");
const previewGrid = document.getElementById("previewGrid");
const submitButton = document.getElementById("submitButton");
const formMessage = document.getElementById("formMessage");
const submissionPaused = document.getElementById("submissionPaused");
const submissionSuccess = document.getElementById("submissionSuccess");
const submitAnotherButton = document.getElementById("submitAnotherButton");

const MAX_FILES = 8;
const MAX_FILE_MB = 15;
const MAX_IMAGE_DIMENSION = 2200;
const JPEG_QUALITY = 0.86;
const SKIP_COMPRESSION_BELOW_BYTES = 350 * 1024;
const MIN_FORM_SECONDS = 2;
const SUBMIT_COOLDOWN_MS = 15000;
const formOpenedAt = Date.now();

let submissionsOpen = true;

function setMessage(text, type = "") {
  formMessage.textContent = text;
  formMessage.className = `form-message ${type}`.trim();
}

function createClient() {
  const cfg = window.MEMORIAL_CONFIG || {};
  if (!(cfg.supabaseUrl && cfg.supabaseAnonKey)) return null;
  return window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
}

async function loadSubmissionStatus() {
  const client = createClient();
  if (!client) return true;

  try {
    const { data, error } = await client
      .from("memorial_settings")
      .select("submissions_open")
      .eq("id", "site")
      .maybeSingle();

    if (error || !data) {
      console.warn("Submission status unavailable:", error);
      submissionsOpen = true;
    } else {
      submissionsOpen = data.submissions_open !== false;
    }
  } catch (error) {
    console.warn("Could not load submission status:", error);
    submissionsOpen = true;
  }

  const showingSuccess = submissionSuccess && !submissionSuccess.classList.contains("hidden");

  if (!showingSuccess) {
    form.classList.toggle("hidden", !submissionsOpen);
    submissionPaused?.classList.toggle("hidden", submissionsOpen);
  }

  return submissionsOpen;
}

loadSubmissionStatus();

photoInput.addEventListener("change", () => {
  previewGrid.innerHTML = "";
  const files = Array.from(photoInput.files || []).slice(0, MAX_FILES);
  setMessage((photoInput.files || []).length > MAX_FILES ? `Please choose no more than ${MAX_FILES} photos.` : "", (photoInput.files || []).length > MAX_FILES ? "error" : "");

  files.forEach(file => {
    const url = URL.createObjectURL(file);
    const img = document.createElement("img");
    img.src = url;
    img.alt = "Selected photo preview";
    img.onload = () => URL.revokeObjectURL(url);
    previewGrid.appendChild(img);
  });
});

function randomId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeFileName(name) {
  return name.normalize("NFKD").replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_").slice(-120);
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(objectUrl); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Could not load image")); };
    img.src = objectUrl;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Canvas conversion failed")), type, quality));
}

async function compressImage(file) {
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/gif" || file.size <= SKIP_COMPRESSION_BELOW_BYTES) return file;

  try {
    const img = await loadImageFromFile(file);
    let { width, height } = img;
    const longest = Math.max(width, height);

    if (longest > MAX_IMAGE_DIMENSION) {
      const scale = MAX_IMAGE_DIMENSION / longest;
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha:false });
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await canvasToBlob(canvas, "image/jpeg", JPEG_QUALITY);
    if (blob.size >= file.size) return file;

    const cleanBase = safeFileName(file.name.replace(/\.[^.]+$/, "")) || "photo";
    return new File([blob], `${cleanBase}.jpg`, { type:"image/jpeg", lastModified:Date.now() });
  } catch (error) {
    console.warn("Compression skipped:", file.name, error);
    return file;
  }
}

async function compressFiles(files) {
  const results = [];
  for (let i = 0; i < files.length; i++) {
    submitButton.textContent = `Optimizing photo ${i + 1} of ${files.length}…`;
    results.push(await compressImage(files[i]));
  }
  return results;
}

submitAnotherButton?.addEventListener("click", async () => {
  submissionSuccess?.classList.add("hidden");
  form.reset();
  previewGrid.innerHTML = "";
  setMessage("");

  const open = await loadSubmissionStatus();
  if (open) {
    form.classList.remove("hidden");
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("name")?.focus();
  }
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  setMessage("");

  const stillOpen = await loadSubmissionStatus();
  if (!stillOpen) {
    setMessage("Memory submissions are temporarily paused.", "error");
    return;
  }

  const name = document.getElementById("name").value.trim();
  const relationship = document.getElementById("relationship").value.trim();
  const story = document.getElementById("story").value.trim();
  const consent = document.getElementById("consent").checked;
  const honeypot = document.getElementById("website")?.value.trim();
  const originalFiles = Array.from(photoInput.files || []);

  if (honeypot) return;

  if ((Date.now() - formOpenedAt) / 1000 < MIN_FORM_SECONDS) {
    setMessage("Please wait a moment and try submitting again.", "error");
    return;
  }

  const lastSubmit = Number(localStorage.getItem("toddMemorialLastSubmit") || 0);
  if (Date.now() - lastSubmit < SUBMIT_COOLDOWN_MS) {
    setMessage("Your last submission was just received. Please wait a few seconds before sending another.", "error");
    return;
  }

  if (!story && originalFiles.length === 0) { setMessage("Please share a story, a photo, or both.", "error"); return; }
  if (!consent) { setMessage("Please check the permission box before submitting.", "error"); return; }
  if (originalFiles.length > MAX_FILES) { setMessage(`Please choose no more than ${MAX_FILES} photos.`, "error"); return; }

  const tooLarge = originalFiles.find(f => f.size > MAX_FILE_MB * 1024 * 1024);
  if (tooLarge) { setMessage(`${tooLarge.name} is larger than ${MAX_FILE_MB} MB.`, "error"); return; }

  const client = createClient();
  if (!client) {
    setMessage("The memory collection is temporarily unavailable. Please try again later.", "error");
    return;
  }

  submitButton.disabled = true;

  try {
    const files = await compressFiles(originalFiles);
    const submissionId = randomId();
    const uploaded = [];

    for (let i = 0; i < files.length; i++) {
      submitButton.textContent = files.length > 1 ? `Uploading photo ${i + 1} of ${files.length}…` : "Uploading photo…";
      const file = files[i];
      const path = `${submissionId}/${randomId()}-${safeFileName(file.name)}`;

      const { error: uploadError } = await client.storage
        .from((window.MEMORIAL_CONFIG || {}).storageBucket || "memorial-uploads")
        .upload(path, file, { cacheControl:"3600", upsert:false, contentType:file.type || undefined });

      if (uploadError) throw uploadError;
      uploaded.push(path);
    }

    submitButton.textContent = "Saving your memory…";
    const { error: insertError } = await client.from("memory_submissions").insert({
      submission_id: submissionId,
      name: name || null,
      relationship: relationship || null,
      story: story || null,
      photo_paths: uploaded
    });

    if (insertError) throw insertError;

    localStorage.setItem("toddMemorialLastSubmit", String(Date.now()));
    form.reset();
    previewGrid.innerHTML = "";
    setMessage("");

    form.classList.add("hidden");
    submissionPaused?.classList.add("hidden");
    submissionSuccess?.classList.remove("hidden");

    submissionSuccess?.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (error) {
    console.error(error);
    setMessage("Something went wrong while saving this memory. Please try again.", "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Add to Todd’s memory collection";
  }
});
