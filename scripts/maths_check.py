"""Independent answers for the maths exercises (src/maths): each function recomputes, from the
numbers drawn for an instance, what the learner must answer, with NumPy/SciPy rather than by
re-reading the TypeScript formulas. validate_content.py compares them with the app's answers."""

import math
from fractions import Fraction
from itertools import product

import numpy as np
from scipy import stats


def p_union(a, b, ab):
    u = a + b - ab
    return [u, 1 - u]


def p_at_least_one(n, p):
    return [1 - stats.binom.pmf(0, n, p)]


def p_counting(n, k):
    return [math.comb(n, k), math.perm(n, k)]


def p_conditional(freeChurn, freeStay, premChurn, premStay):
    return [freeChurn / (freeChurn + freeStay), freeChurn / (freeChurn + premChurn)]


def p_total(s, d1, d2):
    joint = np.array([s * d1, (1 - s) * d2])
    return [joint.sum(), joint[0] / joint.sum()]


def p_bayes_test(prev, se, sp):
    tp, fp = se * prev, (1 - sp) * (1 - prev)
    return [tp + fp, tp / (tp + fp)]


def p_dice(s, t):
    rolls = [a + b for a, b in product(range(1, 7), repeat=2)]
    return [Fraction(rolls.count(s), 36), Fraction(sum(r >= t for r in rolls), 36)]


def rv_expectation(xs, ps):
    x, p = np.array(xs, float), np.array(ps)
    assert abs(p.sum() - 1) < 1e-9 and (p > 0).all()
    d = stats.rv_discrete(values=(x, p))
    return [d.mean(), d.var()]


def rv_linear(m, sd, a, b):
    return [a * m + b, a ** 2 * sd ** 2, abs(a) * sd]


def rv_binomial(n, p, k):
    return [stats.binom.pmf(k, n, p), stats.binom.mean(n, p)]


def rv_binomial_moments(n, p):
    return [stats.binom.mean(n, p), stats.binom.var(n, p), stats.binom.std(n, p)]


def rv_poisson(lambda_, k):
    return [stats.poisson.pmf(k, lambda_), stats.poisson.sf(0, lambda_)]


def rv_normal(mu, sigma, x):
    return [(x - mu) / sigma, stats.norm.sf(x, mu, sigma)]


def rv_sum(m1, s1, m2, s2):
    return [m1 + m2, s1 ** 2 + s2 ** 2, math.sqrt(s1 ** 2 + s2 ** 2)]


def rv_exponential(lambda_, t):
    d = stats.expon(scale=1 / lambda_)
    return [d.mean(), d.sf(t)]


def inf_mean_std(xs):
    return [np.mean(xs), np.std(xs, ddof=1)]


def inf_standard_error(sigma, n):
    return [sigma / math.sqrt(n), sigma / math.sqrt(4 * n)]


def inf_ci_mean(mean, sigma, n):
    lo, hi = stats.norm.interval(0.95, loc=mean, scale=sigma / math.sqrt(n))
    return [lo, hi]


def inf_ci_proportion(n, k):
    p = k / n
    lo, hi = stats.norm.interval(0.95, loc=p, scale=math.sqrt(p * (1 - p) / n))
    return [p, (hi - lo) / 2]


def inf_ab_test(n, ka, kb):
    # statsmodels' proportions_ztest with the pooled variance, written out.
    pool = (ka + kb) / (2 * n)
    z = (kb / n - ka / n) / math.sqrt(pool * (1 - pool) * (2 / n))
    # Cross-check with a chi-square test on the 2x2 table: z^2 == chi2 (no continuity correction).
    chi2 = stats.chi2_contingency([[ka, n - ka], [kb, n - kb]], correction=False)[0]
    assert abs(z * z - chi2) < 1e-6 * max(1, chi2), (z * z, chi2)
    return [pool, z]


def inf_sample_size(sigma, e):
    # The statement and the lesson use the rounded quantile 1,96.
    return [math.ceil((1.96 * sigma / e) ** 2 - 1e-9)]


def inf_correlation(xs, ys):
    return [np.cov(xs, ys, ddof=1)[0, 1], stats.pearsonr(xs, ys)[0]]


def la_dot(u, v):
    return [np.dot(u, v)]


def la_norms(u):
    u = np.array(u, float)
    return [np.linalg.norm(u), np.linalg.norm(u, 1), np.linalg.norm(u) ** 2]


def la_cosine(u, v):
    u, v = np.array(u, float), np.array(v, float)
    return [u @ v / np.linalg.norm(u) / np.linalg.norm(v)]


def la_shapes(batch, dIn, dOut):
    y = np.zeros((batch, dIn)) @ np.zeros((dIn, dOut)) + np.zeros(dOut)
    return [y.shape[0], y.shape[1], dIn * dOut + dOut]


