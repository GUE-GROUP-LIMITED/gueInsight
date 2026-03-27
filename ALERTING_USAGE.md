# GueInsight Alerting System: Testing & Usage Guide

## End-to-End Testing Steps

### 1. Setup & Prerequisites
- Ensure all migrations are applied: `python -m flask db upgrade`
- Set up Slack/Teams webhooks in your environment variables if you want to test notifications.
- Start the Flask app: `python -m flask run`

### 2. As an Admin
- Log in at `/admin_login`.
- Go to "Alert Rules" in the admin dashboard.
- Create a global alert rule (e.g., type: keyword, value: test, severity: high).
- Go to "Alerts" to view all triggered alerts (should be empty initially).

### 3. As a User
- Sign up or log in at `/user_login` or `/user_signup`.
- Go to "Alert Rules" in the user dashboard.
- Create a user-specific alert rule (e.g., type: keyword, value: confidential, severity: medium).
- Submit a file or text containing the keyword/value you set in your rule.
- Go to "Alerts" to see if your rule was triggered.

### 4. Triggering Alerts
- Upload or submit content that matches a rule (keyword, IOC, or severity).
- The system will evaluate all enabled rules (user and global).
- If a rule matches, an alert is created, and notifications are sent (if configured).

### 5. Viewing Alerts
- Users: See triggered alerts in the "Alerts" section of the user dashboard.
- Admins: See all triggered alerts in the "Alerts" section of the admin dashboard.

### 6. Managing Rules
- Users can create, edit, enable/disable, and delete their own rules.
- Admins can manage global rules for all users.

## Usage Summary
- **Alert Rules:** Define what should trigger an alert (keyword, IOC, severity).
- **Alerts:** View when and why an alert was triggered, and which rule caused it.
- **Notifications:** Slack/Teams/SMS notifications are sent for each triggered alert (if configured).

---

# Running the App & Logging In

1. **Start the App:**
   - In your terminal, run: `python -m flask run`
   - The app will be available at `http://127.0.0.1:5000/`

2. **Log in as Admin:**
   - Go to `/admin_login`
   - Enter your admin credentials (or sign up at `/admin_signup` if needed)
   - Access the admin dashboard, manage users, files, reports, and alert rules

3. **Log in as User:**
   - Go to `/user_login` or `/user_signup`
   - Enter your user credentials
   - Access the user dashboard, upload files, manage alert rules, and view alerts

4. **Test Alerting:**
   - Create alert rules as admin and user
   - Upload or submit content to trigger alerts
   - Check the "Alerts" section for results

---

For any issues, check the logs in your terminal for errors or notifications.
