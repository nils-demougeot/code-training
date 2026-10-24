import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

export interface Experiment {
  id: string
  title: string
  /** What to do / observe. */
  task: string
  /** Question to think about before revealing the insight. */
  question: string
  /** Markdown explanation. */
  insight: string
  preset: Record<string, unknown>
}

export interface LabDef {
  id: string
  title: string
  summary: string
  emoji: string
  color: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: LazyExoticComponent<ComponentType<{ preset?: { config: any; nonce: number } }>>
  experiments: Experiment[]
}

export const LABS: LabDef[] = [
  {
    id: 'nn-playground',
    title: 'Réseau de neurones : large ou profond ?',
    summary: 'Entraîne un MLP en direct, change sa largeur, sa profondeur, ses activations et regarde la frontière se former.',
    emoji: '🧠',
    color: '#f472b6',
    component: lazy(() => import('./NNPlayground')),
    experiments: [
      {
        id: 'linear',
        title: 'Zéro couche cachée',
        task: 'Entraîne un réseau sans couche cachée sur les cercles.',
        question: 'Pourquoi l’accuracy plafonne-t-elle autour de 50–60 %, même après 1 000 époques ?',
        insight:
          'Sans couche cachée, le réseau calcule $\\sigma(w_1x_1 + w_2x_2 + b)$ : c’est exactement une **régression logistique**. Sa frontière de décision est une **droite**, or aucune droite ne sépare un disque d’un anneau.\n\nÀ retenir : la non-linéarité d’un réseau vient des **couches cachées + activations non linéaires**. Empiler des couches *linéaires* ne sert à rien : un produit de matrices reste une matrice.',
        preset: { dataset: 'circles', hidden: [], activation: 'tanh', features: 'raw' },
      },
      {
        id: 'features',
        title: 'Feature engineering contre profondeur',
        task: 'Même réseau linéaire, mais ajoute les entrées x², y², xy.',
        question: 'Comment un modèle linéaire peut-il soudain séparer les cercles ?',
        insight:
          'Avec $x_1^2 + x_2^2$ en entrée, le cercle devient une **droite dans l’espace des features** : la frontière $w_3 x_1^2 + w_4 x_2^2 + b = 0$ est un cercle dans le plan d’origine.\n\nC’est l’idée des `PolynomialFeatures` de scikit-learn et du *kernel trick* des SVM. Un réseau profond fait la même chose, mais **apprend lui-même** ses features au lieu qu’on les choisisse à la main.',
        preset: { dataset: 'circles', hidden: [], activation: 'tanh', features: 'poly' },
      },
      {
        id: 'wide-vs-deep',
        title: 'Large [64] contre profond [6×5]',
        task: 'Sur la spirale, entraîne « Large [64] » puis « Profond [6×5] ». Compare le nombre de paramètres et la forme de la frontière.',
        question: 'Lequel s’en sort le mieux à nombre de paramètres comparable ? Lequel est le plus capricieux à entraîner ?',
        insight:
          '- **Large et peu profond** : chaque neurone apporte un « pli » (une demi-droite pour ReLU, une rampe pour tanh). La frontière est une **somme** de ces plis. Le théorème d’approximation universelle dit qu’une seule couche suffit… avec potentiellement *énormément* de neurones.\n- **Profond et étroit** : chaque couche **compose** les plis de la précédente. On obtient des formes complexes (comme la spirale) avec beaucoup **moins de paramètres** : le nombre de régions peut croître exponentiellement avec la profondeur.\n- Contrepartie : un réseau profond est **plus dur à optimiser** (gradients qui s’évanouissent ou explosent, sensibilité au learning rate et à l’initialisation). C’est pourquoi on a inventé ReLU, BatchNorm, les connexions résiduelles (ResNet) et Adam.\n\nEn entretien : *« la profondeur donne de l’expressivité hiérarchique, la largeur de la capacité par couche ; en pratique on choisit l’architecture par validation »*.',
        preset: { dataset: 'spiral', hidden: [64], activation: 'tanh', lr: 0.01, noise: 0.05 },
      },
      {
        id: 'vanishing',
        title: 'Le gradient qui disparaît',
        task: 'Réseau de 6 couches de 8 neurones en sigmoid. Regarde le panneau « Signal du gradient par couche », puis passe en ReLU.',
        question: 'Pourquoi les premières couches ne reçoivent-elles presque aucun gradient avec la sigmoïde ?',
        insight:
          'La dérivée de la sigmoïde vaut au maximum **0,25**. La backprop multiplie ces dérivées couche après couche : avec 6 couches, $0{,}25^6 \\approx 0{,}0002$. Les premières couches n’apprennent donc presque rien : c’est le **vanishing gradient**.\n\nReLU a une dérivée de 1 pour $x>0$ : le signal traverse les couches sans s’atténuer. C’est la raison n°1 pour laquelle ReLU (et ses variantes GELU, LeakyReLU) est l’activation par défaut des couches cachées.',
        preset: { dataset: 'circles', hidden: [8, 8, 8, 8, 8, 8], activation: 'sigmoid', optimizer: 'sgd', lr: 0.3 },
      },
      {
        id: 'too-narrow',
        title: 'Le goulot d’étranglement',
        task: 'Sur XOR, entraîne [1], puis [2], puis [4].',
        question: 'Pourquoi un seul neurone caché ne suffit-il jamais pour XOR ?',
        insight:
          'Une couche d’**un seul neurone** compresse les 2 entrées en **1 nombre** : toute l’information passe par une seule direction. Les points de classes opposées se retrouvent mélangés après projection, et les couches suivantes ne peuvent plus les séparer.\n\nXOR demande au moins **2 neurones cachés** (deux droites). Retiens qu’une couche trop étroite est un **goulot d’étranglement** qui détruit de l’information, quelle que soit la profondeur ensuite.',
        preset: { dataset: 'xor', hidden: [1], activation: 'tanh' },
      },
      {
        id: 'lr',
        title: 'Learning rate trop grand',
        task: 'Mets SGD avec un learning rate de 3, puis 0.001, puis 0.1.',
        question: 'Que se passe-t-il sur la courbe de loss dans chaque cas ?',
        insight:
          '- **Trop grand** : chaque pas « saute » par-dessus le minimum, la loss oscille voire **diverge** (NaN).\n- **Trop petit** : ça converge… très lentement.\n- **Bien réglé** : descente rapide puis stabilisation.\n\nEn pratique on cherche le learning rate par ordres de grandeur (1e-1, 1e-2, 1e-3…), on utilise **Adam** qui est plus tolérant, et un *scheduler* qui le diminue au cours de l’entraînement.',
        preset: { dataset: 'moons', hidden: [16, 16], activation: 'relu', optimizer: 'sgd', lr: 3 },
      },
      {
        id: 'overfit',
        title: 'Overfitting et régularisation',
        task: 'Peu de points, beaucoup de bruit, gros réseau : entraîne longtemps. Puis recommence avec L2 = 0.01.',
        question: 'Que racontent les deux courbes de loss qui divergent ?',
        insight:
          'La loss **train** continue de baisser pendant que la loss **test** remonte : le réseau **mémorise le bruit** des points d’entraînement (frontière tortueuse autour des points isolés). C’est l’overfitting, et ce moment de bascule est le point idéal d’*early stopping*.\n\nRemèdes : plus de données, **régularisation L2** (`weight_decay`), **dropout**, early stopping, réseau plus petit. La L2 pénalise les gros poids, ce qui donne des frontières plus lisses.',
        preset: { dataset: 'moons', hidden: [32, 32, 32], activation: 'relu', noise: 0.55, points: 80, lr: 0.01, l2: 0 },
      },
    ],
  },
  {
    id: 'model-zoo',
    title: 'Comparer les modèles de ML',
    summary: 'kNN, arbres, forêts, régression logistique, Naive Bayes : vois leurs frontières, leur overfitting et leurs hypothèses.',
    emoji: '🌳',
    color: '#34d399',
    component: lazy(() => import('./ModelZoo')),
    experiments: [
      {
        id: 'knn-k',
        title: 'kNN : le compromis biais-variance',
        task: 'Mets k = 1, regarde l’accuracy train. Puis k = 120. Ensuite clique « Calculer » sur la courbe de complexité.',
        question: 'Pourquoi k = 1 donne-t-il 100 % en train mais pas en test ?',
        insight:
          'Avec **k = 1**, chaque point d’entraînement est son propre voisin : accuracy train de 100 % garantie, mais la frontière épouse le bruit (**variance élevée**, overfitting).\n\nAvec **k très grand**, on moyenne sur presque tout le dataset : la frontière devient trop lisse (**biais élevé**, underfitting).\n\nLa courbe de complexité montre le classique « U inversé » du test : on choisit k là où la courbe **test** (ou de validation croisée) est maximale. C’est exactement ce que fait `GridSearchCV`.',
        preset: { model: 'knn', k: 1, dataset: 'moons', noise: 0.35 },
      },
      {
        id: 'tree-depth',
        title: 'Arbre de décision : la profondeur',
        task: 'Fais varier la profondeur de 1 à 15 sur les lunes bruitées.',
        question: 'Pourquoi les frontières sont-elles toujours faites de segments horizontaux et verticaux ?',
        insight:
          'Chaque nœud teste **une seule feature** contre un seuil (`x₁ <= 0.3 ?`). Les frontières sont donc des **rectangles alignés sur les axes**. Une frontière diagonale demande beaucoup de petites marches.\n\nUn arbre profond peut isoler chaque point : variance énorme. On le contrôle avec `max_depth`, `min_samples_leaf` ou le *pruning*. Bonus : les arbres **n’ont pas besoin de normaliser les features**, puisqu’un seuil ne dépend pas de l’échelle.',
        preset: { model: 'tree', depth: 12, dataset: 'moons', noise: 0.35 },
      },
      {
        id: 'forest',
        title: 'Un arbre contre une forêt',
        task: 'Même profondeur (10) : compare « Arbre de décision » et « Random forest ».',
        question: 'Pourquoi la moyenne de nombreux arbres qui overfittent généralise-t-elle mieux ?',
        insight:
          'Chaque arbre de la forêt est entraîné sur un **échantillon bootstrap** (tirage avec remise) et ne regarde qu’une partie des features à chaque split. Ils font donc des **erreurs différentes**, et la moyenne les annule : la variance baisse sans augmenter le biais. C’est le **bagging**.\n\nÀ opposer au **boosting** (XGBoost, LightGBM) : des arbres *peu profonds* entraînés **séquentiellement**, chacun corrigeant les erreurs du précédent, ce qui réduit surtout le **biais**.',
        preset: { model: 'forest', depth: 10, trees: 40, dataset: 'moons', noise: 0.35 },
      },
      {
        id: 'logreg-poly',
        title: 'Régression logistique + features polynomiales',
        task: 'Sur les cercles, degré 1 puis 2, puis 8 avec beaucoup de bruit.',
        question: 'Que gagne-t-on avec le degré 2 ? Que risque-t-on au degré 8 ?',
        insight:
          'Degré 1 : frontière linéaire, échec sur les cercles. Degré 2 : $x_1^2$ et $x_2^2$ suffisent, la frontière devient une ellipse, **parfait**. Degré 8 : 44 features, la frontière se tord pour suivre le bruit.\n\nEn scikit-learn : `make_pipeline(PolynomialFeatures(2), StandardScaler(), LogisticRegression(C=1.0))`. `C` est l’inverse de la force de régularisation : petit `C` = plus de régularisation.',
        preset: { model: 'logreg', degree: 1, dataset: 'circles', noise: 0.2 },
      },
      {
        id: 'nb-xor',
        title: 'Naive Bayes et l’hypothèse d’indépendance',
        task: 'Naive Bayes sur « Nuages », puis sur XOR.',
        question: 'Pourquoi Naive Bayes est-il excellent sur les nuages et nul sur XOR ?',
        insight:
          'Naive Bayes suppose que les features sont **indépendantes sachant la classe** et modélise chaque classe par une gaussienne alignée sur les axes. Sur XOR, chaque classe occupe deux quadrants opposés : sa moyenne est au centre et la classe n’est définie que par l’**interaction** $x_1 \\times x_2$. Le modèle ne peut pas la voir.\n\nÀ retenir : NB est rapide, robuste avec peu de données et très bon en classification de texte (bag of words), mais **aveugle aux interactions** entre features.',
        preset: { model: 'nb', dataset: 'blobs', noise: 0.2 },
      },
      {
        id: 'scaling',
        title: 'Pourquoi normaliser les features ?',
        task: 'kNN (k = 15) sur les lunes : passe l’échelle de x₁ à ×100. Puis fais la même chose avec un arbre.',
        question: 'Pourquoi kNN s’effondre-t-il alors que l’arbre n’est pas affecté ?',
        insight:
          'kNN calcule des **distances** euclidiennes. Si $x_1$ est en centimètres et $x_2$ en kilomètres, la distance n’est plus déterminée que par $x_1$ : $x_2$ devient invisible.\n\nLes modèles basés sur des **distances ou des gradients** (kNN, SVM, régression logistique/linéaire régularisée, réseaux de neurones, PCA, k-means) ont besoin de `StandardScaler`. Les **arbres** et leurs ensembles (RF, XGBoost) sont invariants à l’échelle.\n\n⚠️ Le scaler se `fit` sur le **train uniquement**, puis on `transform` le test. D’où l’intérêt des `Pipeline` qui évitent la fuite de données (*data leakage*).',
        preset: { model: 'knn', k: 15, dataset: 'moons', noise: 0.2, scaleX: 100 },
      },
    ],
  },
  {
    id: 'gradient-descent',
    title: 'Optimiseurs : SGD, Momentum, Adam',
    summary: 'Regarde différents optimiseurs dévaler une surface de loss : ravins, cols, minima locaux, learning rate.',
    emoji: '⛰️',
    color: '#22d3ee',
    component: lazy(() => import('./GradientDescent')),
    experiments: [
      {
        id: 'ravine-lr',
        title: 'Le ravin et le learning rate',
        task: 'Sur le ravin, lance SGD avec lr = 0.03, puis 0.06, puis 0.1.',
        question: 'Pourquoi SGD zigzague-t-il, puis diverge, alors que la pente est douce dans une direction ?',
        insight:
          'Le ravin est **mal conditionné** : très raide en y (courbure 30), plat en x (courbure 1). Le learning rate est limité par la direction la plus raide ($lr < 2/30 \\approx 0{,}067$ sinon ça diverge), et devient donc ridiculement petit pour la direction plate.\n\nC’est ce qui arrive quand les features ont des échelles très différentes : **normaliser les features** arrondit le bol et accélère énormément la descente de gradient.',
        preset: { surface: 'ravine', lr: 0.06, enabled: ['sgd'] },
      },
      {
        id: 'momentum',
        title: 'Momentum : la bille qui prend de l’élan',
        task: 'Ravin, lr = 0.01 : compare SGD et Momentum.',
        question: 'Pourquoi le momentum avance-t-il beaucoup plus vite le long du ravin ?',
        insight:
          'Le momentum accumule une **moyenne mobile des gradients** : $v \\leftarrow 0{,}9\\,v + g$, puis $\\theta \\leftarrow \\theta - lr \\cdot v$. Les oscillations en y changent de signe et **s’annulent**, alors que la composante en x, toujours dans le même sens, **s’accumule** (jusqu’à ×10).\n\nRésultat : moins de zigzag, plus de vitesse dans les directions plates.',
        preset: { surface: 'ravine', lr: 0.01, enabled: ['sgd', 'momentum'] },
      },
      {
        id: 'adam',
        title: 'Adam : un learning rate par paramètre',
        task: 'Rosenbrock avec lr = 0.03 : compare SGD, RMSProp et Adam.',
        question: 'D’où vient la robustesse d’Adam ?',
        insight:
          'RMSProp divise chaque gradient par la racine d’une moyenne mobile de son **carré** : les directions raides sont freinées, les directions plates accélérées. C’est un **learning rate adaptatif par paramètre**.\n\nAdam = **Momentum + RMSProp** (+ correction du biais des premières itérations). C’est l’optimiseur par défaut en deep learning (`torch.optim.Adam(model.parameters(), lr=1e-3)`), même si SGD+momentum bien réglé généralise parfois mieux en vision.',
        preset: { surface: 'rosenbrock', lr: 0.03, enabled: ['sgd', 'rmsprop', 'adam'] },
      },
      {
        id: 'saddle',
        title: 'Coincé sur un col',
        task: 'Sur le col, pars presque exactement sur l’axe (point par défaut). Lance SGD, puis ajoute du bruit de gradient.',
        question: 'Pourquoi SGD reste-t-il bloqué, et pourquoi le bruit l’aide-t-il ?',
        insight:
          'Au point selle, le gradient est quasi nul : SGD avance à peine. En grande dimension, les **points selles** sont bien plus fréquents que les minima locaux.\n\nLe **bruit du mini-batch** (le « S » de SGD) pousse le paramètre hors de l’axe instable, et la descente repart. Le bruit est une fonctionnalité, pas seulement un défaut : il aide aussi à trouver des minima plus « plats », qui généralisent mieux.',
        preset: { surface: 'saddle', lr: 0.03, enabled: ['sgd', 'adam'], noise: 0 },
      },
      {
        id: 'local-minima',
        title: 'Minima locaux',
        task: 'Sur « Minima locaux », essaie plusieurs points de départ (clique sur la carte).',
        question: 'Le point d’arrivée dépend-il du point de départ ?',
        insight:
          'Sur une surface non convexe, la descente de gradient trouve le minimum **le plus proche** du bassin de départ. D’où l’importance de l’**initialisation** et de l’aléa (plusieurs seeds).\n\nBonne nouvelle : pour les grands réseaux, la plupart des minima locaux ont une loss proche du minimum global. Le vrai problème est plutôt les plateaux et les points selles.',
        preset: { surface: 'bumpy', lr: 0.03, enabled: ['sgd', 'momentum', 'adam'] },
      },
    ],
  },
  {
    id: 'shapes',
    title: 'Shapes, axes et broadcasting',
    summary: 'Visualise ce que font reshape, .T, axis=0/1, keepdims et le broadcasting NumPy. Fini les erreurs de shape.',
    emoji: '🧊',
    color: '#4fb3ff',
    component: lazy(() => import('./ShapesLab')),
    experiments: [
      {
        id: 'center',
        title: 'Centrer une matrice de données',
        task: 'A = (100, 3) (100 exemples, 3 features), B = (3,) : la moyenne par feature.',
        question: 'Pourquoi `X - X.mean(axis=0)` marche sans boucle ?',
        insight:
          '`X.mean(axis=0)` a la shape `(3,)`. Alignée à droite contre `(100, 3)`, elle est vue comme `(1, 3)` puis **étirée** sur les 100 lignes. Chaque feature est centrée.\n\nC’est le cœur de `StandardScaler` : `(X - X.mean(axis=0)) / X.std(axis=0)`.',
        preset: { a: '(100, 3)', b: '(3,)' },
      },
      {
        id: 'rows',
        title: 'Le piège : normaliser par ligne',
        task: 'A = (100, 3), B = (100,), le résultat de `X.sum(axis=1)`.',
        question: 'Pourquoi ça plante, et comment corriger ?',
        insight:
          '`(100,)` est aligné à droite contre l’axe de taille **3** : 100 ≠ 3, erreur. Il faut que la somme garde son axe : `X.sum(axis=1, keepdims=True)` → `(100, 1)`, ou `X.sum(axis=1)[:, None]`.\n\nRéflexe d’entretien : avant chaque opération entre tableaux, **écris les shapes en commentaire**.',
        preset: { a: '(100, 3)', b: '(100,)' },
      },
      {
        id: 'outer',
        title: 'Produit extérieur et distances par paires',
        task: 'A = (5, 1), B = (1, 4).',
        question: 'Comment calculer toutes les distances entre 2 ensembles de points sans boucle ?',
        insight:
          '`(5, 1)` op `(1, 4)` donne `(5, 4)` : chaque ligne × chaque colonne. Pour des points `P (n, d)` et `Q (m, d)` :\n\n```python\ndiff = P[:, None, :] - Q[None, :, :]   # (n, 1, d) - (1, m, d) -> (n, m, d)\nD = np.sqrt((diff ** 2).sum(axis=-1)) # (n, m)\n```\n\nC’est le cœur d’un kNN ou d’un k-means vectorisé, une question d’entretien fréquente.',
        preset: { a: '(5, 1)', b: '(1, 4)' },
      },
    ],
  },
  {
    id: 'clt',
    title: 'Le théorème central limite en direct',
    summary: 'Tire des échantillons de n’importe quelle distribution et regarde la moyenne devenir gaussienne.',
    emoji: '🔔',
    color: '#a3e635',
    component: lazy(() => import('./CLTLab')),
    experiments: [
      {
        id: 'n1',
        title: 'Un seul tirage',
        task: 'Distribution exponentielle, n = 1.',
        question: 'Pourquoi l’histogramme de droite ressemble-t-il exactement à celui de gauche ?',
        insight:
          'Avec n = 1, la « moyenne » d’un échantillon est un seul tirage : on retrouve la distribution de départ, très **asymétrique**. Le théorème central limite ne dit rien des observations individuelles, il parle de **moyennes**.',
        preset: { dist: 'exponential', n: 1 },
      },
      {
        id: 'n30',
        title: 'La cloche apparaît',
        task: 'Exponentielle avec n = 2, puis 5, puis 30.',
        question: 'À partir de quel n la distribution des moyennes ressemble-t-elle à une gaussienne ?',
        insight:
          'Dès n ≈ 30, la moyenne d’une exponentielle est quasi normale, alors que la distribution de départ ne l’est pas du tout. C’est le **TCL** : la moyenne de n variables indépendantes de variance finie tend vers $\\mathcal N(\\mu, \\sigma^2/n)$, **quelle que soit** la distribution de départ.\n\nC’est pour ça qu’on peut calculer des intervalles de confiance et faire des A/B tests sur des moyennes de données qui ne sont pas normales (paniers, durées de session…).',
        preset: { dist: 'exponential', n: 30 },
      },
      {
        id: 'sqrt-n',
        title: 'La règle du √n',
        task: 'Uniforme, n = 5 puis n = 100 (20 fois plus). Compare l’écart-type observé.',
        question: 'Multiplier la taille d’échantillon par 20 divise la dispersion par combien ?',
        insight:
          'L’écart-type de la moyenne vaut $\\sigma / \\sqrt n$ : 20 fois plus de données ne réduisent l’incertitude que de $\\sqrt{20} \\approx 4{,}5$. Pour **diviser l’erreur par 2**, il faut **4 fois** plus de données.\n\nC’est l’origine de l’« erreur standard » et de la taille des A/B tests.',
        preset: { dist: 'uniform', n: 5 },
      },
      {
        id: 'heavy-tail',
        title: 'Quand le TCL échoue',
        task: 'Pareto (queue lourde) avec n = 30, puis n = 100. Relance plusieurs fois.',
        question: 'Pourquoi les moyennes restent-elles asymétriques et instables ?',
        insight:
          'Cette loi de Pareto a une **variance infinie** : de très rares valeurs énormes dominent la moyenne. Les hypothèses du TCL ne sont pas remplies, la convergence vers une gaussienne n’a pas lieu (ou est très lente).\n\nEn vrai : revenus, tailles de fichiers, viralité, montants de sinistres. Préfère la **médiane**, une transformation log, ou des méthodes robustes.',
        preset: { dist: 'pareto', n: 30 },
      },
    ],
  },
  {
    id: 'ab-test',
    title: 'A/B tests : puissance et faux positifs',
    summary: 'Simule des milliers d’A/B tests pour voir les p-values, la puissance et le piège du peeking.',
    emoji: '🧪',
    color: '#a3e635',
    component: lazy(() => import('./ABTestLab')),
    experiments: [
      {
        id: 'null',
        title: 'Quand B ne fait rien',
        task: 'Effet réel : aucun. Simule.',
        question: 'Quelle proportion de tests déclare quand même B gagnant ? À quoi ressemblent les p-values ?',
        insight:
          'Environ **5 %** : c’est exactement α, le taux de **faux positifs** qu’on accepte. Sous l’hypothèse nulle, les p-values sont **uniformes** entre 0 et 1.\n\nUne p-value de 0,03 ne veut **pas** dire « 97 % de chances que B soit meilleur ». Elle dit : « si B ne faisait rien, on verrait un écart au moins aussi grand 3 % du temps ».',
        preset: { uplift: 0, n: 2000, peeking: false },
      },
      {
        id: 'power',
        title: 'Un vrai effet, pas assez de données',
        task: 'Effet +10 %, 2 000 utilisateurs par groupe, puis 15 000.',
        question: 'Pourquoi la plupart des tests ratent-ils l’effet avec 2 000 utilisateurs ?',
        insight:
          'La **puissance** (probabilité de détecter un effet qui existe) est faible avec un petit échantillon : la plupart des tests concluent « pas significatif » alors que B est meilleur (**faux négatifs**). Avec la taille calculée (≈ 14 750 par groupe), on atteint 80 %.\n\nAutre piège visible sur l’histogramme des uplifts : parmi les tests sous-dimensionnés qui *sont* significatifs, l’effet mesuré est **surestimé** (la « malédiction du gagnant »).',
        preset: { uplift: 0.1, n: 2000, peeking: false },
      },
      {
        id: 'peeking',
        title: 'Le piège du peeking',
        task: 'Effet : aucun, peeking activé. Simule, puis désactive le peeking.',
        question: 'Pourquoi regarder les résultats en cours de route multiplie-t-il les faux positifs ?',
        insight:
          'À chaque coup d’œil, on a 5 % de chances de voir un faux « significatif ». Avec 10 regards et un arrêt dès le premier p < 0,05, le taux de faux positifs grimpe vers **20 %**, au lieu de 5 %.\n\nRemèdes : fixer la taille d’échantillon **à l’avance** et n’analyser qu’à la fin, ou utiliser des méthodes séquentielles prévues pour (alpha spending, tests bayésiens, mSPRT).',
        preset: { uplift: 0, n: 5000, peeking: true },
      },
    ],
  },
  {
    id: 'bayes',
    title: 'Bayes, dépistage et taux de base',
    summary: '1 000 personnes, un test « fiable à 99 % » : visualise pourquoi un positif n’est souvent qu’une fausse alerte.',
    emoji: '🩺',
    color: '#a3e635',
    component: lazy(() => import('./BayesLab')),
    experiments: [
      {
        id: 'rare',
        title: 'Maladie rare',
        task: 'Prévalence 1 %, sensibilité 99 %, spécificité 95 %.',
        question: 'Pourquoi un test « fiable » donne-t-il surtout des faux positifs ?',
        insight:
          'Sur 1 000 personnes : 10 malades (≈ 10 détectés) mais 990 sains, dont 5 % → ≈ 50 fausses alertes. Un positif n’a qu’**1 chance sur 6** d’être un vrai malade.\n\nC’est la **precision** d’un classifieur sur une classe rare : même avec un excellent recall, la precision s’effondre si les faux positifs, appliqués à l’immense classe négative, sont nombreux.',
        preset: { prevalence: 0.01, sensitivity: 0.99, specificity: 0.95, retest: false },
      },
      {
        id: 'specificity',
        title: 'Ce qui compte vraiment',
        task: 'Garde 1 % de prévalence. Monte la sensibilité à 100 %, puis remets-la et monte la spécificité à 99,9 %.',
        question: 'Quel paramètre améliore le plus la valeur d’un test positif ?',
        insight:
          'Pour une classe rare, c’est la **spécificité** (moins de faux positifs) qui fait monter la precision, pas la sensibilité. Passer de 95 % à 99,9 % de spécificité fait passer P(malade | +) de 17 % à 91 %.\n\nEn ML : sur un problème déséquilibré, regarde le **taux de faux positifs** et la precision, pas seulement le recall ou l’AUC.',
        preset: { prevalence: 0.01, sensitivity: 0.99, specificity: 0.95, retest: false },
      },
      {
        id: 'retest',
        title: 'Le second test',
        task: 'Configuration de départ, puis active « re-tester » sur les positifs.',
        question: 'Comment un second test positif change-t-il la probabilité ?',
        insight:
          'Le résultat du premier test devient le **nouveau prior** : la prévalence parmi les positifs n’est plus 1 % mais 17 %. Après un second positif, P(malade) monte à environ 80 %. C’est la mise à jour bayésienne en action : chaque preuve indépendante affine la croyance.\n\nAttention, ça suppose des tests **indépendants**. Deux tests qui se trompent pour la même raison n’apportent pas autant.',
        preset: { prevalence: 0.01, sensitivity: 0.99, specificity: 0.95, retest: true },
      },
    ],
  },
]

export const labById = new Map(LABS.map((l) => [l.id, l]))
