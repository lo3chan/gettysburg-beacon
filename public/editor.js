const editorState = {
  panels: [],
  feeds: [],
  feedStatus: {},
  dragIndex: null,
  dirty: false,
};

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setStatus(msg, isError = false) {
  const el = document.getElementById('save-status');
  el.textContent = msg;
  el.className = `text-[11px] mr-1 font-bold ${isError ? 'text-red-800' : 'text-[#4d4235]'}`;
}

function badgeClasses(color) {
  if (color === 'red') return 'bg-[#f0c2ba] text-[#69241b] border-[#dc9f95]';
  if (color === 'green') return 'bg-[#c2eecf] text-[#185e33] border-[#a2d8b1]';
  if (color === 'kraft') return 'bg-[#dec6a4] text-[#3a2814] border-[#b4966e]';
  return 'bg-[#f5dfa0] text-[#593e0c] border-[#d6b96c]';
}

function colSpanClass(span) {
  if (Number(span) === 3) return 'md:col-span-2 lg:col-span-3';
  if (Number(span) === 2) return 'md:col-span-2 lg:col-span-2';
  return 'col-span-1';
}

function renderPanels() {
  const grid = document.getElementById('panels-grid');
  grid.innerHTML = editorState.panels
    .map((p, idx) => {
      const backingClass = p.backing === 'parchment' ? 'tex-parchment border-[#a48663]' : 'tex-lined border-[#d3caa8]';
      const catFeeds = editorState.feeds.filter((f) => f.category === p.category);
      const selectedFeeds = new Set(p.feedIds || []);

      return `
        <div class="panel-card relative ${colSpanClass(p.colSpan)} transition-all duration-150"
             draggable="true" data-panel-idx="${idx}">
          <!-- Pinned Tab Preview -->
          <div class="flex items-center justify-between pr-2">
            <div class="inline-flex items-center space-x-2 tex-parchment border-[1.5px] border-[#2a231b] px-2.5 py-1 text-xs font-mono font-bold ml-1 relative z-10 paper-tab-shadow cursor-grab active:cursor-grabbing">
              <span class="text-[#6a5a47] select-none">&#8942;&#8942;</span>
              <span class="tracking-wide">${esc(p.title)}</span>
              <span class="${badgeClasses(p.badgeColor)} text-[10px] font-sans font-bold px-1.5 py-0.2 rounded-sm border uppercase">${esc(p.badge)}</span>
              <span class="border border-[#2a231b] px-1 py-0 text-[10px]">${Number(p.windowSize)}</span>
            </div>
            <div class="relative z-10 flex items-center gap-1 font-mono text-[10px]">
              <button type="button" data-move="${idx}:-1" ${idx === 0 ? 'disabled' : ''} class="tex-parchment border border-[#2a231b] px-1.5 py-0.5 disabled:opacity-40 cursor-pointer" title="Move Left/Up">&larr;</button>
              <button type="button" data-move="${idx}:1" ${idx === editorState.panels.length - 1 ? 'disabled' : ''} class="tex-parchment border border-[#2a231b] px-1.5 py-0.5 disabled:opacity-40 cursor-pointer" title="Move Right/Down">&rarr;</button>
            </div>
          </div>

          <!-- Panel Config Card -->
          <div class="${backingClass} border p-3.5 -mt-2.5 paper-shadow rounded-sm font-mono text-xs space-y-3 pt-4">
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-[10px] font-bold uppercase text-[#4d4235]">Title</label>
                <input type="text" data-field="title" data-idx="${idx}" value="${esc(p.title)}" class="w-full border-[#8a7962] bg-white/75 text-xs px-2 py-1" />
              </div>
              <div>
                <label class="block text-[10px] font-bold uppercase text-[#4d4235]">Badge</label>
                <input type="text" data-field="badge" data-idx="${idx}" value="${esc(p.badge)}" class="w-full border-[#8a7962] bg-white/75 text-xs px-2 py-1" />
              </div>
            </div>

            <div class="grid grid-cols-3 gap-2">
              <div>
                <label class="block text-[10px] font-bold uppercase text-[#4d4235]">Category</label>
                <select data-field="category" data-idx="${idx}" class="w-full border-[#8a7962] bg-white/75 text-xs px-1.5 py-1">
                  <option value="youtube" ${p.category === 'youtube' ? 'selected' : ''}>YouTube</option>
                  <option value="audio" ${p.category === 'audio' ? 'selected' : ''}>Audio</option>
                  <option value="text" ${p.category === 'text' ? 'selected' : ''}>Text</option>
                </select>
              </div>
              <div>
                <label class="block text-[10px] font-bold uppercase text-[#4d4235]">Backing</label>
                <select data-field="backing" data-idx="${idx}" class="w-full border-[#8a7962] bg-white/75 text-xs px-1.5 py-1">
                  <option value="parchment" ${p.backing === 'parchment' ? 'selected' : ''}>Parchment</option>
                  <option value="lined" ${p.backing === 'lined' ? 'selected' : ''}>Lined</option>
                </select>
              </div>
              <div>
                <label class="block text-[10px] font-bold uppercase text-[#4d4235]">Badge Color</label>
                <select data-field="badgeColor" data-idx="${idx}" class="w-full border-[#8a7962] bg-white/75 text-xs px-1.5 py-1">
                  <option value="red" ${p.badgeColor === 'red' ? 'selected' : ''}>Coral</option>
                  <option value="green" ${p.badgeColor === 'green' ? 'selected' : ''}>Mint</option>
                  <option value="amber" ${p.badgeColor === 'amber' ? 'selected' : ''}>Amber</option>
                  <option value="kraft" ${p.badgeColor === 'kraft' ? 'selected' : ''}>Kraft</option>
                </select>
              </div>
            </div>

            <!-- Rolling Window Slider -->
            <div class="border-t border-[#cfc8b0]/80 pt-2">
              <div class="flex items-center justify-between mb-1">
                <label class="text-[10px] font-bold uppercase text-[#4d4235]">Rolling Window</label>
                <span class="font-bold text-[11px]">Show latest <span class="underline">${Number(p.windowSize)}</span> items</span>
              </div>
              <div class="flex items-center gap-2">
                <input type="range" min="1" max="25" value="${Number(p.windowSize)}" data-field="windowSize" data-idx="${idx}" class="flex-1 accent-[#1e1c19]" />
                <input type="number" min="1" max="30" value="${Number(p.windowSize)}" data-field="windowSize" data-idx="${idx}" class="w-14 border-[#8a7962] bg-white/80 text-xs px-1.5 py-0.5 text-center" />
              </div>
            </div>

            <!-- Snap Column Width -->
            <div class="flex items-center justify-between border-t border-[#cfc8b0]/80 pt-2">
              <span class="text-[10px] font-bold uppercase text-[#4d4235]">Desktop Snap Width</span>
              <div class="inline-flex border border-[#2a231b]">
                ${[1, 2, 3]
                  .map(
                    (c) => `
                  <button type="button" data-colspan="${idx}:${c}"
                    class="px-2 py-0.5 text-[10px] font-bold cursor-pointer ${
                      Number(p.colSpan) === c ? 'bg-[#1e1c19] text-[#f4ecd8]' : 'bg-white/70 hover:bg-white'
                    }">
                    ${c} Col${c > 1 ? 's' : ''}
                  </button>`
                  )
                  .join('')}
              </div>
            </div>

            <!-- Feed Source Filter -->
            ${
              catFeeds.length
                ? `<div class="border-t border-[#cfc8b0]/80 pt-2">
                    <div class="text-[10px] font-bold uppercase text-[#4d4235] mb-1">Sources (leave all unchecked = all ${esc(p.category)})</div>
                    <div class="flex flex-wrap gap-1.5">
                      ${catFeeds
                        .map(
                          (f) => `
                        <label class="inline-flex items-center gap-1 border border-[#8a7962] bg-white/60 px-1.5 py-0.5 text-[10px] cursor-pointer">
                          <input type="checkbox" data-panel-feed="${idx}:${esc(f.id)}" ${selectedFeeds.has(f.id) ? 'checked' : ''} class="w-3 h-3 text-[#1e1c19]" />
                          <span>${esc(f.title)}</span>
                        </label>`
                        )
                        .join('')}
                    </div>
                  </div>`
                : ''
            }

            <div class="flex justify-end pt-1">
              <button type="button" data-delete-panel="${idx}" class="text-[10px] text-red-900 hover:underline font-bold cursor-pointer">
                Remove Panel
              </button>
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  attachDragHandlers();
}

function renderFeeds() {
  const list = document.getElementById('feeds-list');
  document.getElementById('feeds-count-badge').textContent = editorState.feeds.length;
  const totalItems = Object.values(editorState.feedStatus).reduce((sum, s) => sum + (s.count || 0), 0);
  document.getElementById('feed-summary').textContent = `${editorState.panels.length} panels • ${editorState.feeds.length} feeds • ${totalItems} cached items`;

  if (!editorState.feeds.length) {
    list.innerHTML = '<div class="text-[#4d4235] py-2">No RSS feeds configured yet.</div>';
    return;
  }

  list.innerHTML = editorState.feeds
    .map((f, idx) => {
      const st = editorState.feedStatus[f.id];
      const badge = st
        ? st.ok
          ? `<span class="bg-[#c2eecf] text-[#185e33] border border-[#a2d8b1] px-1.5 py-0 text-[10px]">OK (${st.count})</span>`
          : `<span class="bg-[#f0c2ba] text-[#69241b] border border-[#dc9f95] px-1.5 py-0 text-[10px]" title="${esc(st.error)}">ERR</span>`
        : '';

      return `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#cfc8b0]/80 pb-2">
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-bold text-[12px]">${esc(f.title)}</span>
              <span class="border border-[#8a7962] px-1 text-[10px] uppercase bg-white/60">${esc(f.category)}</span>
              ${badge}
            </div>
            <div class="text-[10px] text-[#4d4235] truncate">${esc(f.url)}</div>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <label class="inline-flex items-center gap-1 text-[10px] cursor-pointer">
              <input type="checkbox" data-toggle-feed="${idx}" ${f.enabled !== false ? 'checked' : ''} class="w-3.5 h-3.5 text-[#1e1c19]" />
              <span>Active</span>
            </label>
            <button type="button" data-delete-feed="${idx}" class="border border-[#69241b] text-[#69241b] px-1.5 py-0.5 text-[10px] hover:bg-[#f0c2ba]/40 cursor-pointer">
              Delete
            </button>
          </div>
        </div>
      `;
    })
    .join('');
}

function attachDragHandlers() {
  document.querySelectorAll('.panel-card').forEach((card) => {
    card.addEventListener('dragstart', (e) => {
      editorState.dragIndex = Number(card.dataset.panelIdx);
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      document.querySelectorAll('.panel-card').forEach((c) => c.classList.remove('drag-over'));
      editorState.dragIndex = null;
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      card.classList.add('drag-over');
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-over');
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-over');
      const targetIdx = Number(card.dataset.panelIdx);
      const fromIdx = editorState.dragIndex;
      if (fromIdx == null || fromIdx === targetIdx) return;

      const [moved] = editorState.panels.splice(fromIdx, 1);
      editorState.panels.splice(targetIdx, 0, moved);
      editorState.dirty = true;
      setStatus('Unsaved changes — click Save Board Layout');
      renderPanels();
    });
  });
}

async function saveLayout() {
  setStatus('Saving layout...');
  const res = await fetch('/api/editor/layout', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ panels: editorState.panels }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    setStatus(err.error || 'Save failed', true);
    return;
  }
  const data = await res.json();
  editorState.panels = data.panels;
  editorState.dirty = false;
  setStatus('Saved & live on gettysburgbeacon.com');
  renderPanels();
}

async function saveFeeds() {
  setStatus('Saving feeds & refreshing...');
  const res = await fetch('/api/editor/feeds', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(editorState.feeds),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    setStatus(err.error || 'Feed save failed', true);
    return;
  }
  const data = await res.json();
  editorState.feeds = data.feeds;
  editorState.feedStatus = data.feedStatus || {};
  setStatus('Feeds updated');
  renderFeeds();
  renderPanels();
}

document.addEventListener('input', (e) => {
  const field = e.target.dataset.field;
  if (!field) return;
  const idx = Number(e.target.dataset.idx);
  const panel = editorState.panels[idx];
  if (!panel) return;

  if (field === 'windowSize') {
    panel.windowSize = Math.max(1, Math.min(30, Number(e.target.value) || 1));
    // Sync sibling range/number inputs without full re-render
    document.querySelectorAll(`[data-field="windowSize"][data-idx="${idx}"]`).forEach((el) => {
      if (el !== e.target) el.value = panel.windowSize;
    });
  } else {
    panel[field] = e.target.value;
    if (field === 'category') {
      panel.feedIds = [];
      renderPanels();
    }
  }
  editorState.dirty = true;
  setStatus('Unsaved changes — click Save Board Layout');
});

document.addEventListener('change', (e) => {
  const pf = e.target.dataset.panelFeed;
  if (pf) {
    const [idxStr, feedId] = pf.split(':');
    const panel = editorState.panels[Number(idxStr)];
    if (!panel) return;
    const set = new Set(panel.feedIds || []);
    if (e.target.checked) set.add(feedId);
    else set.delete(feedId);
    panel.feedIds = [...set];
    editorState.dirty = true;
    setStatus('Unsaved changes — click Save Board Layout');
    return;
  }

  const tf = e.target.dataset.toggleFeed;
  if (tf !== undefined) {
    const idx = Number(tf);
    editorState.feeds[idx].enabled = e.target.checked;
    saveFeeds();
  }
});

document.addEventListener('click', async (e) => {
  const moveBtn = e.target.closest('[data-move]');
  if (moveBtn) {
    const [idxStr, deltaStr] = moveBtn.dataset.move.split(':');
    const idx = Number(idxStr);
    const nextIdx = idx + Number(deltaStr);
    if (nextIdx >= 0 && nextIdx < editorState.panels.length) {
      const [moved] = editorState.panels.splice(idx, 1);
      editorState.panels.splice(nextIdx, 0, moved);
      editorState.dirty = true;
      setStatus('Unsaved changes — click Save Board Layout');
      renderPanels();
    }
    return;
  }

  const spanBtn = e.target.closest('[data-colspan]');
  if (spanBtn) {
    const [idxStr, colStr] = spanBtn.dataset.colspan.split(':');
    editorState.panels[Number(idxStr)].colSpan = Number(colStr);
    editorState.dirty = true;
    setStatus('Unsaved changes — click Save Board Layout');
    renderPanels();
    return;
  }

  const delPanelBtn = e.target.closest('[data-delete-panel]');
  if (delPanelBtn) {
    const idx = Number(delPanelBtn.dataset.deletePanel);
    editorState.panels.splice(idx, 1);
    editorState.dirty = true;
    setStatus('Unsaved changes — click Save Board Layout');
    renderPanels();
    return;
  }

  const delFeedBtn = e.target.closest('[data-delete-feed]');
  if (delFeedBtn) {
    const idx = Number(delFeedBtn.dataset.deleteFeed);
    editorState.feeds.splice(idx, 1);
    await saveFeeds();
  }
});

document.getElementById('btn-save-layout').addEventListener('click', saveLayout);

document.getElementById('btn-refresh-feeds').addEventListener('click', async () => {
  setStatus('Refreshing RSS feeds...');
  const res = await fetch('/api/editor/refresh', { method: 'POST' });
  if (res.ok) {
    const data = await res.json();
    editorState.feedStatus = data.feedStatus || {};
    setStatus(`Refreshed (${data.count} items)`);
    renderFeeds();
  } else {
    setStatus('Refresh failed', true);
  }
});

document.getElementById('form-add-panel').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  editorState.panels.push({
    id: `panel-${Date.now()}`,
    title: String(fd.get('title')).trim().toUpperCase(),
    badge: String(fd.get('badge')).trim().toUpperCase(),
    badgeColor: String(fd.get('badgeColor')),
    category: String(fd.get('category')),
    backing: String(fd.get('backing')),
    order: editorState.panels.length,
    colSpan: Number(fd.get('colSpan')) || 1,
    windowSize: Number(fd.get('windowSize')) || 6,
    feedIds: [],
  });
  e.target.reset();
  renderPanels();
  await saveLayout();
});

document.getElementById('form-add-feed').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const url = String(fd.get('url')).trim();
  editorState.feeds.push({
    id: `feed-${Date.now()}`,
    title: String(fd.get('title')).trim(),
    category: String(fd.get('category')),
    url,
    siteUrl: String(fd.get('siteUrl') || '').trim() || url,
    enabled: true,
  });
  e.target.reset();
  await saveFeeds();
});

async function init() {
  setStatus('Loading board...');
  const res = await fetch('/api/editor/state');
  if (!res.ok) {
    setStatus('Failed to load editor state', true);
    return;
  }
  const data = await res.json();
  editorState.panels = data.layout?.panels || [];
  editorState.feeds = data.feeds || [];
  editorState.feedStatus = data.feedStatus || {};
  setStatus('Ready');
  renderPanels();
  renderFeeds();
}

init();
