// ---------- Grab the elements we need ----------
const form = document.getElementById("prompt-form");
const promptInput = document.getElementById("prompt");
const counter = document.getElementById("counter");
const errorBox = document.getElementById("error");
const generateBtn = document.getElementById("generate-btn");
const emptyState = document.getElementById("empty");
const loadingState = document.getElementById("loading");
const loadingText = document.getElementById("loading-text");
const resultImg = document.getElementById("result");
const caption = document.getElementById("caption");
const enhancedCaption = document.getElementById("enhanced-caption");
const downloadBtn = document.getElementById("download-btn");

// Enhance Toggle & Suggestion Elements
const enhanceToggle = document.getElementById("enhance-toggle");
const enhanceState = document.getElementById("enhance-state");
const suggestionControlRow = document.getElementById("suggestion-control-row");
const btnSuggestPrompt = document.getElementById("btn-suggest-prompt");
const suggestionStatusText = document.getElementById("suggestion-status-text");
const suggestionBox = document.getElementById("suggestion-box");
const suggestionLoading = document.getElementById("suggestion-loading");
const suggestionContent = document.getElementById("suggestion-content");
const suggestionText = document.getElementById("suggestion-text");
const btnUseGenerate = document.getElementById("btn-use-generate");
const btnUsePrompt = document.getElementById("btn-use-prompt");
const btnSuggestionClose = document.getElementById("btn-suggestion-close");

const MAX_LENGTH = 500;
let isGenerating = false; // stops duplicate image requests
let isEnhanceEnabled = true; // Prompt Enhancement defaults to ON
let currentSuggestedPrompt = "";
let isFetchingSuggestion = false;
let suggestionDebounceTimer = null;

// ---------- Enhance Toggle Handler ----------
if (enhanceToggle) {
  enhanceToggle.addEventListener("click", () => {
    isEnhanceEnabled = !isEnhanceEnabled;
    enhanceToggle.classList.toggle("active", isEnhanceEnabled);
    enhanceToggle.setAttribute("aria-pressed", isEnhanceEnabled ? "true" : "false");
    if (enhanceState) {
      enhanceState.textContent = isEnhanceEnabled ? "ON" : "OFF";
    }

    if (suggestionControlRow) {
      suggestionControlRow.hidden = !isEnhanceEnabled;
    }

    if (!isEnhanceEnabled && suggestionBox) {
      suggestionBox.hidden = true;
    } else if (isEnhanceEnabled && promptInput.value.trim().length >= 2) {
      fetchSuggestion(false);
    }
  });
}

// ---------- UI Error & Loading Helpers ----------
function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
  promptInput.classList.add("invalid");
}

function clearError() {
  errorBox.hidden = true;
  promptInput.classList.remove("invalid");
}

function setLoading(on) {
  isGenerating = on;
  generateBtn.disabled = on;
  generateBtn.textContent = on ? "Generating..." : "Generate image";
  loadingState.hidden = !on;
  if (on) {
    emptyState.hidden = true;
    resultImg.hidden = true;
    downloadBtn.hidden = true;
    caption.textContent = "";
    if (enhancedCaption) {
      enhancedCaption.hidden = true;
    }
  }
}

// ---------- AI Prompt Suggestion Fetcher ----------
async function fetchSuggestion(isExplicitClick = false) {
  if (isFetchingSuggestion) return;
  const rawPrompt = promptInput.value.trim();

  if (!rawPrompt) {
    if (isExplicitClick) {
      showError("Write an idea or place name first, then get an AI suggestion.");
      promptInput.focus();
    }
    if (suggestionBox) suggestionBox.hidden = true;
    return;
  }

  clearError();
  isFetchingSuggestion = true;

  if (btnSuggestPrompt) {
    btnSuggestPrompt.disabled = true;
  }
  if (suggestionStatusText) {
    suggestionStatusText.textContent = "AI is thinking...";
  }

  // Show the suggestion container with loading state
  if (suggestionBox && suggestionLoading && suggestionContent) {
    suggestionBox.hidden = false;
    suggestionLoading.hidden = false;
    suggestionContent.hidden = true;
  }

  try {
    const res = await fetch("/enhance-prompt", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        prompt: rawPrompt
      })
    });

    const contentType = res.headers.get("content-type") || "";
    if (!res.ok || !contentType.includes("application/json")) {
      throw new Error("Could not enhance prompt at this moment.");
    }

    const data = await res.json();
    if (data && data.success && data.enhancedPrompt) {
      currentSuggestedPrompt = data.enhancedPrompt;

      if (suggestionText) {
        suggestionText.textContent = data.enhancedPrompt;
      }
      if (suggestionLoading && suggestionContent) {
        suggestionLoading.hidden = true;
        suggestionContent.hidden = false;
      }
      if (suggestionStatusText) {
        suggestionStatusText.textContent = "Click below to apply & generate!";
      }
    } else {
      throw new Error("Empty suggestion received.");
    }
  } catch (err) {
    console.warn("Suggestion fetch error:", err);
    if (isExplicitClick) {
      showError("Could not retrieve AI suggestion right now. You can still generate directly.");
    }
    if (suggestionBox) {
      suggestionBox.hidden = true;
    }
    if (suggestionStatusText) {
      suggestionStatusText.textContent = "Ready to generate";
    }
  } finally {
    isFetchingSuggestion = false;
    if (btnSuggestPrompt) {
      btnSuggestPrompt.disabled = false;
    }
  }
}

