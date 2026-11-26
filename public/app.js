const state = {
  tab: 'feed',
  feedFilter: 'all',
  dispatchFilter: 'all',
  feeds: { items: [], sources: [], updatedAt: null },
  dispatches: [],
  about: null,
  activeAudioId: null,
};

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatStamp(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function updateNavUI() {
  document.querySelectorAll('.mobile-nav-tab').forEach((btn) => {
    const isActive = btn.dataset.tab === state.tab;
    btn.classList.toggle('text-[#e9ded0]', isActive);
    btn.classList.toggle('font-bold', isActive);
    const glow = btn.querySelector('.nav-glow');
    if (glow) glow.classList.toggle('hidden', !isActive);
  });

  document.querySelectorAll('.desktop-nav-tab').forEach((btn) => {
    const isActive = btn.dataset.tab === state.tab;
    btn.classList.toggle('active', isActive);
  });
}

function renderSubnav() {
  const nav = document.getElementById('subnav');
  if (state.tab === 'feed') {
    const tabs = [
      { id: 'all', label: 'All' },
      { id: 'youtube', label: 'YouTube' },
      { id: 'text', label: 'Text' },
      { id: 'audio', label: 'Audio' },
    ];
    nav.innerHTML = `
      <div class="grid grid-cols-4 md:inline-grid md:grid-cols-4 gap-1.5 md:gap-2 font-mono text-center text-sm font-semibold md:w-auto">
        ${tabs
          .map(
            (t) => `
          <button type="button" data-feed-filter="${t.id}"
            class="filter-btn tex-kraft border-[1.5px] border-[#221c16] py-1 md:px-5 rounded-[1px] shadow-sm cursor-pointer ${
              state.feedFilter === t.id ? 'active' : ''
            }">
            ${t.label}
          </button>`
          )
          .join('')}
      </div>
    `;
    nav.classList.remove('hidden');
  } else if (state.tab === 'dispatch') {
    const tabs = [
      { id: 'all', label: 'All' },
      { id: 'review', label: 'Reviews' },
      { id: 'post', label: 'Posts' },
      { id: 'micro', label: 'Notes' },
    ];
    nav.innerHTML = `
      <div class="grid grid-cols-4 md:inline-grid md:grid-cols-4 gap-1.5 md:gap-2 font-mono text-center text-sm font-semibold md:w-auto">
        ${tabs
          .map(
            (t) => `
          <button type="button" data-dispatch-filter="${t.id}"
            class="filter-btn tex-kraft border-[1.5px] border-[#221c16] py-1 md:px-5 rounded-[1px] shadow-sm cursor-pointer ${
              state.dispatchFilter === t.id ? 'active' : ''
            }">
            ${t.label}
          </button>`
          )
          .join('')}
      </div>
    `;
    nav.classList.remove('hidden');
  } else {
    nav.innerHTML = '';
    nav.classList.add('hidden');
  }
}

