# Specifica di prodotto — Stati di macchina, orphan zone e robustezza del recalc (PWSEditor)

Stato: proposta. Deriva dalla diagnosi in `MCP-API-dashboard-implementation.md` §9.2 e
dalla discussione di design sul trattamento delle orphan exit zone (R4).

## 1. Principio guida

Un PWS è un **oggetto formale** che esiste indipendentemente dall'editor: si può
scrivere anche su carta, e **un PWS scorretto è un oggetto legittimo** (come un
programma con un bug). La **correttezza-per-costruzione (CbC)** è una *metodologia*
— il discharge delle obbligazioni R1–R8 — **non** un vincolo che l'editor impone a
monte.

Ne discende la politica dell'editor:

> **Rappresentare fedelmente + diagnosticare, mai prevenire.**

L'editor deve poter rappresentare qualunque PWS (anche scorretto) e **segnalare**
dove e perché viola le regole. La prevenzione degli errori sta nel *seguire la
metodologia CbC*, non nel rifiutare le operazioni di editing.

Corollario: **nessun blocco** delle operazioni di editing per motivi di
correttezza. In particolare, cancellare uno stato di macchina che è referenziato
**non va bloccato**: va eseguito, e la orphan zone risultante va diagnosticata.
Bloccare sarebbe anche incoerente, perché lo stesso PWS scorretto è raggiungibile
scrivendo a mano un vincolo che nomina uno stato inesistente.

## 2. Obiettivi e non-obiettivi

**Obiettivi**
- Il recalc non lancia mai eccezioni non gestite su un modello strutturalmente
  incoerente.
- Le orphan exit zone sono rilevate e segnalate (badge `O`) da **tutte** le vie che
  le producono, in modo uniforme.
- `delete_machine_state` e `rename_machine_state` non fanno crashare l'editor.

**Non-obiettivi**
- **Non** impedire (bloccare) la creazione di PWS scorretti.
- **Non** rendere R4 una regola "prevenuta per costruzione": resta *diagnosticabile*
  come R1–R3, R5–R8.
- L'auto-riscrittura dei riferimenti (fix A) non è un meccanismo di correttezza ma
  una comodità di refactoring (vedi §3, R-E).

## 3. Requisiti

### R-A — Robustezza del recalc (obbligatorio, priorità 1)
Il ricalcolo automatico delle semantiche **non deve mai** propagare un'eccezione non
gestita fino alla UI. Su un modello con riferimenti pendenti (uno stato di macchina
referenziato ma inesistente) il recalc deve:
- completare senza throw;
- produrre semantiche parziali coerenti con ciò che è calcolabile;
- marcare come diagnostica ogni incoerenza (orphan zone, stati irraggiungibili).

Bug noto da coprire: `IllegalArgumentException: No transition triggered by event on
found in machine laser`, sollevata durante il recalc dopo la cancellazione di
`cover.Closed`. Il lookup delle transizioni di componente deve tollerare l'assenza.

### R-B — `delete_machine_state` non bloccante (obbligatorio)
La cancellazione di uno stato di componente **riesce sempre** (nessun blocco per
correttezza). Dopo la cancellazione:
- gli stati controller / le guardie / le azioni che referenziano lo stato rimosso
  restano con riferimenti **pendenti**;
- le exit zone la cui sorgente di macchina non esiste più sono emesse come
  **orphan** (badge `O`, `transition == null`);
- nessun crash (vedi R-A).

### R-C — Diagnosi uniforme delle orphan zone (obbligatorio, = fix B)
Una orphan exit zone deve essere rilevata e segnalata **indipendentemente dalla via**
con cui è stata prodotta:
1. `delete_machine_state`;
2. `rename_machine_state` senza riscrittura dei riferimenti;
3. **edit manuale del vincolo** di uno stato controller verso uno stato di macchina
   inesistente (es. `Work = (cover.Sealed, laser.On)` con `cover ∈ {Open, Closed}`).

Comportamento: in `findProvisionalExitZones`, quando una `BasicStateProposition` di
una riga di vincolo non matcha alcuno stato della macchina, emettere una `ExitZone`
orfana (`source = bsp`, `transition = null`) invece di scartarla in silenzio.
Consumer da rendere tolleranti a `transition == null`: dashboard, `pws_get_report`
(`orphanExitZones`), serializzazione MCP.

