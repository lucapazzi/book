# Revisione del libro dopo il cambio di modello — introduzione degli eventi

Confronto tra il testo attuale dei capitoli e la semantica del modello a eventi
come definita in PWSEditor 5.0 (fonti autorevoli: `docs/CBC_OBLIGATIONS.md`,
`docs/INTERNAL_CONFIGURATIONS.md`, `src/pws/editor/semantics/Semantics.java`,
`CHANGELOG.md`).

---

## 1. Cosa è cambiato nel modello (sintesi autorevole)

Il modello a eventi introduce/formalizza tre elementi che il libro non copre ancora
in modo esplicito:

**(a) Le azioni del controllore sono eventi `machine.event` (M.E), con semantica stretta.**
`Semantics.transformByMachineEvent(machineId, eventName, …)` funziona così:
- *Dominio*: le configurazioni che contengono `{M:S}`, dove `S` è lo stato sorgente
  di una transizione del componente `M` innescata dall'evento `E`.
- *Codominio*: si sostituisce `{M:S}` con `{M:T}` (stato bersaglio della transizione).
- *Regola stretta*: **le configurazioni in cui l'evento non può scattare vengono
  scartate** (il contributo è ⊥/bottom), non propagate inalterate. Il codice lo
  chiama esplicitamente *"strict event semantics"*.

**(b) Gli eventi sono bidirezionali.** Oltre ai comandi controllore→componente
(azioni `m.e`), i componenti possono **emettere** eventi (`emits`, resi `fail!`)
che il controllore **cattura** con un *trigger di evento* `c.e`:
- *emissione catturata*: il codominio della transizione emittente contribuisce allo
  stato-bersaglio della cattura; non allarga l'`SS` dello stato sorgente;
- *emissione non catturata*: il self-loop implicito la **assorbe** (l'`SS` resta
  invariato; aggiungere `emits` non cambia la semantica finché non esiste una cattura);
- *transizione emittente di confine* (bersaglio fuori dal dominio dei vincoli): resta
  una exit zone, e una cattura conta come copertura della zona.

**(c) I trigger raggruppano le transizioni.** Le transizioni si raggruppano per
(stato sorgente, evento innescante); le transizioni iniziali appartengono al gruppo
sintetico `_init`. Le obbligazioni di partizione delle guardie (copertura, overlap,
partizione incompleta) valgono **per gruppo di trigger**.

Nuove obbligazioni CBC connesse: *dead event trigger* (`c.e` mai attivabile),
*duplicate event trigger*, *emission on commanded transition* (senza effetto),
*absorbed emission* e *uncaptured output* (informative).

---

## 2. Incoerenze per capitolo

### Part II — The PWS Model (`part-2-the-pws-model.html`)

1. **Doppio canale di input, manca il terzo.** Il testo dice che i controllori hanno
   due flussi d'ingresso: «observations of component states» e «external triggers or
   commands from outside sources». Nel nuovo modello c'è un **terzo canale**: gli
   **eventi emessi dai componenti** e catturati dai trigger `c.e`. Da aggiungere.

2. **«event» usato solo per i trigger esterni.** Le transizioni «event-triggered with
   actions» sono descritte come «commands issued to the Assembly» in notazione
   `⟨laser.on⟩`. Va reso esplicito che un'azione **è** un evento `machine.event`
   inviato al componente, e non un semplice "comando" opaco — è lo stesso oggetto
   (evento) che, dal lato componente, innesca una transizione.

3. **Tre tipi di transizione → quattro.** L'elenco «initial / guard-triggered /
   event-triggered with actions» non include le transizioni **innescate da un evento
   emesso dal componente** (cattura `c.e`). Andrebbe aggiunto come quarto tipo, o il
   secondo/terzo tipo riformulati per distinguere *evento esterno* da *evento del
   componente catturato*.

4. **Terminologia «command».** Ci sono 23 occorrenze di "command". Non serve
   eliminarle, ma va introdotta una volta l'equivalenza esplicita: *comando = evento
   `m.e` diretto a un componente*, così il resto del libro resta coerente.

### Part III — Configuration Semantics (`part-3-configuration-semantics.html`)

