# SPEC.md — MIME v0

**App:** MIME (M-I-M-E) · **Owner:** Crono · **Ruler:** Gui  
**Updated:** 2026-09-21 (após rebate técnico peer)

---

## Soul

FFT Mime (“vaquinha”): só copia a forma. Prep/memória — não cheat de torneio. Sem PvP, sem música.

---

## Lock técnico (Crono + peer — ACEITO)

| Decisão | Valor |
|---------|--------|
| Surface v0 | **Web PWA** (Vite + TS) + **Chessground** + **chess.js** |
| Backend v0 | **Nenhum** — estático offline |
| Storage | `maps/` JSON + `index.json` via HTTP GET / CDN |
| Lance interno | **UCI**; log humano pode mostrar SAN |
| Comparação | **Não** string cega: user move → chess.js → comparar com UCI esperado |
| Validação de mapa | **Build time** (`npm run build:maps`); client assume JSON legal |
| Quem joga | User só `side_to_learn`; oponente **auto-joga** no Show (pausa breve) |
| Fail default | **Hard reset** → ply 0 (peer; alinhado DNA MK sequência) |
| Library server | Fora do v0; interface mínima mock (`listMaps` / `getMap`) |
| Godot / Android nativo / engine lab | **Bloqueados no v0** |

### Schema Line (v0)
```json
{
  "id": "slug",
  "name": "Accelerated Dragon",
  "epithet": "",
  "side_to_learn": "white",
  "start_fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "moves_uci": ["e2e4", "c7c5"],
  "length": 2,
  "tags": ["sicilian"],
  "difficulty": 1,
  "thesis": "",
  "validated_at": "ISO-8601"
}
```
Drop no core v0: eco, source, named_by (podem voltar no Bibleo metadata depois).

### Schema MimeSession (v0)
```json
{
  "id": "",
  "line_id": "",
  "cursor_ply": 0,
  "mistakes_total": 0,
  "failed_plies": [],
  "status": "active",
  "started_at": "",
  "last_reset_at": null
}
```

### Bibleo layout
```
maps/
  canon/
  house/
  index.json
```

### Loop
1. SHOW: se ply é do oponente → auto-move + pausa; se ply é do learner → demonstra o lance esperado (sem input).
2. MIME: board liberado só para o UCI esperado (via chess.js).
3. Acerto → próximo ply. Erro → feedback → **reset cursor_ply = 0**.
4. Fim da Line → complete.

---

## Negado / adiado (Crono)

| Item | Nota |
|------|------|
| Retry no mesmo ply (proposta Crono antiga) | **Substituído** por hard reset (peer) |
| Postgres/SQLite | Só se >~1000 Lines ou Hub real |
| Day Feed / Upload Hub / engine lab | Pós-v0; encaixe = escrever em `maps/` |
| PGN import no client | Bloqueado até retenção do loop provar valor |

---

## Riscos aceitos (monitorar)

1. Chessground + restrição a um único lance legal (hack risk)
2. Race cursor vs animação
3. Promoção quebrando click-click
4. Service worker cacheando mapa podre
5. Scope creep PGN cedo demais

---

## Semana 1 (checklist peer — Crono endossa)

1. Scaffold Vite + TS  
2. Chessground envelope “burro”  
3. chess.js (memória; worker opcional)  
4. `build:maps` script  
5. Estado Show (auto oponente / demo learner)  
6. Estado Mime (trava + valida UCI)  
7. Hard reset no erro  
8. Tela complete crua + Next  

---

## UX travado (Gui 2026-09-21 — sugestão Saturno)

1. **`side_to_learn = black`:** Brancas **auto-jogam** o 1º lance da Line no Show. Sempre FEN inicial padrão; o Show absorve o turno do oponente. Não gerar FEN custom só pra pular ply 0.
2. **Fail:** só **flash vermelho** + hard reset ply 0. **Sem dica** do lance certo (não viciar “errar pra ver”).
3. **Orientação:** inverter tabuleiro pelo `side_to_learn` (Chessground `orientation`). Pretas embaixo se aprendendo pretas.

**Escopo v0 travado. Build autorizado.**

---

## Mantra

MIME does not play you. MIME makes you copy the line until the line is yours.

---

## v0.2 Hardening

See **[HARDENING-SPEC.md](../HARDENING-SPEC.md)** (repo root) / **HARDENING-SPEC.md** — locked 2026-09-24.

v0.2 does **not** add product features. It adds:
- Golden fixtures G01–G13 + virtual clock (web Vitest + Android JUnit)
- Canon maps in `maps/canon-src/` → `build:maps` → `public/maps` + Android export
- CI gates, MIT LICENSE, SemVer 0.2.0

Android native runtime **exists** (see LOCK-TECH); v0.2 = fence the loop, not redesign.
