"""Compétition « Le juste prix à Lyon » : prix de vente d'appartements (en k€).
Données synthétiques (générées ici, identiques à chaque exécution) ; la cible du test est cachée."""
import numpy as _np
import pandas as pd

def _make_apparts(seed=69):
    rng = _np.random.default_rng(seed)
    n = 3000
    arr = rng.choice(_np.arange(1, 10), n, p=[0.08, 0.1, 0.17, 0.08, 0.1, 0.13, 0.15, 0.1, 0.09])
    base_m2 = _np.array([0, 5400, 5900, 4700, 5000, 4300, 6300, 4400, 3700, 3900])[arr]
    pieces = rng.choice([1, 2, 3, 4, 5, 6], n, p=[0.17, 0.3, 0.27, 0.16, 0.07, 0.03])
    surface = _np.round(_np.clip(pieces * rng.normal(21, 5, n) + rng.normal(8, 6, n), 12, 260), 1)
    annee = rng.choice(_np.arange(1850, 2024), n)
    etage = _np.minimum(rng.geometric(0.3, n) - 1, 12).astype(float)
    ascenseur = (rng.random(n) < _np.where(annee > 1950, 0.85, 0.35)) | (etage >= 6)
    balcon = rng.random(n) < _np.where(annee > 1970, 0.55, 0.2)
    dpe = _np.array(list('ABCDEFG'))[_np.clip(_np.round(rng.normal(_np.where(annee > 2005, 1.5, _np.where(annee > 1975, 3.2, 4.3)), 1.0)), 0, 6).astype(int)]
    dpe_effect = {'A': 0.08, 'B': 0.06, 'C': 0.03, 'D': 0.0, 'E': -0.04, 'F': -0.09, 'G': -0.14}
    m2 = base_m2 * (1 + _np.vectorize(dpe_effect.get)(dpe)) * (1 + 0.04 * balcon) \
        * (1 + _np.where(ascenseur, 0.012 * _np.minimum(etage, 8), -0.03 * etage)) \
        * (1 - 0.12 * (surface < 20)) * (1 + 0.06 * ((annee > 1850) & (annee < 1914)))
    prix = _np.round(surface * m2 * rng.lognormal(0, 0.08, n) / 1000, 1)  # en k€
    df = pd.DataFrame({
        'id': _np.arange(1, n + 1), 'arrondissement': arr, 'surface': surface, 'pieces': pieces, 'etage': etage,
        'ascenseur': ascenseur, 'balcon': balcon, 'annee_construction': annee.astype(float), 'dpe': dpe, 'prix': prix,
    })
    # Saisies abîmées : valeurs manquantes et surfaces tapées en dm² au lieu de m².
    for col, rate in [('etage', 0.04), ('annee_construction', 0.06), ('dpe', 0.08)]:
        df[col] = df[col].astype(object) if col == 'dpe' else df[col]
        df.loc[rng.random(n) < rate, col] = _np.nan
    bad = rng.random(n) < 0.012
    df.loc[bad, 'surface'] = df.loc[bad, 'surface'] * 100
    is_test = rng.random(n) < 0.25
    train = df[~is_test].reset_index(drop=True)
    test = df[is_test & ~bad].reset_index(drop=True)
    return train, test.drop(columns='prix'), test['prix'].to_numpy()


# Disponibles dans le notebook, comme dans un notebook Kaggle.
import numpy as np  # noqa: E402

train, test, _y_hidden = _make_apparts()
_train0, _test0 = train.copy(), test.copy()


def _score(submission):
    """RMSE (en k€) de la soumission sur le test caché."""
    pred = submission.set_index('id').loc[_test0['id'], 'prix'].to_numpy(dtype=float)
    return float(_np.sqrt(_np.mean((pred - _y_hidden) ** 2)))


def _naive_submission():
    return pd.DataFrame({'id': _test0['id'], 'prix': float(_train0['prix'].mean())})
