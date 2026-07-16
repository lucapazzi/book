# PWSEditor MCP — API richieste: dashboard di stato, fail-state & chrome pseudostato

Stato al 2026-07-11, dedotto dagli schemi `tools/list` esposti dal server MCP.

## 1. Riepilogo: cosa esiste già, cosa manca

| Capacità | Tool MCP | Stato |
|---|---|---|
| Mostra/nascondi **card** transizione (guard/actions/semantics) | `pws_update_annotation` (`showGuard`, `showActions`, `showSemantics`) | ✅ esiste |
| **Sposta** card transizione | `pws_update_annotation` (`offsetX`, `offsetY`, `resetPosition`) | ✅ esiste |
| Marca stato come **fail** | `pws_update_state` (`failState: boolean`) | ✅ esiste |
| Marca stato come **timed** | `pws_update_state` (`timed: boolean`) | ✅ esiste |
| Mostra/nascondi **dashboard** (pannello Sem/Acc/RS) — globale | `pws_export` / `pws_screenshot` (`dashboards: boolean`) | ✅ esiste (tutto-o-niente) |
| Mostra/nascondi **dashboard del singolo stato** | — | ❌ **manca** |
| **Sposta** la dashboard del singolo stato | — | ❌ **manca** |
| Sopprimere il **chrome del pseudostato** (box/ghost/trattino) su transizione iniziale | — | ❌ **manca** (§5) |
| **Auto-layout** bilanciato del modello | — | ❌ **manca** (§7) |

Conclusione: **il fail-state non va aggiunto, esiste già.** L'unico buco è il controllo
per-stato della dashboard (visibilità + posizione), speculare a ciò che
`pws_update_annotation` fa per le card delle transizioni.

### Uso del fail-state già disponibile (nessuna implementazione)

```jsonc
// setta Fail come stato fail → maschera gli obblighi reattivi R2/R7 (exit zone),
// l'anello rosso da "uncovered exit zone" sparisce
pws_update_state { "name": "Fail", "failState": true }
```

---

## 2. Nuovo tool proposto: `pws_update_dashboard`

Speculare a `pws_update_annotation`, ma agganciato allo **stato** invece che alla
transizione. Un solo tool copre visibilità e posizione per-stato.

### 2.1 Schema JSON (da dichiarare in `McpBridge.java`, accanto a `pws_update_annotation`)

```json
{
  "name": "pws_update_dashboard",
  "description": "Update a controller state's dashboard panel (Sem/Acc/RS): per-state visibility and/or its offset from the state node. Overrides the global dashboards export/screenshot flag for that state.",
  "inputSchema": {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "additionalProperties": false,
    "required": ["name"],
    "properties": {
      "name":          { "type": "string",  "description": "Controller state name" },
      "visible":       { "type": "boolean", "description": "Show or hide this state's dashboard" },
      "offsetX":       { "type": "number",  "description": "Dashboard-anchor offset X from the state center (with offsetY)" },
      "offsetY":       { "type": "number",  "description": "Dashboard-anchor offset Y from the state center (with offsetX)" },
      "resetPosition": { "type": "boolean", "description": "Reset the dashboard to its default offset" }
    }
  }
}
```

Note di design (coerenti con `pws_update_annotation`):
- `offsetX`/`offsetY` vanno passati insieme; se manca uno dei due, ignora lo spostamento.
- `resetPosition: true` ha precedenza sugli offset e ripristina l'ancoraggio di default.
- `visible` è indipendente dagli offset (puoi cambiare solo la visibilità).
- La visibilità per-stato **fa override** del flag globale `dashboards` in export/screenshot:
  se globale = true e per-stato = false → quella dashboard resta nascosta, e viceversa.

### 2.2 Handler (dispatch in `McpBridge`)

Aggiungere un ramo nel dispatcher dei tool, sul modello di `handleUpdateAnnotation`:

