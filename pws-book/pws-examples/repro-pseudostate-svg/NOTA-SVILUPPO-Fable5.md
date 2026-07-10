# Nota per lo sviluppo — PWSEditor: pseudostati, alias e API remote-control

Destinatario: sviluppo (Fable5). Contesto: generazione automatica di figure per il libro PWS
tramite l'API/MCP remote-control di PWSEditor. Sotto: cause confermate, difetti aperti e
richieste di implementazione, con criteri di accettazione.

---

## 1. Bug — alias pseudostato orfano non rimosso alla cancellazione della transizione iniziale

**Sintomo.** Nell'export SVG (e sul canvas) compare un pallino nero extra, non connesso a
nulla, a coordinate fisse (centro 440,20).

**Causa (confermata).** È un `annotations.pseudoAliases = [{x:432,y:12}]` a livello controller
rimasto **orfano**: nessuna transizione lo referenzia (`pseudoAliasByTransition` assente).
Cancellando una transizione iniziale l'editor chiama `clearPseudoAliasForTransition` ma **non**
`removePseudoAliasAt`, quindi il legame transizione→alias viene rimosso mentre l'alias resta e
continua a essere disegnato.

**Richiesta.**
- Alla cancellazione dell'ultima transizione che usa un alias, **rimuovere automaticamente
  l'alias** (o chiedere conferma all'utente).
- Opzionale: un "garbage-collect" degli alias orfani al load/save del modello.

**Criteri di accettazione.**
- Creando una transizione iniziale con alias e poi cancellandola, `pseudoAliases` non contiene
  più l'alias corrispondente.
- Un modello caricato con alias orfani viene ripulito (o segnalato) e l'export non contiene
  marker scollegati.

---

## 2. Gap API — manca un verbo per creare una transizione iniziale "completa"

**Problema.** L'unico modo via API è `pws_add_transition(source="PseudoState", trigger="_init")`.
Questo crea l'arco `_init` nel modello ma **non** crea, posiziona e collega l'alias dello
pseudostato. Risultato: la freccia iniziale non è ancorata al centro di un alias, la coda è
sfalsata rispetto allo pseudostato, e senza alias il marker non viene nemmeno emesso nell'export
SVG (vedi §4). Le transizioni iniziali create dalla UI, invece, hanno alias creato + posizionato
+ referenziato via `pseudoAliasByTransition`, e la freccia parte pulita dal centro dell'alias.

**Richiesta (una delle due).**
- **A)** Nuovo verbo dedicato, es.
  `pws_add_initial_transition(target, alias?: {x,y}, guard?, actions?)`
  che internamente: crea l'arco `_init` da `PseudoState`, crea l'alias (in `alias` se fornito,
  altrimenti in una posizione di default sensata vicino al target), lo **collega** via
  `pseudoAliasByTransition`, e ancora la geometria della freccia al **centro** dell'alias.
- **B)** In alternativa, un flag/parametro su `pws_add_transition`, es.
  `createAlias: true, aliasPos?: {x,y}`, con lo stesso comportamento.

**Criteri di accettazione.**
- Dopo la chiamata, `pseudoAliases` contiene l'alias, `pseudoAliasByTransition` lo collega alla
  nuova transizione, e nell'export SVG la freccia iniziale parte dal centro del pallino.
- Nessun post-processing lato client necessario per ottenere il pallino iniziale.

---

## 3. Gap API — gli alias non sono esposti né gestibili via API/MCP

**Problema.** Gli alias oggi sono invisibili all'API (`GET /model` / MCP non li riporta) e non
esiste alcun comando per crearli, spostarli, collegarli o cancellarli. Un client non può né
diagnosticare né correggere i casi §1/§2 senza editare direttamente il JSON del `.pws`.

**Richiesta.**
- Includere gli alias in `pws_get_model` (posizione, indice, transizione collegata, eventuale
  stato orfano).
- CRUD sugli alias:
  `pws_add_pseudo_alias(pos)`, `pws_move_pseudo_alias(index,pos)`,
  `pws_link_pseudo_alias(index, transitionId)`, `pws_delete_pseudo_alias(index)`.

**Criteri di accettazione.**
- `pws_get_model` elenca gli alias e per ciascuno indica se è collegato o orfano.
- È possibile rimuovere un alias orfano via API senza toccare il file.

---

## 4. Difetto export — marker pseudostato "nativo" non emesso in SVG

**Problema.** Una transizione iniziale **senza alias** mostra il pallino dello pseudostato sul
canvas ma **non** lo emette nell'export SVG. Chi esporta resta senza pallino iniziale (nel libro
è stato ridisegnato in post-processing sulla coda della freccia).

**Richiesta.** L'export SVG deve emettere il marker dello pseudostato anche in assenza di alias,
coerente con quanto mostrato sul canvas.

