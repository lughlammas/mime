# HARDENING-SPEC — MIME v0.1 → v0.2

**App:** MIME (M-I-M-E) · **Owner:** Crono · **Ruler:** Gui  
**Date:** 2026-09-24 · **Status:** **LOCKED** 2026-09-24 (Gui: lock_go) — v0.2.0 implementation landed (goldens G01–G13 web+Android; maps canon; CI)  
**Repos:** engineering review estático (Web + Android) + código local em `/workspace/mime` e `/workspace/mime-android`

---

## 0. Classificação (aceita)

> Software experimental sério, com arquitetura de produto; ainda **não** software de produção endurecido.

**Não** refazer o MIME. **Cercar** o MIME que já existe: testes, CI, versão, release, fonte canônica de dados.

| Área | v0.1 | Meta v0.2 |
|------|------|-----------|
| Conceito / domínio | Muito bom | Inalterado |
| MimeLoop (web + Android) | Bom, espelhados | Golden + parity gate |
| Maps | Duplicados | Uma fonte + export |
| Testabilidade | Fraca | Suíte golden + unit |
| CI / releases | Inicial | Gate em PR + tags |
| LICENSE / doc técnica | Ausente / mínima | Presente |
| Play Store | targetSdk 34 | **Fora** do v0.2 (fila) |

---

## 1. Fora de escopo (v0.2)

Bloqueado até hardening fechar:

- Hub / Day Feed / Upload / engine lab / PGN import
- Compartilhar runtime Kotlin↔TypeScript (não)
- Clean Architecture de 7 camadas / DI framework
- Otimizar `isLearnerPly` (rebuild FEN)
- `MapRepository` em `Dispatchers.IO`
- `targetSdk 36` / Google Play submission
- Features UX novas; Greco art polish

---

## 2. Arquitetura alvo (não muda o runtime)

```text
                  MIME SPEC (este doc + SPEC.md)
                     │
          ┌──────────┴──────────┐
          │                     │
      Web runtime          Android runtime
      MimeLoop.ts          MimeLoop.kt
          │                     │
          └──── golden fixtures ──┘
                     │
               parity gate (CI)

             MIME MAPS CANON (única fonte)
                     │
                build/export
                 ↙       ↘
          web public/   android assets/
```

Runtimes continuam nativos. O que se compartilha: **especificação + fixtures + mapas canônicos**.

---

## 3. Constantes de paridade (já no código — travar)

| Constante | Valor | Web | Android |
|-----------|-------|-----|---------|
| `SHOW_PAUSE_MS` | 700 | `loop.ts` | `MimeLoop.kt` |
| `DEMO_HOLD_MS` | 900 | idem | idem |
| `FAIL_FLASH_MS` | 550 | idem | idem |

Testes de tempo: usar **clock fake / delay virtual**. Não assertar wall-clock real.

---

## 4. Snapshot canônico (contrato de teste)

Todo golden compara **apenas** estes campos (após cada ação lógica):

```ts
type GoldenSnapshot = {
  phase: 'SHOW' | 'MIME' | 'FAIL' | 'COMPLETE';
  cursorPly: number;
  fen: string;           // FEN completo, normalizado
  lastMove: [string, string] | null;  // from,to lowercase
  mistakes: number;
  expectedUci: string | null;         // lowercase; null em FAIL/COMPLETE se assim hoje
  flash: boolean;
};
```

**Normalização obrigatória**
- UCI e casas: lowercase
- FEN: string exata do motor após o lance (aceitar diferença de halfmove/en-passant **só** se documentada; meta = strings iguais nos dois runtimes para as fixtures)
- `expectedUci` em SHOW/MIME = `moves_uci[cursorPly]` ou null se fim

---

## 5. Formato do fixture golden (fonte única)

Path proposto (web repo como dono temporário; ou `mime-fixtures/` depois):

```text
fixtures/golden/
  manifest.json
  lines/
    italian-game.json          # ou stub curto
    accelerated-dragon.json
    promo-white-queen.json     # Line artificial curta
  cases/
    G01-white-learner-happy.json
    G02-black-learner-happy.json
    ...
```

### 5.1 Schema `cases/*.json`

```json
{
  "id": "G01-white-learner-happy",
  "line_ref": "italian-game",
  "clock": "virtual",
  "steps": [
    { "op": "start" },
    { "op": "advance_ms", "ms": 900 },
    { "op": "expect", "snap": { "phase": "MIME", "cursorPly": 0, "mistakes": 0, "flash": false } },
    { "op": "try_move", "from": "e2", "to": "e4" },
    { "op": "expect", "snap": { "phase": "SHOW", "cursorPly": 1 } }
  ]
}
```

### 5.2 Ops permitidas