```java
// in McpBridge, accanto agli altri case "pws_..."
case "pws_update_dashboard": return handleUpdateDashboard(args);

private JsonObject handleUpdateDashboard(JsonObject a) {
    String name = a.get("name").getAsString();
    ControllerState st = model.findState(name);          // stesso lookup di pws_update_state
    if (st == null) return err("unknown state: " + name);

    DashboardView dash = st.getDashboardView();          // vista del pannello Sem/Acc/RS

    if (a.has("resetPosition") && a.get("resetPosition").getAsBoolean()) {
        dash.resetOffset();
    } else if (a.has("offsetX") && a.has("offsetY")) {
        dash.setOffset(a.get("offsetX").getAsDouble(),
                       a.get("offsetY").getAsDouble());
    }
    if (a.has("visible")) {
        dash.setVisibleOverride(a.get("visible").getAsBoolean()); // tri-state: unset/true/false
    }

    editor.recalcAndRepaint();                            // come gli altri mutation tool
    return ok(Map.of("name", name,
                     "visible", dash.isVisibleEffective(),
                     "offsetX", dash.offsetX(),
                     "offsetY", dash.offsetY()));
}
```

### 2.3 Modello / vista

Serve uno stato di vista per la dashboard, analogo all'annotation card della transizione:

- `DashboardView` (o campi sullo `ControllerState`/suo view-model) con:
  - `offsetX, offsetY` (double) — ancoraggio rispetto al centro dello stato; default calcolato come oggi.
  - `visibleOverride` **tri-state**: `UNSET` (segue il flag globale), `SHOWN`, `HIDDEN`.
  - `isVisibleEffective(globalDashboards)` = `override==UNSET ? globalDashboards : override==SHOWN`.
- Il renderer che oggi disegna la dashboard deve:
  1. leggere `isVisibleEffective(...)` invece del solo flag globale;
  2. posizionare il pannello usando `offsetX/offsetY` invece dell'ancoraggio fisso;
  3. **non tracciare il leader tratteggiato** verso una dashboard nascosta
     (bug attuale osservato con `dashboards=false` a livello globale).

### 2.4 Export / screenshot

`renderToSvg/Pdf/Png` già ricevono il flag globale `dashboards`. Passarlo a
`isVisibleEffective(global)` per ogni stato così che l'override per-stato sia
rispettato in export, screenshot e canvas live in modo identico.

### 2.5 Persistenza `.pws`

Serializzare per stato: `dashboardOffsetX`, `dashboardOffsetY`, `dashboardVisible`
(tri-state / nullable). Retrocompatibilità: assenti ⇒ default + `UNSET`.

### 2.6 `pws_get_model` / `pws_get_state`

Esporre nel payload dello stato i nuovi campi, così l'agente può leggere lo stato
corrente prima di modificarlo:

```jsonc
"dashboard": { "visible": "unset|shown|hidden", "offsetX": 0, "offsetY": 0 }
```

---

## 3. Bug correlato da correggere insieme (leader penzolanti)

Con `dashboards=false` (globale) l'export/screenshot disegna ancora le **linee
guida tratteggiate** verso le dashboard nascoste. Vanno soppresse quando la
dashboard non è visibile (sia via flag globale sia via override per-stato).
È lo stesso guard di visibilità del §2.3 punto 3.

---

## 5. Chrome del pseudostato sulla transizione iniziale

### 5.1 Sintomo osservato

Isolando il **solo** pseudostato, l'editor lo disegna come un **pallino nero pieno
pulito** (identico alle figure del libro). Ma appena nella figura è presente anche
la sua **transizione iniziale** uscente (`PseudoState → Idle`), attorno al
pseudostato compare del chrome extra:

- un **box grigio arrotondato** attorno al dot;
- il dot reso **bicolore** (metà nero / metà grigio) invece che nero pieno;
- un **trattino tratteggiato** corto che fa da connettore.

Diagnosi per esclusione (verificata via screenshot `selectionOnly`):

- **non è una maniglia di edit**: con `editMode=false` sparisce il pallino verde
  della transizione, ma il box grigio + dot bicolore + trattino **restano**;
- **non è una card**: `pws_update_annotation` non lo influenza;
- **non è un alias esplicito**: `pws_get_model` riporta `pseudoAliases: []`.

Sembra quindi un **ancoraggio-sorgente / ghost** del pseudostato che il renderer
disegna come nodo quando traccia la transizione iniziale, con il trattino come
connettore verso il dot d'origine.

### 5.2 Impatto

