import sqlite3 as _sqlite3

_db = _sqlite3.connect(":memory:")
_db.executescript(
    """
CREATE TABLE customers (
    id INTEGER PRIMARY KEY, name TEXT NOT NULL, city TEXT NOT NULL, signup_date TEXT NOT NULL
);
CREATE TABLE products (
    id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, price REAL NOT NULL
);
CREATE TABLE orders (
    id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id),
    order_date TEXT NOT NULL, status TEXT NOT NULL
);
CREATE TABLE order_items (
    order_id INTEGER NOT NULL REFERENCES orders(id), product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL
);

INSERT INTO customers VALUES
 (1, 'Alice', 'Paris', '2023-01-15'), (2, 'Bruno', 'Lyon', '2023-02-03'),
 (3, 'Chloé', 'Paris', '2023-02-20'), (4, 'David', 'Marseille', '2023-03-11'),
 (5, 'Emma', 'Lyon', '2023-04-02'), (6, 'Farid', 'Paris', '2023-04-18'),
 (7, 'Gaëlle', 'Bordeaux', '2023-05-07'), (8, 'Hugo', 'Marseille', '2023-06-21'),
 (9, 'Inès', 'Bordeaux', '2023-07-09'), (10, 'Jules', 'Paris', '2023-08-30');

INSERT INTO products VALUES
 (1, 'Clavier mécanique', 'Informatique', 89.0), (2, 'Souris sans fil', 'Informatique', 29.0),
 (3, 'Écran 27 pouces', 'Informatique', 249.0), (4, 'Casque audio', 'Audio', 129.0),
 (5, 'Enceinte bluetooth', 'Audio', 59.0), (6, 'Livre Python', 'Livres', 39.0),
 (7, 'Livre Machine Learning', 'Livres', 49.0), (8, 'Lampe de bureau', 'Maison', 35.0),
 (9, 'Chaise ergonomique', 'Maison', 299.0), (10, 'Tapis de souris', 'Informatique', 12.0);

INSERT INTO orders VALUES
 (1, 1, '2024-01-05', 'livrée'), (2, 2, '2024-01-12', 'livrée'), (3, 1, '2024-01-20', 'livrée'),
 (4, 3, '2024-02-02', 'livrée'), (5, 4, '2024-02-14', 'annulée'), (6, 5, '2024-02-18', 'livrée'),
 (7, 1, '2024-02-25', 'livrée'), (8, 6, '2024-03-03', 'livrée'), (9, 2, '2024-03-09', 'livrée'),
 (10, 3, '2024-03-15', 'livrée'), (11, 7, '2024-03-22', 'livrée'), (12, 8, '2024-04-01', 'livrée'),
 (13, 5, '2024-04-07', 'annulée'), (14, 1, '2024-04-12', 'livrée'), (15, 6, '2024-04-19', 'livrée'),
 (16, 2, '2024-05-02', 'livrée'), (17, 3, '2024-05-10', 'livrée'), (18, 7, '2024-05-16', 'livrée'),
 (19, 4, '2024-05-28', 'livrée'), (20, 6, '2024-06-04', 'livrée'), (21, 2, '2024-06-11', 'en cours'),
 (22, 1, '2024-06-15', 'en cours');

INSERT INTO order_items VALUES
 (1, 1, 1), (1, 2, 1), (2, 6, 2), (3, 3, 1), (3, 10, 2), (4, 4, 1), (5, 9, 1), (6, 7, 1), (6, 6, 1),
 (7, 5, 2), (8, 8, 3), (8, 2, 1), (9, 4, 1), (10, 1, 1), (10, 10, 1), (11, 9, 1), (12, 6, 1),
 (12, 7, 1), (13, 3, 2), (14, 2, 2), (14, 8, 1), (15, 5, 1), (16, 1, 1), (16, 4, 1), (17, 7, 2),
 (18, 8, 2), (18, 10, 4), (19, 2, 1), (20, 3, 1), (20, 9, 1), (21, 6, 3), (22, 4, 1);
"""
)


def q(sql):
    """Runs a query and returns the rows as a list of tuples."""
    return [tuple(row) for row in _db.execute(sql).fetchall()]


def show(sql, limit=30):
    """Pretty-prints the result of a query (used by the « Exécuter » button)."""
    cur = _db.execute(sql)
    cols = [d[0] for d in cur.description] if cur.description else []
    rows = cur.fetchall()
    if not cols:
        print("(requête exécutée, aucune colonne renvoyée)")
        return
    cells = [[str(c) for c in cols]] + [["NULL" if v is None else str(v) for v in r] for r in rows[:limit]]
    widths = [max(len(row[i]) for row in cells) for i in range(len(cols))]
    line = "-+-".join("-" * w for w in widths)
    print(" | ".join(c.ljust(w) for c, w in zip(cells[0], widths)))
    print(line)
    for row in cells[1:]:
        print(" | ".join(c.ljust(w) for c, w in zip(row, widths)))
    print(f"\n{len(rows)} ligne(s)" + (f", {limit} affichées" if len(rows) > limit else ""))
