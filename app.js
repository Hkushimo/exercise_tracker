const API_URL = "https://script.google.com/macros/s/AKfycbwXYPvj0kiUNiyNLbN7WoK4Vf_FptWZ-W8WDKOC963eMdUDG5V0F_vsRw8rJKG18DubXQ/exec";

const STORAGE_KEYS = {
  draft: "workoutTrackerDraft",
  settings: "workoutTrackerSettings",
  references: "workoutTrackerReferences",
};

const PUSH_EXERCISES = [
  "Bench Press",
  "Incline Bench Press",
  "Dumbbell Press",
  "Machine Chest Press",
  "Machine Incline Chest Press",
  "Pec Deck / Chest Fly",
  "Cable Chest Fly",
  "Shoulder Press",
  "Machine Shoulder Press",
  "Machine Lateral Raise",
  "Lateral Raise",
  "Assisted Dip Machine",
  "Triceps Press Machine",
  "Triceps Extension Machine",
  "Triceps Pushdown",
  "Cable Triceps Pushdown",
  "Smith Machine Bench Press",
  "Smith Machine Incline Press",
];

const PULL_EXERCISES = [
  "Pull-Up",
  "Assisted Pull-Up Machine",
  "Lat Pulldown",
  "Lat Pulldown Machine",
  "Barbell Row",
  "Cable Row",
  "Seated Row Machine",
  "Rear Delt Fly Machine",
  "Cable Face Pull",
  "Biceps Curl",
  "Cable Biceps Curl",
  "Preacher Curl Machine",
  "Back Extension Machine",
  "Deadlift",
];

const LOWER_BODY_EXERCISES = [
  "Squat",
  "Smith Machine Squat",
  "Leg Press",
  "Leg Press Machine",
  "Hack Squat Machine",
  "Romanian Deadlift",
  "Smith Machine Romanian Deadlift",
  "Leg Curl",
  "Seated Leg Curl Machine",
  "Lying Leg Curl Machine",
  "Leg Extension",
  "Leg Extension Machine",
  "Calf Raise",
  "Seated Calf Raise Machine",
  "Standing Calf Raise Machine",
  "Hip Abduction Machine",
  "Hip Adduction Machine",
  "Glute Kickback Machine",
  "Cable Kickback",
  "Cable Pull-Through",
  "Deadlift",
];

const CARDIO_EXERCISES = [
  "Running",
  "Walking",
  "Cycling",
  "Treadmill",
  "Elliptical",
  "Arc Trainer",
  "Upright Bike",
  "Recumbent Bike",
  "Rower",
  "Stair Climber / Stepmill",
  "Recumbent Stepper",
  "Upper Body Ergometer",
];

const CORE_AND_FUNCTIONAL_EXERCISES = [
  "Ab Crunch Machine",
  "Rotary Torso Machine",
  "Captain's Chair / Vertical Knee Raise",
  "Cable Wood Chop",
  "Cable Crunch",
  "Dual Adjustable Pulley",
  "Cable Tower",
  "Smith Machine",
  "30-Minute Express Circuit",
  "Battle Ropes",
  "TRX Row",
];

const WORKOUT_TYPES = {
  Push: PUSH_EXERCISES,
  Pull: PULL_EXERCISES,
  Legs: LOWER_BODY_EXERCISES,
  "Upper Body": [...PUSH_EXERCISES, ...PULL_EXERCISES],
  "Lower Body": [...LOWER_BODY_EXERCISES, ...CARDIO_EXERCISES],
  "Full Body": [...PUSH_EXERCISES, ...PULL_EXERCISES, ...LOWER_BODY_EXERCISES, ...CORE_AND_FUNCTIONAL_EXERCISES, ...CARDIO_EXERCISES],
  Cardio: CARDIO_EXERCISES,
  Custom: [],
};

let referenceExercises = cloneWorkoutTypes(WORKOUT_TYPES);