Non esiste oggi alcun flag MCP per sopprimerlo: `editMode=false` toglie solo le
maniglie verdi, `dashboards=false` non c'entra (e lascia i leader penzolanti, cfr §3).
Di conseguenza **non è possibile ottenere via API la figura pulita del libro**
(pallino nero + freccia) quando la transizione iniziale è in scena.

### 5.3 Cosa verificare lato sorgente editor

1. Identificare esattamente cos'è quel chrome: ancoraggio-sorgente della
   transizione iniziale, ghost del pseudostato, o rendering agganciato al sistema
   di alias (`pws_add_pseudo_alias` / `pws_link_pseudo_alias` / …).
2. Capire perché il dot diventa **bicolore** solo in questo contesto (stato di
   selezione? indicazione delle 2 configurazioni iniziali? marcatore di ancoraggio?).

### 5.4 Proposta API

Esporre il chrome come opzione controllabile in `pws_export` / `pws_screenshot`,
speculare agli altri flag di vista già presenti:

```json
{
  "initialAnchors": {
    "type": "boolean",
    "description": "Show/hide the pseudostate source-anchor chrome (grey box, ghost dot, dashed connector) drawn around a pseudostate when its initial transition is rendered. Default true. When false, the initial transition starts from a clean solid black dot."
  }
}
```

Comportamento atteso con `initialAnchors: false`: la transizione iniziale parte da
un **pallino nero pieno**, senza box/ghost/trattino — figura identica al libro.

Alternativa più economica (se accettabile semanticamente): **far seguire questo
chrome al flag `editMode`**, così che `editMode=false` lo rimuova insieme alle
maniglie verdi. In tal caso non serve un nuovo parametro, basta riclassificare
box/ghost/trattino come affordance di edit.

### 5.5 Bug correlato

Come per le dashboard (§3), qualunque **trattino/leader** verso chrome nascosto va
soppresso quando il chrome non è visibile.

---

## 7. Auto-layout "equilibrato" del modello

### 7.1 Obiettivo

Oltre all'allineamento degli stati serve una disposizione **ben bilanciata**:
stati distribuiti simmetricamente, transizioni corte e con pochi incroci, flusso
leggibile (pseudostato iniziale in alto, rami paralleli, card sopra la rispettiva
transizione). Esempio target: `Fail — Idle — Work` su una riga, pseudostato sopra
`Idle`, i due `start` simmetrici a sinistra/destra.

### 7.2 Esiste un algoritmo? Sì

Il problema è "graph drawing" classico; le famiglie rilevanti:

- **Layered / Sugiyama** (Sugiyama–Tagawa–Toda, 1981): dispone i nodi in livelli
  lungo una direzione, minimizza gli incroci e allinea i nodi. È l'ideale per
  macchine a stati con un flusso direzionato (pseudostato → stati). Il passo di
  *node placement* (es. **Brandes–Köpf**) produce proprio l'allineamento
  bilanciato/simmetrico che si vede nell'esempio.
- **Stress majorization / Kamada–Kawai**: ottime per layout **simmetrici ed
  equilibrati** senza direzione forte; utili come modalità alternativa.
- **Force-directed** (Fruchterman–Reingold): equilibrio "morbido", ma meno
  allineato — meno adatto a figure da libro.
- **Ortogonale**: massimo allineamento a griglia, look "circuito".

### 7.3 Libreria consigliata: ELK (Eclipse Layout Kernel)

Perché calza:

- **Java puro**, usabile fuori da Eclipse, pubblicato su **Maven Central** →
  integrazione diretta nell'editor (che è già in Java), senza processi esterni.
- Algoritmo **`org.eclipse.elk.layered`** = Sugiyama con routing straight/
  orthogonal/spline, node placement Brandes–Köpf, gestione delle porte.
- **Nato per gli statechart**: deriva dal tool KIEL/KLighD di layout di statechart,
  quando Graphviz non bastava. Offre anche `stress`, `force`, `mrtree`, `rectpacking`
  come modalità alternative dallo stesso kernel.

Alternative se non si vuole ELK: **Graphviz** `dot` (layered) via processo esterno
o binding; **JGraphX/mxGraph** `mxHierarchicalLayout` (Java, ma progetto in
manutenzione ridotta). Raccomandazione: **ELK layered** come default, `stress` come
modalità "bilanciata simmetrica".

### 7.4 Proposta API: `pws_auto_layout`