// ---------- Apply Suggestion Handler ----------
function applySuggestion(andGenerateImmediately = false) {
  if (!currentSuggestedPrompt) return;

  // Insert enhanced prompt into textarea
  promptInput.value = currentSuggestedPrompt;
  promptInput.dispatchEvent(new Event("input"));
  clearError();

  if (andGenerateImmediately) {
    // Hide suggestion box & trigger image generation
    if (suggestionBox) suggestionBox.hidden = true;
    handleGenerate(new Event("submit"));
  } else {
    // Provide user feedback that it was inserted into the prompt
    if (btnUsePrompt) {
      const origText = btnUsePrompt.textContent;
      btnUsePrompt.textContent = "✓ Applied to Prompt!";
      btnUsePrompt.style.borderColor = "var(--accent)";
      setTimeout(() => {
        btnUsePrompt.textContent = origText;
        btnUsePrompt.style.borderColor = "";
      }, 2000);
    }
    promptInput.focus();
  }
}

// ---------- Main Generation Flow ----------
async function handleGenerate(event) {
  if (event && event.preventDefault) event.preventDefault();
  if (isGenerating) return;

  const currentPrompt = promptInput.value.trim();

  // Validation: prompt cannot be empty
  if (!currentPrompt) {
    showError("Write a description first, then press Generate image.");
    promptInput.focus();
    return;
  }

  clearError();
  setLoading(true);

  let promptToSend = currentPrompt;
  let originalPromptForCaption = currentPrompt;
  let enhancedPromptForCaption = null;

  try {
    // If Enhance is ON, check if prompt needs enhancement or was already enhanced
    if (isEnhanceEnabled) {
      if (loadingText) {
        loadingText.textContent = "Understanding prompt...";
      }

      // If user already used a suggestion that matches currentPrompt, keep it
      if (currentSuggestedPrompt && currentPrompt === currentSuggestedPrompt) {
        enhancedPromptForCaption = currentSuggestedPrompt;
      } else {
        // Fetch enhanced version
        try {
          const enhanceResponse = await fetch("/enhance-prompt", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            body: JSON.stringify({
              prompt: currentPrompt
            })
          });

          const ct = enhanceResponse.headers.get("content-type") || "";
          if (enhanceResponse.ok && ct.includes("application/json")) {
            const enhanceData = await enhanceResponse.json();
            if (enhanceData && enhanceData.success && enhanceData.enhancedPrompt) {
              enhancedPromptForCaption = enhanceData.enhancedPrompt;
              promptToSend = enhanceData.enhancedPrompt;
              currentSuggestedPrompt = enhanceData.enhancedPrompt;

              // Also display it in the suggestion box for user reference
              if (suggestionText) {
                suggestionText.textContent = enhanceData.enhancedPrompt;
              }
              if (suggestionBox && suggestionContent && suggestionLoading) {
                suggestionLoading.hidden = true;
                suggestionContent.hidden = false;
                suggestionBox.hidden = false;
              }
            }
          }
        } catch (enhanceErr) {
          console.warn("Fallback to original prompt on generation:", enhanceErr);
          promptToSend = currentPrompt;
        }
      }
    }

    // Step 2: Request Image Generation from Backend
    if (loadingText) {
      loadingText.textContent = "Developing your image…";
    }

    const response = await fetch("/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        prompt: promptToSend
      })
    });

    const responseContentType = response.headers.get("content-type") || "";
    let data = null;

    if (responseContentType.includes("application/json")) {
      try {
        data = await response.json();
      } catch (jsonErr) {
        console.warn("Could not parse JSON:", jsonErr);
      }
    }

    if (!response.ok || !data || !data.success || !data.imageUrl) {
      const errorMsg = (data && data.error) ? data.error : "Something went wrong while generating your image. Please try again.";
      throw new Error(errorMsg);
    }

    // Display the image
    resultImg.src = data.imageUrl;
    resultImg.alt = "Generated image for: " + (enhancedPromptForCaption || originalPromptForCaption);
    resultImg.hidden = false;

    // Trigger photo print develop animation
    resultImg.classList.remove("reveal");
    void resultImg.offsetWidth;
    resultImg.classList.add("reveal");

    // Update captions
    if (enhancedPromptForCaption && enhancedPromptForCaption !== originalPromptForCaption) {
      caption.textContent = "Original: " + originalPromptForCaption;
      if (enhancedCaption) {
        enhancedCaption.textContent = "Enhanced: " + enhancedPromptForCaption;
        enhancedCaption.hidden = false;
      }
    } else {
      caption.textContent = originalPromptForCaption;
      if (enhancedCaption) {
        enhancedCaption.hidden = true;
      }
    }

    downloadBtn.hidden = false;

  } catch (err) {
    console.error("Generate error:", err);
    emptyState.hidden = false;
    showError(err.message || "Something went wrong while generating your image. Please try again.");
  } finally {
    setLoading(false);
    if (loadingText) {
      loadingText.textContent = "Developing your image…";
    }
  }
}