function renderYouTubeSection(items, expanded = false) {
  if (!items.length) return '';
  const gridClass = expanded
    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1'
    : 'space-y-4 pt-1';

  return `
    <section class="relative" data-purpose="youtube-feed-group">
      <div class="inline-flex items-center space-x-2 tex-parchment border-[1.5px] border-[#2a231b] px-2.5 py-1 text-xs font-mono font-bold ml-1 relative z-10 paper-tab-shadow">
        <span class="tracking-wide">YOUTUBE</span>
        <span class="bg-[#f0c2ba] text-[#69241b] text-[10px] font-sans font-bold px-1.5 py-0.2 rounded-sm border border-[#dc9f95] uppercase">
          VIDEO
        </span>
        <span class="border border-[#2a231b] px-1 py-0 text-[10px]">${items.length}</span>
      </div>
      <div class="tex-parchment border border-[#a48663] p-3 md:p-4 -mt-2.5 paper-shadow rounded-sm relative">
        <div class="${gridClass}">
          ${items
            .map(
              (item) => `
            <article class="relative">
              <div class="w-full aspect-video rounded-sm overflow-hidden border border-black/20 shadow-lg bg-[#0a0a0c] relative">
                <div class="relative w-full h-full cursor-pointer group overflow-hidden" data-yt-id="${esc(item.videoId)}" data-yt-url="${esc(item.url)}">
                  ${
                    item.thumbnailUrl
                      ? `<img src="${esc(item.thumbnailUrl)}" alt="${esc(item.title)}" loading="lazy" class="object-cover w-full h-full transform transition-transform duration-500 group-hover:scale-105 opacity-90" />`
                      : ''
                  }
                  <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30 pointer-events-none"></div>
                  <div class="absolute inset-0 flex items-center justify-center">
                    <div class="w-12 h-12 rounded-[2px] bg-black/60 backdrop-blur-md border border-white/25 text-white flex items-center justify-center shadow-lg group-hover:bg-amber-400 group-hover:text-black group-hover:border-amber-300 transition-all duration-300">
                      <svg class="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24"><polygon points="6 3 20 12 6 21"></polygon></svg>
                    </div>
                  </div>
                  <div class="absolute inset-x-2 bottom-2 px-2.5 py-1.5 rounded-[2px] bg-black/75 backdrop-blur-md border border-white/10 flex items-center space-x-2.5">
                    <span class="text-white flex-shrink-0"><svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><polygon points="6 3 20 12 6 21"></polygon></svg></span>
                    <div class="flex-1 bg-white/20 h-[2px] relative flex items-center">
                      <div class="w-1/4 bg-white h-full relative">
                        <div class="absolute -right-1 -top-[3px] w-2 h-2 bg-white rounded-[1px] shadow-sm"></div>
                      </div>
                    </div>
                    <span class="text-[10px] font-mono font-bold text-white/90 tracking-wider tabular-nums flex-shrink-0">YT</span>
                  </div>
                </div>
              </div>
              <div class="mt-1.5 flex items-baseline justify-between gap-2 font-mono text-[11px] leading-snug text-[#1e1c19]">
                <a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer" class="hover:underline">
                  <span class="font-bold">${esc(item.source)}</span> &mdash; <span class="italic">&ldquo;${esc(item.title)}&rdquo;</span>
                </a>
                <span class="text-[10px] text-[#4d4235] whitespace-nowrap flex-shrink-0">${esc(formatStamp(item.publishedAt))}</span>
              </div>
            </article>`
            )
            .join('')}
        </div>
      </div>
    </section>
  `;
}