5. **Il passo induttivo non è "stretto".** Sezione *Computing configurations*:
   «every configuration in Conf(s) is transformed (subject to guards and component
   capabilities), and the resulting configurations are accumulated into Conf(t)» e
   «some configurations are transformed … these may already belong … or may not, in
   which case they are added». Questa formulazione **non dice** che, sotto semantica
   stretta, le configurazioni in cui l'evento **non può scattare vengono scartate**.
   È il punto centrale del cambio di modello: va riscritto il passo induttivo
   distinguendo:
   - transizione **senza azione** (guard-only): identità/pass-through — `t` eredita le
     configurazioni di `s` (già detto correttamente più avanti);
   - transizione **con azione `m.e`**: si applica `transformByMachineEvent` — solo il
     **codominio** passa a `t`; le configurazioni dove `E` non è abilitato **non
     transitano** (contributo ⊥).

6. **Rischio di ambiguità sul termine "strict".** Il capitolo usa già «strict subset»
   in senso insiemistico ("Conf ⊊ Sem"). Introdurre "strict event semantics" senza
   distinguere i due usi confonde. Usare una dicitura diversa in italiano/inglese
   (es. *semantica stretta degli eventi* / *strict firing semantics*) e definirla una
   volta.

7. **Manca del tutto il livello emissione/cattura.** In Part III non si parla di eventi
   emessi dai componenti né di come una cattura `c.e` contribuisce al `Conf` dello
   stato-bersaglio (e non a quello sorgente). È il buco più grosso: o si aggiunge una
   sezione, o si rimanda esplicitamente a un capitolo dedicato.

### Part IV — Rules (semantics / reactive / liveness)

8. **`part-4-rules-semantics.html`** — la Figura 5 (colorazione delle azioni) descrive
   già l'azione orfana in termini di "fireable ⟨laser.on⟩". È coerente con la semantica
   stretta ma non la nomina: conviene collegare esplicitamente l'azione orfana alla
   regola "l'evento `m.e` non è raggiungibile dalla semantica sorgente" (definizione
   in `CBC_OBLIGATIONS.md` §Action obligations).

9. **"absorb" usato in senso informale.** In R5 «a Fail state that absorbs the
   open-cover case» usa "absorb" col significato colloquiale. Il modello ha ora un
   significato **tecnico** preciso di *absorption* (self-loop implicito che assorbe
   un'emissione non catturata). Vanno distinti: o si cambia la parola nel caso R5, o
   si definisce il termine tecnico e si evita l'uso colloquiale.

10. **Nessuna copertura delle nuove obbligazioni sugli eventi.** Le regole non trattano
    *dead event trigger*, *duplicate event trigger*, *emission on commanded transition*,
    *absorbed / uncaptured emission*. Se il Part IV vuole essere l'elenco completo delle
    obbligazioni CBC, mancano queste voci legate agli eventi.

11. **Partizione delle guardie "per gruppo di trigger".** Le obbligazioni di partizione
    (copertura/overlap/partizione incompleta) ora sono definite **per gruppo di trigger**
    (stesso stato sorgente + stesso evento; le iniziali nel gruppo `_init`). Verificare
    che il testo di R5 riformuli la partizione in questi termini, non solo "sullo stato".

---

## 3. Priorità suggerite

1. **Alta** — Part III §Computing configurations: riscrivere il passo induttivo con la
   semantica stretta (punto 5). È il cuore del cambio di modello.
2. **Alta** — Introdurre il livello emissione/cattura/assorbimento (punti 1, 3, 7):
   decidere se sezione nuova in Part II+III o capitolo dedicato.
3. **Media** — Allineare la terminologia azione=evento `m.e` e "command" (punti 2, 4);
   disambiguare "strict" e "absorb" (punti 6, 9).
4. **Media** — Completare le obbligazioni CBC sugli eventi in Part IV (punti 10, 11) e
   collegare l'azione orfana (punto 8).

---

## 4. Nota di metodo

I punti sopra derivano dal confronto testo↔codice/doc. Prima di riscrivere, converrebbe
confermare con l'autore l'*intenzione editoriale*: se il livello emissione/cattura debba
entrare nel libro base o restare avanzato, e quale terminologia italiana canonica adottare
per *event / trigger / action / emission / capture / absorption*.
