import type { Line, MapIndexEntry, MimeSnapshot } from './types.ts';
import { listMaps, getMap } from './maps.ts';
import { MimeLoop } from './loop.ts';
import { mountBoard, type BoardHandle } from './board.ts';

export function mountApp(root: HTMLElement): void {
  root.innerHTML = `
    <div class="shell">
      <header class="top">
        <div class="brand">MIME</div>
        <div class="tagline">copy the line until the line is yours</div>
      </header>
      <main id="screen" class="screen"></main>
    </div>
  `;
  const screen = root.querySelector('#screen') as HTMLElement;
  showLibrary(screen);
}

async function showLibrary(screen: HTMLElement): Promise<void> {
  screen.innerHTML = `<div class="panel"><p class="muted">Loading maps…</p></div>`;
  let maps: MapIndexEntry[];
  try {
    maps = await listMaps();
  } catch (e) {
    screen.innerHTML = `<div class="panel fail-text">Failed to load library: ${String(e)}</div>`;
    return;
  }

  const cards = maps
    .map(
      (m) => `
      <article class="card" data-path="${m.path}">
        <h2>${escapeHtml(m.name)}</h2>
        <p class="meta">
          <span class="pill">${m.side_to_learn}</span>
          <span class="muted">${m.length} plies</span>
        </p>
        <button type="button" class="btn primary" data-start="${m.path}">Start Mime</button>
      </article>`,
    )
    .join('');

  screen.innerHTML = `
    <div class="panel">
      <h1 class="title">Library</h1>
      <p class="muted">Show → Mime. Wrong move resets to ply 0. No hints.</p>
      <div class="grid">${cards}</div>
    </div>
  `;

  screen.querySelectorAll<HTMLButtonElement>('[data-start]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const path = btn.dataset.start!;
      btn.disabled = true;
      btn.textContent = 'Loading…';
      try {
        const line = await getMap(path);
        showPlay(screen, line);
      } catch (e) {
        btn.disabled = false;
        btn.textContent = 'Start Mime';
        alert(String(e));
      }
    });
  });
}

function showPlay(screen: HTMLElement, line: Line): void {
  screen.innerHTML = `
    <div class="panel play ${line.side_to_learn === 'black' ? 'orient-black' : ''}">
      <div class="play-head">
        <button type="button" class="btn ghost" id="btn-lib">← Library</button>
        <div class="play-title">
          <strong>${escapeHtml(line.name)}</strong>
          <span class="muted">${escapeHtml(line.epithet || line.id)}</span>
        </div>
      </div>
      <div class="status-row">
        <span class="phase" id="phase">SHOW</span>
        <span class="progress" id="progress">0 / ${line.length}</span>
        <span class="mistakes muted" id="mistakes">mistakes 0</span>
      </div>
      <div id="board-wrap" class="board-wrap">
        <div id="board" class="cg-wrap"></div>
      </div>
      <div id="complete" class="complete hidden">
        <p class="complete-msg">Line complete</p>
        <div class="row">
          <button type="button" class="btn primary" id="btn-retry">Retry</button>
          <button type="button" class="btn ghost" id="btn-back">Library</button>
        </div>
      </div>
    </div>
  `;

  const boardEl = screen.querySelector('#board') as HTMLElement;
  const wrap = screen.querySelector('#board-wrap') as HTMLElement;
  const phaseEl = screen.querySelector('#phase') as HTMLElement;
  const progressEl = screen.querySelector('#progress') as HTMLElement;
  const mistakesEl = screen.querySelector('#mistakes') as HTMLElement;
  const completeEl = screen.querySelector('#complete') as HTMLElement;

  let loop: MimeLoop | null = null;
  let board: BoardHandle | null = null;

  const teardown = () => {
    loop?.stop();
    board?.destroy();
    loop = null;
    board = null;
  };

  const startSession = () => {
    teardown();
    completeEl.classList.add('hidden');
    loop = new MimeLoop(line);
    board = mountBoard(boardEl, (from, to, promo) => {
      loop?.tryMove(from, to, promo);
    });
    loop.subscribe((snap) => renderSnap(snap));
    loop.start();
  };

  function renderSnap(snap: MimeSnapshot): void {
    phaseEl.textContent = snap.phase;
    phaseEl.dataset.phase = snap.phase;
    progressEl.textContent = `${Math.min(snap.cursorPly, line.length)} / ${line.length}`;
    mistakesEl.textContent = `mistakes ${snap.mistakes}`;

    wrap.classList.toggle('flash-fail', snap.flash);

    const interactive = snap.phase === 'MIME';
    board?.setPosition({
      fen: snap.fen,
      lastMove: snap.lastMove,
      orientation: line.side_to_learn,
      interactive,
      turnColor: interactive ? line.side_to_learn : null,
    });

    if (snap.phase === 'COMPLETE') {
      completeEl.classList.remove('hidden');
    } else {
      completeEl.classList.add('hidden');
    }
  }

  screen.querySelector('#btn-lib')!.addEventListener('click', () => {
    teardown();
    showLibrary(screen);
  });
  screen.querySelector('#btn-back')!.addEventListener('click', () => {
    teardown();
    showLibrary(screen);
  });
  screen.querySelector('#btn-retry')!.addEventListener('click', () => {
    startSession();
  });

  startSession();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
