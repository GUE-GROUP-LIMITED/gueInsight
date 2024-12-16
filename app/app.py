# app.py

from flask import render_template
from flask_login import LoginManager
from flask_mail import Mail
from app import create_app
from app.models import User
from utils.utils import get_serializer


# Initialize the Flask app
app = create_app()  # Use the create_app function to initialize the app

#csrf = CSRFProtect(app)
mail = Mail(app)
# Serializer for generating and verifying tokens
app.serializer = get_serializer(app.config['SECRET_KEY'], app.config['SECURITY_PASSWORD_SALT'])
# Initialize login manager
login_manager = LoginManager(app)
login_manager.login_view = 'users.user_login'  # Redirect to login page if not authenticated
login_manager.login_view = 'admin.admin_login' # Redirect to login page if not authenticated

# User loader function
@login_manager.user_loader
def load_user(user_id):
    return User.query.get(user_id)

print(app.url_map)

# Route for home page
@app.route('/')
def index():
    return render_template('index.html')

if __name__ == "__main__":
    app.run(debug=True)

