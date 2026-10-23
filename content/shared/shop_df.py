import numpy as _np
import pandas as pd


def make_orders(n=60, seed=0):
    """A small, deterministic e-commerce orders table used by the Pandas exercises."""
    rng = _np.random.default_rng(seed)
    customers = ["Alice", "Bruno", "Chloé", "David", "Emma", "Farid", "Gaëlle", "Hugo"]
    cities = {"Alice": "Paris", "Bruno": "Lyon", "Chloé": "Paris", "David": "Marseille",
              "Emma": "Lyon", "Farid": "Paris", "Gaëlle": "Bordeaux", "Hugo": "Marseille"}
    products = [
        ("Clavier", "Informatique", 89.0), ("Souris", "Informatique", 29.0), ("Écran", "Informatique", 249.0),
        ("Casque", "Audio", 129.0), ("Enceinte", "Audio", 59.0), ("Livre Python", "Livres", 39.0),
        ("Livre ML", "Livres", 49.0), ("Lampe", "Maison", 35.0), ("Chaise", "Maison", 299.0),
    ]
    dates = pd.date_range("2024-01-01", "2024-06-30", freq="D")
    rows = []
    for i in range(n):
        c = customers[rng.integers(len(customers))]
        name, cat, price = products[rng.integers(len(products))]
        rows.append({
            "order_id": 1000 + i,
            "date": dates[rng.integers(len(dates))],
            "customer": c,
            "city": cities[c],
            "product": name,
            "category": cat,
            "qty": int(rng.integers(1, 5)),
            "price": price,
        })
    return pd.DataFrame(rows).sort_values("date").reset_index(drop=True)


orders = make_orders()
