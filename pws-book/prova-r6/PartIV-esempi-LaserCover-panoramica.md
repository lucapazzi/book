# Parte IV — panoramica esempi e copertura con LaserCover

**Domanda:** usando parti dell'esempio LaserCover si possono coprire *tutti* gli
esempi dei sottocapitoli della Parte IV? **Risposta: sì**, quasi integralmente —
Cover–Laser è già l'esempio corrente della Parte IV. Serve solo uno stato
supplementare `Halt` (stop d'emergenza, senza uscite) per i casi di deadlock, e le
dashboard aiutano dove il testo mostra righe di `Conf`/`RS`/liveness.

## Il modello base LaserCover e le sue "fette"

Assembly: `cover ∈ {Open, Closed}` (autonomo), `laser ∈ {Off, On}` (comandato `on`/`off`).
Configurazioni native: `(Open,Off)`, `(Closed,Off)`, `(Closed,On)`, `(Open,On)`.

Stati controller usati come mattoni:

| Stato | Sem | Ruolo |
|---|---|---|
| `Idle` | `(Open, Off)` | cover aperto, laser spento |
| `Ready` | `(Closed, Off)` | cover chiuso, pronto |
| `Work` | `(Closed, On)` | laser acceso a lavorare |
| `Fail` | `(Open, Off)` | sink dell'open-cover (usato in R5) |
| `Halt` (suppl.) | `(Open, Off)` o ANY | stop d'emergenza senza uscite (R3/R7/R8) |

## Mappatura esempio → fetta LaserCover

Legenda stato: ✅ fattibile diretto · 🟡 fattibile con variante/aggiunta · ⚪ concettuale/astratto · ✔️ già fatto.

### part-4-designing-correct-controllers — il ciclo di progetto

| Esempio | Illustra | Realizzazione LaserCover | Dashboard | Stato |
|---|---|---|---|---|
| §3 *Example: Cover–Laser* + **Figure 3.1** | calcolo dello spazio reattivo (exit zone) | modello LaserCover completo; evidenziare le exit zone di `Work`/`Ready` | utile (mostra `RS`) | ✅ |

### part-4-rules-semantics — R5 / R6 / R1

| Esempio | Illustra | Realizzazione LaserCover | Dashboard | Stato |
|---|---|---|---|---|
| **R5 Micro-example 1** (Fig. 2–3) | guardia incompleta → partizione riparata verso `Fail` | `Idle`→`Work` `[cover.Closed]` (+ `Idle`→`Fail` `[cover.Open]`) | no | ✔️ fatto |
| **R5 Figure 4 / Micro-example 2** | partizione ben formata sulle transizioni *iniziali* | pseudostato con due iniziali guardate: `[cover.Open]`→`Idle`, `[cover.Closed]`→`Ready` | no | ✅ |
| **R6 Figure 5 + Micro-example** | colorazione azioni: valid / orphan / provisional | `Ready`⇄`Work` con `⟨laser.on/off⟩` nelle tre varianti | opz. | ✔️ fatto |
| **R1 Micro-example** | consistenza: `Conf ⊄ Sem` → riga rossa | transizione verso `Work` con guardia che non impone `cover.Closed` → `(Open,On) ∈ Conf(Work)` | **sì** (riga `Conf` rossa) | ✅ |

### part-4-rules-reactive — R2 / R3 / R4

| Esempio | Illustra | Realizzazione LaserCover | Dashboard | Stato |
|---|---|---|---|---|
| **R2 Figure 1** | exit zone `(Open,On)`: 0 / 1 / 2 reazioni | `Work` con exit zone cover `Closed→Open`, tre varianti di reazione | **sì** (`RS`) | ✅ |
| **R2 Micro-example** | copertura: riga `RS` rossa → verde | `Work`, `RS={(Open,On)}` rossa; aggiungi `Work`→`Idle` `[cover.Open]` `⟨laser.off⟩` | **sì** | ✅ |
| **R3 Micro-example** | determinismo: due reazioni sulla stessa exit zone | `Work`→`Idle` e `Work`→`Halt`, entrambe `[cover.Open]` | opz. | 🟡 (serve `Halt`) |
| **R4 Micro-example** | exit zone orphan dopo refactor | rinominare `cover.Closed` → l'exit zone punta a stato inesistente | **sì** | 🟡 (variante assembly) |

### part-4-rules-liveness — R7 / R8

| Esempio | Illustra | Realizzazione LaserCover | Dashboard | Stato |
|---|---|---|---|---|
| **Figure 1** | tassonomia escape-path / deadlock (c₁,c₂,c₃) | diagramma a livello di *configurazioni*, non un controller | — | ⚪ concettuale |
| **R7 Micro-example** | deadlock + exit zone scoperta | aggiungere `Halt` senza transizioni uscenti (stop d'emergenza) | **sì** (allarmi liveness) | 🟡 (serve `Halt`) |
| **R8 Micro-example** | eccezione fail-safe: marca `Halt` come `fail` | stesso `Halt`, `failState=true`: gli allarmi R2/R7 spariscono | **sì** | 🟡 (serve `Halt`) |
| §4 *reading liveness on the dashboard* | lettura liveness sulla dashboard | qualsiasi stato LaserCover con dashboard aperta | **sì (centrale)** | ✅ |

## Conclusioni

1. **Copertura completa** con un unico assembly (Cover–Laser): tutti gli esempi
   normativi (R1–R8) sono fette o micro-varianti del LaserCover.
2. **Unica aggiunta di modello:** lo stato `Halt` (stop d'emergenza senza uscite),
   che serve a R3 (seconda reazione concorrente), R7 (deadlock) e R8 (fail-safe).
   Riutilizzabile in tutti e tre.
3. **Varianti minori:** R4 richiede una versione dell'assembly con uno stato del
   `cover` rinominato (per generare l'exit zone orphan).
4. **Dashboard:** da introdurre dove il testo mostra righe di verifica — R1
   (`Conf` rossa), R2 (`RS` rossa→verde), R7/R8 (allarmi), e tutto §4 liveness.
   Con le nuove API (`pws_update_dashboard`: `visible`/`minimized`/offset) si può
   mostrare **solo** la dashboard dello stato rilevante, spostata dove non copre le frecce.
5. **Unico caso non-controller:** liveness **Figure 1** è una tassonomia astratta
   sul grafo delle configurazioni; si può *strumentare* con configurazioni concrete
   del LaserCover (es. `(Open,On)` come deadlock in `Halt`) ma non è una fetta del canvas.

## Set di file .pws proposto (riuso massimo)

- `laserCover-base.pws` — modello completo (già presente): §3, R5 Fig.4, base per tutto.
- `laserCover-R1-inconsistent.pws` — guardia debole verso `Work` → `(Open,On)` rossa.
- `laserCover-R2-*.pws` — tre varianti di reazione all'exit zone `(Open,On)`.
- `laserCover-R3-nondet.pws` — `Work`→`Idle` e `Work`→`Halt` sullo stesso `[cover.Open]`.
- `laserCover-R4-orphan-exitzone.pws` — assembly con `cover` rinominato.
- `laserCover-R7-halt-deadlock.pws` — `Halt` senza uscite.
- `laserCover-R8-halt-fail.pws` — come sopra, `Halt` marcato `fail`.

Tutti generabili via MCP (`pws_add_state`/`pws_add_transition`/`pws_set_guard`/
`pws_set_actions`/`pws_update_state failState`) e ripuliti col workflow R5
(`selectionOnly` + `grid=false` + `editMode=false` + `showCard=false` sull'iniziale).
