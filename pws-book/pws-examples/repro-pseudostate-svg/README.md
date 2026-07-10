# Repro — pallino pseudostato "fantasma" (alias orfano nel .pws)

## Causa confermata (dallo sviluppo)
Il pallino extra **non** è un bug del renderer né una coordinata hard-coded. È un dato
presente nel `.pws`: un **pseudostate alias orfano** salvato nelle annotazioni del
controller.

- Il controller ha `annotations.pseudoAliases = [{x: 432, y: 12}]`. L'alias è disegnato
  come cerchio di diametro 16 con quel top-left, quindi il centro cade esattamente a
  **(440, 20)** — le coordinate viste nell'SVG.
- Gli alias sono una feature UI legittima ("Create pseudostate alias"): copie visive dello
  pseudostato da cui far partire frecce iniziali senza incrociare il diagramma. Vengono
  disegnati sempre, sia sul canvas sia nell'export — per questo il pallino compare anche
  nello screenshot.
- Il difetto è che qui l'alias è **orfano**: nessuna transizione lo referenzia
  (`pseudoAliasByTransition` del controller è assente).

## Come si produce l'orfano (bug a monte)
Cancellando una transizione iniziale, l'editor rimuove il legame transizione→alias ma
**non** l'alias stesso (`clearPseudoAliasForTransition` senza `removePseudoAliasAt`).
In questo caso: il modello del libro derivava da `laserCover` con una transizione iniziale
`PseudoState → Ready` a cui era associato l'alias; cancellando quella transizione, l'alias
è rimasto orfano e continua a essere disegnato a (440,20).

## File del repro
- `minimal-initial-BUG.pws` — modello minimale (`PseudoState → Idle [_init]`) **con** l'alias
  orfano: riproduce il pallino fantasma in canvas ed export.
- `minimal-initial-FIXED.pws` — stesso modello senza l'entry `pseudoAliases`: un solo
  pallino, connesso alla freccia iniziale.
- `minimal-initial-EXPORT-BUG.svg` — export SVG del caso BUG.
- `GOT-buggy-export.png` vs `EXPECTED-single-connected-dot.png` — confronto visivo.
- Copie `*.pws.txt` (JSON) per gli uploader che rifiutano l'estensione `.pws`.

## Prova nel file SVG del caso BUG
Due marker `rx=8`:

```
cx='258.0' cy='63.0'   <- pseudostato reale (la freccia iniziale parte da 258,70)   OK
cx='440.0' cy='20.0'   <- alias ORFANO, disegnato sempre, scollegato               BUG
```

## Rimedi immediati (senza toccare il codice)
- Nell'editor: tasto destro sul pallino isolato → **Delete pseudostate alias**, poi salvare; **oppure**
- rimuovere l'entry `annotations.pseudoAliases` dal JSON del `.pws` (è ciò che è stato fatto
  sui file del libro: `laserCover-R5-incomplete.pws` e `laserCover-R5-partition.pws`).

## Note per lo sviluppo (eventuali migliorie a monte)
1. **Rimozione automatica dell'alias** quando viene cancellata l'ultima transizione che lo usa
   (o chiedere conferma), così da non generare orfani.
2. **Esporre gli alias in `GET /model` / MCP**: oggi sono invisibili all'API, per cui un client
   (come quello usato per il libro) non può né vederli né rimuoverli — deve intervenire sul JSON
   o via UI.
3. **(minore)** Nell'export l'unico marker dello pseudostato "nativo" (senza alias) non viene
   emesso in SVG mentre è visibile sul canvas: chi esporta un iniziale senza alias resta senza
   pallino. Le figure del libro lo ridisegnano in post-processing sulla coda della freccia.

## Note collaterali sull'export (indipendenti dal repro)
- **Card annotazioni su transizioni create via API**: non vengono renderizzate finché il file non
  viene **salvato e riaperto**.
- **Font non portabile**: l'export usa `font-family: "Lucida Grande"`; fuori da macOS i caratteri
  `〈` `〉` (U+3008/U+3009) cadono su glifo mancante (tofu). Meglio incorporare il font o usare uno
  stack con fallback.