// Centralized element references keep event wiring and state collection simple.
const els = {
  form: document.querySelector("#workoutForm"),
  date: document.querySelector("#workoutDate"),
  type: document.querySelector("#workoutType"),
  startTime: document.querySelector("#workoutStartTime"),
  duration: document.querySelector("#workoutDuration"),
  exerciseList: document.querySelector("#exerciseList"),
  addExercise: document.querySelector("#addExerciseButton"),
  clearWorkout: document.querySelector("#clearWorkoutButton"),
  formMessage: document.querySelector("#formMessage"),
  submit: document.querySelector("#submitButton"),
  installButton: document.querySelector("#installButton"),
  settingsToggle: document.querySelector("#settingsToggle"),
  settingsPanel: document.querySelector("#settingsPanel"),
  defaultUnit: document.querySelector("#defaultUnit"),
  themeMode: document.querySelector("#themeMode"),
  apiUrl: document.querySelector("#apiUrl"),
  apiToken: document.querySelector("#apiToken"),
  referenceForm: document.querySelector("#referenceExerciseForm"),
  referenceWorkoutType: document.querySelector("#referenceWorkoutType"),
  referenceExerciseName: document.querySelector("#referenceExerciseName"),
  referenceMessage: document.querySelector("#referenceMessage"),
  referenceSubmit: document.querySelector("#referenceSubmitButton"),
  summaryModal: document.querySelector("#summaryModal"),
  summaryContent: document.querySelector("#summaryContent"),
  confirmSubmit: document.querySelector("#confirmSubmitButton"),
  exerciseTemplate: document.querySelector("#exerciseTemplate"),
  setTemplate: document.querySelector("#setTemplate"),
};

let settings = loadSettings();
let pendingPayload = null;
let saveTimer = 0;
let deferredInstallPrompt = null;

init();

async function init() {
  registerServiceWorker();
  setupInstallPrompt();
  applyTheme(settings.theme);
  els.date.value = todayIso();
  els.defaultUnit.value = settings.defaultUnit;
  els.themeMode.value = settings.theme;
  els.apiUrl.value = settings.apiUrl;
  els.apiToken.value = settings.apiToken;

  loadCachedReferences();
  await loadExerciseReferences();

  const restored = restoreDraft();
  if (!restored) {
    resetWorkoutTime();
    addExercise({}, { position: "end" });
  }

  els.addExercise.addEventListener("click", () => {
    addExercise({}, { position: "start", focus: true });
    saveDraftSoon();
  });

  els.date.addEventListener("change", updateDurationDisplay);

  els.type.addEventListener("change", () => {
    refreshExerciseOptions();
    saveDraftSoon();
  });

  els.form.addEventListener("input", saveDraftSoon);
  els.form.addEventListener("change", saveDraftSoon);
  els.form.addEventListener("submit", handleReview);
  els.startTime.addEventListener("input", () => {
    updateDurationDisplay();
    saveDraftSoon();
  });
  els.startTime.addEventListener("change", () => {
    updateDurationDisplay();
    saveDraftSoon();
  });
  els.clearWorkout.addEventListener("click", clearWorkout);
  els.referenceForm.addEventListener("submit", submitReferenceExercise);

  els.settingsToggle.addEventListener("click", toggleSettings);
  [els.defaultUnit, els.themeMode, els.apiUrl, els.apiToken].forEach((input) => {
    input.addEventListener("input", saveSettings);
    input.addEventListener("change", saveSettings);
  });

  els.summaryModal.addEventListener("close", () => {
    if (els.summaryModal.returnValue === "confirm") {
      submitWorkout();
    }
  });

  updateDurationDisplay();
  window.setInterval(updateDurationDisplay, 30000);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      // The app still works without offline caching if registration fails.
    });
  });
}