| Op | Significado |
|----|-------------|
| `start` | `loop.start()` |
| `stop` | `loop.stop()` |
| `advance_ms` | Avança clock virtual `ms` (dispara timers pendentes) |
| `try_move` | `tryMove(from,to,promotion?)` — guarda `accepted: bool` se o case pedir |
| `expect` | Asserta subset ou snapshot completo |
| `expect_rejected` | `tryMove` retorna false **e** phase ainda MIME (ilegal, sem FAIL) |
| `expect_fail_then_reset` | Após try errado legal: FAIL+flash → após FAIL_FLASH_MS → SHOW ply0 |

Campos omitidos em `expect.snap` = não assertar (permite checks parciais).

---

## 6. Suíte de parity (obrigatória — Definition of Done)

Cada case deve passar **idêntico** em Vitest (web) e JUnit (Android).

### A. Learner white (Italian seed ou stub)

| ID | Caso | Asserts chave |
|----|------|----------------|
| **G01** | Happy path até COMPLETE | Após cada MIME correto: avanços; oponente auto via SHOW; COMPLETE no fim; `mistakes=0` |
| **G02** | Illegal move em MIME | `e2e5` (ou de casa vazia): `tryMove=false`, phase=MIME, mistakes inalterado, sem flash |
| **G03** | Legal mas errado | Ex.: `d2d4` quando esperado `e2e4`: FAIL, flash=true, mistakes+=1; após 550ms: ply0, SHOW, flash=false, FEN=start |
| **G04** | Fail no meio da linha | Acertar 2 plies do learner, errar o 3º → reset total ply0 (não fica no meio) |
| **G05** | stop() cancela timer | start → stop antes de DEMO_HOLD → não entra MIME; sem emit posterior |

### B. Learner black (Accelerated Dragon seed)

| ID | Caso | Asserts chave |
|----|------|----------------|
| **G06** | White auto no ply 0 | Após start+SHOW_PAUSE: cursorPly≥1, FEN após `e2e4`, ainda SHOW ou já demo pretas |
| **G07** | Happy path black | Completa linha com MIME só nos plies pretos |
| **G08** | Fail black mid-line | Hard reset; white auto-joga de novo no reinício |

### C. Promoção

| ID | Caso | Asserts chave |
|----|------|----------------|
| **G09** | Promo explícita `e7e8q` | Line artificial; MIME aceita com promotion `q` |
| **G10** | Auto-queen sem promo char | Android já auto-queen; web deve espelhar — fixture prova os dois |

Use Line stub, não seed de abertura:

```json
{
  "id": "promo-stub",
  "side_to_learn": "white",
  "start_fen": "<FEN com peão branco em e7, turno white, caminho limpo>",
  "moves_uci": ["e7e8q"]
}
```

(FEN exata a fixar na implementação; validar com `build:maps` / chess.js.)

### D. Bordas de sessão

| ID | Caso | Asserts chave |
|----|------|----------------|
| **G11** | tryMove fora de MIME | phase=SHOW → tryMove false, estado intacto |
| **G12** | Linha vazia / length 0 | start → COMPLETE imediato (ou erro de validação no build — escolher um e travar) |
| **G13** | Teardown / segunda start | stop + novo MimeLoop na mesma Line: estado limpo |

### E. Dados / maps (não loop, mas parity de conteúdo)

| ID | Caso | Asserts chave |
|----|------|----------------|
| **M01** | italian-game bytes/campos | Mesmo `moves_uci`, `side_to_learn`, `start_fen` nos dois exports |
| **M02** | accelerated-dragon | Idem |
| **M03** | index.json | Mesmos ids, ordem canônica definida |
| **M04** | build:maps rejeita UCI ilegal | Fixture mapa podre → script exit ≠ 0 |

---

## 7. Checklist arquivo a arquivo (auditoria v0.1)

Marcar na implementação: `[ ]` → `[x]` só com evidência (teste ou CI log).

### 7.1 Web (`lughlammas/mime` · app em `mime/app`)

| Arquivo | Papel | Checklist v0.2 |
|---------|-------|----------------|
| `src/mime/loop.ts` | Máquina de estados | Injetar clock; golden G01–G13; exportar constantes |
| `src/mime/types.ts` | Contratos | Snapshot alinhado ao GoldenSnapshot |
| `src/mime/uci.ts` | Parse UCI | Unit: promo, lowercase |
| `src/mime/ui.ts` | UI + teardown | Manual/smoke: teardown ao trocar Line (sem golden) |
| `scripts/build-maps.mjs` | Validação build | M04; não pular validated_at |
| `public/maps/canon/*` | **Deixa de ser fonte** | Vira **output** do export |
| `package.json` | Scripts | `test`, `build:maps`, `ci` |
| — | LICENSE | Adicionar na raiz do repo |
| — | `.github/workflows/ci.yml` | Novo |

### 7.2 Android (`lughlammas/mime-android`)

