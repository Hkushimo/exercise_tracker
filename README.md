# Workout Tracker

A lightweight, responsive workout tracker built with plain HTML, CSS, and JavaScript. It is designed to be hosted as a static site on GitHub Pages.

## Files

- `index.html` - app markup and templates
- `styles.css` - mobile-first styling
- `app.js` - workout state, validation, local storage, and submission logic

## Backend endpoint

The frontend posts workout JSON to a configurable backend URL. The default placeholder is:

```javascript
const API_URL = "https://script.google.com/macros/s/AKfycbwXYPvj0kiUNiyNLbN7WoK4Vf_FptWZ-W8WDKOC963eMdUDG5V0F_vsRw8rJKG18DubXQ/exec";
```

Users can change the API URL in the Settings section of the app. An optional API access token can also be stored locally and is sent as:

```http
Authorization: Bearer <token>
```

Do not put Google credentials, service account keys, or private API secrets in this frontend. The backend should validate requests and append accepted workouts to Google Sheets.

## Google Sheets API setup

Recommended architecture:

1. GitHub Pages hosts this static frontend.
2. The frontend sends the workout JSON to your backend API URL.
3. The backend validates the request.
4. The backend appends rows to Google Sheets.

Do not call Google Sheets directly from `app.js`. Browser code cannot safely hold Google service account keys, OAuth client secrets, or private spreadsheet credentials.

### Simple option: Google Apps Script backend

For a personal or lightweight tracker, a Google Apps Script web app is the shortest path.

1. Create a Google Sheet.
2. Add a tab named `Workouts`.
3. Add this header row:

```text
Submitted At | Date | Workout Type | Workout Notes | Exercise | Set Number | Weight | Unit | Reps | RPE | Set Notes
```

4. In the Sheet, open `Extensions > Apps Script`.
5. Paste this script into `Code.gs`.
6. Replace `PASTE_SPREADSHEET_ID_HERE` with the spreadsheet ID from the Sheet URL.
7. In Apps Script, set an optional script property named `API_TOKEN` if you want basic token checking.
8. Deploy as a Web app.
9. Use the Web app URL as the Backend API URL in the tracker settings.

```javascript
const SPREADSHEET_ID = "PASTE_SPREADSHEET_ID_HERE";
const SHEET_NAME = "Workouts";

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const expectedToken = PropertiesService.getScriptProperties().getProperty("API_TOKEN");

    if (expectedToken && payload.apiToken !== expectedToken) {
      return jsonResponse({ ok: false, error: "Unauthorized" });
    }

    validateWorkout(payload);

    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    const submittedAt = new Date();
    const rows = [];

    payload.exercises.forEach((exercise) => {
      exercise.sets.forEach((set) => {
        rows.push([
          submittedAt,
          payload.date,
          payload.workoutType,
          payload.notes || "",
          exercise.name,
          set.setNumber,
          set.weight,
          set.unit,
          set.reps,
          set.rpe || "",
          set.notes || "",
        ]);
      });
    });

    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    return jsonResponse({ ok: true, insertedRows: rows.length });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message });
  }
}

function validateWorkout(payload) {
  if (!payload.date || !payload.workoutType || !Array.isArray(payload.exercises)) {
    throw new Error("Invalid workout payload.");
  }

  const hasSet = payload.exercises.some((exercise) => {
    return exercise.name && Array.isArray(exercise.sets) && exercise.sets.length > 0;
  });

  if (!hasSet) {
    throw new Error("Workout must include at least one exercise and set.");
  }
}

function jsonResponse(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### Important CORS note

If you use Google Apps Script directly from GitHub Pages, browser CORS behavior can be strict. A standard backend such as Cloudflare Workers, Netlify Functions, Vercel Functions, Express, or FastAPI can accept the current `Content-Type: application/json` request and `Authorization` header more cleanly.

This app detects Apps Script URLs that include `script.google.com/macros/` and sends a simple POST body to reduce CORS preflight issues. If you enter an optional API token for an Apps Script backend, the app sends it inside the JSON body as `apiToken`. For non-Apps-Script APIs, the token is sent as a standard `Authorization: Bearer <token>` header.

## Expected payload

```json
{
  "date": "2026-07-29",
  "workoutType": "Push",
  "notes": "Felt strong today",
  "exercises": [
    {
      "name": "Bench Press",
      "sets": [
        {
          "setNumber": 1,
          "weight": 135,
          "unit": "lb",
          "reps": 10,
          "rpe": 8,
          "notes": ""
        }
      ]
    }
  ]
}
```

## Local storage

The app stores unfinished workout drafts and settings in `localStorage`, so refreshing the page keeps entered data. Successful submission clears only the workout draft and keeps settings such as the selected default weight unit.

## GitHub Pages deployment

1. Commit `index.html`, `styles.css`, `app.js`, and `README.md`.
2. Push the repository to GitHub.
3. In the repository settings, enable GitHub Pages from the branch and folder that contain these files.

No build command is required.

## Android install

The app includes a web app manifest and service worker, so Chrome on Android can install it from the GitHub Pages URL. The install button appears only when the browser fires the PWA install prompt. It will not appear when opening `index.html` directly from the filesystem.
