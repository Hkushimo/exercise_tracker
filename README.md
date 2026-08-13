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

Do not put Google credentials, service account keys, or private API secrets in this frontend. The backend should validate requests, append accepted workouts to Google Sheets, return exercise references from the `References` tab, and return filtered workout history for the stats and date views. The workout page asks the backend for `?action=references` on load, so the Sheet can be the source of truth for dropdown options.

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
3. Add a tab named `References`.
4. Add this `Workouts` header row:

```text
Submitted At | Date | Workout Type | Started At | Finished At | Duration | Duration Seconds | Exercise | Set Number | Weight | Unit | Reps | RPE
```

5. Add this `References` header row:

```text
Workout Type | Exercise
```

6. In the Sheet, open `Extensions > Apps Script`.
7. Paste this script into `Code.gs`.
8. Confirm `SPREADSHEET_ID` matches the spreadsheet ID from the Sheet URL.
9. In Apps Script, set an optional script property named `API_TOKEN` if you want basic token checking.
10. Deploy as a Web app.
11. Use the Web app URL as the Backend API URL in the tracker settings.

```javascript
const SPREADSHEET_ID = "1zXCTXKHvGpwL1Iv19Y29DAn7D62NU7BrqsDqlTvu974";
const WORKOUTS_SHEET_NAME = "Workouts";
const REFERENCES_SHEET_NAME = "References";
const APP_TIME_ZONE = "America/New_York";

function doGet(e) {
  try {
    validateToken(e.parameter.apiToken);

    if (e.parameter.action === "references") {
      return jsonResponse({ ok: true, references: readReferences() });
    }

    if (e.parameter.action === "workoutHistory") {
      return jsonResponse({ ok: true, rows: readWorkoutRows(e.parameter.exercise, e.parameter.date) });
    }

    return jsonResponse({ ok: false, error: "Unknown action." });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    validateToken(payload.apiToken);

    if (payload.action === "addExercise") {
      return jsonResponse(addReferenceExercise(payload));
    }

    validateWorkout(payload);

    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(WORKOUTS_SHEET_NAME);
    const submittedAt = Utilities.formatDate(new Date(), APP_TIME_ZONE, "yyyy-MM-dd");
    const startedAt = payload.startedAt || formatWorkoutTime(payload.startedAtIso);
    const finishedAt = payload.finishedAt || formatWorkoutTime(payload.finishedAtIso);
    const rows = [];

    payload.exercises.forEach((exercise) => {
      exercise.sets.forEach((set) => {
        rows.push([
          submittedAt,
          payload.date,
          payload.workoutType,
          startedAt,
          finishedAt,
          payload.duration || "",
          payload.durationSeconds || 0,
          exercise.name,
          set.setNumber,
          set.weight,
          set.unit,
          set.reps,
          set.rpe || "",
        ]);
      });
    });

    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    return jsonResponse({ ok: true, insertedRows: rows.length });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message });
  }
}

function formatWorkoutTime(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return Utilities.formatDate(date, APP_TIME_ZONE, "h:mm a");
}

function validateToken(token) {
  const expectedToken = PropertiesService.getScriptProperties().getProperty("API_TOKEN");

  if (expectedToken && token !== expectedToken) {
    throw new Error("Unauthorized");
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

function addReferenceExercise(payload) {
  const workoutType = String(payload.workoutType || "").trim();
  const exerciseName = String(payload.exerciseName || payload.exercise || payload.name || "").trim();

  if (!workoutType || !exerciseName) {
    throw new Error("Workout type and exercise name are required.");
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(REFERENCES_SHEET_NAME);
  const existing = readReferences();
  const duplicate = existing.some((row) => {
    return row.workoutType.toLowerCase() === workoutType.toLowerCase()
      && row.exercise.toLowerCase() === exerciseName.toLowerCase();
  });

  if (duplicate) {
    return { ok: true, insertedRows: 0, duplicate: true };
  }

  sheet.appendRow([workoutType, exerciseName]);
  rebuildReferenceHelpers();
  return { ok: true, insertedRows: 1 };
}

function readWorkoutRows(exerciseFilter, dateFilter) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(WORKOUTS_SHEET_NAME);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const exercise = String(exerciseFilter || "").toLowerCase();
  const targetDate = String(dateFilter || "").trim();

  return sheet.getRange(2, 1, lastRow - 1, 13).getValues()
    .map((row) => ({
      submittedAt: formatSheetDate(row[0]),
      date: formatSheetDate(row[1]),
      workoutType: String(row[2] || ""),
      startedAt: formatSheetTime(row[3]),
      finishedAt: formatSheetTime(row[4]),
      duration: String(row[5] || ""),
      durationSeconds: Number(row[6] || 0),
      exercise: String(row[7] || ""),
      setNumber: Number(row[8] || 0),
      weight: Number(row[9] || 0),
      unit: String(row[10] || ""),
      reps: Number(row[11] || 0),
      rpe: String(row[12] || ""),
    }))
    .filter((row) => {
      if (!row.date || !row.exercise) return false;
      if (targetDate && row.date !== targetDate) return false;
      if (exercise && row.exercise.toLowerCase() !== exercise) return false;
      return true;
    })
    .slice(-500);
}

function formatSheetDate(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return Utilities.formatDate(date, APP_TIME_ZONE, "yyyy-MM-dd");
}

function formatSheetTime(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{1,2}:\d{2}\s?(AM|PM)$/i.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return Utilities.formatDate(date, APP_TIME_ZONE, "h:mm a");
}

function readReferences() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(REFERENCES_SHEET_NAME);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  return sheet.getRange(2, 1, lastRow - 1, 2).getValues()
    .map((row) => ({
      workoutType: String(row[0] || "").trim(),
      exercise: String(row[1] || "").trim(),
    }))
    .filter((row) => row.workoutType && row.exercise);
}

function rebuildReferenceHelpers() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(REFERENCES_SHEET_NAME);
  const references = readReferences();
  const exercises = [...new Set(references.map((row) => row.exercise))].sort();
  const workoutTypes = [...new Set(references.map((row) => row.workoutType))].sort();

  sheet.getRange(1, 4, sheet.getMaxRows(), 1).clearContent();
  sheet.getRange(1, 6, sheet.getMaxRows(), 1).clearContent();
  sheet.getRange(1, 4).setValue("All Exercises");
  sheet.getRange(1, 6).setValue("Workout Types");

  if (exercises.length) {
    sheet.getRange(2, 4, exercises.length, 1).setValues(exercises.map((exercise) => [exercise]));
  }

  if (workoutTypes.length) {
    sheet.getRange(2, 6, workoutTypes.length, 1).setValues(workoutTypes.map((type) => [type]));
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
  "startedAt": "2:05 PM",
  "finishedAt": "3:08 PM",
  "startedAtIso": "2026-07-29T18:05:00.000Z",
  "finishedAtIso": "2026-07-29T19:08:00.000Z",
  "durationSeconds": 3780,
  "duration": "1hr 3m",
  "exercises": [
    {
      "name": "Bench Press",
      "sets": [
        {
          "setNumber": 1,
          "weight": 135,
          "unit": "lb",
          "reps": 10,
          "rpe": "Hard"
        }
      ]
    }
  ]
}
```

The Exercise Library form in Settings sends this payload to the same endpoint:

```json
{
  "action": "addExercise",
  "workoutType": "Pull",
  "exerciseName": "Hammer Strength Row"
}
```

## Local storage

The app stores unfinished workout drafts and settings in `localStorage`, so refreshing the page keeps entered data. Successful submission clears only the workout draft and keeps settings such as the selected default weight unit.

## GitHub Pages deployment

1. Commit the HTML, CSS, JavaScript, manifest, icon, and README files.
2. Push the repository to GitHub.
3. In the repository settings, enable GitHub Pages from the branch and folder that contain these files.

No build command is required.

## Android install

The app includes a web app manifest and service worker, so Chrome on Android can install it from the GitHub Pages URL. The install button appears only when the browser fires the PWA install prompt. It will not appear when opening `index.html` directly from the filesystem.