def la_matmul(A, B):
    return list((np.array(A) @ np.array(B)).ravel())


def la_inverse(A):
    A = np.array(A, float)
    return [np.linalg.det(A), *np.linalg.inv(A).ravel()]


def la_eigen(a, b, d):
    w = np.linalg.eigvalsh(np.array([[a, b], [b, d]], float))
    return [w[1], w[0]]


def la_projection(u, v):
    u, v = np.array(u, float), np.array(v, float)
    # Least-squares fit of u by c * v gives the orthogonal projection.
    c = np.linalg.lstsq(v[:, None], u, rcond=None)[0][0]
    return list(c * v)


def _poly_eval(coefs, x):
    return np.polyval(coefs, x)


def calc_poly(a, b, c, d, x0):
    p = np.poly1d([a, b, c, d])
    return [p.deriv()(x0), p.deriv(2)(x0)]


def calc_chain(a, b, n, x0):
    p = np.poly1d([a, b]) ** n
    return [p.deriv()(x0)]


def _num_deriv(f, x, h=1e-5):
    return (f(x + h) - f(x - h)) / (2 * h)


def calc_log_exp(a, b, x0, k):
    return [_num_deriv(lambda x: math.log(a * x * x + b), x0), _num_deriv(lambda x: x * x * math.exp(k * x), 1.0)]


def calc_gradient(a, b, c, d, x0, y0):
    f = lambda x, y: a * x * x + b * x * y + c * y * y + d * x
    return [_num_deriv(lambda x: f(x, y0), x0), _num_deriv(lambda y: f(x0, y), y0)]


def calc_gd(a, m, x0, eta):
    xs = [x0]
    for _ in range(2):
        xs.append(xs[-1] - eta * _num_deriv(lambda t: a * (t - m) ** 2, xs[-1]))
    # The ideal rate is the one that lands on m in one step from any start.
    ideal = (x0 - m) / _num_deriv(lambda t: a * (t - m) ** 2, x0)
    return [xs[1], xs[2], ideal]


def calc_sigmoid(z, y):
    s = lambda t: 1 / (1 + math.exp(-t))
    loss = lambda t: -(y * math.log(s(t)) + (1 - y) * math.log(1 - s(t)))
    return [_num_deriv(s, z), _num_deriv(loss, z)]


def calc_min(a, b, c):
    from scipy.optimize import minimize_scalar

    res = minimize_scalar(lambda x: a * x * x + b * x + c)
    return [res.x, res.fun]


def calc_mse_grad(xs, ys, w0):
    x, y = np.array(xs, float), np.array(ys, float)
    loss = lambda w: np.mean((w * x - y) ** 2)
    w_star = np.linalg.lstsq(x[:, None], y, rcond=None)[0][0]
    return [loss(w0), _num_deriv(loss, w0), w_star]


def ml_metrics(tp, fp, fn, tn):
    from sklearn.metrics import f1_score, precision_score, recall_score

    y = [1] * (tp + fn) + [0] * (fp + tn)
    pred = [1] * tp + [0] * fn + [1] * fp + [0] * tn
    return [precision_score(y, pred), recall_score(y, pred), f1_score(y, pred)]


def ml_imbalance(n, pos, tp, fp):
    from sklearn.metrics import accuracy_score, recall_score

    y = [1] * pos + [0] * (n - pos)
    a = [0] * n
    b = [1] * tp + [0] * (pos - tp) + [1] * fp + [0] * (n - pos - fp)
    return [accuracy_score(y, a), accuracy_score(y, b), recall_score(y, b)]


def ml_regression_metrics(y, yhat):
    from sklearn.metrics import mean_absolute_error, mean_squared_error

    mse = mean_squared_error(y, yhat)
    return [mse, math.sqrt(mse), mean_absolute_error(y, yhat)]


def ml_r2(y, yhat):
    from sklearn.metrics import r2_score

    y, yhat = np.array(y, float), np.array(yhat, float)
    return [((y - yhat) ** 2).sum(), ((y - y.mean()) ** 2).sum(), r2_score(y, yhat)]


def ml_logloss(ys, ps):
    from sklearn.metrics import log_loss

    return [log_loss(ys, ps, labels=[0, 1])]


def ml_softmax(z, k):
    from scipy.special import softmax

    p = softmax(np.array(z, float))
    return [p[k], -math.log(p[k])]


def ml_entropy(counts):
    p = np.array(counts, float) / sum(counts)
    return [stats.entropy(p, base=2), 1 - (p ** 2).sum()]


