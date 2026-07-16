# Post-mortem — PWSEditor: pseudostati, alias e API remote-control

Destinatario: sviluppo (Fable5). Contesto: generazione automatica di figure per il libro PWS
tramite l'API/MCP remote-control di PWSEditor.

**Esito: tutti i punti risolti.** Verifica end-to-end effettuata dopo le fix: costruita via API
una transizione iniziale con `createAlias` + una transizione triggered con azione, poi export SVG
**senza salvare/riaprire** e render **senza alcun rammendo lato client**. Tutto pulito.

Questo documento resta come storico dei difetti e come base per i test di non-regressione. Il
repro minimale è nella stessa cartella (vedi in fondo).

---

## Riepilogo

| # | Difetto | Stato | Test di non-regressione |
|---|---------|-------|--------------------------|
| 1 | Alias pseudostato orfano non rimosso alla cancellazione della transizione iniziale | ✅ risolto | Creare iniziale con alias, cancellarla → `pseudoAliases` non contiene più l'alias; export senza marker scollegati |
| 2 | Mancava un verbo per creare una transizione iniziale "completa" (arco + alias posizionato e collegato) | ✅ risolto | `pws_add_transition(createAlias:true)` → `pseudoAliases` popolato, freccia dal centro dell'alias, nessun post-processing |
| 3 | Alias non esposti né gestibili via API/MCP | ✅ risolto | `pws_get_model` elenca gli alias con flag `orphan`; alias rimovibile via API senza toccare il file |
| 4 | Marker pseudostato "nativo" non emesso in SVG | ✅ risolto | Export di un'iniziale con alias contiene il marker ancorato alla coda della freccia |
| 5 | Card annotazioni non renderizzate su transizioni create via API (serviva save/reopen) | ✅ risolto | Dopo `add_transition` + `recalculate`, l'export mostra la card senza salvare/riaprire |
| 6 | Font hard-coded (`Lucida Grande`) non disponibile fuori da macOS → tofu sulle `〈 〉` | ✅ risolto | Stack font con fallback esplicito |
| 7 | Quoting `font-family` con apici singoli dentro `style='…'` → SVG non valido | ✅ risolto | L'export passa un parser XML stretto (`xmllint --noout`) |

**Come verificato (§2, §4, §5):** `pws_add_transition(source="PseudoState", target="Test",
trigger="_init", guard="cover.Open", createAlias:true, aliasX/Y)` ha ritornato
`{alias:{index,x,y,transitions:[…],orphan:false}, transition:{…}}`; l'export selezionato,
**senza save/reopen**, conteneva il marker dello pseudostato e le card `go`, `[(cover.Open)]`,
`〈 laser.on 〉`. XML ben formato, render diretto con `resvg` senza sostituzioni.

**Nota lato client (non un difetto dell'export).** `cairosvg` non fa fallback per-glifo su uno
stack font, quindi da solo mostra "tofu" sulle `〈 〉`. Un motore SVG conforme (browser, oppure
`resvg`/`librsvg`) rende l'export **così com'è**. Il libro rasterizza con `resvg`: **nessun
post-processing SVG residuo**.

---

## Dettaglio storico dei difetti (per riferimento)

### 1 — Alias pseudostato orfano non rimosso alla cancellazione della transizione iniziale
**Sintomo.** Nell'export SVG (e sul canvas) compariva un pallino nero extra, non connesso a
nulla, a coordinate fisse (centro 440,20).
**Causa.** Un `annotations.pseudoAliases = [{x:432,y:12}]` a livello controller rimasto orfano
(nessun `pseudoAliasByTransition`). Cancellando una transizione iniziale l'editor chiamava
`clearPseudoAliasForTransition` ma non `removePseudoAliasAt`: il legame veniva rimosso mentre
l'alias restava e continuava a essere disegnato.
**Fix attesa/applicata.** Rimozione automatica dell'alias quando si cancella l'ultima transizione
che lo usa (o conferma utente); opzionale garbage-collect degli orfani al load/save.

### 2 — Verbo per creare una transizione iniziale "completa"
**Problema.** `pws_add_transition(source="PseudoState", trigger="_init")` creava solo l'arco
`_init`, senza creare/posizionare/collegare l'alias: freccia non ancorata al centro dell'alias,
coda sfalsata, e senza alias il marker non veniva emesso nell'export (vedi §4).
**Fix applicata.** `pws_add_transition(..., createAlias:true, aliasX/Y)` crea + posiziona +
collega l'alias e ancora la freccia al suo centro.

### 3 — Alias esposti e gestibili via API/MCP
**Problema.** Gli alias erano invisibili all'API e non gestibili: un client non poteva
diagnosticare/correggere §1/§2 senza editare il JSON del `.pws`.
**Fix applicata.** `pws_get_model` include `pseudoAliases` (index, x, y, transitions, orphan);
CRUD alias: `pws_add_pseudo_alias`, `pws_move_pseudo_alias`, `pws_link_pseudo_alias`,
`pws_delete_pseudo_alias`.

### 4 — Marker pseudostato "nativo" non emesso in SVG
**Problema.** Una transizione iniziale senza alias mostrava il pallino sul canvas ma non lo
emetteva nell'export.
**Fix applicata.** L'export emette il marker dello pseudostato, coerente col canvas.

### 5 — Card annotazioni non renderizzate su transizioni create via API
**Problema.** Le card guardia/azione di una transizione creata via API non comparivano finché il
file non veniva salvato e riaperto.
**Fix applicata.** La card è materializzata alla creazione/`recalculate`, senza ciclo
save/reopen.

### 6 — Portabilità font
**Problema.** L'export usava `font-family: "Lucida Grande"`; fuori da macOS i caratteri `〈` `〉`
(U+3008/U+3009) cadevano su glifo mancante.
**Fix applicata.** Stack con fallback esplicito, es.
`"Lucida Grande", "Helvetica Neue", Helvetica, Arial, "Noto Sans", "Noto Sans CJK JP", sans-serif`.

### 7 — Quoting `font-family` (regressione della fix §6, poi risolta)
**Problema.** Lo stack font usava apici singoli per i nomi font dentro un attributo `style='…'`
anch'esso ad apici singoli, chiudendo prematuramente l'attributo → SVG non XML-valido (i browser
tolleravano, i parser stretti fallivano).
**Fix applicata.** Virgolette doppie per i nomi font dentro `style='…'`:
`font-family: "Lucida Grande", …, "Noto Sans CJK JP", sans-serif;`.

---

## Repro allegato
Cartella `repro-pseudostate-svg/`: `minimal-initial-BUG.pws(.txt)` (riproduce il §1),
`minimal-initial-FIXED.pws(.txt)`, `minimal-initial-EXPORT-BUG.svg`, e il confronto
`GOT-buggy-export.png` vs `EXPECTED-single-connected-dot.png`. Dettagli in `README.md`.
