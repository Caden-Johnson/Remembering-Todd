const form = document.getElementById("memoryForm");
const photoInput = document.getElementById("photos");
const previewGrid = document.getElementById("previewGrid");
const submitButton = document.getElementById("submitButton");
const formMessage = document.getElementById("formMessage");

const MAX_FILES = 8;
const MAX_FILE_MB = 15;

// Compression settings
const MAX_IMAGE_DIMENSION = 2200;   // longest side in pixels
const JPEG_QUALITY = 0.86;          // 0 to 1
const SKIP_COMPRESSION_BELOW_BYTES = 350 * 1024; // keep very small images as-is

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

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not load image"));
    };

    img.src = objectUrl;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas conversion failed"));
    }, type, quality);
  });
}

async function compressImage(file) {
  // Only attempt to compress image files.
  if (!file.type.startsWith("image/")) return file;

  // Skip animated GIFs and tiny images.
  if (file.type === "image/gif" || file.size <= SKIP_COMPRESSION_BELOW_BYTES) {
    return file;
  }

  try {
    const img = await loadImageFromFile(file);

    let { width, height } = img;
    const longestSide = Math.max(width, height);

    if (longestSide > MAX_IMAGE_DIMENSION) {
      const scale = MAX_IMAGE_DIMENSION / longestSide;
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    // Convert uploads to optimized JPEG for smaller storage and faster upload.
    const blob = await canvasToBlob(canvas, "image/jpeg", JPEG_QUALITY);

    // If compression somehow made the file larger, keep the original.
    if (blob.size >= file.size) {
      return file;
    }

    const cleanBase = safeFileName(file.name.replace(/\.[^.]+$/, "")) || "photo";
    return new File([blob], `${cleanBase}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now()
    });
  } catch (error) {
    console.warn("Compression skipped for file:", file.name, error);
    return file;
  }
}

async function compressFiles(files) {
  const results = [];
  for (const file of files) {
    const compressed = await compressImage(file);
    results.push(compressed);
  }
  return results;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("");

  const name = document.getElementById("name").value.trim();
  const relationship = document.getElementById("relationship").value.trim();
  const story = document.getElementById("story").value.trim();
  const consent = document.getElementById("consent").checked;
  const originalFiles = Array.from(photoInput.files || []);

  if (!story && originalFiles.length === 0) {
    setMessage("Please share a story, a photo, or both.", "error");
    return;
  }

  if (!consent) {
    setMessage("Please check the permission box before submitting.", "error");
    return;
  }

  if (originalFiles.length > MAX_FILES) {
    setMessage(`Please choose no more than ${MAX_FILES} photos.`, "error");
    return;
  }

  const tooLarge = originalFiles.find(f => f.size > MAX_FILE_MB * 1024 * 1024);
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
  submitButton.textContent = originalFiles.length ? "Optimizing photos…" : "Saving your memory…";

  try {
    const files = await compressFiles(originalFiles);

    submitButton.textContent = "Saving your memory…";

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
