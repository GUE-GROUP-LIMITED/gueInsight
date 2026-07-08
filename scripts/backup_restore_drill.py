import datetime
import os
import shutil
import sqlite3


def run_drill():
    base = 'instance'
    src = os.path.join(base, 'app.db')
    if not os.path.exists(src):
        raise FileNotFoundError(f'Source database not found: {src}')

    ts = datetime.datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
    backup = os.path.join(base, f'app_backup_{ts}.db')
    restore = os.path.join(base, f'app_restore_drill_{ts}.db')

    shutil.copy2(src, backup)

    conn = sqlite3.connect(backup)
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    tables = [row[0] for row in cur.fetchall()]

    sample_counts = {}
    for table_name in tables[:12]:
        try:
            cur.execute(f'SELECT COUNT(*) FROM {table_name}')
            sample_counts[table_name] = cur.fetchone()[0]
        except Exception as exc:
            sample_counts[table_name] = f'error: {exc}'
    conn.close()

    shutil.copy2(backup, restore)

    restore_conn = sqlite3.connect(restore)
    restore_cur = restore_conn.cursor()
    restore_cur.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    table_count = restore_cur.fetchone()[0]
    restore_conn.close()

    print(f'SRC={src}')
    print(f'BACKUP={backup}')
    print(f'RESTORE={restore}')
    print(f'TABLE_COUNT={table_count}')
    print(f'SAMPLE_COUNTS={sample_counts}')


if __name__ == '__main__':
    run_drill()
