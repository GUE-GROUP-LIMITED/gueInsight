import requests

def test_login():
    url = 'http://127.0.0.1:5000/auth/login'
    payload = {"email": "gabrielaloho@duck.com", "password": "Password123!"}
    try:
        r = requests.post(url, json=payload, timeout=10)
    except Exception as e:
        print('REQUEST ERROR:', e)
        return
    print('STATUS:', r.status_code)
    print('HEADERS:')
    for k,v in r.headers.items():
        print(f'{k}: {v}')
    print('TEXT:')
    print(r.text)

if __name__ == '__main__':
    test_login()