**Criteri di accettazione.** Export SVG di un modello con transizione iniziale senza alias
contiene un marker dello pseudostato nella stessa posizione del canvas.

---

## 5. Difetto export — card annotazioni non renderizzate su transizioni create via API

**Problema.** Le card guardia/azione di una transizione **creata via API** non compaiono
nell'export (né sul canvas) finché il file non viene **salvato e riaperto**. Dopo save+reopen
compaiono correttamente.

**Richiesta.** Materializzare la card di annotazione al momento della creazione via API (o al
successivo `recalculate`), senza richiedere un ciclo save/reopen.

**Criteri di accettazione.** Dopo `pws_add_transition(...)` + `pws_recalculate`, l'export mostra
la card della transizione senza necessità di salvare e riaprire.

---

## 6. Portabilità export — font hard-coded non disponibile fuori da macOS

**Problema.** L'export SVG usa `font-family: "Lucida Grande"`. Fuori da macOS il font manca; in
particolare i caratteri delle parentesi angolari `〈` `〉` (U+3008/U+3009 usati per le azioni)
cadono su glifo mancante ("tofu").

**Richiesta.** Incorporare il font nell'SVG (o usare uno stack con fallback esplicito, es.
`"Lucida Grande", "Helvetica Neue", Arial, "Noto Sans CJK", sans-serif`), così che l'export sia
renderizzabile su qualsiasi piattaforma senza sostituzioni.

**Criteri di accettazione.** L'SVG esportato si renderizza con testo e parentesi angolari
corretti su Linux/Windows senza il font macOS installato.

---

## STATO (aggiornamento dopo la nuova release del server MCP)
Verificato rigenerando la Figura 5 (R6) del libro:
- §1 **risolto** — nessun alias orfano; export pulito.
- §2 **risolto** — `pws_add_transition(..., createAlias:true, aliasX/Y)` disponibile.
- §3 **risolto** — `pws_get_model` ora elenca `pseudoAliases` (index, x, y, transitions, orphan);
  CRUD alias presente (`add/move/link/delete_pseudo_alias`). 👍 sblocca il client.
- §6 **implementato** ma con **regressione** (vedi §7 sotto).
- §4, §5 non ri-testati in questa tornata (la Figura 5 non usa transizioni iniziali).

---

## 7. REGRESSIONE (nuova) — font-family con apici singoli dentro attributo `style='…'` → SVG non valido

**Problema.** La fix §6 ha introdotto uno stack font che usa **apici singoli** per i nomi font,
ma è inserito dentro un attributo `style` a sua volta delimitato da **apici singoli**:

```
<text ... style='fill: rgb(0,0,0); ... font-family: 'Lucida Grande', 'Helvetica Neue', Helvetica, Arial, 'Noto Sans', 'Noto Sans CJK JP', sans-serif; font-size: 12px;' ...>
```

Il primo `'` di `'Lucida Grande'` **chiude prematuramente** l'attributo `style`, quindi l'SVG
**non è XML ben formato**. I browser tolleranti lo renderizzano, ma i parser stretti falliscono
(cairosvg/ElementTree: *"not well-formed (invalid token)"* alla prima occorrenza). Ho dovuto
normalizzare il quoting lato client per poter renderizzare.

**Richiesta.** Nell'export SVG, usare un quoting coerente per `font-family`:
- **A)** virgolette doppie per i nomi font: `font-family: "Lucida Grande", "Helvetica Neue", …;`
  (l'attributo `style` è ad apici singoli, quindi le doppie interne sono valide); **oppure**
- **B)** delimitare l'attributo `style` con virgolette doppie e usare apici singoli all'interno.

**Criteri di accettazione.** L'SVG esportato passa un parser XML stretto (es. `xmllint --noout`)
e si renderizza con cairosvg senza modifiche lato client; parentesi angolari `〈 〉` corrette.

---

## Priorità suggerita (dal punto di vista del client "generazione figure")
0. §7 (quoting font-family) — **quick fix**, oggi l'SVG non è XML valido.
1. §3 (esporre/gestire alias via API) — sblocca tutto il resto senza rammendi.
2. §2 (verbo transizione iniziale completa) — qualità grafica immediata.
3. §1 (no alias orfani) — robustezza dei modelli.
4. §4, §5, §6 (difetti export) — fedeltà e portabilità dell'output.

## Repro allegato
Cartella `repro-pseudostate-svg/`: `minimal-initial-BUG.pws(.txt)` (riproduce),
`minimal-initial-FIXED.pws(.txt)`, `minimal-initial-EXPORT-BUG.svg`, e il confronto
`GOT-buggy-export.png` vs `EXPECTED-single-connected-dot.png`. Dettagli in `README.md`.