Verifica di coerenza: gli approcci (1) e (3) devono produrre lo **stesso** verdetto
per lo stesso stato (badge `O` sulla riga `RS`).

### R-D — Avvisi non bloccanti (opzionale, raccomandato)
Le operazioni distruttive che produrranno riferimenti pendenti possono mostrare un
**avviso informativo con conferma** ("questa operazione lascerà N riferimenti a
`cover.Closed` e produrrà orphan zone su: Ready, Work — continuare?"). L'avviso
**non** impedisce l'operazione: se confermata, procede e la diagnosi segnala il
risultato. È UX, non correttezza.

### R-E — Rename reference-aware (opzionale, = fix A)
`rename_machine_state` può riscrivere `machineId.oldName → machineId.newName` nei
raw constraint text degli stati controller, nelle guardie (`BasicStateProposition`)
e nelle azioni, così che un semplice rename **non** rompa il modello. È una
**comodità di refactoring**, non un meccanismo di correttezza: non impedisce di
raggiungere un PWS scorretto per altre vie, e non va usato per "nascondere" orphan
zone legittime.

## 4. Comportamento atteso per operazione

| Operazione | Esito | Diagnosi |
|---|---|---|
| `delete_machine_state` su stato referenziato | **riesce**, nessun crash | orphan zone (`O`) + eventuali stati irraggiungibili/deadlock |
| `rename_machine_state` con R-E attivo | **riesce**, modello sano | nessuna (riferimenti riscritti) |
| `rename_machine_state` senza R-E | **riesce**, nessun crash | orphan zone (`O`) sui riferimenti stantii |
| `set_constraints` verso stato inesistente | **riesce** | orphan zone (`O`) localizzata su quello stato |
| Qualunque via → PWS scorretto | mai bloccata | sempre segnalata |

## 5. Criteri di accettazione

- [ ] `delete_machine_state cover Closed` su `laserCover-base.pws` → `recalculate`
      **non lancia eccezioni**; `get_report` restituisce `orphanExitZones` popolato.
- [ ] `set_constraints Work = (cover.Sealed, laser.On)` (con `cover ∈ {Open,Closed}`)
      → orphan zone `O` **solo** su `Work`, resto del controller invariato, nessun crash.
- [ ] Gli esiti di (delete) e (set_constraints) mostrano lo **stesso** badge `O` sulla
      riga `RS` della dashboard dello stato interessato.
- [ ] Il recalc su modello con riferimenti pendenti non blocca la UI e produce
      semantiche parziali.
- [ ] Nessuna operazione di editing è rifiutata per motivi di correttezza (solo
      eventuali avvisi non bloccanti, R-D).
- [ ] Con R-E attivo, un rename non lascia guardie rosse né stati irraggiungibili spuri.
- [ ] Serializzazione MCP e dashboard tollerano `transition == null` nelle exit zone orfane.

## 6. Impatto su documentazione e sul libro

- Aggiornare la descrizione dei tool: la frase "utile a indurre orphan exit zone" va
  su `set_constraints` / `delete_machine_state`; con R-E, `rename_machine_state` non
  induce più orphan zone.
- Libro (Parte IV, R4): la figura dell'orphan exit zone (badge `O`) resta valida e va
  prodotta preferibilmente via **edit del vincolo** (localizzata, non distruttiva),
  oppure via `delete` una volta soddisfatto R-A.

## 7. Riferimenti al codice (dalla diagnosi dello sviluppo)

- `RemoteControlServer.java:1255` — `handleRenameMachineState` (fix A).
- `PWSStateMachine.java:888` — percorso provvisorio da vincoli raw (fix B: emettere
  orphan invece di scartare).
- `PWSStateMachine.java:1181-1201` — percorso semantico (idem).
- `ExitZone.java:154` — `isOrphanSource`.
- `RemoteControlServer.java:2220` — serializzazione exit zone (tollerare `transition == null`).
- `CBC_OBLIGATIONS.md §3` — definizione di orphan exit zone.
