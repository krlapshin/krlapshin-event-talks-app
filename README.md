# BigQuery Release Notes Explorer 🚀

A modern, highly aesthetic web dashboard built with **Python Flask** and **plain vanilla HTML5, CSS3, and JavaScript**. The application pulls, parses, caches, and presents the official Google Cloud BigQuery Release Notes feed in a structured and searchable UI, allowing users to select and Tweet about any specific update with a custom tweet composer.

---

## ✨ Features

- **⚡ Live Feed Fetching & Parsing**: Queries the official Google Cloud BigQuery Atom feed and dynamically splits combined daily release logs into granular, type-specific release notes (Features, Changes, Issues, Breaking, Announcements).
- **⏱️ In-Memory Caching**: Caches feed items for 5 minutes in memory to prevent rate-limiting and accelerate dashboard load times. Includes a manual force-refresh button that bypasses cache.
- **🔍 Instant Search & Filter**: Real-time keyword matching across dates, update types, and description contents, with color-coded category chips to filter notes instantly.
- **🐦 Built-in X/Twitter Composer Modal**: Selecting any release card opens an interactive composer that pre-populates a draft tweet. It dynamically truncates the text to fit exactly within X's 280-character limit (accounting for X's 23-character HTTPS link wrapping) and shows a circular visual progress count ring.
- **📱 Premium Responsive Interface**: Sleek dark mode styling featuring Google Cloud aesthetics, glassmorphism card panels, glowing background orbs, micro-animations, loading animations, and status indicators.
- **📋 Clipboard Integration**: Built-in clipboard utility with animated slide-in success toasts.

---

## 🛠️ Tech Stack

- **Backend**: Python, Flask (with built-in `urllib` & `xml.etree.ElementTree` parsing)
- **Frontend**: Vanilla HTML5, Vanilla CSS3 (Custom variables, Keyframes, Transitions), Vanilla ES6 JavaScript (Fetch API, DOM manipulation, SVG progress animation)
- **Icons**: FontAwesome 6, custom SVGs
- **Fonts**: Outfit (headings), Inter (body)

---

## 📂 Project Structure

```text
bq-release-notes/
├── app.py                  # Flask Application & Cache/Parsing Logic
├── requirements.txt        # Python Dependencies
├── .gitignore              # Files ignored by Git (caches, envs, IDEs)
├── README.md               # Project documentation
├── templates/
│   └── index.html          # Web dashboard structural template
└── static/
    ├── css/
    │   └── style.css       # Layout styles, glassmorphic effects, and variables
    └── js/
        └── app.js          # Core client logic, state engine, and tweet composer
```

---

## 🚀 Getting Started

### Prerequisites
Make sure you have **Python 3.x** and **pip** installed on your system.

### 1. Clone & Navigate
```bash
git clone https://github.com/krlapshin/krlapshin-event-talks-app.git
cd bq-release-notes
```

### 2. Install Dependencies
Install the required packages using pip:
```bash
pip install -r requirements.txt
```

### 3. Run the Server
Launch the Flask development server:
```bash
python app.py
```

### 4. Access the Dashboard
Open your web browser and navigate to:
👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 🔄 How the Data Flows

1. **User Action**: The browser makes a query to `/api/release-notes`.
2. **Server Check**: Flask checks if the in-memory cache is valid. If expired or forced via `?refresh=true`, it calls Google's XML feed.
3. **Data Splitting**: Flask reads the XML `<entry>` containers, decomposes the block content by splitting on `<h3>` tags via regex, and converts HTML to plain-text.
4. **Client Render**: JavaScript groups the structured JSON items by date and inserts them dynamically into the dashboard grid.
5. **Tweet Intent**: Clicking **Tweet** on a card calculates the character limit, truncates the message, and triggers a window open to X's web intent (`https://twitter.com/intent/tweet?text=...`).