```json
{
  "name": "pws_auto_layout",
  "description": "Automatically arrange the controller for a balanced, readable layout (states aligned and evenly distributed, short edges, few crossings). Positions are updated in the model and repainted.",
  "inputSchema": {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "algorithm":   { "type": "string", "enum": ["layered", "stress", "force", "tree"],
                       "description": "Default 'layered' (Sugiyama). 'stress' for symmetric/balanced." },
      "direction":   { "type": "string", "enum": ["DOWN", "UP", "RIGHT", "LEFT"],
                       "description": "Main flow direction; default DOWN (initial pseudostate on top)." },
      "spacing":     { "type": "number", "description": "Base node-to-node spacing (px)." },
      "snapToGrid":  { "type": "boolean", "description": "Snap final centers to the editor grid. Default true." },
      "keepFailSink":{ "type": "boolean", "description": "Push fail states to the layout periphery. Default true." },
      "selectionOnly":{ "type": "boolean", "description": "Lay out only the current selection, keep the rest fixed." }
    }
  }
}
```

### 7.5 Note di integrazione

1. **Mapping modello → ELK**: ogni `ControllerState` → `ElkNode`; ogni transizione
   → `ElkEdge`; il pseudostato iniziale è la radice del layered (rank 0).
2. **Card e dashboard come label/porte**: modellare le card annotazione (e le
   dashboard, se visibili) come `ElkLabel`/nodi-porta così che l'algoritmo riservi
   spazio ed eviti sovrapposizioni testo/frecce.
3. **Post-processing**: dopo ELK, **snap-to-grid** dei centri (coerente con la
   griglia dell'editor) e riancoraggio delle card sopra il midpoint della curva
   (`pws_update_annotation` offset di default).
4. **Stabilità**: preservare l'orientamento scelto dall'utente quando possibile
   (`interactive`/`INTERACTIVE` in ELK) per evitare che ri-layout stravolgano
   figure già curate.
5. **Idempotenza**: due esecuzioni consecutive senza modifiche → stesso risultato.

### 7.6 Riferimenti

- ELK — Eclipse Layout Kernel: https://eclipse.dev/elk/
- ELK Layered (algoritmo): https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html
- ELK su GitHub (Java, Maven Central): https://github.com/eclipse-elk/elk
- "The Eclipse Layout Kernel", Domrös et al.: https://arxiv.org/pdf/2311.00533

---

## 8. Bug export: il canvas non riserva spazio alle dashboard fuori dal cluster

### 8.1 Sintomo (riproducibile)

Costruendo le figure R2 (dashboard di `Work` visibile) l'export PDF/SVG **taglia la
dashboard** quando è posizionata fuori dal cluster degli stati. Evidenza misurata
su due varianti dello stesso modello (LaserCover):

- `laserCover-R2-covered` → canvas **2089×1781** px, bbox contenuto `(450,31)-(1864,1467)`:
  dashboard interamente inclusa **con margine**.
- `laserCover-R2-uncovered` (identico ma senza la reazione `Work→Idle`) → canvas
  **1648×1075** px, bbox `(450,31)-(1648,1075)`: la bbox **tocca i bordi destro e
  inferiore** → dashboard tagliata.

Spostando la dashboard (`offsetX/offsetY`) si trova quasi sempre un solo intervallo
stretto in cui non viene tagliata, e spesso quell'intervallo **sovrappone lo stato**.
In modelli "compatti" non esiste alcuna posizione che sia insieme *dentro il canvas*
e *non sovrapposta*.

### 8.2 Causa

La dimensione del canvas di export dipende dai bounds del documento/viewport
(che variano con lo stato della sessione e col `.pws` salvato) e **non viene
ricalcolata per includere, con margine, le dashboard visibili** poste all'esterno
del bounding box di stati+transizioni. Due modelli quasi identici producono canvas
di dimensioni diverse.

### 8.3 Fix richiesto

In `pws_export` / `pws_screenshot`, quando `dashboards=true` (o per dashboard con
override per-stato visibile), calcolare i bounds di export come **unione di: stati +
transizioni + card annotazione + dashboard visibili**, poi aggiungere un **margine
uniforme** (es. 20–30 px). Il canvas deve espandersi di conseguenza, in modo
deterministico e indipendente dal viewport/dallo stato persistito.

Opzionale ma utile: parametro `margin` (px) su export/screenshot, e/o
`canvasWidth`/`canvasHeight` espliciti per forzare la dimensione.

### 8.4 Accettazione

- [ ] Due modelli identici a meno di una transizione producono canvas che includono
      entrambi la dashboard con lo stesso margine.
- [ ] Una dashboard posizionata a qualsiasi `offsetX/offsetY` non viene mai tagliata:
      il canvas si espande per contenerla.
- [ ] Il margine attorno al contenuto è uniforme sui quattro lati.

---

## 9. Gap emersi costruendo le figure R3 e R4

### 9.1 R3 — nondeterminismo non segnalato

Costruendo l'esempio R3 (due reazioni autonome concorrenti dalla stessa sorgente
sulla stessa exit zone: `Work→Idle [cover.Open]` **e** `Work→Halt [cover.Open]`),
il tool **non rileva** la violazione di determinismo:

