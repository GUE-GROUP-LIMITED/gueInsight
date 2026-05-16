import os
import sqlite3


def db_path():
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    return os.path.join(root, 'instance', 'app.db')


def ensure_column():
    path = db_path()
    if not os.path.exists(path):
        print('DB file not found at', path)
        return
    conn = sqlite3.connect(path)
    cur = conn.cursor()
    try:
        cur.execute("PRAGMA table_info('subscription')")
        cols = [r[1] for r in cur.fetchall()]
        if 'is_trial' in cols:
            print('is_trial already present')
            return
        print('Adding is_trial column')
        cur.execute('ALTER TABLE subscription ADD COLUMN is_trial BOOLEAN NOT NULL DEFAULT 0')
        conn.commit()
        print('is_trial added')
    except Exception as e:
        print('Error while modifying DB:', e)
    finally:
        conn.close()


if __name__ == '__main__':
    ensure_column()
