Kai Ke Fit - Weight Loss Competition Dashboard

Overview

Kai Ke Fit is a modern web-based dashboard designed for weight loss competitions. Participants can complete daily check-ins, track leaderboard standings, celebrate daily wins, and view competition results in a clean and engaging interface.

The application is built using:

* HTML
* CSS
* JavaScript
* Browser Local Storage (for data persistence)

No backend or database is required for the initial version.

⸻

Features

Dashboard

The main dashboard includes:

Live Leaderboard

Displays participant rankings based on points earned during the selected month.

Scoring System:

* Workout Completed = 1 Point
* Followed Diet = 1 Point
* Won the Day = 1 Point

Maximum Daily Points:

* 3 Points Per Day

Monthly Toggle

Users can:

* View the current month leaderboard
* Switch to previous months
* Compare performance across competition periods

Dashboard Statistics

Displays:

* Total Check-Ins
* Total Users
* Top Score

Daily Wins Carousel

Automatically rotates through wins submitted by participants from the previous day.

Examples:

“Joe: Walked 10,000 steps”

“Teagan: Stayed within calorie goal”

“Emma: Meal prepped for the week”

⸻

Daily Check-In

Participants can submit a daily check-in.

Questions:

1. Did you complete a 30-minute workout?

Options:

* Yes
* No

2. Did you follow your diet?

Options:

* Yes
* No

3. Do you feel like you won the day?

Options:

* Yes
* No

4. What was one win from today?

Free text response.

Examples:

* Drank a gallon of water
* Hit 12,000 steps
* Avoided soda

5. Upload Progress Image

Participants can upload:

* Progress photos
* Meal photos
* Workout screenshots

Supported Formats:

* JPG
* PNG
* GIF
* WEBP

⸻

User Management

Administrators can create new users.

Features:

* Add participant
* View participant list
* Automatically appear in leaderboard
* Available for future check-ins

⸻

Project Structure

project-folder/
│
├── index.html
├── style.css
├── script.js
└── README.md

⸻

Installation

Option 1 - Run Locally

1. Download all project files.
2. Place them in the same folder.
3. Open:

index.html

in any modern browser.

Recommended Browsers:

* Chrome
* Edge
* Firefox
* Safari

⸻

Option 2 - Host on GitHub Pages

Step 1

Create a GitHub repository.

Example:

kai-ke-fit-dashboard

Step 2

Upload:

* index.html
* style.css
* script.js

Step 3

Navigate to:

Settings → Pages

Step 4

Set:

Source: Deploy from Branch

Step 5

Choose:

main
/root

Step 6

Save.

Your dashboard will be available at:

https://yourusername.github.io/kai-ke-fit-dashboard/

⸻

Future Enhancements

Competition Features

* Weekly weigh-ins
* Weight loss point calculations
* Team competitions
* Bonus challenges
* Streak tracking

User Experience

* User profile photos
* Achievement badges
* Push notifications
* Mobile app support
* Dark/Light mode

Leaderboards

* Monthly rankings
* Weekly rankings
* All-time rankings
* Team rankings

Analytics

* Weight loss trends
* Progress charts
* Daily activity reports
* Check-in compliance tracking

⸻

Recommended Upgrade Path

For a true live competition experience, replace Local Storage with:

Firebase

Pros:

* Real-time updates
* Authentication
* File uploads
* Free tier available

Supabase

Pros:

* PostgreSQL database
* Authentication
* Real-time subscriptions
* Easy leaderboard queries

Recommended for Production:

Frontend:
HTML + CSS + JavaScript
Backend:
Firebase or Supabase
Hosting:
GitHub Pages or Vercel

⸻

Version

Version: 1.0

Created For:

Kai Ke Fit Weight Loss Competition

Last Updated:

June 2026
