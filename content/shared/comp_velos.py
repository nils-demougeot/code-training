"""Compétition « Rush hour à vélo » : nombre de locations de vélos par heure.
Données synthétiques (générées ici, identiques à chaque exécution) ; la cible du test est cachée."""
import numpy as _np
import pandas as pd

def _make_velos(seed=7):
    rng = _np.random.default_rng(seed)
    times = pd.date_range('2024-01-01 00:00', '2024-12-31 23:00', freq='h')
    n = len(times)
    hour = times.hour.to_numpy()
    dow = times.dayofweek.to_numpy()
    doy = times.dayofyear.to_numpy()
    weekend = dow >= 5
    holidays = {(1, 1), (4, 1), (5, 1), (5, 8), (5, 9), (5, 20), (7, 14), (8, 15), (11, 1), (11, 11), (12, 25)}
    ferie = _np.array([(t.month, t.day) in holidays for t in times])
    off = weekend | ferie
    # Daily weather: seasonal temperature, rainy days, then hourly variations.
    day_temp = 12 - 9 * _np.cos(2 * _np.pi * (_np.arange(366) - 15) / 366) + rng.normal(0, 2.5, 366)
    day_rain = rng.random(366) < 0.3
    temp = day_temp[doy - 1] + 4 * _np.sin(2 * _np.pi * (hour - 9) / 24) + rng.normal(0, 1, n)
    pluie = day_rain[doy - 1] & (rng.random(n) < 0.45)
    humidite = _np.clip(_np.where(pluie, 88, 62) + rng.normal(0, 9, n) - 0.6 * (temp - 12), 20, 100).round()
    vent = _np.clip(rng.gamma(2, 7, n), 0, 70).round(1)
    commute = 260 * _np.exp(-((hour - 8) ** 2) / 1.6) + 300 * _np.exp(-((hour - 18) ** 2) / 2.2) + 70 * _np.exp(-((hour - 13) ** 2) / 3)
    leisure = 150 * _np.exp(-((hour - 15) ** 2) / 10)
    night = 12 + 25 * ((hour >= 7) & (hour <= 22))
    base = _np.where(off, leisure, commute) + night
    # Après une averse, les rues restent mouillées : la demande reste basse l'heure suivante.
    pluie_avant = _np.concatenate([[False], pluie[:-1]]) | _np.concatenate([[False, False], pluie[:-2]])
    weather = _np.clip(1 + 0.035 * (temp - 15) - 0.0012 * (temp - 22) ** 2 * (temp > 22), 0.15, 1.5) \
        * _np.where(pluie, 0.35, _np.where(pluie_avant, 0.5, 1)) * (1 - 0.006 * vent) * rng.lognormal(0, 0.05, 366)[doy - 1]
    count = rng.poisson(_np.maximum(base * weather, 0.5))
    df = pd.DataFrame({
        'datetime': times.strftime('%Y-%m-%d %H:%M'), 'temperature': temp.round(1), 'humidite': humidite, 'vent': vent,
        'pluie': pluie, 'ferie': ferie, 'locations': count,
    })
    # Capteur d'humidité en panne par moments (valeur 0), et quelques températures manquantes.
    df.loc[rng.random(n) < 0.02, 'humidite'] = 0
    df.loc[rng.random(n) < 0.01, 'temperature'] = _np.nan
    is_test = times.day >= 22
    train = df[~is_test].reset_index(drop=True)
    test = df[is_test].reset_index(drop=True)
    return train, test.drop(columns='locations'), test['locations'].to_numpy()


# Disponibles dans le notebook, comme dans un notebook Kaggle.
import numpy as np  # noqa: E402

train, test, _y_hidden = _make_velos()
_train0, _test0 = train.copy(), test.copy()


def _score(submission):
    """MAE (en locations par heure) de la soumission sur le test caché."""
    pred = submission.set_index('datetime').loc[_test0['datetime'], 'locations'].to_numpy(dtype=float)
    return float(_np.mean(_np.abs(pred - _y_hidden)))


def _naive_submission():
    return pd.DataFrame({'datetime': _test0['datetime'], 'locations': float(_train0['locations'].mean())})
