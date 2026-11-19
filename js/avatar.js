/* ============ ✂️ Avatar cropper (circle) — the usual rules of good profile-photo editors ============
 * - the photo ALWAYS covers the circle (no empty edges): minimum zoom = "cover", panning is clamped
 * - drag with finger / mouse, pinch / wheel / slider / ± to zoom (zoom keeps the point under the cursor in place)
 * - rotate 90°, reset, keyboard: arrows move, + / − zoom, Enter saves, Esc cancels
 * - output 512×512 JPEG (sharp on retina), EXIF orientation of phone photos respected by the browser
 */
(function () {
  const V = 280;   // circle size on screen
  const OUT = 512; // saved size

  const Avatar = {
    /** src: data URL / blob URL / image URL -> Promise<dataURL | null> */
    crop(src, title = '✂️ Выделите фото') {
      return new Promise(resolve => {
        let done = false;
        const m = UI.modal({
          title, cls: 'narrow crop-modal',
          onClose: () => { if (!done) resolve(null); },
          body: `<div class="crop-box" data-box tabindex="0" aria-label="Фото: двигайте и масштабируйте"><img data-img alt="" draggable="false"><div class="crop-mask"></div><div class="crop-grid"></div></div>
            <div class="row crop-tools"><button class="icon-btn sm" data-zout title="Уменьшить">−</button><input type="range" class="grow" min="1" max="5" step="0.01" value="1" data-zoom aria-label="Масштаб"><button class="icon-btn sm" data-zin title="Увеличить">+</button>
              <button class="icon-btn sm" data-rot title="Повернуть на 90°">⟳</button><button class="icon-btn sm" data-reset title="Сбросить">↺</button></div>
            <div class="small muted center">Двигайте фото пальцем или мышью · масштаб — щипком, колёсиком или ползунком</div>`,
          foot: '<button class="btn ghost" data-cancel>Отмена</button><button class="btn primary" data-ok>✓ Сохранить</button>',
        });
        const box = m.$('[data-box]'), img = m.$('[data-img]'), zoom = m.$('[data-zoom]');
        let W = 1, H = 1, z = 1, rot = 0, x = 0, y = 0;
        const dims = () => (rot % 180 ? [H, W] : [W, H]);      // size after rotation
        const cover = () => { const [w, h] = dims(); return V / Math.min(w, h); }; // scale at z = 1
        const clamp = () => {
          const [w, h] = dims(), s = cover() * z;
          const mx = Math.max(0, (w * s - V) / 2), my = Math.max(0, (h * s - V) / 2);
          x = U.clamp(x, -mx, mx); y = U.clamp(y, -my, my);
        };
        const apply = () => { clamp(); img.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px) rotate(${rot}deg) scale(${cover() * z})`; zoom.value = z; };
        const zoomTo = (nz, cx = 0, cy = 0) => { nz = U.clamp(nz, 1, 5); const k = nz / z; x = cx - (cx - x) * k; y = cy - (cy - y) * k; z = nz; apply(); };
        img.onload = () => { W = img.naturalWidth; H = img.naturalHeight; img.style.width = W + 'px'; img.style.height = H + 'px'; apply(); box.focus(); };
        img.onerror = () => { UI.toast('Не удалось открыть фото', 'bad'); m.close(); };
        if (/^https?:/.test(src)) img.crossOrigin = 'anonymous';
        img.src = src;
        // drag (one pointer) + pinch (two pointers)
        const pts = new Map(); let start = null;
        const rel = e => { const r = box.getBoundingClientRect(); return [e.clientX - r.left - V / 2, e.clientY - r.top - V / 2]; };
        box.addEventListener('pointerdown', e => { box.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); start = null; });
        box.addEventListener('pointermove', e => {
          if (!pts.has(e.pointerId)) return;
          const prev = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
          if (pts.size === 1) { x += e.clientX - prev[0]; y += e.clientY - prev[1]; apply(); return; }
          const [a, b] = [...pts.values()];
          const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
          if (!start) start = { d, z };
          const r = box.getBoundingClientRect();
          zoomTo(start.z * d / start.d, (a[0] + b[0]) / 2 - r.left - V / 2, (a[1] + b[1]) / 2 - r.top - V / 2);
        });
        const up = e => { pts.delete(e.pointerId); if (pts.size < 2) start = null; };
        box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
        box.addEventListener('wheel', e => { e.preventDefault(); const [cx, cy] = rel(e); zoomTo(z * (e.deltaY < 0 ? 1.08 : 0.92), cx, cy); }, { passive: false });
        box.addEventListener('dblclick', () => { z = 1; x = y = 0; apply(); });
        box.addEventListener('keydown', e => {
          const st = e.shiftKey ? 30 : 8;
          const map = { ArrowLeft: () => { x += st; }, ArrowRight: () => { x -= st; }, ArrowUp: () => { y += st; }, ArrowDown: () => { y -= st; }, '+': () => zoomTo(z * 1.1), '=': () => zoomTo(z * 1.1), '-': () => zoomTo(z / 1.1) };
          if (map[e.key]) { e.preventDefault(); map[e.key](); apply(); }
          if (e.key === 'Enter') { e.preventDefault(); m.$('[data-ok]').click(); }
        });
        zoom.oninput = () => zoomTo(+zoom.value);
        m.$('[data-zin]').onclick = () => zoomTo(z * 1.15);
        m.$('[data-zout]').onclick = () => zoomTo(z / 1.15);
        m.$('[data-rot]').onclick = () => { rot = (rot + 90) % 360; apply(); };
        m.$('[data-reset]').onclick = () => { z = 1; rot = 0; x = y = 0; apply(); };
        m.$('[data-cancel]').onclick = () => m.close();
        m.$('[data-ok]').onclick = () => {
          const c = document.createElement('canvas'); c.width = c.height = OUT;
          const ctx = c.getContext('2d');
          ctx.imageSmoothingQuality = 'high';
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, OUT, OUT);
          const k = OUT / V, s = cover() * z * k;
          ctx.translate(OUT / 2 + x * k, OUT / 2 + y * k);
          ctx.rotate(rot * Math.PI / 180);
          ctx.drawImage(img, -W * s / 2, -H * s / 2, W * s, H * s);
          let data;
          try { data = c.toDataURL('image/jpeg', 0.9); } catch (e) { UI.toast('Сайт запретил копировать это фото — сохраните его на устройство и выберите оттуда', 'bad', 7000); return; }
          done = true; m.close(); resolve(data);
        };
      });
    },
  };

  window.Avatar = Avatar;
})();