| Arquivo | Papel | Checklist v0.2 |
|---------|-------|----------------|
| `.../mime/MimeLoop.kt` | Máquina | Clock/test dispatcher; mesmos goldens |
| `.../data/*` (Line, Phase, Snapshot) | Modelos | Paridade de campos com types.ts |
| `.../data/MapRepository.kt` | Assets | Só lê export; sem lógica de loop |
| `.../ui/MimeViewModel.kt` | Sessão | Smoke: start/stop; goldens no Loop, não no VM |
| `.../MainActivity.kt` | Root | Sem lógica de domínio |
| `app/src/main/assets/maps/**` | **Output** | Gerado; CI falha se drift |
| `app/build.gradle.kts` | SDK/version | versionName 0.2.0; **não** forçar API 36 neste marco |
| — | LICENSE | Idem |
| — | CI workflow | `./gradlew test` (+ assembleDebug opcional) |

### 7.3 Compartilhado (criar)

| Artefato | Dono proposto | Nota |
|----------|---------------|------|
| `fixtures/golden/**` | Repo **mime** (web) | Android copia via submodule, path sync script, ou CI checkout |
| `maps/canon-src/**` | Repo **mime** | Única edição humana |
| `scripts/export-maps-android.mjs` (ou sh) | mime | Copia validados → tree Android |

**Decisão a travar no go (default Crono):** canon + fixtures vivem em `mime`; Android CI faz checkout do mime ou job monorepo; script `export-maps` é a única ponte. Alternativa aceitável: repo `mime-data` — só se Gui quiser 3º repo.

---

## 8. CI (gate mínimo)

### Web PR
1. `npm ci`
2. `npm run build:maps` (fail se ilegal)
3. `npm test` (goldens + uci)
4. `npm run build`

### Android PR
1. JDK 17
2. `./gradlew test`
3. (opcional) `assembleDebug`
4. Job **parity**: checkout fixtures do mime → rodar mesmos case ids

### Drift maps
- Hash (sha256) de cada JSON canônico exportado deve bater entre `public/maps` e `assets/maps` no CI agregado, **ou** Android assets regenerados no job e `git diff --exit-code`.

Merge bloqueado se qualquer job falhar.

---

## 9. Release engineering

| Item | v0.2 |
|------|------|
| SemVer | `0.2.0` nos dois |
| Tag | `v0.2.0` em cada repo |
| CHANGELOG | Keep-a-changelog curto (Added tests/CI/canon; Fixed n/a) |
| GitHub Release | Web: notes; Android: APK debug ou release assinado se já houver key |
| Commits | Sair de “1 commit orphan” → histórico legível (não reescrever main à força) |

---

## 10. LICENSE + doc técnica mínima

1. **LICENSE** MIT (alinhado ao lab) na raiz de `mime` e `mime-android`, salvo Gui mandar outra.
2. **HARDENING-SPEC.md** (este) versionado no mime.
3. Atualizar **SPEC.md** com seção “v0.2 Hardening” apontando para este arquivo.
4. Atualizar **LOCK-TECH.md**: Android nativo **já existe**; v0.2 = cercar, não feature.
5. README: badge CI + “how to test” em 5 linhas.

---

## 11. Ordem de implementação (quando Gui der go)

1. Clock injetável + G01–G03 no web (prova o harness)
2. Portar harness Android + mesmos 3 cases
3. Completar G04–G13 + G09–G10
4. Canon maps: pasta fonte + export + M01–M04
5. CI workflows + drift check
6. LICENSE, CHANGELOG, bump 0.2.0, tags

Não inverter: **sem golden harness, maps canônicos sozinhos não fecham o risco de MimeLoop**.

---

## 12. Definition of Done — v0.2

- [x] Todos os cases **G01–G13** e **M01–M04** verdes em Web e Android
- [x] Uma edição em `maps/canon-src` propaga aos dois runtimes sem cópia manual
- [x] CI workflows adicionados nos dois repos
- [x] LICENSE presente
- [ ] Tags `v0.2.0` + CHANGELOG (tag on push)
- [x] Nenhuma feature nova mergeada neste marco
- [x] SPEC.md + LOCK-TECH atualizados

**Pronto para uso experimental:** já era.  
**Pronto para confiar em cada diff futuro do MimeLoop:** só depois deste DoD.

---

## 13. Riscos abertos (monitorar, não bloquear v0.2)

1. FEN string diff chess.js vs chesslib em edge cases → normalizar ou pin FEN nas fixtures pós-lance conhecido
2. `lastMove` após undo no demo (web usa history; Android usa ply anterior) → golden deve fixar o contrato desejado
3. Promo auto-queen: web precisa confirmação explícita de paridade (G10)
4. Terceiro repo vs pasta no mime — escolher no go (default: tudo no mime)

---

## 14. Mantra de fase

MIME does not play you.  
Hardening does not redesign you.  
**Prove the loop twice, ship once.**

---

*Fim da auditoria. Próximo ato = implementação só após “go” do Gui.*
