# Code Training

Ma plateforme d'entraînement personnelle pour les **entretiens techniques** en Python, data et IA : des exercices de code testés automatiquement (dans l'esprit de LeetCode et deep-ml), de la répétition espacée pour retenir la syntaxe, des labs interactifs pour comprendre ce qu'il se passe vraiment, des projets guidés et des entretiens blancs.

Python s'exécute **dans le navigateur** (Pyodide/WebAssembly, sur le processeur de ta machine). Un **runner local** optionnel permet d'utiliser ton propre Python, avec PyTorch et le GPU.

## Ce qu'il y a dedans

| Section | Contenu |
|---|---|
| **Accueil** | Plan du jour (cartes → exercice → quiz), objectif d'XP, série de jours, maîtrise par domaine, heatmap d'activité, badges |
| **Exercices** | 137 exercices avec tests visibles et cachés : Python, NumPy, Pandas, SQL, probas & stats, ML, Deep Learning, algo. Indices progressifs, solution, fiche « À retenir », notes perso, chrono, et un onglet **Doc** pour chercher une fonction sans quitter l'exercice. Certains ont un **bonus de complexité** : validés même en O(n²), mais avec un conseil si la complexité attendue en entretien n'est pas atteinte |
| **Mémoire** | 269 cartes de syntaxe. Tu **tapes** la réponse, elle est **exécutée** et comparée à la référence (types et dtypes compris), puis reprogrammée par répétition espacée (SM-2). Mode **« Réécris de mémoire »** : refaire un exercice déjà résolu depuis une page blanche, avec chrono et diff contre la solution de référence |
| **Quiz éclair** | 177 questions « prédis la sortie » chronométrées, avec combo. Les questions ratées reviennent plus souvent |
| **Blocs de code** | Remettre les lignes d'une solution dans l'ordre et les indenter, sans se soucier de la syntaxe. Un clic ajoute le bloc sous la ligne sélectionnée (indenté automatiquement après un `:`) ; en glisser-déposer, une ligne fantôme montre où il va atterrir et à quel **niveau d'indentation** (réglé en bougeant la souris à gauche ou à droite). Numéros de ligne, guides d'indentation, raccourcis clavier (`Tab`, `Alt+↑↓`, `Suppr`). Le programme assemblé est validé par les vrais tests, donc tout ordre correct est accepté. Options : indentation fournie ou à placer, pièges (lignes fausses mais plausibles). 172 programmes, dont **40 écrits pour ce mode** (quicksort, Union-Find, sac à dos, ABR, itérateurs, générateurs, ACP, Naive Bayes, gradient boosting, sessions Pandas, CTE SQL, RNN, Transformer…) |
| **Git & GitHub** | Un terminal Git simulé dans le navigateur : tu tapes les vraies commandes (`git add`, `commit`, `switch`, `merge`, `rebase`, `reset`, `revert`, `cherry-pick`, `stash`, `push`, `pull`, `gh pr create/merge`…) et tu vois le graphe des commits, les trois zones (répertoire de travail, index, HEAD) et le dépôt GitHub réagir en direct. 19 missions guidées (conflits, push rejeté, PR en conflit…), un bac à sable, une antisèche, 22 cartes et 14 questions de quiz |
| **Labs** | 7 labs interactifs : réseau de neurones large vs profond (entraînement en direct, gradient par couche), comparaison de modèles de ML (biais-variance), optimiseurs (SGD, Momentum, Adam), shapes et broadcasting, théorème central limite, A/B tests (puissance, peeking), Bayes et dépistage. 31 expériences guidées |
| **Projets** | 5 projets multi-étapes : réseau de neurones from scratch, pipeline ML de bout en bout, analyse e-commerce Pandas, moteur de recherche TF-IDF, classifieur PyTorch |
| **Compétitions** | 3 problèmes façon Kaggle avec un jeu de données synthétique réaliste : passagers disparus d'un vaisseau spatial (classification), prix d'appartements à Lyon (régression, saisies aberrantes), locations de vélos par heure (série temporelle). Un **notebook guidé** en 6 cellules (explorer, nettoyer, créer des variables, valider, modéliser, soumettre), chaque étape vérifiée par des tests, puis une soumission notée sur un **test caché** : médailles de bronze, d'argent et d'or, et classement |
| **Maths** | 6 chapitres (probabilités, variables aléatoires et lois, statistique et tests, algèbre linéaire, dérivées et optimisation, maths du ML) : un **cours** avec les formules et les objets à connaître, un formulaire, puis 53 exercices de **calcul** aux valeurs tirées au hasard (réponses tapées en nombre, fraction ou expression : `3/8`, `sqrt(2)/2`, `e^2/(1+e^2)`), avec la formule en indice et une **correction pas à pas**. Étoiles par exercice et un **boss** par chapitre (5 calculs d'affilée, 3 vies). Les labs (TCL, A/B test, Bayes) restent là pour visualiser |
| **Fiches** | 12 synthèses : list vs ndarray vs DataFrame vs Tensor, axes et broadcasting, Pandas, pipelines scikit-learn, choix de modèle, métriques, réseaux de neurones, boucle PyTorch, complexité, méthode d'entretien, probas & stats, Git |
| **Documentation** | Une doc maison de 149 entrées (Python, NumPy, Pandas, scikit-learn, PyTorch, SQL, scipy.stats), avec un exemple typique **exécutable** pour chacune. Aussi accessible en tiroir depuis l'éditeur (bouton Doc, ou `F2` sur un mot) |
| **Entretien blanc** | Chrono, 1 à 3 problèmes, sans indice ni autocomplétion, checklist de méthode, débrief |

Fonctions transverses :

- Les exercices résolus **reviennent en révision** quelques jours plus tard, pour les re-résoudre de mémoire.
- XP, niveaux et badges.
- Recherche globale avec `Ctrl+K` (exercices, doc, blocs, compétitions, chapitres et exercices de maths…).
- `Ctrl+Entrée` ou `Ctrl+S` **exécute sans valider** : chaque expression de premier niveau est affichée (pas besoin de `print`), et les exemples de l'énoncé sont appelés sur ton code. `Ctrl+Maj+Entrée` soumet.

## Démarrer en local

```bash
npm install
npm run dev          # http://localhost:5173
```

Node 20+ requis. Au premier lancement, Pyodide (~10 Mo, puis NumPy/Pandas/scikit-learn à la demande) est téléchargé depuis le CDN jsDelivr puis mis en cache par le navigateur.

## Déployer (GitHub Pages)

1. Dans le dépôt GitHub : **Settings → Pages → Build and deployment → Source : GitHub Actions**.
2. Pousse sur `main` : le workflow `.github/workflows/deploy.yml` construit et publie l'app sur `https://<utilisateur>.github.io/<dépôt>/`.

L'app est entièrement statique : n'importe quel hébergeur de fichiers statiques convient (Vercel, Netlify, Cloudflare Pages). Hors GitHub Pages, définis `BASE_PATH=/` au build.

## Compte synchronisé (Supabase)

Sans configuration, la progression est stockée dans le navigateur, avec export/import JSON dans **Profil**. Pour la synchroniser entre ordinateur et téléphone :

1. Crée un projet gratuit sur [supabase.com](https://supabase.com).
2. **SQL Editor → New query** : colle le contenu de [`supabase/schema.sql`](supabase/schema.sql) puis **Run**. Une table `progress` est créée, protégée par row-level security (chacun ne lit et n'écrit que sa ligne).
3. **Authentication → URL Configuration** :
   - *Site URL* : l'URL de l'app (ex. `https://<utilisateur>.github.io/code-training/`) ;
   - *Redirect URLs* : ajoute aussi `http://localhost:5173/` pour le développement.
4. (Optionnel) **Authentication → Providers → GitHub** pour se connecter avec GitHub. Le lien magique par e-mail marche sans configuration.
5. Récupère l'URL du projet et la clé `anon` (**Project Settings → API**). La clé `anon` est publique par conception : la sécurité repose sur la RLS.
   - En local : copie `.env.example` en `.env.local` et remplis les deux variables.
   - Pour le déploiement : **Settings → Secrets and variables → Actions → Variables** du dépôt, crée `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.

La synchronisation fusionne intelligemment les deux côtés (XP par jour, exercices, cartes, projets, badges) : tu peux réviser hors ligne sur ton téléphone, puis retrouver tout sur ton ordinateur.

## Runner local (PyTorch, GPU, ton Python)

Les exercices et le projet PyTorch nécessitent le runner local, car PyTorch ne tourne pas dans le navigateur.

```bash
pip install numpy pandas scikit-learn matplotlib torch    # dans ton environnement
python runner/local_runner.py                              # bibliothèque standard uniquement
```

Le terminal affiche une URL et un **token**. Dans l'app : **Profil → Moteur d'exécution → Runner local**, colle l'URL et le token, puis **Tester**. Le runner signale aussi si CUDA ou Apple MPS est disponible.

- Seules les requêtes portant le token sont exécutées : un autre site ouvert dans ton navigateur ne peut pas lancer de code sur ta machine. Le token est stocké dans `~/.code-training-runner-token`.
- Chaque exécution tourne dans un sous-processus avec un timeout.
- Chrome, Edge et Firefox autorisent un site `https://` à joindre `http://127.0.0.1`. Safari le bloque.

## Ajouter du contenu

Tout le contenu est en YAML dans [`content/`](content), sans code à toucher dans l'app.

```
content/
  exercises/<domaine>/<id>.yaml   # domaine : python, numpy, pandas, sql, stats, ml, dl, algo
  cards/*.yaml                    # paquets de cartes
  quiz/<domaine>.yaml
  projects/*.yaml
  fiches/*.yaml
  docs/*.yaml                     # documentation maison (exemples exécutés par le validateur)
  parsons/*.yaml                  # problèmes écrits pour le mode blocs de code
  competitions/*.yaml             # compétitions façon Kaggle (notebook guidé)
  shared/*.py                     # setup partagé (base SQLite, DataFrame, jeux de données des compétitions)
```

Exemple d'exercice :

```yaml
id: np-softmax
title: Softmax numériquement stable
domain: numpy
difficulty: medium          # easy | medium | hard
minutes: 6
interview: true             # proposé en entretien blanc
tags: [softmax, axis]
cards: [np-keepdims]        # cartes liées (affichées dans « À retenir »)
statement: |
  Écris `softmax(z)`… (Markdown + LaTeX)
starter: |
  def softmax(z):
      pass
solution: |
  ...
setup: |                    # optionnel, exécuté avant le code (données, imports)
  import numpy as np
tests:
  - call: softmax(np.array([1., 2.]))          # expression évaluée dans le code de l'utilisateur
    expected: np.array([0.26894142, 0.73105858])  # optionnel : sinon calculé avec la solution
  - call: softmax(np.zeros((3, 4)))
    hidden: true
  - name: Vérification libre
    check: |                                   # assertions Python ; `ref` donne accès à la solution
      assert softmax(np.zeros(3)).sum() == 1
hints: ["…", "…"]
explanation: |
  Ce qu'il faut retenir…
```

Options de test : `strict` (types et dtypes identiques), `unordered`, `rtol`, `atol`. Exercices SQL : `language: sql` + `shared: sql_shop`, la requête est disponible en Python sous le nom `QUERY`.

Erreurs typiques et blocs de code : `wrong:` liste des solutions fausses réalistes (le validateur exige qu'au moins un test les rejette, ce qui prouve que les tests sont assez forts). `parsons:` règle la version en blocs : `skip: true`, ou des `distractors` (une ligne fausse et la ligne qu'elle imite, qui doit faire échouer les tests).

```yaml
wrong:
  - |
    def dedupe(items):
        return list(set(items))      # perd l'ordre : doit échouer
parsons:
  distractors:
    - line: "if k in seen:"
      replaces: "if k not in seen:"
```

Bonus de complexité : un test `bonus: true` ne bloque pas la validation. Il s'accompagne d'un bloc `complexity` (et d'une solution `naive` que le validateur vérifie : elle passe les tests requis mais échoue au bonus). `growth_exponent(f, make_input)` mesure l'exposant k de t ∝ nᵏ, indépendamment de la vitesse de la machine :

```yaml
complexity: {target: "O(n)", note: "Un dict des valeurs déjà vues évite la double boucle."}
naive: |
  ...
tests:
  - name: "Bonus : complexité O(n)"
    bonus: true
    check: |
      k = growth_exponent(two_sum, lambda n: (list(range(n)), 2 * n - 3))
      assert k < 1.5, f"Ta solution semble en O(n^{k:.1f})"
```

Cartes : `kind: expr` (défaut, compare des valeurs), `stmt` (compare la variable `var`), `stdout`, ou `reveal` (auto-évaluée). `loose: true` ignore les différences de type.

Compétitions : le jeu de données est généré par `content/shared/comp_<id>.py` (qui définit `train`, `test`, la cible cachée et `_score(submission)`). Chaque étape (`steps`) a des `instructions`, un `starter`, une `solution`, des `hints`, des `tests` (assertions sur les variables du notebook) et des `wrong:` optionnels. Les cellules s'exécutent dans l'ordre, dans le même espace de noms, comme un notebook. `medals` fixe les seuils, et `gold` est une cellule « modèle » qui doit atteindre l'or.

Maths : les chapitres sont en TypeScript (`src/maths/chapters/*.ts`), car chaque exercice **génère** son énoncé, ses réponses et sa correction à partir de nombres tirés au hasard. `scripts/maths_check.py` recalcule chaque réponse indépendamment (NumPy, SciPy, scikit-learn).

### Valider le contenu

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r scripts/requirements-content.txt     # mêmes versions que Pyodide
python scripts/validate_content.py                  # --only <id> pour cibler, --skip-local sans PyTorch
```

Le validateur vérifie que chaque **solution passe** ses tests, que chaque **code de départ échoue**, que chaque **erreur typique** listée dans `wrong:` est bien rejetée par les tests, que le programme reconstruit à partir des blocs passe et que chaque **piège** le fait échouer, que chaque carte et chaque exemple de doc s'exécutent, que les solutions naïves déclenchent bien le bonus de complexité, que la réponse de chaque question de quiz `verify: true` est bien la sortie réelle du code. Pour les **compétitions** : le notebook de référence passe chaque étape, chaque cellule de départ et chaque variante fausse échoue, la soumission naïve n'a pas le bronze, la référence atteint l'argent et la solution « or » l'or. Pour les **maths** : 60 tirages par exercice, chaque réponse recalculée en Python, chaque cours, énoncé et correction rendus avec KaTeX sans erreur, et la réponse arrondie à la précision demandée acceptée. La CI le lance sur chaque pull request.

## Architecture

- **Vite + React + TypeScript + Tailwind CSS v4**, CodeMirror 6 pour l'éditeur, KaTeX pour les formules.
- **Pyodide 0.27** dans un Web Worker (`public/pyodide-worker.js`). Les paquets sont chargés selon les imports du code, et le worker est redémarré en cas de boucle infinie.
- **`public/harness.py`** : exécution, tests, comparaison des résultats et tracebacks lisibles. Le même fichier sert au navigateur, au runner local et au validateur.
- **Git** : `src/git/engine.ts` simule Git et GitHub (commits = instantanés de fichiers, merge à trois voies avec conflits, rebase, remote, pull requests). Les missions sont dans `src/git/levels.ts` ; `scripts/git-levels-check.mjs` rejoue chaque solution (lancé par le validateur).
- **Maths** : `src/maths/core.ts` (tirages reproductibles, lecture des réponses tapées, tolérance), un fichier par chapitre ; `scripts/maths-export.mjs` exporte les tirages pour le validateur.
- **Labs** : modèles (MLP avec backprop, kNN, arbres, forêts, régression logistique, Naive Bayes, optimiseurs) réimplémentés en TypeScript pour tourner en temps réel (`src/labs/ml.ts`).
- **Progression** : store Zustand persisté en `localStorage`, fusion sans conflit avec Supabase (`src/lib/progress.ts`, `src/lib/sync.ts`). Répétition espacée : `src/lib/srs.ts`.
