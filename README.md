# Bunk Smart 🎓📊

[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

Bunk Smart is a smart attendance tracking web app that helps students monitor attendance, analyze bunk patterns, and make informed academic decisions. With secure Firebase login, clean UI, and real-time data sync, it transforms boring attendance tracking into a powerful decision system.

---

## Table of Contents
- [About](#about)
- [Features](#features)
- [Demo](#demo)
- [Usage](#usage)
- [Technologies Used](#technologies-used)
- [Contributing](#contributing)
- [License](#license)

---

## About
Bunk Smart is built for students who want clarity and control over their attendance.  
Instead of manually tracking classes, students get structured insights, subject-wise tracking, and smart analytics that help them decide when to attend and when they can safely bunk.

It’s not just tracking attendance.  
It’s **student decision intelligence**.

---

## Features
- Subject-wise attendance tracking  
- Secure Firebase authentication  
- Cloud-based real-time data storage  
- Smart bunk insights  
- Visual analytics dashboard  
- Responsive UI (Mobile + Desktop)  
- Fast and lightweight performance  
- Installable PWA shell with offline app assets
- Today command center with one-click actions
- Subject-level attendance and weekly timetable
- Optional locked holiday forecasts and Google Calendar connection surface

---

## Demo
Check out the live project:  
[Bunk Smart Live Demo](https://bunk-smart.netlify.app/)

*(Login required due to Firebase authentication)*

---

## Usage
1. Open the app in a browser  
2. Sign in using Firebase authentication  
3. Add subjects and attendance data  
4. Track attendance patterns  
5. View analytics and insights  
6. Use data to make smarter academic decisions  

---

## Technologies Used
- HTML, CSS, JavaScript  
- Firebase Authentication  
- Firebase Database  
- Netlify Hosting  

### Python calculation engine

The dependency-free engine in `python/attendance_engine.py` is the canonical
place for attendance rules: monthly rate, streaks, trend data, holidays, and
future-date validation. Run its focused checks with:

```bash
python3 -m py_compile python/attendance_engine.py
```

The current Netlify frontend reads Firebase directly. The module is kept as a
dependency-free reference for future server-side scoring.

### Optional smart-calendar integrations

- Public holiday suggestions use [Nager.Date](https://date.nager.at/). It is
  free for this use and does not require an API key. The frontend calls its
  public-holiday endpoint after the user chooses a country.
- College calendars need no API key: upload a CSV with `date,title` columns or
  a JSON array such as `[{"date":"2026-09-15","title":"College holiday"}]`.
- Browser reminders use the Web Notifications API and require the user's
  browser permission. They work while the app is open; reliable background
  reminders require a service worker and push provider later.

### Google Calendar setup

- The current frontend includes a safe connection placeholder but does not ask
  for private Google events without OAuth. To enable it, create a Google Cloud
  project, enable Google Calendar API, configure the OAuth consent screen, and
  create a Web application OAuth client. Add the deployed origin and a backend
  callback such as `/api/google/callback` to the authorized origins and redirect
  URIs. Store `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` only on the Python
  backend. The backend should request read-only `calendar.events` access, store
  refresh tokens encrypted, and return only normalized event data to the app.

This is the correct route for birthdays and festival events because private
calendar data must not be accessed with a browser-exposed secret.

The Google Calendar integration now runs as same-site Netlify Functions, so a
separate Render service is not required. Netlify hosts the static app and the
OAuth endpoints together. Put the following variables in Netlify's site
settings under **Environment variables**:

```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=https://bunk-smart.netlify.app/.netlify/functions/google-callback
FRONTEND_URL=https://bunk-smart.netlify.app
SESSION_SECRET=your_long_random_secret
```

Use `netlify dev` locally; it serves the frontend and Functions together.

For local Netlify development, Netlify reads `.env` from the repository root.
Copy the variables into a root `.env` manually, or add them in the Netlify CLI
environment. Do not commit either file; both are ignored by `.gitignore`.

### Ownership

Bunk Smart is owned and developed by Jishnu Rahegaonkar. The repository uses
the MIT license in `LICENSE`; third-party services, fonts, and libraries keep
their own terms. Never commit Firebase service-account credentials, Google OAuth
secrets, push-provider keys, or other private credentials.

---

## Contributing
1. Fork the repository  
2. Create a branch (`git checkout -b feature-name`)  
3. Commit your changes (`git commit -m "Add feature"`)  
4. Push to the branch (`git push origin feature-name`)  
5. Open a Pull Request  

---

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
