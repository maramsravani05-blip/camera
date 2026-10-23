(() => {
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const captureBtn = document.getElementById('captureBtn');
  const switchBtn = document.getElementById('switchBtn');
  const startBtn = document.getElementById('startBtn');
  const messageEl = document.getElementById('message');
  const flashEl = document.getElementById('flash');
  const labelEl = document.getElementById('cameraLabel');
  const filtersEl = document.getElementById('filters');
  const galleryEl = document.getElementById('gallery');

  // Add or edit filters here. Values are standard CSS filter strings.
  const FILTERS = [
    { name: 'Normal',   css: 'none' },
    { name: 'B&W',      css: 'grayscale(1)' },
    { name: 'Noir',     css: 'grayscale(1) contrast(1.4) brightness(0.9)' },
    { name: 'Sepia',    css: 'sepia(1)' },
    { name: 'Vintage',  css: 'sepia(.5) contrast(1.1) saturate(1.3) hue-rotate(-10deg)' },
    { name: 'Warm',     css: 'sepia(.25) saturate(1.4) brightness(1.05)' },
    { name: 'Cool',     css: 'hue-rotate(180deg) saturate(1.1) brightness(1.05)' },
    { name: 'Vivid',    css: 'saturate(1.8) contrast(1.1)' },
    { name: 'Fade',     css: 'contrast(.85) brightness(1.15) saturate(.8)' },
    { name: 'Dreamy',   css: 'blur(1.5px) brightness(1.1) saturate(1.3)' },
    { name: 'Invert',   css: 'invert(1)' },
    { name: 'Purple',   css: 'hue-rotate(250deg) saturate(1.5)' },
  ];

  let stream = null;
  let facingMode = 'user';      // 'user' = front, 'environment' = back
  let currentFilter = FILTERS[0];

  // ---------- UI helpers ----------
  function showMessage(text) {
    messageEl.textContent = text;
    messageEl.hidden = false;
  }
  function hideMessage() { messageEl.hidden = true; }

  function buildFilterChips() {
    FILTERS.forEach((f, i) => {
      const b = document.createElement('button');
      b.className = 'filter-chip' + (i === 0 ? ' active' : '');
      b.textContent = f.name;
      b.addEventListener('click', () => {
        currentFilter = f;
        video.style.filter = f.css;
        filtersEl.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        b.classList.add('active');
      });
      filtersEl.appendChild(b);
    });
  }

  // ---------- Camera ----------
  function stopStream() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
  }

  async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showMessage('Camera is not supported here. Open this page over HTTPS (or localhost) in a modern browser.');
      return;
    }

    stopStream();
    startBtn.hidden = true;
    labelEl.textContent = 'Starting…';

    const constraints = {
      audio: false,
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    };

    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = stream;
      await video.play().catch(() => {});
      hideMessage();

      // Check which camera we actually got (desktop webcams ignore facingMode).
      const settings = stream.getVideoTracks()[0].getSettings();
      const actual = settings.facingMode || facingMode;
      const isFront = actual === 'user';
      video.classList.toggle('mirror', isFront);   // mirror the selfie preview only
      labelEl.textContent = isFront ? 'Front camera' : 'Back camera';
      video.dataset.front = isFront ? '1' : '0';

      // Hide switch button if there is only one camera.
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter(d => d.kind === 'videoinput');
      switchBtn.style.display = cams.length > 1 ? '' : 'none';
    } catch (err) {
      console.error(err);
      startBtn.hidden = false;
      switch (err.name) {
        case 'NotAllowedError':
        case 'SecurityError':
          showMessage('Camera permission was denied. Allow camera access in your browser settings, then tap "Enable camera".');
          break;
        case 'NotFoundError':
        case 'OverconstrainedError':
          showMessage('No matching camera was found on this device.');
          break;
        case 'NotReadableError':
          showMessage('The camera is being used by another app. Close it and try again.');
          break;
        default:
          showMessage('Could not start the camera: ' + err.message);
      }
      labelEl.textContent = 'Camera off';
    }
  }

  function switchCamera() {
    facingMode = facingMode === 'user' ? 'environment' : 'user';
    startCamera();
  }

  // ---------- Capture ----------
  function capture() {
    if (!stream || !video.videoWidth) return;

    const w = video.videoWidth;
    const h = video.videoHeight;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    ctx.save();
    // Apply the selected filter (ctx.filter is supported in Chrome, Edge, Firefox;
    // Safari/iOS may ignore it and save the photo without the filter).
    ctx.filter = currentFilter.css;

    // Match the mirrored selfie preview.
    if (video.dataset.front === '1') {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();

    // Flash effect
    flashEl.classList.remove('go');
    void flashEl.offsetWidth;
    flashEl.classList.add('go');

    canvas.toBlob(blob => {
      if (!blob) return;
      addToGallery(URL.createObjectURL(blob));
    }, 'image/jpeg', 0.92);
  }

  function addToGallery(url) {
    const wrap = document.createElement('div');
    wrap.className = 'shot';

    const img = document.createElement('img');
    img.src = url;
    img.alt = 'Captured photo';

    const dl = document.createElement('a');
    dl.href = url;
    dl.download = `photo-${Date.now()}.jpg`;
    dl.textContent = 'Save';

    wrap.append(img, dl);
    galleryEl.prepend(wrap);
  }

  // ---------- Init ----------
  buildFilterChips();
  captureBtn.addEventListener('click', capture);
  switchBtn.addEventListener('click', switchCamera);
  startBtn.addEventListener('click', startCamera);

  // Release the camera when the tab is hidden, restart when it returns.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopStream();
    else if (!stream) startCamera();
  });

  startCamera();
})();
