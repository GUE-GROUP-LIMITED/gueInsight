# GueInsight

GueInsight is a comprehensive cybersecurity platform designed to analyze various cybersecurity artifacts, extract Indicators of Compromise (IoCs), and assist with threat modeling, forensics, and attribution. The platform combines the power of machine learning, Natural Language Processing (NLP), and transformers to provide actionable insights and aid in compliance, data security, and information security.

---

## Features

### 1. **Multi-Layer Architecture**
GueInsight follows a structured approach to turn raw data into valuable insights through the following layers:

- **Input Layer**: Allows users to upload files, paste text, or provide a cloud drive URL via the dashboard.
- **Preprocessing Layer**: Cleans and structures raw data for analysis (located at `/app/src/preprocessing/preprocess.py`).
- **Ingestion Layer**: Handles data ingestion (located at `/app/src/ingestion/file_ingestion.py`).
- **Analysis Layer**: Performs detailed analysis, such as threat categorization and anomaly detection (located at `/app/src/analysis/file_analysis.py`).
- **Visualization Layer**: Generates interactive charts and reports (located at `/app/src/visualization/visualization.py`).
- **Output Layer**: Stores analysis results and enables data export (located at `/app/output`).

### 2. **User Subscription Tiers**
- **Freemium**: One file upload per month.
- **Personal**: Up to four uploads per month.
- **SME**: Up to six uploads per month and allows adding sub-users.
- **Large Enterprise**: Up to ten uploads per month and allows adding sub-users.

### 3. **File Analysis**
Supports the following file types for upload and analysis:
- `.txt`, `.json`, `.xml`, `.log`, `.pcap`, `.pcapng`, `.yar`, `.yara`, `.pdf`, `.sqlite`, `.db`, `.mdb`, `.bin`

The analysis focuses on:
- Extracting IoCs.
- Identifying threats and ransomware families.
- Modeling attack patterns and aiding in forensic investigations.

### 4. **Professional Report Generation**
Users can generate professional cybersecurity reports that include:
- The date and time of generation.
- The name of the user.
- File types analyzed.
- Recommendations for remediation and system hardening.

Reports are:
- Downloadable directly.
- Saved in the user's dashboard for later access.

### 5. **Subscription Management**
- Users with SME or Large Enterprise subscriptions can manage sub-users.
- Admin users have a full overview of users and their sub-users.

### 6. **Email Alerts**
- Automatically sends analysis results to the logged-in user's email and designated stakeholders.

---

## Application Structure
GueInsight follows a modular architecture:

```
/app
├── src
│   ├── preprocessing
│   │   └── preprocess.py
│   ├── ingestion
│   │   └── file_ingestion.py
│   ├── analysis
│   │   └── file_analysis.py
│   └── visualization
│       └── visualization.py
├── templates
│   ├── users
│   │   └── userbase.html
├── output
└── gueInsight_db.db
```

---

## Technical Details

- **Backend Framework**: Flask (currently not using Blueprints for simplicity).
- **Database**: Single SQLite database (`gueInsight_db.db`) for users and admins.
- **Frontend**: Designed to reflect a purple team theme for cybersecurity.
- **NLP Tool**: SpaCy for text analysis and IoC extraction.

---

## How to Use

1. **Upload Files**: Navigate to the dashboard and upload supported files.
2. **Run Analysis**: The platform automatically processes the files and generates insights.
3. **View Results**: Results are displayed in the dashboard with options for downloading reports.
4. **Export Data**: Export analysis results for further use.

---

## Development Roadmap

### Current
- Fully functional file upload and analysis.
- Subscription-based user management.
- Email alert system.

### Future Enhancements
- Scalability with microservices.
- Real-time anomaly detection.
- Enhanced visualization with dashboards.

---

## Requirements

- Python 3.9+
- Flask
- SpaCy

---

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/GUE-GROUP-LIMITED/gueInsight.git
   ```
2. Navigate to the project directory:
   ```bash
   cd gueInsight
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the application:
   ```bash
   python app.py
   ```
5. Access the app at `http://127.0.0.1:5000/`.

## Local Configuration

Create a `.env` file in the repository root based on `.env.example` and set the trusted staff owner account:

```bash
SUPER_ADMIN_EMAIL=you@yourcompany.com
```

This account is the only one that can view and manage other admin accounts. Regular admins only see subscriber accounts.

If you want to use a different local database or frontend origin, set `SQLALCHEMY_DATABASE_URI` and `FRONTEND_ORIGINS` in the same `.env` file.

---

## License
GueInsight is licensed under [MIT License](LICENSE).

---

## Contributors
- Gabriel Aloho (Project Owner)

---

## Support
For support, contact [support@guecyber.com](mailto:support@guecyber.com).
