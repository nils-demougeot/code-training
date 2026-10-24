import { field, num, type Chapter, type MathExercise } from '../core'
import { formulaQuiz } from './formulaQuiz'

const md = String.raw
const vec = (v: (number | string)[]) => `\\begin{pmatrix} ${v.join(' \\\\ ')} \\end{pmatrix}`
const mat = (m: number[][]) => `\\begin{pmatrix} ${m.map((row) => row.map((x) => num(x)).join(' & ')).join(' \\\\ ')} \\end{pmatrix}`

const dot: MathExercise = {
  id: 'la-dot',
  title: 'Produit scalaire',
  skill: 'u · v = Σ uᵢ vᵢ',
  level: 1,
  generate: (r) => {
    const u = Array.from({ length: 3 }, () => r.int(-4, 5))
    const v = Array.from({ length: 3 }, () => r.int(-4, 5))
    const d = u.reduce((a, x, i) => a + x * v[i], 0)
    return {
      params: { u, v },
      statement: md`Calcule le produit scalaire de $u = ${vec(u)}$ et $v = ${vec(v)}$.

Les deux vecteurs sont-ils orthogonaux ? (c'est le cas si et seulement si le produit scalaire est nul)`,
      fields: [field('$u \\cdot v$', d, 0)],
      hint: md`$u \cdot v = u_1 v_1 + u_2 v_2 + u_3 v_3$.`,
      solution: md`$$u \cdot v = ${u.map((x, i) => `(${x})(${v[i]})`).join(' + ')} = ${u.map((x, i) => x * v[i]).join(' + ').replace(/\+ -/g, '- ')} = ${d}$$

${d === 0 ? 'Le produit scalaire est nul : les vecteurs sont **orthogonaux**.' : 'Le produit scalaire est non nul : les vecteurs ne sont pas orthogonaux.'} En NumPy : ${'`'}u @ v${'`'}.`,
    }
  },
}

const norms: MathExercise = {
  id: 'la-norms',
  title: 'Normes L1 et L2',
  skill: '‖u‖₂ = √(Σ uᵢ²), ‖u‖₁ = Σ |uᵢ|',
  level: 1,
  generate: (r) => {
    const base = r.pick([[1, 2, 2], [2, 3, 6], [1, 4, 8], [2, 6, 9], [4, 4, 7], [2, 10, 11]])
    const signs = base.map(() => r.pick([1, -1]))
    const u = base.map((x, i) => x * signs[i])
    const l2 = Math.sqrt(u.reduce((a, x) => a + x * x, 0))
    return {
      params: { u },
      statement: md`Soit le vecteur de poids $w = ${vec(u)}$.

Calcule sa norme **L2** (euclidienne), sa norme **L1**, et le carré de sa norme L2 (la pénalité de Ridge, à un facteur près).`,
      fields: [field('$\\|w\\|_2$', l2, 2), field('$\\|w\\|_1$', u.reduce((a, x) => a + Math.abs(x), 0), 0), field('$\\|w\\|_2^2$', l2 * l2, 0)],
      hint: md`$\|w\|_2 = \sqrt{\sum_i w_i^2}$, $\|w\|_1 = \sum_i |w_i|$, $\|w\|_2^2 = \sum_i w_i^2$.`,
      solution: md`$$\|w\|_2^2 = ${u.map((x) => `${x < 0 ? `(${x})` : x}^2`).join(' + ')} = ${u.map((x) => x * x).join(' + ')} = ${l2 * l2} \qquad \|w\|_2 = \sqrt{${l2 * l2}} = ${l2}$$

$$\|w\|_1 = ${u.map((x) => `|${x}|`).join(' + ')} = ${u.reduce((a, x) => a + Math.abs(x), 0)}$$

La régularisation **L2** (Ridge) pénalise $\|w\|_2^2$ et rétrécit tous les poids ; la **L1** (Lasso) pénalise $\|w\|_1$ et en met certains à zéro exactement.`,
    }
  },
}