- `pws_get_report` non ha una categoria per il determinismo (R3);
- l'exit zone in `pws_get_state` ha `coveredBy` **singolo** (`"Idle"`): la seconda
  reazione concorrente non viene registrata né segnalata;
- la dashboard di `Work` mostra la riga `RS` `Closed→Open ⇒ Idle` **verde**
  (coperta), come se tutto fosse a posto;
- le due transizioni concorrenti non sono colorate/evidenziate nel diagramma.

Fix richiesto: la verifica R3 deve rilevare più reazioni che coprono la stessa
exit zone di uno stato e segnalarle — `coveredBy` come **lista**, una voce
`nondeterministicExitZones` in `pws_get_report`, e colorazione delle transizioni
in conflitto. Senza questo, R3 non è illustrabile con un verdetto come le altre regole.

### 9.2 R4 — orphan exit zone non inducibile (badge `O` codice morto)

**Stato aggiornato.** L'editing degli stati di macchina è ora esposto
(`pws_rename_machine_state`, `pws_delete_machine_state`), quindi il punto 2 è
implementato. Restava però un difetto: costruire l'esempio R4 non produce una
*orphan exit zone*.

**Osservato.** Su `laserCover-base.pws`: `pws_rename_machine_state cover Closed Sealed`
→ `pws_recalculate` → `pws_get_report` dà `orphanExitZones: []`,
`unreachableStates: [Ready, Work]`, zona scoperta `Idle: Open→Sealed`, e le guardie
`[cover.Closed]` rese in rosso (riferimenti orphan). **Atteso:** `orphanExitZones`
popolato (badge `O`).

**Diagnosi (dallo sviluppo) — due difetti concorrenti.**

1. **Il rename non riscrive i riferimenti.** `handleRenameMachineState`
   (`RemoteControlServer.java:1255`) fa solo `state.setName(newName)` e ricalcola. I
   vincoli dei controller-state (`"(cover.Closed, laser.Off)"` su `Ready`/`Work`) e le
   guardie delle transizioni memorizzano il nome come testo/proposizione e restano
   **stantii** → da qui gli stati irraggiungibili e le guardie rosse.
