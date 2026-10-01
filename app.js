const form = document.getElementById("memoryForm");
const photoInput = document.getElementById("photos");
const previewGrid = document.getElementById("previewGrid");
const submitButton = document.getElementById("submitButton");
const formMessage = document.getElementById("formMessage");

const MAX_FILES = 8;
const MAX_FILE_MB = 15;

function setMessage(text, type = "") {
  formMessage.textContent = text;
  formMessage.className = `form-message ${type}`.trim();
}

photoInput.addEventListener("change", () => {
  previewGrid.innerHTML = "";
  const files = Array.from(photoInput.files || []).slice(0, MAX_FILES);

  if ((photoInput.files || []).length > MAX_FILES) {
    setMessage(`Please choose no more than ${MAX_FILES} photos.`, "error");
  } else {
    setMessage("");
  }

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
  return name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(-120);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("");

  const name = document.getElementById("name").value.trim();
  const relationship = document.getElementById("relationship").value.trim();
  const story = document.getElementById("story").value.trim();
  const consent = document.getElementById("consent").checked;
  const files = Array.from(photoInput.files || []);

  if (!story && files.length === 0) {
    setMessage("Please share a story, a photo, or both.", "error");
    return;
  }

  if (!consent) {
    setMessage("Please check the permission box before submitting.", "error");
    return;
  }

  if (files.length > MAX_FILES) {
    setMessage(`Please choose no more than ${MAX_FILES} photos.`, "error");
    return;
  }

  const tooLarge = files.find(f => f.size > MAX_FILE_MB * 1024 * 1024);
  if (tooLarge) {
    setMessage(`${tooLarge.name} is larger than ${MAX_FILE_MB} MB.`, "error");
    return;
  }

  const cfg = window.MEMORIAL_CONFIG || {};
  const configured = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);

  // Demo mode allows you to preview the full experience before wiring storage.
  if (!configured) {
    submitButton.disabled = true;
    submitButton.textContent = "Saving…";
    await new Promise(r => setTimeout(r, 650));
    setMessage("Demo mode: the submission flow works. Connect Supabase to save real stories and photos.", "success");
    submitButton.disabled = false;
    submitButton.textContent = "Add to Todd’s memory collection";
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Saving your memory…";

  try {
    const supabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    const submissionId = randomId();
    const uploaded = [];

    for (const file of files) {
      const path = `${submissionId}/${randomId()}-${safeFileName(file.name)}`;

      const { error: uploadError } = await supabase.storage
        .from(cfg.storageBucket || "memorial-uploads")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || undefined
        });

      if (uploadError) throw uploadError;
      uploaded.push(path);
    }

    const { error: insertError } = await supabase
      .from("memory_submissions")
      .insert({
        submission_id: submissionId,
        name: name || null,
        relationship: relationship || null,
        story: story || null,
        photo_paths: uploaded
      });

    if (insertError) throw insertError;

    form.reset();
    previewGrid.innerHTML = "";
    setMessage("Thank you. Your memory has been saved for Todd’s family.", "success");
  } catch (error) {
    console.error(error);
    setMessage("Something went wrong while saving this memory. Please try again.", "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Add to Todd’s memory collection";
  }
});