const cosine: MathExercise = {
  id: 'la-cosine',
  title: 'Similarité cosinus',
  skill: 'cos θ = u·v / (‖u‖ ‖v‖)',
  level: 2,
  generate: (r) => {
    const u = r.pick([[3, 4], [6, 8], [5, 12], [8, 6], [4, 3]])
    const v = r.pick([[1, 0], [0, 2], [12, 5], [4, -3], [3, 4], [-6, 8]])
    const d = u[0] * v[0] + u[1] * v[1]
    const nu = Math.hypot(u[0], u[1])
    const nv = Math.hypot(v[0], v[1])
    return {
      params: { u, v },
      statement: md`Deux embeddings de mots (en 2 dimensions pour simplifier) : $u = ${vec(u)}$ et $v = ${vec(v)}$.

Calcule leur **similarité cosinus**.`,
      fields: [field('$\\cos(u, v)$', d / (nu * nv), 3)],
      hint: md`$\cos(u, v) = \dfrac{u \cdot v}{\|u\|_2\,\|v\|_2}$ : le produit scalaire des vecteurs **normalisés**. Il vaut 1 pour des directions identiques, 0 si orthogonales, −1 si opposées.`,
      solution: md`$u \cdot v = ${u[0]} \times ${v[0]} + ${u[1]} \times ${v[1]} = ${d}$, $\|u\| = ${nu}$, $\|v\| = ${nv}$.

$$\cos(u, v) = \frac{${d}}{${nu} \times ${nv}} = \frac{${d}}{${nu * nv}} \approx ${num(d / (nu * nv), 4)}$$

La similarité cosinus ignore la **longueur** des vecteurs : elle ne compare que leur direction. C'est la mesure standard pour comparer des embeddings.`,
    }
  },
}

const shapes: MathExercise = {
  id: 'la-shapes',
  title: 'Dimensions et nombre de paramètres',
  skill: '(m × n)(n × p) = (m × p)',
  level: 1,
  generate: (r) => {
    const batch = r.pick([16, 32, 64])
    const dIn = r.pick([10, 20, 784, 128])
    const dOut = r.pick([3, 10, 64, 256])
    return {
      params: { batch, dIn, dOut },
      statement: md`Une couche dense calcule $Y = XW + b$ où $X$ est un batch de **${batch}** exemples à **${dIn}** features, et la couche a **${dOut}** neurones.

1. Combien de lignes et de colonnes a $Y$ ?
2. Combien de **paramètres** entraînables a la couche ($W$ et $b$) ?`,
      fields: [field('Lignes de $Y$', batch, 0), field('Colonnes de $Y$', dOut, 0), field('Paramètres', dIn * dOut + dOut, 0)],
      hint: md`Un produit $(m \times n)(n \times p)$ donne une matrice $m \times p$ : les dimensions **intérieures** doivent être égales et disparaissent. Ici $W$ est de taille $d_{in} \times d_{out}$ et $b$ a $d_{out}$ coefficients.`,
      solution: md`$X$ est $${batch} \times ${dIn}$ et $W$ est $${dIn} \times ${dOut}$, donc $Y$ est $${batch} \times ${dOut}$ ($b$ est ajouté à chaque ligne par *broadcasting*).

Paramètres : $${dIn} \times ${dOut} + ${dOut} = ${dIn * dOut + dOut}$. La taille du batch n'intervient pas : les mêmes poids servent pour tous les exemples.`,
    }
  },
}

const matmul: MathExercise = {
  id: 'la-matmul',
  title: 'Produit de matrices 2 × 2',
  skill: 'Ligne × colonne',
  level: 2,
  generate: (r) => {
    const A = [[r.int(-3, 4), r.int(-3, 4)], [r.int(-3, 4), r.int(-3, 4)]]
    const B = [[r.int(-3, 4), r.int(-3, 4)], [r.int(-3, 4), r.int(-3, 4)]]
    const C = [0, 1].map((i) => [0, 1].map((j) => A[i][0] * B[0][j] + A[i][1] * B[1][j]))
    return {
      params: { A, B },
      statement: md`Calcule le produit $C = AB$ avec
$$A = ${mat(A)} \qquad B = ${mat(B)}$$`,
      fields: [field('$c_{11}$', C[0][0], 0), field('$c_{12}$', C[0][1], 0), field('$c_{21}$', C[1][0], 0), field('$c_{22}$', C[1][1], 0)],
      hint: md`$c_{ij}$ est le produit scalaire de la **ligne** $i$ de $A$ et de la **colonne** $j$ de $B$ : $c_{ij} = \sum_k a_{ik}\,b_{kj}$.`,
      solution: md`$$c_{11} = (${A[0][0]})(${B[0][0]}) + (${A[0][1]})(${B[1][0]}) = ${C[0][0]} \qquad c_{12} = (${A[0][0]})(${B[0][1]}) + (${A[0][1]})(${B[1][1]}) = ${C[0][1]}$$
$$c_{21} = (${A[1][0]})(${B[0][0]}) + (${A[1][1]})(${B[1][0]}) = ${C[1][0]} \qquad c_{22} = (${A[1][0]})(${B[0][1]}) + (${A[1][1]})(${B[1][1]}) = ${C[1][1]}$$

$$AB = ${mat(C)}$$

En général $AB \neq BA$ : le produit matriciel n'est **pas commutatif**.`,
    }
  },
}