function setupInstallPrompt() {
  if (!els.installButton) return;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    els.installButton.hidden = false;
  });

  els.installButton.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;

    els.installButton.disabled = true;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice.catch(() => null);
    deferredInstallPrompt = null;
    els.installButton.hidden = true;
    els.installButton.disabled = false;
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    els.installButton.hidden = true;
  });
}

function todayIso() {
  return new Date().toLocaleDateString("en-CA");
}

function loadSettings() {
  const fallback = {
    defaultUnit: "lb",
    theme: "system",
    apiUrl: API_URL,
    apiToken: "",
  };

  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(STORAGE_KEYS.settings)) };
  } catch {
    return fallback;
  }
}

function saveSettings() {
  settings = {
    defaultUnit: els.defaultUnit.value,
    theme: els.themeMode.value,
    apiUrl: els.apiUrl.value.trim() || API_URL,
    apiToken: els.apiToken.value.trim(),
  };
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  applyTheme(settings.theme);
  saveDraftSoon();
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme || "system";
}

function cloneWorkoutTypes(source) {
  return Object.fromEntries(Object.entries(source).map(([type, exercises]) => [type, [...exercises]]));
}

function allReferenceExercises() {
  return [...new Set(Object.values(referenceExercises).flat())].sort();
}

function loadCachedReferences() {
  try {
    const cached = JSON.parse(localStorage.getItem(STORAGE_KEYS.references));
    const parsed = parseReferencePayload(cached);
    if (parsed) referenceExercises = parsed;
  } catch {
    referenceExercises = cloneWorkoutTypes(WORKOUT_TYPES);
  }
}

async function loadExerciseReferences() {
  try {
    const url = buildReferenceUrl();
    const response = await fetch(url, { method: "GET", mode: "cors" });
    if (!response.ok) throw new Error(`References returned ${response.status}`);

    const body = await response.json();
    if (body.ok === false) throw new Error(body.error || "References request failed.");

    const parsed = parseReferencePayload(body.references || body);
    if (!parsed) throw new Error("References response was empty.");

    referenceExercises = parsed;
    localStorage.setItem(STORAGE_KEYS.references, JSON.stringify(body.references || body));
  } catch {
    // Keep cached or built-in references if the Sheet is unavailable.
  }
}

async function reloadExerciseReferences() {
  localStorage.removeItem(STORAGE_KEYS.references);
  referenceExercises = cloneWorkoutTypes(WORKOUT_TYPES);
  await loadExerciseReferences();
  refreshExerciseOptions();
}

function buildReferenceUrl() {
  const url = new URL(settings.apiUrl || API_URL);
  url.searchParams.set("action", "references");
  if (settings.apiToken) url.searchParams.set("apiToken", settings.apiToken);
  return url.toString();
}

