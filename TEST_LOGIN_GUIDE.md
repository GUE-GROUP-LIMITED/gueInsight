# TEST CREDENTIALS & LOGIN GUIDE

## 🔐 Test Account Created

Your test user account has been created and is ready to use!

### Login Credentials:
```
Email:    demo@gueinsight.com
Password: demo12345
Name:     Demo User
Company:  GueInsight Test
```

---

## 📝 How to Test (Step by Step)

### Step 1: Navigate to Login Page
- **URL:** http://localhost:5173/login
- The login form is already loaded in your browser

### Step 2: Enter Credentials
1. **Email field:** Type `demo@gueinsight.com`
2. **Password field:** Type `demo12345`
3. Click the **"Log in"** button

### Step 3: Dashboard Access
- After successful login, you'll be redirected to your dashboard
- You can now test:
  - File analysis upload
  - User profile settings
  - Analysis history
  - Export/reporting features

---

## 🧪 What You Can Test

### File Upload & Analysis
1. Upload a sample file (PDF, DOCX, TXT, or LOG)
2. System will:
   - Extract text content
   - Identify IoCs (IPs, URLs, emails, hashes)
   - Detect suspicious patterns
   - Evaluate alert rules
3. View analysis results with:
   - Suspicious patterns found
   - Indicators of Compromise
   - Threat level assessment
   - Export options

### User Account
1. View/edit profile information
2. Update company details
3. Manage notification preferences
4. Generate compliance reports

### Compliance Features
1. GDPR data export
2. Incident summaries
3. Audit evidence packing
4. Multi-format report generation

---

## 🔗 Frontend Routes to Test

| Route | Feature | Notes |
|-------|---------|-------|
| `/login` | Authentication | ✓ Currently viewing |
| `/signup` | New user registration | Test alternative sign-up flow |
| `/dashboard` | Main dashboard | After login |
| `/upload` | File analysis | Upload documents |
| `/analysis-results` | Results view | View past analyses |
| `/profile` | User settings | Edit account info |
| `/compliance` | Compliance reports | Generate audit docs |
| `/docs` | Documentation | User guides |

---

## 🛠️ Additional Test Credentials (From Tests)

If you want to test multiple users or different roles, here are other credentials used in the test suite:

### Default Test User
```
Email:    test@example.com
Password: password
```

### Other Test Cases
```
Email:    auth_test@example.com
Password: password

Email:    logout_test@example.com
Password: password
```

**Note:** These are from the test suite. Use the created `demo@gueinsight.com` account for UI testing.

---

## 📊 Backend API Testing (Optional)

While testing the UI, you can also verify the API directly:

### Health Check
```bash
curl http://localhost:5000/healthz
# Response: {"status":"ok"}
```

### Test Endpoints
```bash
# Get current user (requires login)
curl -X GET http://localhost:5000/api/users/me

# Upload file (requires authentication)
curl -X POST http://localhost:5000/api/analysis/upload \
  -F "file=@sample.txt"
```

---

## ✅ Testing Checklist

- [ ] Navigate to http://localhost:5173/login
- [ ] Enter email: `demo@gueinsight.com`
- [ ] Enter password: `demo12345`
- [ ] Click "Log in"
- [ ] Verify redirect to dashboard
- [ ] Upload a test file
- [ ] Review analysis results
- [ ] Test profile settings
- [ ] Generate compliance export
- [ ] Test logout

---

## 🚀 Frontend Application Status

| Component | Status | URL |
|-----------|--------|-----|
| **React Frontend** | ✓ Running | http://localhost:5173 |
| **Flask Backend** | ✓ Running | http://localhost:5000 |
| **Login Page** | ✓ Loaded | http://localhost:5173/login |
| **Database** | ✓ Connected | SQLite (dev) |
| **Test User** | ✓ Created | demo@gueinsight.com |

---

## 🆘 Troubleshooting

### "Invalid credentials" error
- Double-check email spelling: `demo@gueinsight.com` (case-insensitive)
- Password is exactly: `demo12345` (case-sensitive)

### Page not loading
- Verify frontend server is running on port 5173
- Check browser console for errors
- Clear browser cache and refresh

### Login redirects to login page
- Frontend server may need to communicate with backend
- Verify backend is running on port 5000
- Check network tab in browser dev tools

### No "Log in" button visible
- Try scrolling down on the page
- Check if JavaScript is enabled
- Try in a different browser

---

## 📞 Support

For more information about the platform:
- **Documentation:** http://localhost:5173/docs
- **Pricing:** http://localhost:5173/subscription
- **Support:** http://localhost:5173/support
- **Company:** https://www.guecyber.com
- **Email:** info@guecyber.com

---

## 🎯 Next Steps After Login

1. **Explore Dashboard** - Get familiar with the interface
2. **Upload Sample File** - Test the analysis engine
3. **Review Results** - See IoC extraction in action
4. **Generate Report** - Create compliance export
5. **Test Features** - Try all available functionality

---

**Ready to test?** Go to: **http://localhost:5173/login** and use your credentials!

Test Date: 2026-06-23  
Environment: Development (Windows)  
Frontend Server: Active on port 5173 ✓  
Backend API: Active on port 5000 ✓
