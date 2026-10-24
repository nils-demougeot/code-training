import { q, Setup, type GitState } from './engine'

export interface GitGoal {
  text: string
  check: (s: GitState) => boolean
}

export interface GitLevel {
  id: string
  chapter: string
  title: string
  /** Markdown: the situation and the mission. */
  intro: string
  goals: GitGoal[]
  setup: () => GitState
  /** Reference solution, replayed by scripts/git-levels-check.mjs. */
  solution: string[]
  hints: string[]
  /** Markdown shown once the level is solved. */
  explanation: string
}

export const CHAPTERS = [
  { id: 'bases', title: 'Les bases', text: 'Répertoire de travail, index, commit : les trois zones de Git.' },
  { id: 'branches', title: 'Branches', text: 'Créer, fusionner, rebaser, résoudre un conflit.' },
  { id: 'reparer', title: 'Réparer l’historique', text: 'Annuler, corriger, déplacer des commits sans paniquer.' },
  { id: 'github', title: 'Travailler avec GitHub', text: 'push, pull, pull requests et collègues qui poussent en même temps.' },
]

const base = () => new Setup().commit('Premier commit', { 'README.md': '# Projet' })

const withMarkers = (s: GitState) => Object.values(s.local.work).some((v) => v.includes('<<<<<<<'))
const tipMsg = (s: GitState, b: string) => q.commit(s, q.tip(s, b))?.message
const isMerge = (s: GitState, id: string | null | undefined) => (q.commit(s, id)?.parents.length ?? 0) > 1
const linear = (s: GitState, id: string | null | undefined) => q.history(s, id).every((c) => c.parents.length <= 1)