const inverse: MathExercise = {
  id: 'la-inverse',
  title: 'Déterminant et inverse 2 × 2',
  skill: 'A⁻¹ = (1/det) [[d, −b], [−c, a]]',
  level: 2,
  generate: (r) => {
    let A: number[][]
    let det: number
    do {
      A = [[r.int(-4, 5), r.int(-4, 5)], [r.int(-4, 5), r.int(-4, 5)]]
      det = A[0][0] * A[1][1] - A[0][1] * A[1][0]
    } while (![1, -1, 2, -2, 4, -4].includes(det))
    const inv = [[A[1][1] / det, -A[0][1] / det], [-A[1][0] / det, A[0][0] / det]]
    return {
      params: { A },
      statement: md`Soit $A = ${mat(A)}$.

Calcule son **déterminant**, puis les coefficients de son **inverse** $A^{-1}$.`,
      fields: [field('$\\det A$', det, 0), field('$(A^{-1})_{11}$', inv[0][0], 2), field('$(A^{-1})_{12}$', inv[0][1], 2), field('$(A^{-1})_{21}$', inv[1][0], 2), field('$(A^{-1})_{22}$', inv[1][1], 2)],
      hint: md`Pour $A = \begin{pmatrix} a & b \\ c & d \end{pmatrix}$ : $\det A = ad - bc$ et, si $\det A \neq 0$,
$$A^{-1} = \frac{1}{ad - bc}\begin{pmatrix} d & -b \\ -c & a \end{pmatrix}$$
(on échange la diagonale, on change le signe de l'autre diagonale).`,
      solution: md`$$\det A = (${A[0][0]})(${A[1][1]}) - (${A[0][1]})(${A[1][0]}) = ${det}$$

$$A^{-1} = \frac{1}{${det}}\begin{pmatrix} ${A[1][1]} & ${-A[0][1]} \\ ${-A[1][0]} & ${A[0][0]} \end{pmatrix} = ${mat(inv)}$$

Vérification : $A\,A^{-1} = I$. Une matrice de déterminant nul n'est pas inversible (ses colonnes sont colinéaires) : c'est le problème de la **multicolinéarité** en régression.`,
    }
  },
}

const eigen: MathExercise = {
  id: 'la-eigen',
  title: 'Valeurs propres d’une matrice symétrique',
  skill: 'λ² − tr(A) λ + det(A) = 0',
  level: 3,
  generate: (r) => {
    let a = 0
    let b = 0
    let d = 0
    let disc = 0
    do {
      a = r.int(-3, 6)
      d = r.int(-3, 6)
      b = r.int(1, 4) * r.pick([1, -1])
      disc = (a - d) ** 2 + 4 * b * b
    } while (!Number.isInteger(Math.sqrt(disc)))
    const s = Math.sqrt(disc)
    const l1 = (a + d + s) / 2
    const l2 = (a + d - s) / 2
    return {
      params: { a, b, d },
      statement: md`Trouve les **valeurs propres** de la matrice de covariance (symétrique)
$$A = ${mat([[a, b], [b, d]])}$$
Donne la plus grande, $\lambda_1$, puis la plus petite, $\lambda_2$.`,
      fields: [field('$\\lambda_1$', l1, 2), field('$\\lambda_2$', l2, 2)],
      hint: md`Les valeurs propres annulent $\det(A - \lambda I)$. Pour une matrice $2 \times 2$, cela donne
$$\lambda^2 - \mathrm{tr}(A)\,\lambda + \det(A) = 0$$
avec $\mathrm{tr}(A) = a + d$. Utile pour vérifier : $\lambda_1 + \lambda_2 = \mathrm{tr}(A)$ et $\lambda_1 \lambda_2 = \det(A)$.`,
      solution: md`$\mathrm{tr}(A) = ${a + d}$ et $\det(A) = ${a * d - b * b}$, donc on résout $\lambda^2 - (${a + d})\lambda + (${a * d - b * b}) = 0$.

Discriminant : $\Delta = (${a + d})^2 - 4 \times (${a * d - b * b}) = ${disc}$, $\sqrt{\Delta} = ${s}$.

$$\lambda_1 = \frac{${a + d} + ${s}}{2} = ${num(l1)} \qquad \lambda_2 = \frac{${a + d} - ${s}}{2} = ${num(l2)}$$

En ACP, les vecteurs propres de la covariance sont les **axes principaux**, et chaque valeur propre est la variance des données le long de son axe.`,
    }
  },
}