// ---------- Download Image Handler ----------
function handleDownload() {
  if (!resultImg.src) return;
  const link = document.createElement("a");
  link.href = resultImg.src;
  link.download = "text-to-image-" + Date.now() + ".png";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ---------- Event Listeners ----------
form.addEventListener("submit", handleGenerate);
downloadBtn.addEventListener("click", handleDownload);

// Suggestion buttons
if (btnSuggestPrompt) {
  btnSuggestPrompt.addEventListener("click", () => fetchSuggestion(true));
}
if (btnUseGenerate) {
  btnUseGenerate.addEventListener("click", () => applySuggestion(true));
}
if (btnUsePrompt) {
  btnUsePrompt.addEventListener("click", () => applySuggestion(false));
}
if (suggestionText) {
  suggestionText.addEventListener("click", () => applySuggestion(false));
}
if (btnSuggestionClose) {
  btnSuggestionClose.addEventListener("click", () => {
    if (suggestionBox) suggestionBox.hidden = true;
  });
}

// Real-time character counter & intelligent suggestion debouncer
promptInput.addEventListener("input", () => {
  const len = promptInput.value.length;
  counter.textContent = len + " / " + MAX_LENGTH;
  if (promptInput.value.trim()) clearError();

  // If Enhance Prompt is ON and user types an idea, automatically suggest after a short pause
  if (isEnhanceEnabled) {
    clearTimeout(suggestionDebounceTimer);
    const val = promptInput.value.trim();
    if (val.length >= 3 && val.length <= 40) {
      suggestionDebounceTimer = setTimeout(() => {
        fetchSuggestion(false);
      }, 700);
    }
  }
});

// Example prompt chip buttons
document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    promptInput.value = chip.textContent;
    promptInput.dispatchEvent(new Event("input"));
    promptInput.focus();

    if (isEnhanceEnabled) {
      clearTimeout(suggestionDebounceTimer);
      suggestionDebounceTimer = setTimeout(() => {
        fetchSuggestion(false);
      }, 200);
    }
  });
});

// ---------- Email Section & Copy Handler ----------
const emailToggleBtn = document.getElementById("email-toggle-btn");
const emailCard = document.getElementById("email-card");
const btnCopyEmail = document.getElementById("btn-copy-email");
const copyBtnText = document.getElementById("copy-btn-text");
const emailAddressText = document.getElementById("email-address-text");

if (emailToggleBtn && emailCard) {
  emailToggleBtn.addEventListener("click", (e) => {
    e.preventDefault();
    const willOpen = emailCard.hidden;
    emailCard.hidden = !willOpen;
    emailToggleBtn.classList.toggle("active", willOpen);
    emailToggleBtn.setAttribute("aria-expanded", willOpen ? "true" : "false");
    if (willOpen) {
      emailCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });
}

if (btnCopyEmail) {
  btnCopyEmail.addEventListener("click", async () => {
    const emailToCopy = emailAddressText ? emailAddressText.textContent.trim() : "muhammadmuneebmanzoor5@gmail.com";
    let copied = false;

    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(emailToCopy);
        copied = true;
      } catch (_) {}
    }

    if (!copied) {
      const tempInput = document.createElement("textarea");
      tempInput.value = emailToCopy;
      tempInput.style.position = "fixed";
      tempInput.style.left = "-9999px";
      document.body.appendChild(tempInput);
      tempInput.focus();
      tempInput.select();
      try {
        copied = document.execCommand("copy");
      } catch (_) {}
      document.body.removeChild(tempInput);
    }

    if (copyBtnText) {
      const originalText = copyBtnText.textContent;
      btnCopyEmail.classList.add("copied");
      copyBtnText.textContent = "✓ Copied!";
      setTimeout(() => {
        btnCopyEmail.classList.remove("copied");
        copyBtnText.textContent = originalText;
      }, 2500);
    }
  });
}