export const LEVELS: GitLevel[] = [
  // ------------------------------------------------------------------ bases
  {
    id: 'premier-commit',
    chapter: 'bases',
    title: 'Ton premier commit',
    intro: `Tu viens de créer \`app.py\`, mais Git ne le suit pas encore (*untracked*).

Un commit se fait en **deux temps** : on choisit ce qu'on enregistre avec \`git add\` (ça passe dans l'**index**, la zone de préparation), puis on enregistre avec \`git commit\`.

Commence par \`git status\` pour voir l'état du dépôt.`,
    setup: () => base().work({ 'app.py': 'print("hello")' }).s,
    goals: [
      { text: 'app.py est enregistré dans un nouveau commit sur main', check: (s) => 'app.py' in q.tree(s, q.tip(s, 'main')) && q.history(s, q.tip(s, 'main')).length === 2 },
      { text: 'Le répertoire de travail est propre (git status)', check: (s) => q.clean(s) },
    ],
    solution: ['git status', 'git add app.py', 'git commit -m "Ajoute app.py"'],
    hints: ['`git add app.py` place le fichier dans l’index.', 'Puis `git commit -m "Ajoute app.py"`.'],
    explanation: `Les trois zones de Git :

| zone | contient | commande pour y aller |
|---|---|---|
| répertoire de travail | tes fichiers tels que tu les édites | (ton éditeur) |
| index (*staging*) | ce qui partira dans le prochain commit | \`git add\` |
| dépôt | l'historique des commits | \`git commit\` |

Réflexe : **\`git status\` avant chaque commande** tant que tu n'es pas à l'aise.`,
  },
  {
    id: 'index',
    chapter: 'bases',
    title: 'Ne committer qu’une partie',
    intro: `Tu as modifié \`app.py\` (une vraie correction) **et** \`README.md\` (un brouillon pas fini).

Fais un commit qui contient **seulement** la correction de \`app.py\`. Le brouillon du README doit rester en cours, non commité.

C'est tout l'intérêt de l'index : choisir précisément ce qui part dans chaque commit.`,
    setup: () =>
      base()
        .commit('Ajoute app.py', { 'app.py': 'print("hello")' })
        .work({ 'app.py': 'print("hello, world")', 'README.md': '# Projet\nBrouillon de doc…' }).s,
    goals: [
      { text: 'Le dernier commit contient la nouvelle version de app.py', check: (s) => q.tree(s, q.tip(s, 'main'))['app.py'] === 'print("hello, world")' },
      { text: 'Le dernier commit ne contient pas le brouillon du README', check: (s) => q.tree(s, q.tip(s, 'main'))['README.md'] === '# Projet' },
      { text: 'Le brouillon du README est toujours là (non commité)', check: (s) => s.local.work['README.md']?.includes('Brouillon') ?? false },
    ],
    solution: ['git add app.py', 'git commit -m "Corrige le message de app.py"'],
    hints: ['`git add` accepte un nom de fichier : n’utilise pas `git add .`.', '`git status` montre ce qui est dans l’index (en vert) et ce qui ne l’est pas (en rouge).'],
    explanation: `- \`git add .\` ou \`git commit -a\` ajoutent **tout** : pratique mais dangereux (fichiers de debug, secrets…).
- Un bon commit = **un seul changement logique**, avec un message qui dit *pourquoi*.
- \`git diff\` montre ce qui n'est pas encore indexé, \`git diff --staged\` ce qui va partir dans le commit.`,
  },
  {
    id: 'annuler-local',
    chapter: 'bases',
    title: 'Annuler avant de committer',
    intro: `Deux erreurs à rattraper, **sans créer de commit** :

1. Tu as cassé \`config.py\` en le modifiant : reviens à sa version du dernier commit.
2. Tu as ajouté \`notes.txt\` à l'index par erreur : retire-le de l'index, mais **garde le fichier**.`,
    setup: () =>
      base()
        .commit('Ajoute la config', { 'config.py': 'DEBUG = False' })
        .work({ 'config.py': 'DEBUG = ???', 'notes.txt': 'idées perso' })
        .run('git add notes.txt').s,
    goals: [
      { text: 'config.py est revenu à la version du dernier commit', check: (s) => s.local.work['config.py'] === 'DEBUG = False' },
      { text: 'notes.txt n’est plus dans l’index', check: (s) => !('notes.txt' in s.local.index) },
      { text: 'notes.txt existe toujours sur le disque', check: (s) => 'notes.txt' in s.local.work },
      { text: 'Aucun nouveau commit', check: (s) => q.history(s, q.tip(s, 'main')).length === 2 },
    ],
    solution: ['git restore config.py', 'git restore --staged notes.txt'],
    hints: ['`git restore <fichier>` remet le fichier dans l’état de l’index.', '`git restore --staged <fichier>` retire le fichier de l’index.'],
    explanation: `| situation | commande |
|---|---|
| annuler mes modifs d'un fichier | \`git restore fichier\` ⚠️ perdues pour de bon |
| retirer un fichier de l'index | \`git restore --staged fichier\` |
| tout remettre comme au dernier commit | \`git reset --hard\` ⚠️ |

Les anciennes commandes \`git checkout -- fichier\` et \`git reset HEAD fichier\` font la même chose : tu les verras souvent sur Stack Overflow.`,
  },
  {
    id: 'amend',
    chapter: 'bases',
    title: 'Corriger le dernier commit',
    intro: `Ton dernier commit a deux problèmes : une **faute** dans le message (« foncton ») et tu as **oublié** d'y mettre \`tests.py\`.

Corrige-le **sans ajouter de nouveau commit** : le message doit devenir exactement \`Ajoute la fonction de tri\` et le commit doit contenir \`tests.py\`.`,
    setup: () =>
      base()
        .commit('Ajoute la foncton de tri', { 'tri.py': 'def tri(xs): return sorted(xs)' })
        .work({ 'tests.py': 'assert tri([2, 1]) == [1, 2]' }).s,
    goals: [
      { text: 'Message du dernier commit : « Ajoute la fonction de tri »', check: (s) => tipMsg(s, 'main') === 'Ajoute la fonction de tri' },
      { text: 'Le dernier commit contient tests.py et tri.py', check: (s) => ['tests.py', 'tri.py'].every((f) => f in q.tree(s, q.tip(s, 'main'))) },
      { text: 'Toujours 2 commits sur main', check: (s) => q.history(s, q.tip(s, 'main')).length === 2 },
    ],
    solution: ['git add tests.py', 'git commit --amend -m "Ajoute la fonction de tri"'],
    hints: ['Ajoute d’abord tests.py à l’index.', '`git commit --amend -m "…"` remplace le dernier commit.'],
    explanation: `- \`--amend\` crée un **nouveau** commit (nouveau hash) qui remplace l'ancien.
- ⚠️ Ne fais jamais \`--amend\` sur un commit **déjà poussé** et partagé : tes collègues ont l'ancien, l'historique diverge et il faudrait un \`push --force\`.`,
  },

  // ------------------------------------------------------------------ branches
  {
    id: 'branche',
    chapter: 'branches',
    title: 'Travailler sur une branche',
    intro: `On ne développe pas directement sur \`main\`. Crée une branche **\`feature/login\`**, place-toi dessus, et commits-y un nouveau fichier \`login.py\`.

\`main\` ne doit pas bouger.

Astuce : \`edit login.py\` simule l'écriture du fichier.`,
    setup: () => base().commit('Ajoute app.py', { 'app.py': 'print("hello")' }).s,
    goals: [
      { text: 'La branche feature/login existe', check: (s) => !!q.tip(s, 'feature/login') },
      { text: 'login.py est commité sur feature/login', check: (s) => 'login.py' in q.tree(s, q.tip(s, 'feature/login')) },
      { text: 'main n’a pas bougé', check: (s) => q.history(s, q.tip(s, 'main')).length === 2 && !('login.py' in q.tree(s, q.tip(s, 'main'))) },
    ],
    solution: ['git switch -c feature/login', 'edit login.py', 'git add login.py', 'git commit -m "Ajoute le login"'],
    hints: ['`git switch -c feature/login` crée la branche et s’y place.', 'Puis `edit login.py`, `git add login.py`, `git commit -m "…"`.'],
    explanation: `- Une branche n'est qu'un **pointeur** vers un commit : la créer est instantané.
- \`HEAD\` indique la branche courante : les nouveaux commits font avancer **cette** branche.
- \`git switch -c nom\` (récent) = \`git checkout -b nom\` (ancien).
- Conventions de nommage courantes : \`feature/…\`, \`fix/…\`, \`chore/…\`.`,
  },
  {
    id: 'merge-ff',
    chapter: 'branches',
    title: 'Fusion en avance rapide',
    intro: `La branche \`feature\` a deux commits d'avance sur \`main\`, et \`main\` n'a pas bougé depuis.

Intègre \`feature\` dans \`main\`. Observe le graphe : aucun nouveau commit n'est créé, \`main\` **avance** simplement.`,
    setup: () =>
      base()
        .run('git switch -c feature')
        .commit('Ajoute le modèle', { 'model.py': 'class Model: ...' })
        .commit('Ajoute les tests du modèle', { 'test_model.py': 'def test(): ...' })
        .run('git switch main').s,
    goals: [
      { text: 'main pointe sur le même commit que feature', check: (s) => !!q.tip(s, 'main') && q.tip(s, 'main') === q.tip(s, 'feature') },
      { text: 'Pas de commit de merge', check: (s) => !isMerge(s, q.tip(s, 'main')) },
      { text: 'Tu es sur main', check: (s) => q.branch(s) === 'main' },
    ],
    solution: ['git merge feature'],
    hints: ['Tu es déjà sur main : `git merge feature`.'],
    explanation: `**Fast-forward** : quand \`main\` est un ancêtre de \`feature\`, Git n'a rien à fusionner, il avance le pointeur.

\`git merge --no-ff feature\` force un commit de merge même dans ce cas : certaines équipes le préfèrent pour garder la trace de la branche.`,
  },
  {
    id: 'merge-commit',
    chapter: 'branches',
    title: 'Fusion de branches divergentes',
    intro: `Pendant que tu travaillais sur \`feature\`, un correctif a été commité sur \`main\`. Les deux branches ont **divergé**.

Fusionne \`feature\` dans \`main\`. Cette fois, Git doit créer un **commit de merge** à deux parents.`,
    setup: () =>
      base()
        .run('git switch -c feature')
        .commit('Ajoute l’export CSV', { 'export.py': 'def to_csv(): ...' })
        .run('git switch main')
        .commit('Corrige une faute dans le README', { 'README.md': '# Projet\nDocumentation' }).s,
    goals: [
      { text: 'main se termine par un commit de merge', check: (s) => isMerge(s, q.tip(s, 'main')) },
      { text: 'main contient export.py et la correction du README', check: (s) => { const t = q.tree(s, q.tip(s, 'main')); return 'export.py' in t && t['README.md'].includes('Documentation') } },
      { text: 'feature est un ancêtre de main', check: (s) => q.isAncestor(s, q.tip(s, 'feature'), q.tip(s, 'main')) },
    ],
    solution: ['git merge feature'],
    hints: ['Place-toi sur la branche qui **reçoit** (main), puis `git merge feature`.'],
    explanation: `- Le commit de merge a **deux parents** : la pointe de \`main\` et celle de \`feature\`.
- Git combine automatiquement les changements des deux côtés depuis leur **ancêtre commun** (*merge base*).
- La branche \`feature\` existe toujours : supprime-la une fois fusionnée (\`git branch -d feature\`).`,
  },
  {
    id: 'conflit',
    chapter: 'branches',
    title: 'Résoudre un conflit',
    intro: `\`main\` et \`feature\` ont **tous les deux modifié \`config.py\`** différemment. Git ne peut pas choisir à ta place.

Fusionne \`feature\` dans \`main\`, puis résous le conflit :

1. \`cat config.py\` montre les marqueurs \`<<<<<<<\`, \`=======\`, \`>>>>>>>\` ;
2. \`edit config.py\` résout le conflit (ici, en gardant les deux lignes) ;
3. \`git add config.py\` marque le conflit comme résolu ;
4. \`git commit\` termine le merge.`,
    setup: () =>
      base()
        .commit('Ajoute la config', { 'config.py': 'TIMEOUT = 10' })
        .run('git switch -c feature')
        .commit('Augmente le timeout', { 'config.py': 'TIMEOUT = 30' })
        .run('git switch main')
        .commit('Ajoute le mode debug', { 'config.py': 'TIMEOUT = 10\nDEBUG = True' }).s,
    goals: [
      { text: 'main se termine par un commit de merge avec feature', check: (s) => isMerge(s, q.tip(s, 'main')) && q.isAncestor(s, q.tip(s, 'feature'), q.tip(s, 'main')) },
      { text: 'Plus aucun marqueur de conflit', check: (s) => !withMarkers(s) && !Object.values(q.tree(s, q.tip(s, 'main'))).some((v) => v.includes('<<<<<<<')) },
      { text: 'Répertoire de travail propre', check: (s) => q.clean(s) && !s.local.merge },
    ],
    solution: ['git merge feature', 'cat config.py', 'edit config.py', 'git add config.py', 'git commit -m "Fusionne feature en résolvant le conflit de config"'],
    hints: ['Après `git merge feature`, `git status` liste les fichiers en conflit.', '`edit config.py` puis `git add config.py`, et enfin `git commit -m "…"`.', 'Pour tout annuler : `git merge --abort`.'],
    explanation: `\`\`\`
<<<<<<< HEAD
ta version (main)
=======
leur version (feature)
>>>>>>> feature
\`\`\`
- Résoudre = éditer le fichier pour garder la bonne combinaison, **supprimer les marqueurs**, puis \`git add\`.
- \`git merge --abort\` revient à l'état d'avant le merge si tu es perdu.
- Dans VS Code, les boutons « Accept Current / Incoming / Both » font exactement ça.`,
  },
  {
    id: 'rebase',
    chapter: 'branches',
    title: 'Rebase : un historique linéaire',
    intro: `\`main\` a avancé depuis que tu as créé \`feature\`. Plutôt qu'un commit de merge, ton équipe veut un historique **linéaire**.

**Rebase** \`feature\` sur \`main\` : tes commits sont rejoués *par-dessus* la pointe de \`main\`. Regarde leurs hash changer.`,
    setup: () =>
      base()
        .run('git switch -c feature')
        .commit('Ajoute le parseur', { 'parser.py': 'def parse(): ...' })
        .commit('Gère les erreurs du parseur', { 'parser.py': 'def parse(): ...\n# erreurs' })
        .run('git switch main')
        .commit('Met à jour les dépendances', { 'requirements.txt': 'numpy' }).s,
    goals: [
      { text: 'main est un ancêtre de feature', check: (s) => q.isAncestor(s, q.tip(s, 'main'), q.tip(s, 'feature')) },
      { text: 'L’historique de feature est linéaire (aucun merge)', check: (s) => linear(s, q.tip(s, 'feature')) },
      { text: 'feature contient tes 2 commits et requirements.txt', check: (s) => q.messages(s, q.tip(s, 'feature')).slice(0, 2).join('|') === 'Gère les erreurs du parseur|Ajoute le parseur' && 'requirements.txt' in q.tree(s, q.tip(s, 'feature')) },
    ],
    solution: ['git switch feature', 'git rebase main'],
    hints: ['Place-toi sur la branche à déplacer (feature).', 'Puis `git rebase main`.'],
    explanation: `- \`git rebase main\` prend les commits de ta branche absents de \`main\` et les **recrée** un par un au-dessus de \`main\` (nouveaux hash).
- Résultat : un historique linéaire, plus lisible, et un merge ultérieur en fast-forward.
- ⚠️ **Règle d'or** : ne rebase pas une branche déjà partagée avec d'autres (tu réécris des commits qu'ils ont).
- Merge ou rebase ? Merge préserve l'histoire réelle ; rebase la rend lisible. Beaucoup d'équipes rebasent leur branche perso, puis mergent la PR.`,
  },
  {
    id: 'menage',
    chapter: 'branches',
    title: 'Faire le ménage dans les branches',
    intro: `\`old-fix\` a déjà été fusionnée dans \`main\` : supprime-la.

\`experience\` n'a **pas** été fusionnée : elle doit rester. Essaie quand même \`git branch -d experience\` pour voir Git te protéger.`,
    setup: () =>
      base()
        .run('git switch -c old-fix')
        .commit('Corrige un bug', { 'fix.py': 'ok' })
        .run('git switch main', 'git merge old-fix', 'git switch -c experience')
        .commit('Essai d’un nouvel algo', { 'algo.py': 'try' })
        .run('git switch main').s,
    goals: [
      { text: 'old-fix est supprimée', check: (s) => !q.tip(s, 'old-fix') },
      { text: 'experience existe toujours', check: (s) => !!q.tip(s, 'experience') },
    ],
    solution: ['git branch', 'git branch -d old-fix'],
    hints: ['`git branch -d nom` supprime une branche fusionnée.'],
    explanation: `- \`-d\` refuse de supprimer une branche non fusionnée (tu perdrais ses commits) ; \`-D\` force.
- Supprimer une branche ne supprime **pas** ses commits fusionnés : ils restent dans l'historique de \`main\`.
- \`git branch --merged\` liste les branches déjà fusionnées, bonnes candidates au ménage.`,
  },

  // ------------------------------------------------------------------ réparer
  {
    id: 'reset',
    chapter: 'reparer',
    title: 'Revenir en arrière (reset)',
    intro: `Les **deux derniers commits** de \`main\` sont des essais ratés, jamais partagés. Fais revenir \`main\` au commit « Version stable », en supprimant aussi leurs modifications du répertoire de travail.`,
    setup: () =>
      base()
        .commit('Version stable', { 'app.py': 'v1' })
        .commit('WIP essai 1', { 'app.py': 'v2 cassé' })
        .commit('WIP essai 2', { 'hack.py': 'bidouille' }).s,
    goals: [
      { text: 'main pointe sur « Version stable »', check: (s) => tipMsg(s, 'main') === 'Version stable' },
      { text: 'Le répertoire de travail est propre (hack.py a disparu)', check: (s) => q.clean(s) && !('hack.py' in s.local.work) },
    ],
    solution: ['git log --oneline', 'git reset --hard HEAD~2'],
    hints: ['`HEAD~2` désigne le commit deux crans avant HEAD.', '`git reset --hard HEAD~2`.'],
    explanation: `| commande | branche | index | fichiers |
|---|---|---|---|
| \`reset --soft X\` | → X | inchangé | inchangés |
| \`reset X\` (mixed) | → X | = X | inchangés |
| \`reset --hard X\` | → X | = X | = X ⚠️ |

- \`--soft HEAD~3\` puis un commit : la façon simple de **regrouper** 3 commits en un.
- ⚠️ Comme \`--amend\`, un reset sur des commits déjà poussés réécrit l'histoire partagée : utilise plutôt \`revert\`.
- Commit perdu par erreur ? \`git reflog\` garde la trace des anciennes positions de HEAD.`,
  },
  {
    id: 'revert',
    chapter: 'reparer',
    title: 'Annuler un commit déjà poussé',
    intro: `Le commit « Introduit un bug de calcul » a déjà été **poussé sur GitHub** : tes collègues l'ont. Pas question de réécrire l'histoire.

Crée un commit qui **annule** ses changements, puis pousse-le. Le commit fautif doit rester dans l'historique.`,
    setup: () =>
      base()
        .commit('Ajoute calc.py', { 'calc.py': 'def add(a, b): return a + b' })
        .commit('Introduit un bug de calcul', { 'calc.py': 'def add(a, b): return a - b' })
        .commit('Ajoute la documentation', { 'docs.md': 'calc.add' })
        .publish().s,
    goals: [
      { text: 'calc.py est de nouveau correct sur main', check: (s) => q.tree(s, q.tip(s, 'main'))['calc.py'] === 'def add(a, b): return a + b' },
      { text: 'docs.md est conservé', check: (s) => 'docs.md' in q.tree(s, q.tip(s, 'main')) },
      { text: 'Le commit fautif est toujours dans l’historique', check: (s) => q.messages(s, q.tip(s, 'main')).includes('Introduit un bug de calcul') },
      { text: 'La correction est poussée sur GitHub', check: (s) => !!q.remoteTip(s, 'main') && q.remoteTip(s, 'main') === q.tip(s, 'main') },
    ],
    solution: ['git log --oneline', 'git revert HEAD~1', 'git push'],
    hints: ['Le commit fautif est l’avant-dernier : `HEAD~1` (ou son hash, via `git log --oneline`).', '`git revert HEAD~1` puis `git push`.'],
    explanation: `- \`git revert X\` crée un **nouveau** commit qui applique l'inverse de X : l'historique partagé n'est pas réécrit, donc tout le monde peut \`pull\` sans problème.
- \`reset\` efface (histoire locale) ; \`revert\` compense (histoire partagée).`,
  },
  {
    id: 'cherry-pick',
    chapter: 'reparer',
    title: 'Récupérer un seul commit',
    intro: `Sur la branche \`dev\`, au milieu d'expériences pas prêtes, il y a un commit « Corrige la faille de sécurité » dont \`main\` a besoin **maintenant**.

Applique **uniquement ce commit** sur \`main\`, sans les expériences.`,
    setup: () =>
      base()
        .commit('Ajoute l’authentification', { 'auth.py': 'check(password)' })
        .run('git switch -c dev')
        .commit('Expérience A', { 'exp_a.py': 'a' })
        .commit('Corrige la faille de sécurité', { 'auth.py': 'check(hash(password))' })
        .commit('Expérience B', { 'exp_b.py': 'b' })
        .run('git switch main').s,
    goals: [
      { text: 'main contient le correctif de auth.py', check: (s) => q.tree(s, q.tip(s, 'main'))['auth.py'] === 'check(hash(password))' },
      { text: 'main ne contient aucune expérience', check: (s) => { const t = q.tree(s, q.tip(s, 'main')); return !('exp_a.py' in t) && !('exp_b.py' in t) } },
      { text: 'Le dernier commit de main a le même message que le correctif', check: (s) => tipMsg(s, 'main') === 'Corrige la faille de sécurité' },
    ],
    solution: ['git log --oneline dev', 'git cherry-pick dev~1'],
    hints: ['`git log --oneline dev` affiche les commits de dev et leur hash.', '`git cherry-pick <hash>` (ou `dev~1`).'],
    explanation: `- \`cherry-pick\` copie un commit (ses **changements**) sur la branche courante, avec un nouveau hash.
- Usage typique : porter un correctif urgent sur une branche de release.
- À utiliser avec parcimonie : le même changement existe ensuite deux fois dans l'historique.`,
  },
  {
    id: 'stash',
    chapter: 'reparer',
    title: 'Mettre son travail de côté',
    intro: `Tu es sur \`feature\`, en plein milieu d'une modification de \`feature.py\` (pas prête à être commitée). Urgence : un bug à corriger sur \`main\` dans \`app.py\`.

1. Mets ton travail de côté ;
2. va sur \`main\`, corrige \`app.py\` et commits la correction ;
3. reviens sur \`feature\` et **récupère** ton travail en cours.`,
    setup: () =>
      base()
        .commit('Ajoute app.py', { 'app.py': 'bug' })
        .run('git switch -c feature')
        .commit('Commence la feature', { 'feature.py': 'v1' })
        .work({ 'feature.py': 'v1\ntravail en cours' }).s,
    goals: [
      { text: 'main a un nouveau commit qui modifie app.py', check: (s) => q.tree(s, q.tip(s, 'main'))['app.py'] !== 'bug' && q.history(s, q.tip(s, 'main')).length === 3 },
      { text: 'Tu es revenu sur feature', check: (s) => q.branch(s) === 'feature' },
      { text: 'Ton travail en cours sur feature.py est restauré (non commité)', check: (s) => s.local.work['feature.py']?.includes('travail en cours') && q.tree(s, q.tip(s, 'feature'))['feature.py'] === 'v1' },
      { text: 'La pile de stash est vide', check: (s) => s.local.stash.length === 0 },
    ],
    solution: ['git switch main', 'git stash', 'git switch main', 'edit app.py', 'git commit -am "Corrige le bug urgent"', 'git switch feature', 'git stash pop'],
    hints: ['Essaie `git switch main` : Git refuse car feature.py n’existe pas sur main.', '`git stash` range tes modifications ; `git stash pop` les ressort.'],
    explanation: `- \`git stash\` sauvegarde les modifications non commitées et nettoie le répertoire de travail.
- \`git stash pop\` les réapplique (et retire l'entrée de la pile) ; \`git stash list\` montre la pile.
- Alternative moderne : un commit « WIP » sur la branche, puis \`git reset --soft HEAD~1\` au retour.`,
  },
  {
    id: 'tag',
    chapter: 'reparer',
    title: 'Marquer une version',
    intro: `Le commit « Release 1.0 » est la version livrée au client. Pose un **tag** \`v1.0\` dessus (attention : ce n'est pas le dernier commit), puis publie le tag sur GitHub.`,
    setup: () =>
      base()
        .commit('Release 1.0', { 'app.py': 'v1.0' })
        .commit('Commence la 1.1', { 'app.py': 'v1.1-dev' })
        .publish().s,
    goals: [
      { text: 'Le tag v1.0 pointe sur « Release 1.0 »', check: (s) => q.commit(s, s.local.tags['v1.0'])?.message === 'Release 1.0' },
      { text: 'Le tag est publié sur GitHub', check: (s) => !!s.remote?.tags['v1.0'] && s.remote.tags['v1.0'] === s.local.tags['v1.0'] },
    ],
    solution: ['git log --oneline', 'git tag v1.0 HEAD~1', 'git push origin v1.0'],
    hints: ['`git tag v1.0 <commit>` (par exemple `HEAD~1`).', 'Les tags ne partent pas avec un simple `git push` : `git push origin v1.0` (ou `--tags`).'],
    explanation: `- Un tag est un pointeur **fixe** (une branche avance, un tag non) : idéal pour les versions.
- \`git push --tags\` publie tous les tags. Sur GitHub, un tag peut devenir une *Release*.
- Versionnage sémantique : \`MAJEUR.MINEUR.CORRECTIF\` (v2.3.1).`,
  },

  // ------------------------------------------------------------------ github
  {
    id: 'pull-request',
    chapter: 'github',
    title: 'Ta première pull request',
    intro: `Tu as développé \`feature/graphiques\` en local. Le workflow GitHub :

1. **pousser** la branche sur GitHub ;
2. ouvrir une **pull request** vers \`main\` ;
3. la **merger** (après revue) ;
4. mettre ton \`main\` local à jour.

Le panneau GitHub (à droite) montre l'état du dépôt distant.`,
    setup: () =>
      base()
        .commit('Ajoute les données', { 'data.csv': 'x,y' })
        .publish()
        .run('git switch -c feature/graphiques')
        .commit('Ajoute les graphiques', { 'plots.py': 'plt.plot()' }).s,
    goals: [
      { text: 'La branche est poussée sur GitHub', check: (s) => !!s.remote?.branches['feature/graphiques'] || s.prs.some((p) => p.head === 'feature/graphiques') },
      { text: 'Une pull request a été ouverte puis mergée', check: (s) => s.prs.some((p) => p.head === 'feature/graphiques' && p.state === 'merged') },
      { text: 'origin/main contient plots.py', check: (s) => q.remoteHas(s, 'main', 'plots.py') },
      { text: 'Ton main local est à jour avec origin/main', check: (s) => !!q.tip(s, 'main') && q.tip(s, 'main') === q.remoteTip(s, 'main') },
    ],
    solution: ['git push -u origin feature/graphiques', 'gh pr create --title "Ajoute les graphiques"', 'gh pr merge', 'git switch main', 'git pull'],
    hints: ['Première publication d’une branche : `git push -u origin feature/graphiques`.', '`gh pr create --title "…"` puis `gh pr merge` (en vrai : bouton vert sur GitHub).', 'Enfin `git switch main` et `git pull`.'],
    explanation: `- \`-u\` (\`--set-upstream\`) relie ta branche locale à la branche distante : ensuite, \`git push\` et \`git pull\` suffisent.
- Une PR, c'est une **demande de revue** : discussion, CI, puis merge sur GitHub.
- Après le merge, ton \`main\` local est en retard : \`git pull\`. Puis supprime la branche (\`git branch -d\`).
- \`gh\` est la CLI officielle de GitHub ; tout se fait aussi sur le site.`,
  },
  {
    id: 'push-rejete',
    chapter: 'github',
    title: 'Push rejeté : un collègue est passé avant',
    intro: `Tu as un commit local sur \`main\`. Pendant ce temps, un collègue a poussé sur \`origin/main\`. Essaie \`git push\` : il est **rejeté**.

Récupère son travail **en gardant un historique linéaire** (pas de commit de merge), puis pousse.`,
    setup: () =>
      base()
        .commit('Ajoute le service', { 'service.py': 'v1' })
        .publish()
        .commit('Ajoute le cache', { 'cache.py': 'lru' })
        .teammate('main', 'Ajoute la CI', { '.github/ci.yml': 'tests' }).s,
    goals: [
      { text: 'origin/main contient ton commit et celui du collègue', check: (s) => { const m = q.history(s, q.remoteTip(s, 'main'), s.remote ?? undefined).map((c) => c.message); return m.includes('Ajoute le cache') && m.includes('Ajoute la CI') } },
      { text: 'Historique linéaire (aucun commit de merge)', check: (s) => !!s.remote && q.history(s, q.remoteTip(s, 'main'), s.remote).every((c) => c.parents.length <= 1) },
      { text: 'Ton main local est synchronisé', check: (s) => q.tip(s, 'main') === q.remoteTip(s, 'main') },
    ],
    solution: ['git push', 'git pull --rebase', 'git push'],
    hints: ['`git pull` = `git fetch` + `git merge` ; `git pull --rebase` rejoue tes commits par-dessus ceux du collègue.', 'Puis `git push`.'],
    explanation: `- Un push est refusé quand la branche distante contient des commits que tu n'as pas : Git refuse d'écraser le travail des autres.
- \`git pull --rebase\` : tes commits locaux sont rejoués après ceux du collègue → historique linéaire. Configurable par défaut : \`git config --global pull.rebase true\`.
- ⚠️ Ne réponds jamais à un rejet par \`git push --force\` sur une branche partagée : tu effacerais le travail du collègue.`,
  },
  {
    id: 'branche-collegue',
    chapter: 'github',
    title: 'Récupérer la branche d’un collègue',
    intro: `Une collègue te demande de relire sa branche \`fix/typo\`, qu'elle vient de pousser sur GitHub. Ton dépôt local ne la connaît pas encore.

Récupère-la et place-toi dessus, en local.`,
    setup: () => {
      const b = base().commit('Ajoute la page d’accueil', { 'index.html': '<h1>Bienvenu</h1>' }).publish()
      const r = b.s.remote!
      r.branches['fix/typo'] = r.branches.main
      return b.teammate('fix/typo', 'Corrige la faute de Bienvenue', { 'index.html': '<h1>Bienvenue</h1>' }).s
    },
    goals: [
      { text: 'origin/fix/typo est connue localement', check: (s) => !!s.local.tracking['origin/fix/typo'] },
      { text: 'Tu es sur une branche locale fix/typo qui suit origin/fix/typo', check: (s) => q.branch(s) === 'fix/typo' && s.local.upstream['fix/typo'] === 'fix/typo' },
      { text: 'Le correctif est dans ton répertoire de travail', check: (s) => s.local.work['index.html'] === '<h1>Bienvenue</h1>' },
    ],
    solution: ['git fetch', 'git branch -a', 'git switch fix/typo'],
    hints: ['`git fetch` télécharge les nouveautés de GitHub sans toucher à tes branches.', '`git switch fix/typo` crée automatiquement la branche locale qui suit `origin/fix/typo`.'],
    explanation: `- \`git fetch\` met à jour les branches de suivi (\`origin/…\`) ; il ne modifie jamais ton travail.
- \`git switch fix/typo\` : si seule \`origin/fix/typo\` existe, Git crée la branche locale et la relie.
- \`git branch -a\` liste aussi les branches distantes.`,
  },
  {
    id: 'conflit-pr',
    chapter: 'github',
    title: 'Une PR en conflit',
    intro: `Ta PR \`feature/seuil\` est **en conflit** avec \`main\` : un collègue a modifié \`config.py\` sur \`main\` entre-temps. GitHub refuse de la merger (essaie \`gh pr merge\`).

Résous le conflit **en local** : récupère \`main\`, fusionne-la dans ta branche, résous, pousse. Puis merge la PR.`,
    setup: () =>
      base()
        .commit('Ajoute la config', { 'config.py': 'SEUIL = 0.5' })
        .publish()
        .run('git switch -c feature/seuil')
        .commit('Abaisse le seuil', { 'config.py': 'SEUIL = 0.3' })
        .run('git push -u origin feature/seuil', 'gh pr create --title "Abaisse le seuil"')
        .teammate('main', 'Ajoute la langue', { 'config.py': 'SEUIL = 0.5\nLANGUE = "fr"' }).s,
    goals: [
      { text: 'La PR est mergée', check: (s) => s.prs.some((p) => p.head === 'feature/seuil' && p.state === 'merged') },
      { text: 'origin/main contient le nouveau seuil et la langue', check: (s) => { const t = s.remote ? s.remote.commits[s.remote.branches.main]?.tree['config.py'] ?? '' : ''; return t.includes('0.3') && t.includes('LANGUE') && !t.includes('<<<<<<<') } },
    ],
    solution: ['gh pr merge', 'git fetch', 'git merge origin/main', 'edit config.py', 'git add config.py', 'git commit -m "Fusionne main dans feature/seuil"', 'git push', 'gh pr merge'],
    hints: ['`git fetch` puis `git merge origin/main` sur ta branche : le conflit apparaît en local.', 'Résous (`edit config.py`, `git add`, `git commit`), puis `git push` met à jour la PR.', 'Enfin `gh pr merge`.'],
    explanation: `- Un conflit de PR se résout **dans la branche de la PR**, en y intégrant \`main\` (merge ou rebase), puis en poussant.
- Le push met à jour la PR automatiquement : pas besoin d'en ouvrir une nouvelle.
- Si tu rebases au lieu de merger, il faudra \`git push --force-with-lease\` (la branche est réécrite) : acceptable sur **ta** branche de PR, jamais sur \`main\`.`,
  },
]

export const levelById = new Map(LEVELS.map((l) => [l.id, l]))

/** Free-play repository with a GitHub remote. */
export function sandboxState(): GitState {
  return new Setup()
    .commit('Premier commit', { 'README.md': '# Projet' })
    .commit('Ajoute app.py', { 'app.py': 'print("hello")' })
    .publish().s
}
