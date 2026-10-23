# Code Training

Ma plateforme d'entraînement personnelle pour les **entretiens techniques** en Python, data et IA : des exercices de code testés automatiquement (dans l'esprit de LeetCode et deep-ml), de la répétition espacée pour retenir la syntaxe, des labs interactifs pour comprendre ce qu'il se passe vraiment, des projets guidés et des entretiens blancs.

Python s'exécute **dans le navigateur** (Pyodide/WebAssembly, sur le processeur de ta machine). Un **runner local** optionnel permet d'utiliser ton propre Python, avec PyTorch et le GPU.

## Ce qu'il y a dedans

| Section | Contenu |
|---|---|
| **Accueil** | Plan du jour (cartes → exercice → quiz), objectif d'XP, série de jours, maîtrise par domaine, heatmap d'activité, badges |
| **Exercices** | 64 exercices avec tests visibles et cachés : Python, NumPy, Pandas, SQL, ML, Deep Learning, algo. Indices progressifs, solution, fiche « À retenir », notes perso, chrono |
| **Mémoire** | 172 cartes de syntaxe. Tu **tapes** la réponse, elle est **exécutée** et comparée à la référence (types et dtypes compris), puis reprogrammée par répétition espacée (SM-2) |
| **Quiz éclair** | 76 questions « prédis la sortie » chronométrées, avec combo. Les questions ratées reviennent plus souvent |
| **Labs** | 4 labs interactifs : réseau de neurones large vs profond (entraînement en direct, gradient par couche), comparaison de modèles de ML (biais-variance), optimiseurs (SGD, Momentum, Adam), shapes et broadcasting. 21 expériences guidées |
| **Projets** | 5 projets multi-étapes : réseau de neurones from scratch, pipeline ML de bout en bout, analyse e-commerce Pandas, moteur de recherche TF-IDF, classifieur PyTorch |
| **Fiches** | 10 synthèses : list vs ndarray vs DataFrame vs Tensor, axes et broadcasting, Pandas, pipelines scikit-learn, choix de modèle, métriques, réseaux de neurones, boucle PyTorch, complexité, méthode d'entretien |
| **Entretien blanc** | Chrono, 1 à 3 problèmes, sans indice ni autocomplétion, checklist de méthode, débrief |

Fonctions transverses :

- Les exercices résolus **reviennent en révision** quelques jours plus tard, pour les re-résoudre de mémoire.
- XP, niveaux et badges.
- Recherche globale avec `Ctrl+K`. `Ctrl+Entrée` exécute, `Ctrl+Maj+Entrée` soumet.

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
  exercises/<domaine>/<id>.yaml   # domaine : python, numpy, pandas, sql, ml, dl, algo
  cards/*.yaml                    # paquets de cartes
  quiz/<domaine>.yaml
  projects/*.yaml
  fiches/*.yaml
  shared/*.py                     # setup partagé (base SQLite, DataFrame de commandes)
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

Cartes : `kind: expr` (défaut, compare des valeurs), `stmt` (compare la variable `var`), `stdout`, ou `reveal` (auto-évaluée). `loose: true` ignore les différences de type.

### Valider le contenu

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r scripts/requirements-content.txt     # mêmes versions que Pyodide
python scripts/validate_content.py                  # --only <id> pour cibler, --skip-local sans PyTorch
```

Le validateur vérifie que chaque **solution passe** ses tests, que chaque **code de départ échoue**, que chaque carte s'exécute, et que la réponse de chaque question de quiz `verify: true` est bien la sortie réelle du code. La CI le lance sur chaque pull request.

## Architecture

- **Vite + React + TypeScript + Tailwind CSS v4**, CodeMirror 6 pour l'éditeur, KaTeX pour les formules.
- **Pyodide 0.27** dans un Web Worker (`public/pyodide-worker.js`). Les paquets sont chargés selon les imports du code, et le worker est redémarré en cas de boucle infinie.
- **`public/harness.py`** : exécution, tests, comparaison des résultats et tracebacks lisibles. Le même fichier sert au navigateur, au runner local et au validateur.
- **Labs** : modèles (MLP avec backprop, kNN, arbres, forêts, régression logistique, Naive Bayes, optimiseurs) réimplémentés en TypeScript pour tourner en temps réel (`src/labs/ml.ts`).
- **Progression** : store Zustand persisté en `localStorage`, fusion sans conflit avec Supabase (`src/lib/progress.ts`, `src/lib/sync.ts`). Répétition espacée : `src/lib/srs.ts`.