const projection: MathExercise = {
  id: 'la-projection',
  title: 'Projection sur un vecteur',
  skill: 'proj = (u·v / ‖v‖²) v',
  level: 2,
  generate: (r) => {
    const u = [r.int(-3, 6), r.int(-3, 6)]
    const v = r.pick([[1, 1], [2, 1], [1, 2], [3, 1], [1, -1], [2, -1]])
    const k = (u[0] * v[0] + u[1] * v[1]) / (v[0] ** 2 + v[1] ** 2)
    return {
      params: { u, v },
      statement: md`Projette orthogonalement le point $u = ${vec(u)}$ sur la droite dirigée par $v = ${vec(v)}$ (comme on projette des données sur un axe principal).

Donne les deux coordonnées du projeté.`,
      fields: [field('1ʳᵉ coordonnée', k * v[0], 2), field('2ᵉ coordonnée', k * v[1], 2)],
      hint: md`$$\mathrm{proj}_v(u) = \frac{u \cdot v}{\|v\|^2}\,v$$
Le coefficient $\frac{u \cdot v}{\|v\|^2}$ dit « combien de fois $v$ » il faut prendre.`,
      solution: md`$u \cdot v = ${u[0] * v[0] + u[1] * v[1]}$ et $\|v\|^2 = ${v[0] ** 2 + v[1] ** 2}$, donc le coefficient vaut $${num(k)}$.

$$\mathrm{proj}_v(u) = ${num(k)} \times ${vec(v)} = ${vec([num(k * v[0]), num(k * v[1])])}$$

Le reste $u - \mathrm{proj}_v(u)$ est orthogonal à $v$. La régression linéaire est une projection : $\hat{y}$ est la projection de $y$ sur l'espace engendré par les colonnes de $X$.`,
    }
  },
}

