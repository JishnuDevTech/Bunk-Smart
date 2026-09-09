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
python3 -m unittest discover -s python -p 'test_*.py'
```

The current Netlify frontend still reads Firebase directly, so it cannot run
Python in the browser. The module uses the same record contract and is ready
to be called from a Python API when server-side scoring is introduced.

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
