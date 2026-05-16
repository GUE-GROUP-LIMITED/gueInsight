import sqlite3
DB = r'c:\Users\User\source\repos\gueInsight\app\instance\gueInsight_db.db'
con = sqlite3.connect(DB)
cur = con.cursor()
cur.execute("select id,email,password from user where email=?", ('gabrielaloho@duck.com',))
row = cur.fetchone()
print(row)
con.close()
