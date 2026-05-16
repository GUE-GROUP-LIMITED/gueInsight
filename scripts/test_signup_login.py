import requests
import uuid

def signup_and_login():
    base = 'http://127.0.0.1:5000'
    email = f'testuser+{uuid.uuid4().hex[:6]}@example.com'
    password = 'Password123!'
    print('SIGNUP', email)
    r = requests.post(base + '/auth/signup', json={'email': email, 'password': password, 'agree_to_terms': True, 'gdpr_consent': True})
    print('signup', r.status_code, r.text)
    r2 = requests.post(base + '/auth/login', json={'email': email, 'password': password})
    print('login', r2.status_code, r2.text)

if __name__ == '__main__':
    signup_and_login()