async function submitReferenceExercise(event) {
  event.preventDefault();
  clearReferenceMessage();

  const workoutType = els.referenceWorkoutType.value;
  const exerciseName = els.referenceExerciseName.value.trim();

  if (!workoutType || !exerciseName) {
    showReferenceMessage("Choose a workout type and enter an exercise name.", "error");
    return;
  }

  setReferenceProcessing(true);

  try {
    const response = await fetch(settings.apiUrl || API_URL, {
      method: "POST",
      mode: "cors",
      ...buildApiRequest({ action: "addExercise", workoutType, exerciseName }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(text || `Backend returned ${response.status}`);
    }

    const responseBody = await response.clone().json().catch(() => null);
    if (responseBody && responseBody.ok === false) {
      throw new Error(responseBody.error || "Backend rejected the exercise.");
    }

    els.referenceExerciseName.value = "";
    await reloadExerciseReferences();
    showReferenceMessage("Exercise added and dropdowns refreshed from the Sheet.", "success");
    els.referenceExerciseName.focus();
  } catch (error) {
    showReferenceMessage(readableSubmitError(error).replace("Submission failed", "Exercise add failed"), "error");
  } finally {
    setReferenceProcessing(false);
  }
}

function parseReferencePayload(payload) {
  const next = {};

  if (Array.isArray(payload)) {
    payload.forEach((item) => {
      const workoutType = String(item.workoutType || item.type || item[0] || "").trim();
      const exercise = String(item.exercise || item.name || item[1] || "").trim();
      if (!workoutType || !exercise) return;
      if (!next[workoutType]) next[workoutType] = [];
      next[workoutType].push(exercise);
    });
  } else if (payload && typeof payload === "object") {
    Object.entries(payload).forEach(([workoutType, exercises]) => {
      if (!Array.isArray(exercises)) return;
      next[workoutType] = exercises.map((exercise) => String(exercise).trim()).filter(Boolean);
    });
  }

  Object.keys(next).forEach((workoutType) => {
    next[workoutType] = [...new Set(next[workoutType])].sort();
  });

  return Object.keys(next).length ? { ...emptyWorkoutTypes(), ...next } : null;
}

function emptyWorkoutTypes() {
  return Object.fromEntries(Object.keys(WORKOUT_TYPES).map((type) => [type, []]));
}

function toggleSettings() {
  const isOpen = !els.settingsPanel.hidden;
  els.settingsPanel.hidden = isOpen;
  els.settingsToggle.setAttribute("aria-expanded", String(!isOpen));
}

function exerciseSuggestions() {
  const preferred = referenceExercises[els.type.value] || [];
  return els.type.value === "Custom" ? allReferenceExercises() : preferred;
}

// Exercise cards own their set rows, which keeps add/remove behavior localized.
function addExercise(data = {}, options = {}) {
  const node = els.exerciseTemplate.content.firstElementChild.cloneNode(true);
  const exerciseSelect = node.querySelector(".exercise-select");
  const setsList = node.querySelector(".sets-list");

  populateExerciseSelect(exerciseSelect, data.name);

  exerciseSelect.addEventListener("change", () => {
    saveDraftSoon();
  });

  node.querySelector(".add-set").addEventListener("click", () => {
    addSet(setsList);
    renumberSets(setsList);
    updateSetControls(node);
    saveDraftSoon();
  });

  node.querySelector(".remove-set").addEventListener("click", () => {
    removeLastSet(node);
    saveDraftSoon();
  });

  node.querySelector(".remove-exercise").addEventListener("click", () => {
    removeExercise(node);
    saveDraftSoon();
  });

  if (options.position === "start") {
    els.exerciseList.prepend(node);
  } else {
    els.exerciseList.append(node);
  }

  if (data.sets?.length) {
    data.sets.forEach((set) => addSet(setsList, set));
  } else {
    addSet(setsList);
  }

  renumberSets(setsList);
  updateSetControls(node);

  if (options.focus) {
    requestAnimationFrame(() => exerciseSelect.focus());
  }
}

function removeExercise(card) {
  card.remove();
  if (!els.exerciseList.children.length) addExercise({}, { position: "end" });
}

function removeLastSet(card) {
  const setsList = card.querySelector(".sets-list");
  const rows = setsList.querySelectorAll(".set-row");
  const lastRow = rows[rows.length - 1];

  if (rows.length > 1) {
    lastRow.remove();
  } else if (lastRow) {
    lastRow.querySelector(".set-weight").value = "";
    lastRow.querySelector(".set-reps").value = "";
    setRpe(lastRow, "");
  }

  renumberSets(setsList);
  updateSetControls(card);
}

function updateSetControls(card) {
  const removeSet = card.querySelector(".remove-set");
  if (!removeSet) return;
  removeSet.disabled = card.querySelectorAll(".set-row").length < 1;
}

function populateExerciseSelect(select, selectedName = "") {
  const suggestions = exerciseSuggestions();
  select.replaceChildren();

  select.add(new Option("Choose exercise", ""));

  suggestions.forEach((exercise) => {
    select.add(new Option(exercise, exercise));
  });

  if (selectedName && suggestions.includes(selectedName)) {
    select.value = selectedName;
  } else {
    select.value = "";
  }
}

function refreshExerciseOptions() {
  document.querySelectorAll(".exercise-card").forEach((card) => {
    const select = card.querySelector(".exercise-select");
    populateExerciseSelect(select, select.value);
  });
}

function addSet(setsList, data = {}) {
  const row = els.setTemplate.content.firstElementChild.cloneNode(true);

  row.querySelector(".set-weight").value = data.weight ?? "";
  row.querySelector(".set-reps").value = data.reps ?? "";
  setRpe(row, data.rpe ?? "");

  row.querySelectorAll(".rpe-option").forEach((button) => {
    button.addEventListener("click", () => {
      const nextValue = row.querySelector(".set-rpe").value === button.dataset.rpe ? "" : button.dataset.rpe;
      setRpe(row, nextValue);
      saveDraftSoon();
    });
  });

  setsList.append(row);
}

function setRpe(row, value) {
  const normalized = normalizeRpe(value);
  row.querySelector(".set-rpe").value = normalized;
  row.querySelectorAll(".rpe-option").forEach((button) => {
    const isSelected = button.dataset.rpe === normalized;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
}

function normalizeRpe(value) {
  if (value === "" || value === null || value === undefined) return "";

  if (["Easy", "Hard", "Max"].includes(value)) return value;

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "";
  if (numeric <= 7.5) return "Easy";
  if (numeric <= 8.5) return "Hard";
  return "Max";
}

function renumberSets(setsList) {
  setsList.querySelectorAll(".set-row").forEach((row, index) => {
    const setNumber = index + 1;
    row.querySelector(".set-number").textContent = `Set ${setNumber}`;
  });
}

function resetWorkoutTime() {
  els.startTime.value = currentTimeValue();
  updateDurationDisplay();
}

function workoutTiming() {
  const start = startDateFromInput();
  const finish = new Date();
  const durationSeconds = elapsedSeconds(start, finish);

  return {
    startedAt: start ? start.toISOString() : "",
    finishedAt: finish.toISOString(),
    durationSeconds,
    duration: formatDuration(durationSeconds),
  };
}

function updateDurationDisplay() {
  if (!els.duration) return;
  els.duration.textContent = formatDuration(elapsedSeconds(startDateFromInput(), new Date()));
}

function startDateFromInput() {
  if (!els.date.value || !els.startTime.value) return null;
  return new Date(`${els.date.value}T${els.startTime.value}`);
}

function elapsedSeconds(start, finish) {
  if (!start || Number.isNaN(start.getTime())) return 0;
  const end = finish || new Date();
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
}

function currentTimeValue(date = new Date()) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function timeValueFromIso(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return currentTimeValue(date);
}

function startTimeFromElapsed(totalSeconds) {
  const start = new Date(Date.now() - Math.max(0, Number(totalSeconds || 0)) * 1000);
  return currentTimeValue(start);
}

function formatDuration(totalSeconds) {
  const totalMinutes = Math.max(0, Math.round(totalSeconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours && minutes) return `${hours}hr ${minutes}min`;
  if (hours) return `${hours}hr`;
  return `${minutes}min`;
}

// The draft includes incomplete rows; submissions only include completed sets.
function collectWorkout({ includeIncomplete = true } = {}) {
  const exercises = [...els.exerciseList.querySelectorAll(".exercise-card")]
    .map((card) => {
      const select = card.querySelector(".exercise-select");
      const name = select.value;
      const sets = [...card.querySelectorAll(".set-row")]
        .map((row, index) => {
          const weight = row.querySelector(".set-weight").value;
          const reps = row.querySelector(".set-reps").value;
          const rpe = row.querySelector(".set-rpe").value;

          return {
            setNumber: index + 1,
            weight: weight === "" ? "" : Number(weight),
            unit: settings.defaultUnit,
            reps: reps === "" ? "" : Number(reps),
            rpe,
          };
        })
        .filter((set) => includeIncomplete || isCompletedSet(set));

      return {
        name,
        sets,
      };
    })
    .filter((exercise) => includeIncomplete || (exercise.name && exercise.sets.length));

  return {
    date: els.date.value,
    workoutType: els.type.value,
    startTime: els.startTime.value,
    ...workoutTiming(),
    exercises,
  };
}

function isCompletedSet(set) {
  return typeof set.weight === "number" && Number.isFinite(set.weight) && typeof set.reps === "number" && Number.isFinite(set.reps);
}

function validateWorkout(payload) {
  if (!payload.date) return "Choose a workout date.";
  if (!payload.startTime) return "Choose a workout start time.";
  if (!payload.exercises.length) return "Add at least one exercise.";
  if (payload.exercises.some((exercise) => !exercise.name)) return "Choose an exercise for each exercise card.";

  const completedSets = payload.exercises.flatMap((exercise) => exercise.sets);
  if (!completedSets.length) return "Add at least one completed set with weight and reps.";
  if (completedSets.some((set) => set.weight < 0 || set.reps < 0)) return "Weight and reps cannot be negative.";
  if (completedSets.some((set) => set.rpe !== "" && !["Easy", "Hard", "Max"].includes(set.rpe))) return "RPE must be Easy, Hard, or Max.";

  return "";
}

function handleReview(event) {
  event.preventDefault();
  clearMessage();

  pendingPayload = collectWorkout({ includeIncomplete: false });
  const error = validateWorkout(pendingPayload);

  if (error) {
    showMessage(error, "error");
    return;
  }

  renderSummary(pendingPayload);
  els.summaryModal.showModal();
}

function renderSummary(payload) {
  const totalSets = payload.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
  const items = payload.exercises
    .map((exercise) => {
      const setText = exercise.sets
        .map((set) => {
          const rpe = set.rpe === "" ? "" : `, RPE ${set.rpe}`;
          return `${set.setNumber}: ${set.weight} ${set.unit} x ${set.reps}${rpe}`;
        })
        .join("<br>");

      return `<div class="summary-item"><h3>${escapeHtml(exercise.name)}</h3><p>${setText}</p></div>`;
    })
    .join("");

  els.summaryContent.innerHTML = `
    <div class="summary-item">
      <h3>${escapeHtml(payload.workoutType)} - ${escapeHtml(payload.date)}</h3>
      <p>${payload.exercises.length} exercise${payload.exercises.length === 1 ? "" : "s"} - ${totalSets} set${totalSets === 1 ? "" : "s"} - ${escapeHtml(payload.duration)}</p>
    </div>
    ${items}
  `;
}

// Review first, then POST only after the user confirms the modal.
async function submitWorkout() {
  if (!pendingPayload) return;

  setProcessing(true);
  clearMessage();

  try {
    pendingPayload = collectWorkout({ includeIncomplete: false });
    const request = buildSubmissionRequest(pendingPayload);
    const response = await fetch(settings.apiUrl || API_URL, {
      method: "POST",
      mode: "cors",
      ...request,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(text || `Backend returned ${response.status}`);
    }

    const responseBody = await response.clone().json().catch(() => null);
    if (responseBody && responseBody.ok === false) {
      throw new Error(responseBody.error || "Backend rejected the workout.");
    }

    const keptUnit = settings.defaultUnit;
    localStorage.removeItem(STORAGE_KEYS.draft);
    resetForm(keptUnit);
    showSuccessActions();
  } catch (error) {
    showMessage(readableSubmitError(error), "error");
  } finally {
    setProcessing(false);
    pendingPayload = null;
  }
}

function buildSubmissionRequest(payload) {
  return buildApiRequest(stripDraftFields(payload));
}

function buildApiRequest(payload) {
  const body = { ...payload };
  const isAppsScript = (settings.apiUrl || API_URL).includes("script.google.com/macros/");

  if (isAppsScript) {
    if (settings.apiToken) {
      body.apiToken = settings.apiToken;
    }

    return {
      body: JSON.stringify(body),
    };
  }

  const headers = {
    "Content-Type": "application/json",
  };

  if (settings.apiToken) {
    headers.Authorization = `Bearer ${settings.apiToken}`;
  }

  return {
    headers,
    body: JSON.stringify(body),
  };
}

function stripDraftFields(payload) {
  const { startTime, ...submission } = payload;
  return {
    ...submission,
    exercises: payload.exercises.map(({ name, sets }) => ({
      name,
      sets: sets.map(({ setNumber, weight, unit, reps, rpe }) => ({ setNumber, weight, unit, reps, rpe })),
    })),
  };
}

function readableSubmitError(error) {
  const message = error?.message || "";
  if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
    return "Could not reach the backend. Check the API URL, confirm the backend is online, and make sure it allows CORS requests from this page.";
  }
  return `Submission failed: ${message}`;
}

function setProcessing(isProcessing) {
  els.submit.disabled = isProcessing;
  els.confirmSubmit.disabled = isProcessing;
  els.submit.textContent = isProcessing ? "Submitting..." : "Submit Workout";
  els.confirmSubmit.textContent = isProcessing ? "Submitting..." : "Confirm Submit";
}

function setReferenceProcessing(isProcessing) {
  els.referenceSubmit.disabled = isProcessing;
  els.referenceSubmit.textContent = isProcessing ? "Adding..." : "Add to Sheet";
}

function resetForm(unit) {
  els.date.value = todayIso();
  els.type.value = "Push";
  resetWorkoutTime();
  settings.defaultUnit = unit;
  els.defaultUnit.value = unit;
  els.exerciseList.replaceChildren();
  addExercise({}, { position: "end" });
}

function clearWorkout() {
  if (!confirm("Restart this workout?")) return;

  const keptUnit = settings.defaultUnit;
  localStorage.removeItem(STORAGE_KEYS.draft);
  resetForm(keptUnit);
  clearMessage();
  els.date.focus();
}

function showSuccessActions() {
  els.formMessage.className = "form-message success";
  els.formMessage.innerHTML = `Workout submitted. <button class="link-button" type="button" id="startAnotherButton">Start another workout</button>`;
  document.querySelector("#startAnotherButton").addEventListener("click", () => {
    clearMessage();
    els.date.focus();
  });
}

// Debounced persistence avoids writing to localStorage on every keystroke.
function saveDraftSoon() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveDraft, 150);
}

function saveDraft() {
  const draft = collectWorkout({ includeIncomplete: true });
  localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify(draft));
}

function restoreDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(STORAGE_KEYS.draft));
    if (!draft) return false;

    els.date.value = draft.date || todayIso();
    els.type.value = draft.workoutType || "Push";
    els.startTime.value = draft.startTime || timeValueFromIso(draft.startedAt) || startTimeFromElapsed(draft.durationSeconds);
    updateDurationDisplay();
    els.exerciseList.replaceChildren();
    (draft.exercises?.length ? draft.exercises : [{}]).forEach((exercise) => addExercise(exercise, { position: "end" }));
    return true;
  } catch {
    return false;
  }
}

function showMessage(message, type) {
  els.formMessage.textContent = message;
  els.formMessage.className = `form-message ${type}`;
}

function clearMessage() {
  els.formMessage.textContent = "";
  els.formMessage.className = "form-message";
}

function showReferenceMessage(message, type) {
  els.referenceMessage.textContent = message;
  els.referenceMessage.className = `form-message ${type}`;
}

function clearReferenceMessage() {
  els.referenceMessage.textContent = "";
  els.referenceMessage.className = "form-message";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[char];
  });
}