2. **Le orphan exit zone non possono mai comparire dopo un recalculate — il badge `O`
   è codice morto.** Entrambi i percorsi che costruiscono le exit zone iterano sulle
   transizioni *attuali* della macchina:
   - percorso provvisorio da vincoli raw (`PWSStateMachine.java:888`): la proposition
     stantia `cover.Closed` non matcha nessuno stato sorgente e viene **scartata in
     silenzio** — nessuna zona, né orfana né scoperta;
   - percorso semantico (`PWSStateMachine.java:1181-1201`): `bs_source` nasce sempre da
     uno stato esistente.

   Quindi ogni zona ricalcolata ha per costruzione una sorgente valida e
   `isOrphanSource` (`ExitZone.java:154`) è sempre falso. La condizione documentata in
   `CBC_OBLIGATIONS.md §3` ("stale exit zone whose component source state no longer
   exists") **non è raggiungibile**: la stantiezza riemerge solo indirettamente come
   stati irraggiungibili + zone scoperte. Vale anche per `delete`, non solo per il rename.

**Fix (complementari — procedere con entrambi).**

- **A — rename reference-aware.** In `handleRenameMachineState`, riscrivere
  `machineId.oldName` → `machineId.newName` nei raw constraint text dei controller-state,
  nelle guardie (`BasicStateProposition`) e nelle azioni. Rende il rename sicuro: niente
  più stati irraggiungibili spuri né guardie rosse da refactor.
- **B — ripristinare la rilevazione orfani.** In `findProvisionalExitZones`, quando una
  bsp delle righe di vincolo non matcha nessuno stato della macchina, emettere una
  `ExitZone` **orfana** (`source = bsp`, `transition = null`) invece di scartarla.
  Copre `pws_delete_machine_state`, i vincoli editati a mano e gli stati cancellati.
  *Verificare* che i consumer (dashboard, report, serializzazione a
  `RemoteControlServer.java:2220`) tollerino `transition == null` prima di emettere la zona.

Con **A + B**: il rename diventa sicuro (A) e l'orphan exit zone viene rilevata quando
la sorgente davvero non esiste più (B) — la figura R4 si costruisce con
`pws_delete_machine_state cover Closed` (o un riferimento deliberatamente pendente),
ottenendo il badge `O` nel contesto dell'intero diagramma.

**Nota doc.** Dopo A, la frase "utile a indurre orphan exit zones" va spostata dalla
descrizione di `pws_rename_machine_state` a quella di `pws_delete_machine_state` (o
all'edit manuale dei vincoli).

---

## 10. Riepilogo — cosa il tool dovrà (ancora) supportare

**Già implementato e verificato:** `pws_update_dashboard` (visibilità/minimized/offset/reset),
`pws_auto_layout`, fail-state (`pws_update_state failState`), fix leader penzolanti,
chrome pseudostato che segue `editMode`, `showCard` per card vuote, canvas che include
le dashboard con `margin`; **rilevamento determinismo R3** (`nondeterministicExitZones`,
`coveredBy` come lista, `coveringTransitions`, transizioni in arancione, badge `N`);
**report deadlock** (`deadlockConfigurations` con `primary`/`secondary`); **legenda badge**
(`badgeLegend` in `pws_get_report`); **editing stati di macchina** esposto
(`pws_rename_machine_state`, `pws_delete_machine_state`).

**Ancora da supportare:**

1. **Orphan exit zone / badge `O` (R4).** L'editing degli stati di macchina è esposto, ma
   nessun percorso popola `orphanExitZones` dopo un recalculate (badge `O` codice morto).
   Servono i fix **A** (rename reference-aware) **e B** (emettere `ExitZone` orfana quando
   una bsp di vincolo non matcha alcuno stato di macchina) — vedi §9.2.
2. **Routing dritto delle transizioni singole.** Opzione linee diritte / reset control point
   via MCP (niente "bow" nelle figure a una transizione).

**Chiusi da questa iterazione:** determinismo R3, report deadlock, legenda badge, editing
stati di macchina (rename/delete esposti).

---

## 6. Checklist di accettazione

- [ ] `pws_update_dashboard { name, visible:false }` nasconde **solo** quella dashboard; le altre restano.
- [ ] `pws_update_dashboard { name, offsetX, offsetY }` sposta la dashboard; export/screenshot/canvas concordano.
- [ ] `pws_update_dashboard { name, resetPosition:true }` ripristina il default.
- [ ] Override per-stato batte il flag globale `dashboards` in entrambe le direzioni.
- [ ] Nessun leader tratteggiato verso dashboard nascoste.
- [ ] Round-trip: salva `.pws` → riapri → visibilità e offset preservati.
- [ ] `pws_get_state` riporta i campi `dashboard`.
- [ ] `pws_update_state { name:"Fail", failState:true }` (già esistente) rimuove l'anello rosso da exit zone su Fail — verifica di non-regressione.
- [ ] Con `initialAnchors:false` (o `editMode:false`, secondo la scelta §5.4) la transizione iniziale parte da un **pallino nero pieno**, senza box/ghost/trattino.
- [ ] Nessun trattino/leader residuo verso il chrome del pseudostato nascosto.
- [ ] `pws_auto_layout` produce una disposizione bilanciata (stati allineati/distribuiti, poche sovrapposizioni) ed è idempotente; `snapToGrid` allinea i centri alla griglia.