function renderAudioSection(items, expanded = false) {
  if (!items.length) return '';
  const listClass = expanded
    ? 'grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 font-mono text-xs'
    : 'space-y-3.5 pt-1 font-mono text-xs';

  return `
    <section class="relative pt-1 lg:pt-0" data-purpose="audio-podcasts-section">
      <div class="inline-flex items-center space-x-2 tex-parchment border-[1.5px] border-[#2a231b] px-2.5 py-1 text-xs font-mono font-bold ml-1 relative z-10 paper-tab-shadow">
        <span class="tracking-wide">AUDIO</span>
        <span class="bg-[#c2eecf] text-[#185e33] text-[10px] font-sans font-bold px-1.5 py-0.2 rounded-sm border border-[#a2d8b1] uppercase">
          PODCASTS
        </span>
        <span class="border border-[#2a231b] px-1 py-0 text-[10px]">${items.length}</span>
      </div>
      <div class="tex-lined border border-[#d3caa8] p-3.5 -mt-2.5 paper-shadow rounded-sm relative text-[#201c17]">
        <div class="${listClass}">
          ${items
            .map((item, idx) => {
              const isPlaying = state.activeAudioId === item.id;
              return `
              ${!expanded && idx > 0 ? '<div class="border-b border-[#cfc8b0]/80"></div>' : ''}
              <article class="space-y-2 ${expanded ? 'border-b border-[#cfc8b0]/70 pb-3' : ''}">
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-start space-x-2 min-w-0">
                    <svg class="w-5 h-5 mt-0.5 flex-shrink-0 text-[#251e17]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
                      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
                    </svg>
                    <div class="min-w-0">
                      <div class="font-bold text-[13px] leading-tight">${esc(item.source)} &mdash;</div>
                      <a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer" class="italic text-[11px] text-[#2f271f] font-medium leading-tight hover:underline block">
                        &ldquo;${esc(item.title)}&rdquo;
                      </a>
                      <div class="text-[10px] text-[#4d4235] mt-1">${esc(formatStamp(item.publishedAt))}</div>
                    </div>
                  </div>
                  <div class="flex flex-col items-end flex-shrink-0">
                    ${
                      item.audioUrl
                        ? `<button type="button" data-audio-toggle="${esc(item.id)}"
                            class="border border-[#221c17] px-2 py-0.5 text-xs font-mono font-bold flex items-center space-x-1 bg-[#f9f5e6]/80 hover:bg-white shadow-sm cursor-pointer">
                            <span>${isPlaying ? '&#9632;' : '&#9654;'}</span>
                            <span>${esc(item.duration || 'PLAY')}</span>
                          </button>`
                        : `<a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer"
                            class="border border-[#221c17] px-2 py-0.5 text-xs font-mono font-bold bg-[#f9f5e6]/80 hover:bg-white shadow-sm">
                            OPEN
                          </a>`
                    }
                    <span class="text-[10px] text-[#4d4235] mt-1">${esc(formatStamp(item.publishedAt))}</span>
                  </div>
                </div>
                ${
                  isPlaying && item.audioUrl
                    ? `<audio controls autoplay class="w-full h-8 mt-1" src="${esc(item.audioUrl)}"></audio>`
                    : ''
                }
              </article>`;
            })
            .join('')}
        </div>
      </div>
    </section>
  `;
}

function renderTextSection(items, expanded = false) {
  if (!items.length) return '';
  const listClass = expanded
    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1 font-mono text-xs'
    : 'space-y-3.5 pt-1 font-mono text-xs';

  return `
    <section class="relative pt-1" data-purpose="text-articles-section">
      <div class="inline-flex items-center space-x-2 tex-parchment border-[1.5px] border-[#2a231b] px-2.5 py-1 text-xs font-mono font-bold ml-1 relative z-10 paper-tab-shadow">
        <span class="tracking-wide">TEXT</span>
        <span class="bg-[#f5dfa0] text-[#593e0c] text-[10px] font-sans font-bold px-1.5 py-0.2 rounded-sm border border-[#d6b96c] uppercase">
          ARTICLES
        </span>
        <span class="border border-[#2a231b] px-1 py-0 text-[10px]">${items.length}</span>
      </div>
      <div class="tex-lined border border-[#d3caa8] p-3.5 -mt-2.5 paper-shadow rounded-sm relative text-[#201c17]">
        <div class="${listClass}">
          ${items
            .map(
              (item, idx) => `
            ${!expanded && idx > 0 ? '<div class="border-b border-[#cfc8b0]/80"></div>' : ''}
            <article class="space-y-1 ${expanded ? 'border-b border-[#cfc8b0]/70 pb-3' : ''}">
              <div class="flex items-baseline justify-between gap-2">
                <span class="font-bold text-[12px] text-[#251e17]">${esc(item.source)}</span>
                <span class="text-[10px] text-[#4d4235] flex-shrink-0">${esc(formatStamp(item.publishedAt))}</span>
              </div>
              <a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer" class="block font-bold text-[13px] leading-snug text-[#1a1612] hover:underline">
                &ldquo;${esc(item.title)}&rdquo;
              </a>
              ${
                item.excerpt
                  ? `<p class="text-[11px] leading-relaxed text-[#3d342a]">${esc(item.excerpt)}${item.excerpt.length >= 235 ? '...' : ''}</p>`
                  : ''
              }
            </article>`
            )
            .join('')}
        </div>
      </div>
    </section>
  `;
}

function renderFeedTab() {
  const all = state.feeds.items || [];
  const yt = all.filter((i) => i.category === 'youtube');
  const text = all.filter((i) => i.category === 'text');
  const audio = all.filter((i) => i.category === 'audio');

  let html = '';
  if (state.feedFilter === 'all') {
    const ytHtml = renderYouTubeSection(yt, false);
    const audioHtml = renderAudioSection(audio, false);
    const textHtml = renderTextSection(text, false);
    if (ytHtml || audioHtml || textHtml) {
      html = `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
          ${ytHtml ? `<div>${ytHtml}</div>` : ''}
          ${audioHtml ? `<div>${audioHtml}</div>` : ''}
          ${textHtml ? `<div>${textHtml}</div>` : ''}
        </div>
      `;
    }
  } else if (state.feedFilter === 'youtube') {
    html = renderYouTubeSection(yt, true);
  } else if (state.feedFilter === 'audio') {
    html = renderAudioSection(audio, true);
  } else if (state.feedFilter === 'text') {
    html = renderTextSection(text, true);
  }

  if (!html) {
    html = `
      <div class="tex-parchment border border-[#a48663] p-4 paper-shadow rounded-sm font-mono text-xs text-center text-[#3c3328]">
        No items in this category yet.
      </div>`;
  }

  html += `
    <div class="md:hidden pt-1 pb-2 flex items-center justify-center gap-2 font-mono text-[10px]">
      <a href="/opml.xml" class="tex-parchment border border-[#2a231b] px-2 py-0.5 paper-tab-shadow hover:bg-white">OPML</a>
      <a href="/rss.xml" class="tex-parchment border border-[#2a231b] px-2 py-0.5 paper-tab-shadow hover:bg-white">DISPATCH RSS</a>
    </div>
  `;
  return html;
}

function kindBadge(kind) {
  if (kind === 'review') {
    return '<span class="bg-[#f0c2ba] text-[#69241b] text-[10px] font-sans font-bold px-1.5 py-0.2 rounded-sm border border-[#dc9f95] uppercase">REVIEW</span>';
  }
  if (kind === 'post') {
    return '<span class="bg-[#f5dfa0] text-[#593e0c] text-[10px] font-sans font-bold px-1.5 py-0.2 rounded-sm border border-[#d6b96c] uppercase">POST</span>';
  }
  return '<span class="bg-[#c2eecf] text-[#185e33] text-[10px] font-sans font-bold px-1.5 py-0.2 rounded-sm border border-[#a2d8b1] uppercase">NOTE</span>';
}

function renderDispatchTab() {
  const items = state.dispatches.filter((d) =>
    state.dispatchFilter === 'all' ? true : d.kind === state.dispatchFilter
  );

  return `
    <section class="relative" data-purpose="dispatches-section">
      <div class="inline-flex items-center space-x-2 tex-parchment border-[1.5px] border-[#2a231b] px-2.5 py-1 text-xs font-mono font-bold ml-1 relative z-10 paper-tab-shadow">
        <span class="tracking-wide">DISPATCHES</span>
        <span class="bg-[#f5dfa0] text-[#593e0c] text-[10px] font-sans font-bold px-1.5 py-0.2 rounded-sm border border-[#d6b96c] uppercase">LOG</span>
        <span class="border border-[#2a231b] px-1 py-0 text-[10px]">${items.length}</span>
      </div>
      <div class="tex-lined border border-[#d3caa8] p-3.5 md:p-5 -mt-2.5 paper-shadow rounded-sm relative text-[#201c17]">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-1 font-mono text-xs">
          ${
            items.length === 0
              ? '<p class="text-center text-[#4d4235] py-4 md:col-span-2">No dispatches match this filter.</p>'
              : items
                  .map(
                    (d) => `
                <article id="dispatch-${esc(d.id)}" class="space-y-2 border-b border-[#cfc8b0]/80 pb-4 md:border md:border-[#cfc8b0] md:p-3.5 md:bg-[#fcf8e3]/50 md:rounded-[1px]">
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center space-x-2">
                      ${kindBadge(d.kind)}
                      <span class="text-[10px] text-[#4d4235]">${esc(formatStamp(d.createdAt))}</span>
                    </div>
                  </div>
                  <h2 class="font-headline text-lg uppercase tracking-wide text-[#1e1c19] leading-snug">${esc(d.title)}</h2>
                  ${
                    d.refItem
                      ? `<a href="${esc(d.refItem.url)}" target="_blank" rel="noopener noreferrer"
                          class="block tex-parchment border border-[#b5a486] px-2.5 py-1.5 text-[11px] rounded-[1px] hover:brightness-95">
                          <span class="font-bold uppercase text-[10px] text-[#5c4a35]">RE: ${esc(d.refItem.source)}</span>
                          <div class="italic">&ldquo;${esc(d.refItem.title)}&rdquo; &rarr;</div>
                        </a>`
                      : ''
                  }
                  <div class="text-[12px] leading-relaxed text-[#251e17] whitespace-pre-line">${esc(d.body)}</div>
                  ${
                    d.tags?.length
                      ? `<div class="flex flex-wrap gap-1 pt-0.5">
                          ${d.tags.map((t) => `<span class="border border-[#8a7962] px-1.5 py-0 text-[10px] bg-[#f4ecd8]/70">#${esc(t)}</span>`).join('')}
                        </div>`
                      : ''
                  }
                </article>`
                  )
                  .join('')
          }
        </div>
      </div>
    </section>
  `;
}

function renderAboutTab() {
  const a = state.about;
  if (!a) return '';
  return `
    <div class="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 items-start">
      <section class="relative md:col-span-6" data-purpose="business-card-section">
        <div class="inline-flex items-center space-x-2 tex-parchment border-[1.5px] border-[#2a231b] px-2.5 py-1 text-xs font-mono font-bold ml-1 relative z-10 paper-tab-shadow">
          <span class="tracking-wide">CALLING CARD</span>
          <span class="bg-[#c2eecf] text-[#185e33] text-[10px] font-sans font-bold px-1.5 py-0.2 rounded-sm border border-[#a2d8b1] uppercase">ABOUT</span>
        </div>
        <div class="tex-parchment border-[1.5px] border-[#2a231b] p-4 -mt-2.5 paper-shadow rounded-sm relative text-[#1e1c19]">
          <div class="border border-[#b9a88b] p-3.5 md:p-4 space-y-2.5">
            <div class="flex items-start justify-between gap-2">
              <div>
                <h2 class="font-headline text-2xl font-bold uppercase tracking-wider leading-none">${esc(a.name)}</h2>
                <div class="font-mono text-xs font-bold text-[#4d4235] mt-1">${esc(a.owner)} &bull; ${esc(a.location)}</div>
              </div>
            </div>
            <div class="font-mono text-[11px] font-bold uppercase tracking-wide text-[#5c4a35] border-t border-b border-[#cfc2ab] py-1">
              ${esc(a.role)}
            </div>
            <p class="font-mono text-xs leading-relaxed text-[#251e17]">${esc(a.bio)}</p>
            <div class="pt-1 flex flex-wrap gap-2 font-mono text-xs">
              <a href="mailto:${esc(a.email)}" class="tex-kraft border-[1.5px] border-[#221c16] px-2.5 py-1 font-bold shadow-sm hover:brightness-95">
                ${esc(a.email)}
              </a>
            </div>
          </div>
        </div>
      </section>

      <section class="relative pt-1 md:pt-0 md:col-span-6" data-purpose="links-section">
        <div class="inline-flex items-center space-x-2 tex-parchment border-[1.5px] border-[#2a231b] px-2.5 py-1 text-xs font-mono font-bold ml-1 relative z-10 paper-tab-shadow">
          <span class="tracking-wide">INDEX &amp; LINKS</span>
        </div>
        <div class="tex-lined border border-[#d3caa8] p-3.5 md:p-4 -mt-2.5 paper-shadow rounded-sm relative text-[#201c17] font-mono text-xs space-y-2.5">
          ${(a.links || [])
            .map(
              (l, idx) => `
            ${idx > 0 ? '<div class="border-b border-[#cfc8b0]/80"></div>' : ''}
            <a href="${esc(l.url)}" ${l.url.startsWith('http') ? 'target="_blank" rel="noopener noreferrer"' : ''} class="flex items-center justify-between hover:underline py-0.5">
              <div>
                <div class="font-bold text-[13px]">${esc(l.label)}</div>
                <div class="text-[11px] text-[#4d4235]">${esc(l.note || l.url)}</div>
              </div>
              <span class="border border-[#221c17] px-1.5 py-0.5 text-[10px] font-bold bg-[#f9f5e6]/80">OPEN &rarr;</span>
            </a>`
            )
            .join('')}
          ${
            a.colophon?.length
              ? `<div class="border-t border-[#cfc8b0] pt-2.5 mt-2 text-[10px] text-[#4d4235] space-y-0.5">
                  ${a.colophon.map((c) => `<div>&bull; ${esc(c)}</div>`).join('')}
                </div>`
              : ''
          }
        </div>
      </section>
    </div>
  `;
}

function render() {
  updateNavUI();
  renderSubnav();
  const main = document.getElementById('main-content');
  if (state.tab === 'feed') main.innerHTML = renderFeedTab();
  else if (state.tab === 'dispatch') main.innerHTML = renderDispatchTab();
  else main.innerHTML = renderAboutTab();
}

document.addEventListener('click', (e) => {
  const navBtn = e.target.closest('.nav-tab');
  if (navBtn) {
    state.tab = navBtn.dataset.tab;
    window.location.hash = state.tab;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  const feedBtn = e.target.closest('[data-feed-filter]');
  if (feedBtn) {
    state.feedFilter = feedBtn.dataset.feedFilter;
    render();
    return;
  }

  const dispBtn = e.target.closest('[data-dispatch-filter]');
  if (dispBtn) {
    state.dispatchFilter = dispBtn.dataset.dispatchFilter;
    render();
    return;
  }

  const ytBox = e.target.closest('[data-yt-id]');
  if (ytBox) {
    const vid = ytBox.dataset.ytId;
    if (vid) {
      ytBox.outerHTML = `<iframe src="https://www.youtube.com/embed/${encodeURIComponent(vid)}?autoplay=1" class="w-full h-full border-0" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>`;
    } else if (ytBox.dataset.ytUrl) {
      window.open(ytBox.dataset.ytUrl, '_blank', 'noopener');
    }
    return;
  }

  const audioBtn = e.target.closest('[data-audio-toggle]');
  if (audioBtn) {
    const id = audioBtn.dataset.audioToggle;
    state.activeAudioId = state.activeAudioId === id ? null : id;
    render();
  }
});

async function init() {
  const hash = window.location.hash.replace('#', '');
  if (['feed', 'dispatch', 'about'].includes(hash)) {
    state.tab = hash;
  }
  updateNavUI();
  renderSubnav();

  const [feedsRes, dispRes, aboutRes] = await Promise.all([
    fetch('/api/feeds').then((r) => r.json()).catch(() => ({ items: [] })),
    fetch('/api/dispatches').then((r) => r.json()).catch(() => ({ items: [] })),
    fetch('/api/about').then((r) => r.json()).catch(() => null),
  ]);

  state.feeds = feedsRes;
  state.dispatches = dispRes.items || [];
  state.about = aboutRes;
  render();
}

init();
