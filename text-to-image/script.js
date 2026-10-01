/**
 * Text-to-Image Generator by MMM
 * Vanilla JavaScript Implementation
 * Clean, well-commented, beginner-friendly code.
 */

// Wait for the DOM to fully load before initializing scripts
document.addEventListener('DOMContentLoaded', () => {

  // --------------------------------------------------------------------------
  // 1. DOM Element References
  // --------------------------------------------------------------------------
  const promptInput = document.getElementById('promptInput');
  const promptWrapper = document.getElementById('promptWrapper');
  const charCounter = document.getElementById('charCounter');
  const btnClearPrompt = document.getElementById('btnClearPrompt');
  const btnGenerate = document.getElementById('btnGenerate');
  const btnGenerateText = document.getElementById('btnGenerateText');
  const errorBanner = document.getElementById('errorBanner');
  const errorMessage = document.getElementById('errorMessage');

  const styleSelect = document.getElementById('styleSelect');
  const aspectSelect = document.getElementById('aspectSelect');
  const presetChips = document.querySelectorAll('.preset-chip');

  const previewDisplayBox = document.getElementById('previewDisplayBox');
  const emptyState = document.getElementById('emptyState');
  const loadingState = document.getElementById('loadingState');
  const loadingSubtext = document.getElementById('loadingSubtext');
  const imageResultContainer = document.getElementById('imageResultContainer');
  const generatedImage = document.getElementById('generatedImage');

  const previewMetaPanel = document.getElementById('previewMetaPanel');
  const metaResolution = document.getElementById('metaResolution');
  const metaStyle = document.getElementById('metaStyle');
  const metaDuration = document.getElementById('metaDuration');

  const btnDownload = document.getElementById('btnDownload');
  const btnCopyPrompt = document.getElementById('btnCopyPrompt');
  const btnZoom = document.getElementById('btnZoom');

  const modalOverlay = document.getElementById('modalOverlay');
  const modalImage = document.getElementById('modalImage');
  const modalCaption = document.getElementById('modalCaption');
  const btnCloseModal = document.getElementById('btnCloseModal');

  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');

  // --------------------------------------------------------------------------
  // 2. Mock Image Library & Pool
  // --------------------------------------------------------------------------
  // We provide high-quality pre-rendered assets matching different prompt themes.
  const mockImages = [
    {
      id: 'alpine',
      url: './assets/images/mock-alpine.jpg',
      keywords: ['mountain', 'lake', 'alpine', 'sunset', 'nature', 'landscape', 'water', 'forest', 'golden'],
      defaultPrompt: 'Cinematic photo of serene misty mountain peaks at sunrise with golden sunlight illuminating an alpine glacial lake'
    },
    {
      id: 'cyber',
      url: './assets/images/mock-cyber.jpg',
      keywords: ['cyber', 'neon', 'city', 'future', 'futuristic', 'rain', 'night', 'scifi', 'sci-fi', 'metropolis', 'spire', 'tech'],
      defaultPrompt: 'Moody futuristic neon city skyline at night with rain-slicked asphalt reflecting vibrant blue and amber light'
    },
    {
      id: 'botanical',
      url: './assets/images/mock-botanical.jpg',
      keywords: ['botanical', 'greenhouse', 'plant', 'leaves', 'garden', 'conservatory', 'glass', 'sunlight', 'tropical', 'monstera'],
      defaultPrompt: 'Architectural glass greenhouse interior filled with lush tropical Monstera plants and soft morning sunbeams'
    }
  ];

  let currentImageUrl = '';
  let isGenerating = false;
  let toastTimeout = null;

  // --------------------------------------------------------------------------
  // 3. Prompt Validation & Character Counter
  // --------------------------------------------------------------------------
  const MAX_CHARS = 500;

  function updateCharacterCount() {
    const length = promptInput.value.length;
    charCounter.textContent = `${length} / ${MAX_CHARS}`;

    // Visual cues for character limit
    if (length > MAX_CHARS * 0.9) {
      charCounter.classList.add('limit-near');
      charCounter.classList.remove('limit-reached');
    } else if (length >= MAX_CHARS) {
      charCounter.classList.add('limit-reached');
      charCounter.classList.remove('limit-near');
    } else {
      charCounter.classList.remove('limit-near', 'limit-reached');
    }

    // Dismiss error if user types
    if (promptInput.value.trim().length > 0) {
      hideError();
    }
  }

  function showError(msg) {
    errorMessage.textContent = msg;
    errorBanner.classList.add('visible');
    promptWrapper.classList.add('input-error');

    // Remove shake animation class after it completes so it can re-trigger later
    setTimeout(() => {
      promptWrapper.classList.remove('input-error');
    }, 400);
  }

  function hideError() {
    errorBanner.classList.remove('visible');
    promptWrapper.classList.remove('input-error');
  }

  // --------------------------------------------------------------------------
  // 4. Interactive Presets
  // --------------------------------------------------------------------------
  presetChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const presetText = chip.getAttribute('data-prompt');
      if (presetText) {
        promptInput.value = presetText;
        updateCharacterCount();
        promptInput.focus();
        showToast('Preset prompt applied');
      }
    });
  });

  // Clear prompt button
  if (btnClearPrompt) {
    btnClearPrompt.addEventListener('click', () => {
      promptInput.value = '';
      updateCharacterCount();
      hideError();
      promptInput.focus();
    });
  }

  // --------------------------------------------------------------------------
  // 5. Aspect Ratio Controls
  // --------------------------------------------------------------------------
  function applyAspectRatio() {
    const ratio = aspectSelect.value;
    if (ratio === '16:9') {
      previewDisplayBox.style.aspectRatio = '16 / 9';
      metaResolution.textContent = '1344 × 768';
    } else if (ratio === '9:16') {
      previewDisplayBox.style.aspectRatio = '9 / 16';
      metaResolution.textContent = '768 × 1344';
    } else {
      previewDisplayBox.style.aspectRatio = '1 / 1';
      metaResolution.textContent = '1024 × 1024';
    }
  }

  aspectSelect.addEventListener('change', applyAspectRatio);

  // --------------------------------------------------------------------------
  // 6. Intelligent Mock Image Selector
  // --------------------------------------------------------------------------
  function selectMockImage(promptText) {
    const lowerPrompt = promptText.toLowerCase();

    // Score each mock image based on matching keywords
    let bestMatch = mockImages[0];
    let maxMatches = 0;

    mockImages.forEach(item => {
      let matches = 0;
      item.keywords.forEach(keyword => {
        if (lowerPrompt.includes(keyword)) {
          matches++;
        }
      });
      if (matches > maxMatches) {
        maxMatches = matches;
        bestMatch = item;
      }
    });

    // If no strong keyword match, pick randomly or alternately
    if (maxMatches === 0) {
      const randomIndex = Math.floor(Math.random() * mockImages.length);
      return mockImages[randomIndex];
    }

    return bestMatch;
  }

  // --------------------------------------------------------------------------
  // 7. Core Generation Flow (Mock AI Synthesis)
  // --------------------------------------------------------------------------
  function generateImage() {
    const promptText = promptInput.value.trim();

    // 1. Validation: Prompt cannot be empty
    if (!promptText) {
      showError('Please describe the image you want to create before clicking Generate.');
      promptInput.focus();
      return;
    }

    if (isGenerating) return;

    // 2. Set State to Generating
    isGenerating = true;
    hideError();
    btnGenerate.disabled = true;
    promptInput.disabled = true;
    btnGenerateText.textContent = 'Generating...';

    // 3. UI State Transitions
    emptyState.style.display = 'none';
    imageResultContainer.classList.remove('visible');
    previewMetaPanel.classList.remove('visible');
    loadingState.classList.add('visible');
    previewDisplayBox.classList.remove('has-image');

    // 4. Realistic Multi-Stage Status Updates
    const statusSequence = [
      { text: 'Analyzing text prompt and tokens...', delay: 0 },
      { text: 'Composing geometric perspective & lighting...', delay: 650 },
      { text: 'Refining high-frequency texture synthesis...', delay: 1300 }
    ];

    statusSequence.forEach(stage => {
      setTimeout(() => {
        if (isGenerating) {
          loadingSubtext.textContent = stage.text;
        }
      }, stage.delay);
    });

    const startTime = performance.now();

    // 5. Complete Generation after realistic duration (~1.9s)
    setTimeout(() => {
      const selected = selectMockImage(promptText);
      currentImageUrl = selected.url;

      // Update image source
      generatedImage.src = selected.url;
      generatedImage.alt = promptText;

      generatedImage.onload = () => {
        const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);

        // Hide loading, show image
        loadingState.classList.remove('visible');
        imageResultContainer.classList.add('visible');
        previewDisplayBox.classList.add('has-image');
        previewMetaPanel.classList.add('visible');

        // Update metadata details
        metaStyle.textContent = styleSelect.options[styleSelect.selectedIndex].text;
        metaDuration.textContent = `${elapsed}s`;

        // Update download button
        btnDownload.href = selected.url;
        btnDownload.setAttribute('download', `text-to-image-mmm-${Date.now()}.jpg`);

        // Reset generate button
        isGenerating = false;
        btnGenerate.disabled = false;
        promptInput.disabled = false;
        btnGenerateText.textContent = 'Generate Image';

        showToast('Image generated successfully');
      };

      generatedImage.onerror = () => {
        // Fallback safety if local path is unavailable
        loadingState.classList.remove('visible');
        emptyState.style.display = 'flex';
        showError('Unable to load mock preview image. Please check asset path.');
        isGenerating = false;
        btnGenerate.disabled = false;
        promptInput.disabled = false;
        btnGenerateText.textContent = 'Generate Image';
      };

    }, 1900);
  }

  // --------------------------------------------------------------------------
  // 8. Event Listeners for Generation
  // --------------------------------------------------------------------------
  btnGenerate.addEventListener('click', generateImage);

  // Support Ctrl+Enter / Cmd+Enter to quickly submit prompt
  promptInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      generateImage();
    }
  });

  promptInput.addEventListener('input', updateCharacterCount);

  // --------------------------------------------------------------------------
  // 9. Download Functionality
  // --------------------------------------------------------------------------
  btnDownload.addEventListener('click', (e) => {
    if (!currentImageUrl) {
      e.preventDefault();
      return;
    }
    showToast('Download initiated');
  });

  // --------------------------------------------------------------------------
  // 10. Copy Prompt Functionality
  // --------------------------------------------------------------------------
  if (btnCopyPrompt) {
    btnCopyPrompt.addEventListener('click', async () => {
      const text = promptInput.value.trim();
      if (!text) {
        showToast('No prompt to copy');
        return;
      }

      try {
        await navigator.clipboard.writeText(text);
        showToast('Prompt copied to clipboard');
      } catch (err) {
        // Fallback for older browsers
        const tempTextarea = document.createElement('textarea');
        tempTextarea.value = text;
        document.body.appendChild(tempTextarea);
        tempTextarea.select();
        document.execCommand('copy');
        document.body.removeChild(tempTextarea);
        showToast('Prompt copied to clipboard');
      }
    });
  }

  // --------------------------------------------------------------------------
  // 11. Image Zoom / Lightbox Modal
  // --------------------------------------------------------------------------
  function openModal() {
    if (!currentImageUrl) return;
    modalImage.src = currentImageUrl;
    modalCaption.textContent = promptInput.value.trim() || 'Generated AI Image';
    modalOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modalOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  if (btnZoom) {
    btnZoom.addEventListener('click', openModal);
  }

  if (generatedImage) {
    generatedImage.addEventListener('click', openModal);
  }

  if (btnCloseModal) {
    btnCloseModal.addEventListener('click', closeModal);
  }

  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay.classList.contains('open')) {
      closeModal();
    }
  });

  // --------------------------------------------------------------------------
  // 12. Toast Feedback Notification
  // --------------------------------------------------------------------------
  function showToast(message) {
    if (!toast) return;
    toastMessage.textContent = message;
    toast.classList.add('show');

    if (toastTimeout) {
      clearTimeout(toastTimeout);
    }

    toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }

  // Initialize display
  updateCharacterCount();
  applyAspectRatio();
});
