# Clair — « Sachez avant de remettre la marchandise »

Web app (PWA) qui aide les commerçants de Yaoundé à décider en quelques secondes
si un SMS ou une capture de paiement Mobile Money mérite confiance.

**Clair ne dit jamais « paiement confirmé ».** Elle détecte les incohérences du
message, puis guide vers la seule preuve fiable : la hausse réelle du solde du
commerçant.

## Démo

- **URL en ligne** : à déployer sur [Deployxa](https://deployxa.com) — voir « Déploiement » ci-dessous.
- **Mode jury** : 3 scénarios préchargés (SMS cohérent, SMS falsifié, doublon)
  testables en 30 secondes, directement dans l'app (`Mode jury`).

## Le problème

Sur les marchés de Yaoundé, un commerçant doit décider en quelques secondes s'il
remet sa marchandise sur la foi d'un SMS de paiement Mobile Money — un document
facile à falsifier, à rejouer ou à présenter deux fois.

## Ce que fait Clair

- Saisie du **montant attendu** + **collage du SMS** en 2 gestes.
- **Moteur de 7 règles** (R1 format, R2 expéditeur, R3 montant, R4 fraîcheur,
  R5 doublon, R6 mots-pièges, R7 mise en forme) exécuté **100 % dans le
  navigateur** : aucun réseau, aucune donnée envoyée.
- **Verdict en 3 états** (Cohérent / À vérifier / Danger), en **4 canaux** :
  forme (cercle / triangle / octogone), mot, couleur, voix + vibration.
  Lisible en niveaux de gris, sans son, sans lire.
- **Preuve finale** : l'app n'affiche rien avant que le commerçant confirme que
  **son solde** a augmenté du montant attendu.
- **Historique local** avec détection de **doublons** de transaction.
- **FR / EN**, mode **soleil** (contraste maximal), tailles de texte A/A+/A++,
  **PWA installable et hors-ligne** (service worker écrit à la main).

## Installation

```bash
git clone <repo> && cd clair
python3 -m http.server 8000       # ou npx serve
# Ouvrir http://localhost:8000 sur un téléphone du même réseau
```

Aucun build, aucune dépendance à installer : HTML / CSS / JavaScript purs
(modules ES).

## Tests

```bash
node tests/engine.test.js         # 21 tests du moteur de règles
```

## Ce que Clair n'est pas (honnêteté)

Sans accès aux API des opérateurs, Clair **ne peut pas vérifier** qu'un
transfert a réellement eu lieu. Elle analyse la cohérence du message et du
contexte. Feuille de route : intégration opérateur officielle, flux communautaire
de motifs d'arnaques, audio Pidgin.

## Choix de conception

- **Accessibilité (WCAG 2.2 AA visé)** : verdict jamais porté par la seule
  couleur (principe 1.4.1), cibles tactiles 48–72 px, focus visible contour or,
  textes agrandissables en unités relatives, reflow testé à 320 px,
  `prefers-reduced-motion` respecté, navigation clavier complète,
  `role="status"` / `role="alert"` pour les verdicts.
- **Perf** : zéro framework, 4 polices WOFF2 auto-hébergées (sous-ensemble
  latin, ~64 Ko), service worker cache-first. Objectif < 150 Ko au premier
  chargement.
- **Vie privée** : tout l'historique et les réglages restent en `localStorage`
  sur le téléphone. Bouton « Effacer mes données ».

## Structure

```
├── index.html              écrans S1–S8, accessibles, landmarks
├── manifest.webmanifest    PWA
├── sw.js                   service worker cache-first
├── css/
│   ├── tokens.css          variables (couleurs, tailles, espacements)
│   ├── base.css            reset, focus, reflow, reduced-motion
│   ├── components.css      boutons, champs, cartes, verdict, nav
│   └── themes.css          mode soleil + mode sombre
├── js/
│   ├── app.js              routeur par hash, flows, mode jury
│   ├── engine.js           moteur de règles R1–R7 (+ R8 preuve finale)
│   ├── rules.json          règles et mots-pièges (calibrables)
│   ├── store.js            historique + réglages (localStorage)
│   ├── speech.js           Web Speech + Vibration API
│   └── i18n.js             FR / EN
├── assets/                 polices WOFF2, icônes PWA, og-image
├── tests/engine.test.js    tests du moteur (node)
└── README.md
```

## Déploiement (Deployxa)

1. Se connecter à Deployxa (CLI `deployxa` ou extension VS Code).
   Lire `deployxa.com/docs` pour les commandes exactes.
2. Depuis la racine du projet : `deployxa deploy` (dossier statique).
3. Vérifier l'URL publique **sur mobile**, installer la PWA, tester le mode
   jury et le mode hors-ligne (avion).
4. Redéployer à chaque fin de journée ; conserver les captures de la liste des
   déploiements (preuve pour le prix « Best Use of Deployxa »).

## Licences

- Polices : [Atkinson Hyperlegible](https://www.brailleinstitute.org/freefont/) et
  [Lexend](https://fonts.google.com/specimen/Lexend), SIL Open Font License 1.1.
- Icônes : SVG inline dessinés pour Clair (formes de verdict uniques).
- Code : licence à votre choix (recommandation : MIT).
