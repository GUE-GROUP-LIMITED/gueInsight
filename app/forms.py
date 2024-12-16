from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, BooleanField, SubmitField, TextAreaField, FileField
from wtforms.validators import DataRequired, Email, EqualTo, Length, URL
from flask_wtf.file import FileAllowed, FileRequired
from flask_wtf import FlaskForm
from wtforms import TextAreaField, SubmitField
from wtforms import SelectField
from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField
from wtforms.validators import DataRequired, Email, EqualTo, Length


class TextForm(FlaskForm):
    pasted_input = TextAreaField('Enter Text or Hash', validators=[DataRequired()])
    submit = SubmitField('Submit')

class AdminLoginForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired()])
    password = PasswordField('Password', validators=[DataRequired()])



class AdminSignupForm(FlaskForm):
    email = StringField('Email', validators=[DataRequired(), Email()])
    first_name = StringField('First Name', validators=[DataRequired()])
    last_name = StringField('Last Name', validators=[DataRequired()])
    
    username = StringField('Username', validators=[DataRequired(), Length(min=3, max=20)])
    
    password = PasswordField('Password', validators=[DataRequired(), Length(min=6)])
    
    confirm_password = PasswordField('Confirm Password', validators=[
        DataRequired(), EqualTo('password', message='Passwords must match')
    ])

    submit = SubmitField('Sign Up')


class LoginForm(FlaskForm):
    email = StringField('Email', validators=[DataRequired(), Email()])
    password = PasswordField('Password', validators=[DataRequired()])
    remember = BooleanField('Remember Me')
    submit = SubmitField('Login')


class SignupForm(FlaskForm):
    email = StringField('Email', validators=[DataRequired(), Email()])
    password = PasswordField('Password', validators=[DataRequired(), Length(min=6)])
    confirm_password = PasswordField('Confirm Password', validators=[DataRequired(), EqualTo('password')])
    first_name = StringField('First Name', validators=[DataRequired()])
    last_name = StringField('Last Name', validators=[DataRequired()])
    phone_number = StringField('Phone Number', validators=[DataRequired()])
    country_of_residence = StringField('Country of Residence', validators=[DataRequired()])

    # Add a select field for the subscription plan
    subscription_plan = SelectField('Subscription Plan', choices=[
        ('freemium', 'Freemium'),
        ('premium_individual', 'Premium Individual'),
        ('premium_small_business', 'Premium Small Business'),
        ('premium_large_business', 'Premium Large Business')
    ], default='freemium')

    submit = SubmitField('Sign Up')


class ResetRequestForm(FlaskForm):
    email = StringField('Email', validators=[DataRequired(), Email()])
    submit = SubmitField('Request Password Reset')

class ResetPasswordForm(FlaskForm):
    password = PasswordField('New Password', validators=[DataRequired(), Length(min=6)])
    confirm_password = PasswordField('Confirm Password', validators=[DataRequired(), EqualTo('password')])
    submit = SubmitField('Reset Password')

class ProfileForm(FlaskForm):
    # User Information Fields
    first_name = StringField('First Name', validators=[DataRequired()])
    last_name = StringField('Last Name', validators=[DataRequired()])
    email = StringField('Email', validators=[DataRequired(), Email()])
    phone_number = StringField('Phone Number')
    country_of_residence = StringField('Country of Residence')
    
    # Password Fields for updating password
    password = PasswordField('New Password', validators=[Length(min=6)])
    confirm_password = PasswordField('Confirm New Password', validators=[EqualTo('password')])

    # Profile Picture upload
    profile_picture = FileField('Profile Picture', validators=[FileAllowed(['jpg', 'png', 'jpeg'], 'Image files only')])

    submit = SubmitField('Update Profile')

class UploadFileForm(FlaskForm):
    file = FileField('Upload File', validators=[
        FileRequired(), 
        FileAllowed(['txt', 'json', 'xml', 'log', 'pcap', 'pcapng', 'yar', 'yara', 'pdf', 'sqlite', 'db', 'mdb', 'bin'], 'Allowed file types: txt, json, xml, log, pcap, pcapng, yar, yara, pdf, sqlite, db, mdb, bin')
    ])
    submit = SubmitField('Upload')

class SubmitCloudLinkForm(FlaskForm):
    cloud_link = StringField('Cloud File Link', validators=[DataRequired(), URL()])
    submit = SubmitField('Submit')

class SubmitTextForm(FlaskForm):
    pasted_input = TextAreaField('Paste Text or Hash', validators=[DataRequired()])
    submit = SubmitField('Submit')



class LogoutForm(FlaskForm):
    submit = SubmitField('Logout')

    class Meta:
        csrf = False  # Disable CSRF for this form

