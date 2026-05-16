import sqlite3
from werkzeug.security import generate_password_hash

db = r'c:\Users\User\source\repos\gueInsight\app\instance\gueInsight_db.db'
con = sqlite3.connect(db)
cur = con.cursor()
h = generate_password_hash('Password123!')
cur.execute('update user set password=? where email=?', (h, 'gabrielaloho@duck.com'))
con.commit()
print('rows', cur.rowcount)
con.close()