export const linalgChapter: Chapter = {
  id: 'linalg',
  title: 'Algèbre linéaire',
  emoji: '🧮',
  summary: 'Vecteurs, normes, produit scalaire, matrices, inverse, valeurs propres.',
  lesson: md`## Vecteurs

Un exemple de données, un embedding, des poids : ce sont des **vecteurs** $u \in \mathbb{R}^n$.

- **Produit scalaire** : $u \cdot v = \sum_i u_i v_i = \|u\|\,\|v\|\cos\theta$. Il est nul si les vecteurs sont **orthogonaux**.
- **Norme L2** (longueur) : $\|u\|_2 = \sqrt{u \cdot u} = \sqrt{\sum_i u_i^2}$. **Norme L1** : $\|u\|_1 = \sum_i |u_i|$.
- **Similarité cosinus** : $\cos(u, v) = \dfrac{u \cdot v}{\|u\|\,\|v\|} \in [-1, 1]$.
- **Projection** de $u$ sur la direction $v$ : $\dfrac{u \cdot v}{\|v\|^2}\,v$.

## Matrices

Une matrice $m \times n$ a $m$ lignes et $n$ colonnes. Un jeu de données $X$ est une matrice *(exemples × features)*.

**Produit** : $(m \times n)(n \times p) \to (m \times p)$, avec $c_{ij} = \sum_k a_{ik} b_{kj}$ (ligne $i$ de $A$ · colonne $j$ de $B$). Il n'est **pas commutatif** : $AB \neq BA$ en général.

**Transposée** : $(A^\top)_{ij} = a_{ji}$, et $(AB)^\top = B^\top A^\top$.

**Identité** $I$ : $AI = IA = A$. **Inverse** : $AA^{-1} = I$, n'existe que si $\det A \neq 0$.

Pour une matrice $2 \times 2$ :
$$A = \begin{pmatrix} a & b \\ c & d \end{pmatrix} \qquad \det A = ad - bc \qquad A^{-1} = \frac{1}{ad - bc}\begin{pmatrix} d & -b \\ -c & a \end{pmatrix}$$

## Valeurs et vecteurs propres

$v \neq 0$ est un **vecteur propre** de $A$ de **valeur propre** $\lambda$ si $Av = \lambda v$ : $A$ ne fait qu'étirer $v$. Les $\lambda$ sont les racines de $\det(A - \lambda I) = 0$ ; en $2 \times 2$ :
$$\lambda^2 - \mathrm{tr}(A)\,\lambda + \det(A) = 0$$
avec $\mathrm{tr}(A) = \sum \lambda_i$ et $\det(A) = \prod \lambda_i$. Une matrice **symétrique** (comme une covariance) a des valeurs propres réelles et des vecteurs propres orthogonaux : c'est la base de l'**ACP**.

## Où on les retrouve en ML

| Objet | En ML |
|---|---|
| $Xw$ | prédictions d'un modèle linéaire pour tout le dataset |
| $XW + b$ | une couche dense sur un batch |
| $\|w\|_2^2$, $\|w\|_1$ | régularisation Ridge, Lasso |
| $(X^\top X)^{-1} X^\top y$ | solution exacte des moindres carrés |
| vecteurs propres de $\frac{1}{n-1}X_c^\top X_c$ | axes de l'ACP |
| $\cos(u, v)$ | similarité entre embeddings |

## Exemple résolu

$A = \begin{pmatrix} 2 & 1 \\ 1 & 2 \end{pmatrix}$ : $\mathrm{tr} = 4$, $\det = 3$, donc $\lambda^2 - 4\lambda + 3 = (\lambda - 1)(\lambda - 3)$ : valeurs propres 3 (vecteur $(1, 1)$) et 1 (vecteur $(1, -1)$).`,
  formulas: [
    { name: 'Produit scalaire', tex: md`u \cdot v = \sum_i u_i v_i = \|u\|\,\|v\|\cos\theta` },
    { name: 'Normes', tex: md`\|u\|_2 = \sqrt{\textstyle\sum_i u_i^2} \qquad \|u\|_1 = \textstyle\sum_i |u_i|` },
    { name: 'Cosinus', tex: md`\cos(u, v) = \frac{u \cdot v}{\|u\|\,\|v\|}` },
    { name: 'Produit matriciel', tex: md`(AB)_{ij} = \sum_k a_{ik}\,b_{kj}` },
    { name: 'Inverse 2 × 2', tex: md`\begin{pmatrix} a & b \\ c & d \end{pmatrix}^{-1} = \frac{1}{ad - bc}\begin{pmatrix} d & -b \\ -c & a \end{pmatrix}` },
    { name: 'Valeurs propres 2 × 2', tex: md`\lambda^2 - \mathrm{tr}(A)\,\lambda + \det(A) = 0` },
    { name: 'Projection', tex: md`\mathrm{proj}_v(u) = \frac{u \cdot v}{\|v\|^2}\,v` },
  ],
  exercises: [
    dot,
    norms,
    shapes,
    cosine,
    matmul,
    inverse,
    projection,
    eigen,
    formulaQuiz('la-formulas', 'Les bonnes formules', [
      {
        q: 'Le produit d’une matrice $3 \\times 5$ par une matrice $5 \\times 2$ a pour dimensions :',
        correct: md`$3 \times 2$`,
        wrong: [md`$5 \times 5$`, md`$3 \times 5$`, md`impossible`],
      },
      {
        q: 'La transposée d’un produit $(AB)^\\top$ vaut :',
        correct: md`$B^\top A^\top$`,
        wrong: [md`$A^\top B^\top$`, md`$AB$`, md`$(BA)^{-1}$`],
      },
      {
        q: 'Une matrice carrée est inversible si et seulement si :',
        correct: md`$\det A \neq 0$`,
        wrong: [md`$\mathrm{tr}(A) \neq 0$`, md`tous ses coefficients sont non nuls`, md`elle est symétrique`],
      },
      {
        q: '$v$ est un vecteur propre de $A$ de valeur propre $\\lambda$ si :',
        correct: md`$Av = \lambda v$ avec $v \neq 0$`,
        wrong: [md`$Av = 0$`, md`$A = \lambda v$`, md`$v^\top A v = \lambda$ pour tout $v$`],
      },
      {
        q: 'Deux vecteurs sont orthogonaux si :',
        correct: md`leur produit scalaire est nul`,
        wrong: [md`leurs normes sont égales`, md`leur similarité cosinus vaut 1`, md`l'un est un multiple de l'autre`],
      },
      {
        q: 'La solution des moindres carrés pour $y \\approx Xw$ est :',
        correct: md`$w = (X^\top X)^{-1} X^\top y$`,
        wrong: [md`$w = X^{-1} y$`, md`$w = (X X^\top)^{-1} X y$`, md`$w = X^\top y$`],
      },
    ]),
  ],
}