def ml_gini_split(lp, ln, rp, rn):
    from sklearn.tree import DecisionTreeClassifier

    # A depth-1 tree on a single binary feature reproduces the split; read its impurities.
    X = [[0]] * (lp + ln) + [[1]] * (rp + rn)
    y = [1] * lp + [0] * ln + [1] * rp + [0] * rn
    t = DecisionTreeClassifier(max_depth=1, criterion="gini").fit(X, y).tree_
    if t.node_count == 1:  # identical children: no split possible
        return [t.impurity[0], t.impurity[0], 0.0]
    n = t.weighted_n_node_samples
    after = (n[1] * t.impurity[1] + n[2] * t.impurity[2]) / n[0]
    return [t.impurity[0], after, t.impurity[0] - after]


def ml_ridge(w, lambda_, mse, g):
    w = np.array(w, float)
    pen = lambda_ * (w ** 2).sum()
    total = lambda v: mse + g * (v - w[0]) + lambda_ * (v ** 2 + (w[1:] ** 2).sum())
    return [pen, mse + pen, w[0] - 0.1 * _num_deriv(total, w[0])]


# Parameter names that are Python keywords.
RENAME = {"lambda": "lambda_"}


def check_instance(inst):
    """Returns None when the instance is right, else a message."""
    ex = inst["id"]
    if inst["choice"] is not None and "correct" in inst["params"]:
        # Question banks (formula quizzes, GenAI concept questions): the option marked correct is the bank's answer.
        return None if inst["choice"] == inst["params"]["correct"] else "wrong option marked correct"
    # The check of exercise "rv-binomial" is the function rv_binomial (looked up at call time).
    fn = globals().get(ex.replace("-", "_"))
    if fn is None:
        return "no independent check"
    params = {RENAME.get(k, k): v for k, v in inst["params"].items()}
    expected = [float(x) for x in fn(**params)]
    if len(expected) != len(inst["answers"]):
        return f"{len(inst['answers'])} answers, {len(expected)} expected"
    for i, (got, want, dec) in enumerate(zip(inst["answers"], expected, inst["decimals"])):
        # The app's exact answer must be well within the tolerance granted to the learner.
        if abs(got - want) > max(1e-6, 1e-6 * abs(want)) and abs(got - want) > 0.05 * 10 ** -dec:
            return f"field {i + 1}: app says {got}, independent value {want} (params {inst['params']})"
    return None


# ---------------------------------------------------------------- GenAI Academy

def gen_tokens(words, window, reserved):
    per_doc = words / 0.75
    return [per_doc, math.floor((window - reserved) / per_doc)]


def gen_temperature(logits, temp):
    from scipy.special import softmax

    z = np.array(logits, float)
    return [softmax(z)[0], softmax(z / temp)[0]]


def gen_fewshot_cost(k, tokensPerExample, callsPerDay, price):
    extra = k * tokensPerExample
    return [extra, extra * callsPerDay * 30 / 1e6 * price]


def gen_cosine(q, d1, d2):
    from scipy.spatial.distance import cosine

    return [1 - cosine(q, d1), 1 - cosine(q, d2)]


def gen_chunking(docTokens, size, overlap, docs, dim):
    # Simulate the sliding window instead of using the closed formula.
    starts, start = [], 0
    while True:
        starts.append(start)
        if start + size >= docTokens:
            break
        start += size - overlap
    return [len(starts), len(starts) * docs * dim * np.dtype(np.float32).itemsize / 1e6]


def gen_recall_mrr(ranks, k):
    found = [x for x in ranks if x > 0]
    return [sum(x <= k for x in found) / len(ranks), sum(1 / x for x in found) / len(ranks)]


def gen_precision_k(flags, relevantTotal):
    hits = sum(flags[:5])
    assert hits <= relevantTotal
    return [hits / 5, hits / relevantTotal]


def gen_eval_margin(n, k):
    lo, hi = stats.norm.interval(0.95, loc=k / n, scale=math.sqrt(k / n * (1 - k / n) / n))
    return [k / n, (hi - lo) / 2]


def gen_guardrail(tp, fn, fp, tn):
    from sklearn.metrics import precision_score, recall_score

    y = [1] * (tp + fn) + [0] * (fp + tn)
    blocked = [1] * tp + [0] * fn + [1] * fp + [0] * tn
    return [recall_score(y, blocked), precision_score(y, blocked)]


def gen_agent_reliability(p, n, target):
    steps = 0
    while p ** (steps + 1) >= target:
        steps += 1
    return [p ** n, steps]


def gen_monthly_cost(requests, tin, tout, pin, pout):
    per_request = tin / 1e6 * pin + tout / 1e6 * pout
    return [per_request, per_request * requests * 30]


def gen_latency(retrieval, ttft, tokens, speed):
    return [retrieval + ttft + tokens / speed, retrieval + ttft]


def gen_roi(tickets, minutes, saved, rate, runCost):
    hours = tickets * minutes * saved / 60
    return [hours * rate, hours * rate - runCost]
