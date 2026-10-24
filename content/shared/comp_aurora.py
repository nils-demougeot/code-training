"""Compétition « Les disparus du Starliner Aurora » : passagers transportés dans une autre dimension.
Données synthétiques (générées ici, identiques à chaque exécution) ; la cible du test est cachée."""
import numpy as _np
import pandas as pd

def _make_aurora(seed=2912):
    rng = _np.random.default_rng(seed)
    n_groups = 2000
    sizes = rng.choice([1, 1, 1, 1, 2, 2, 3, 4, 5], n_groups)
    rows = []
    for g, size in enumerate(sizes):
        planet = rng.choice(['Terre', 'Mars', 'Europe'], p=[0.52, 0.22, 0.26])
        deck_p = {'Terre': [0, 0, 0, 0.05, 0.15, 0.4, 0.4], 'Mars': [0, 0, 0, 0.3, 0.4, 0.2, 0.1], 'Europe': [0.25, 0.3, 0.25, 0.1, 0.05, 0.05, 0]}[planet]
        deck = rng.choice(list('ABCDEFG'), p=deck_p)
        side = rng.choice(['P', 'S'])
        num = int(rng.integers(1, 1800))
        for k in range(size):
            age = float(_np.clip(rng.normal(29 if k == 0 else 22, 13), 0, 79))
            cryo = bool(rng.random() < (0.45 if planet == 'Europe' else 0.33))
            vip = bool(rng.random() < (0.07 if planet == 'Europe' else 0.02))
            dest = rng.choice(['Kepler-22b', 'Proxima b', 'Trappist-1e'], p=[0.2, 0.1, 0.7])
            spend = {}
            for col, scale in [('RoomService', 220), ('FoodCourt', 450), ('ShoppingMall', 170), ('Spa', 310), ('VRDeck', 300)]:
                if cryo or age < 13:
                    spend[col] = 0.0
                else:
                    spend[col] = float(_np.round(rng.exponential(scale) * (rng.random() < 0.55), 0))
            room_food = spend['RoomService'] + spend['Spa'] + spend['VRDeck']
            logit = (-0.75 + 1.7 * cryo - 0.45 * _np.log1p(room_food) + 0.15 * _np.log1p(spend['FoodCourt'] + spend['ShoppingMall'])
                     + 0.8 * (planet == 'Europe') - 0.4 * (planet == 'Terre') + 1.4 * (side == 'S')
                     + 1.4 * (deck in 'BC') - 0.7 * (deck == 'E') - 1.0 * (size == 1) + 0.8 * (age < 13) + 0.3 * (dest == 'Kepler-22b'))
            rows.append({
                'PassengerId': f'{g + 1:04d}_{k + 1:02d}', 'HomePlanet': planet, 'CryoSleep': cryo,
                'Cabin': f'{deck}/{num}/{side}', 'Destination': dest, 'Age': round(age), 'VIP': vip, **spend,
                'Transported': bool(rng.random() < 1 / (1 + _np.exp(-logit))),
            })
    df = pd.DataFrame(rows)
    for col, rate in [('HomePlanet', 0.02), ('CryoSleep', 0.025), ('Cabin', 0.02), ('Destination', 0.02), ('Age', 0.02), ('VIP', 0.02),
                      ('RoomService', 0.02), ('FoodCourt', 0.02), ('ShoppingMall', 0.025), ('Spa', 0.02), ('VRDeck', 0.02)]:
        if df[col].dtype == bool:
            df[col] = df[col].astype('boolean')
        df.loc[rng.random(len(df)) < rate, col] = None
    df['Age'] = df['Age'].astype(float)
    groups = df['PassengerId'].str[:4].astype(int)
    is_test = (groups % 4 == 0)
    train = df[~is_test].reset_index(drop=True)
    test = df[is_test].reset_index(drop=True)
    return train, test.drop(columns='Transported'), test['Transported'].to_numpy()


# Disponibles dans le notebook, comme dans un notebook Kaggle.
import numpy as np  # noqa: E402

train, test, _y_hidden = _make_aurora()
_train0, _test0 = train.copy(), test.copy()
SPEND = ['RoomService', 'FoodCourt', 'ShoppingMall', 'Spa', 'VRDeck']


def _score(submission):
    """Accuracy de la soumission sur le test caché."""
    pred = submission.set_index('PassengerId').loc[_test0['PassengerId'], 'Transported']
    return float((pred.astype(bool).to_numpy() == _y_hidden).mean())


def _naive_submission():
    """Classe majoritaire du train pour tout le monde (sert de référence au validateur)."""
    return pd.DataFrame({'PassengerId': _test0['PassengerId'], 'Transported': bool(_train0['Transported'].mean() >= 0.5)})
