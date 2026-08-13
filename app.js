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
  logView: document.querySelector("#workoutForm"),
  analysisView: document.querySelector("#analysisView"),
  logViewButton: document.querySelector("#logViewButton"),
  analysisViewButton: document.querySelector("#analysisViewButton"),
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
  statsWorkoutType: document.querySelector("#statsWorkoutType"),
  statsExercise: document.querySelector("#statsExercise"),
  statsRefresh: document.querySelector("#statsRefreshButton"),
  statsGrid: document.querySelector("#statsGrid"),
  historyDate: document.querySelector("#historyDate"),
  historyRefresh: document.querySelector("#historyRefreshButton"),
  dateWorkoutList: document.querySelector("#dateWorkoutList"),
  analysisMessage: document.querySelector("#analysisMessage"),
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
let statsHasLoaded = false;
let historyHasLoaded = false;

init();

async function init() {
  registerServiceWorker();
  setupInstallPrompt();
  applyTheme(settings.theme);
  els.date.value = todayIso();
  els.historyDate.value = todayIso();
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
  els.statsWorkoutType.addEventListener("change", () => {
    populateStatsExerciseSelect();
    loadExerciseStats();
  });
  els.statsExercise.addEventListener("change", loadExerciseStats);
  els.statsRefresh.addEventListener("click", loadExerciseStats);
  els.historyDate.addEventListener("change", loadWorkoutsByDate);
  els.historyRefresh.addEventListener("click", loadWorkoutsByDate);

  els.settingsToggle.addEventListener("click", toggleSettings);
  els.logViewButton.addEventListener("click", () => switchView("log"));
  els.analysisViewButton.addEventListener("click", () => switchView("analysis"));
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
  populateStatsFilters();
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

function switchView(view) {
  const showAnalysis = view === "analysis";
  els.logView.hidden = showAnalysis;
  els.analysisView.hidden = !showAnalysis;
  els.logViewButton.classList.toggle("is-active", !showAnalysis);
  els.analysisViewButton.classList.toggle("is-active", showAnalysis);
  els.logViewButton.setAttribute("aria-pressed", String(!showAnalysis));
  els.analysisViewButton.setAttribute("aria-pressed", String(showAnalysis));

  if (showAnalysis) {
    populateStatsFilters();
    if (!historyHasLoaded) loadWorkoutsByDate();
    if (!statsHasLoaded) loadExerciseStats();
    els.historyDate.focus();
  } else {
    els.date.focus();
  }
}

function populateStatsFilters() {
  const currentType = els.statsWorkoutType.value || els.type.value || "Push";
  els.statsWorkoutType.replaceChildren();

  Object.keys(referenceExercises).forEach((type) => {
    els.statsWorkoutType.add(new Option(type, type));
  });

  if (referenceExercises[currentType]) {
    els.statsWorkoutType.value = currentType;
  }

  populateStatsExerciseSelect();
}

function populateStatsExerciseSelect() {
  const exercises = referenceExercises[els.statsWorkoutType.value] || [];
  const currentExercise = els.statsExercise.value;
  els.statsExercise.replaceChildren();

  if (!exercises.length) {
    els.statsExercise.add(new Option("No exercises yet", ""));
    return;
  }

  exercises.forEach((exercise) => {
    els.statsExercise.add(new Option(exercise, exercise));
  });

  if (exercises.includes(currentExercise)) {
    els.statsExercise.value = currentExercise;
  }
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
    startedAt: formatClockTime(start),
    finishedAt: formatClockTime(finish),
    startedAtIso: start ? start.toISOString() : "",
    finishedAtIso: finish.toISOString(),
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

function formatClockTime(date) {
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
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

  if (hours && minutes) return `${hours}hr ${minutes}m`;
  if (hours) return `${hours}hr`;
  return `${minutes}m`;
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

async function loadExerciseStats() {
  clearAnalysisMessage();

  const exercise = els.statsExercise.value;

  if (!exercise) {
    renderStatsEmpty("Choose an exercise.");
    return;
  }

  setAnalysisProcessing(true);

  try {
    const response = await fetch(buildWorkoutHistoryUrl(exercise), { method: "GET", mode: "cors" });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(text || `Backend returned ${response.status}`);
    }

    const body = await response.json();
    if (body.ok === false) {
      throw new Error(body.error || "Backend rejected the stats request.");
    }

    renderExerciseStats(parseWorkoutRows(body.rows || body.history || body), exercise);
    statsHasLoaded = true;
  } catch (error) {
    renderStatsEmpty("Stats could not load yet.");
    showAnalysisMessage(readableSubmitError(error).replace("Submission failed", "Stats failed"), "error");
  } finally {
    setAnalysisProcessing(false);
  }
}

async function loadWorkoutsByDate() {
  clearAnalysisMessage();

  const date = els.historyDate.value;

  if (!date) {
    renderDateWorkoutsEmpty("Choose a date.");
    return;
  }

  setHistoryProcessing(true);

  try {
    const response = await fetch(buildWorkoutDateUrl(date), { method: "GET", mode: "cors" });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(text || `Backend returned ${response.status}`);
    }

    const body = await response.json();
    if (body.ok === false) {
      throw new Error(body.error || "Backend rejected the date request.");
    }

    const rows = parseWorkoutRows(body.rows || body.history || body).filter((row) => row.date === date);
    renderDateWorkouts(rows, date);
    historyHasLoaded = true;
  } catch (error) {
    renderDateWorkoutsEmpty("Workouts could not load yet.");
    showAnalysisMessage(readableSubmitError(error).replace("Submission failed", "Date view failed"), "error");
  } finally {
    setHistoryProcessing(false);
  }
}

function buildWorkoutHistoryUrl(exercise) {
  const url = new URL(settings.apiUrl || API_URL);
  url.searchParams.set("action", "workoutHistory");
  url.searchParams.set("exercise", exercise);
  if (settings.apiToken) url.searchParams.set("apiToken", settings.apiToken);
  return url.toString();
}

function buildWorkoutDateUrl(date) {
  const url = new URL(settings.apiUrl || API_URL);
  url.searchParams.set("action", "workoutHistory");
  url.searchParams.set("date", date);
  if (settings.apiToken) url.searchParams.set("apiToken", settings.apiToken);
  return url.toString();
}

function parseWorkoutRows(payload) {
  if (!Array.isArray(payload)) return [];

  return payload
    .map((row) => ({
      submittedAt: String(row.submittedAt || row[0] || "").trim(),
      date: String(row.date || row[1] || "").trim(),
      workoutType: String(row.workoutType || row.type || row[2] || "").trim(),
      startedAt: formatHistoryTime(row.startedAt || row[3] || ""),
      finishedAt: formatHistoryTime(row.finishedAt || row[4] || ""),
      duration: String(row.duration || row[5] || "").trim(),
      durationSeconds: Number(row.durationSeconds || row[6] || 0),
      exercise: String(row.exercise || row.name || row[7] || "").trim(),
      setNumber: Number(row.setNumber || row.set || row[8] || 0),
      weight: Number(row.weight || row[9] || 0),
      unit: String(row.unit || row[10] || settings.defaultUnit).trim() || settings.defaultUnit,
      reps: Number(row.reps || row[11] || 0),
      rpe: String(row.rpe || row[12] || "").trim(),
    }))
    .filter((row) => row.date && row.exercise && Number.isFinite(row.weight) && Number.isFinite(row.reps));
}

function renderDateWorkouts(rows, date) {
  if (!rows.length) {
    renderDateWorkoutsEmpty(`No workouts logged for ${date}.`);
    return;
  }

  const sessions = groupDateWorkoutSessions(rows);
  const totalVolume = sessions.reduce((sum, session) => sum + session.volume, 0);
  const totalSets = sessions.reduce((sum, session) => sum + session.sets, 0);
  const totalSeconds = sessions.reduce((sum, session) => sum + session.durationSeconds, 0);

  els.dateWorkoutList.innerHTML = `
    <section class="date-summary">
      <div>
        <span>Workouts</span>
        <strong>${sessions.length}</strong>
      </div>
      <div>
        <span>Total Time</span>
        <strong>${escapeHtml(formatDuration(totalSeconds))}</strong>
      </div>
      <div>
        <span>Volume</span>
        <strong>${formatNumber(totalVolume)}</strong>
      </div>
      <div>
        <span>Sets</span>
        <strong>${totalSets}</strong>
      </div>
    </section>
    ${sessions.map(renderDateSession).join("")}
  `;
}

function groupDateWorkoutSessions(rows) {
  const sessions = new Map();
  const sorted = [...rows].sort((a, b) => {
    return (a.startedAt || "").localeCompare(b.startedAt || "") || a.workoutType.localeCompare(b.workoutType) || a.setNumber - b.setNumber;
  });

  sorted.forEach((row) => {
    const key = [row.date, row.workoutType, row.startedAt, row.finishedAt, row.duration].join("|");
    if (!sessions.has(key)) {
      sessions.set(key, {
        date: row.date,
        workoutType: row.workoutType || "Workout",
        startedAt: row.startedAt,
        finishedAt: row.finishedAt,
        duration: row.duration,
        durationSeconds: row.durationSeconds,
        volume: 0,
        sets: 0,
        exercises: new Map(),
      });
    }

    const session = sessions.get(key);
    const volume = row.weight * row.reps;
    session.volume += volume;
    session.sets += 1;

    if (!session.exercises.has(row.exercise)) {
      session.exercises.set(row.exercise, []);
    }

    session.exercises.get(row.exercise).push({ ...row, volume });
  });

  return [...sessions.values()];
}

function renderDateSession(session) {
  return `
    <article class="date-session">
      <header class="date-session-header">
        <div>
          <h3>${escapeHtml(session.workoutType)}</h3>
          <p>${escapeHtml(formatSessionTime(session))}</p>
        </div>
        <div class="date-session-totals">
          <span>${escapeHtml(session.duration || formatDuration(session.durationSeconds))}</span>
          <span>${formatNumber(session.volume)} volume</span>
          <span>${session.sets} sets</span>
        </div>
      </header>
      <div class="date-exercise-list">
        ${[...session.exercises.entries()].map(([exercise, sets]) => renderDateExercise(exercise, sets)).join("")}
      </div>
    </article>
  `;
}

function renderDateExercise(exercise, sets) {
  const exerciseVolume = sets.reduce((sum, set) => sum + set.volume, 0);

  return `
    <section class="date-exercise">
      <div class="date-exercise-heading">
        <strong>${escapeHtml(exercise)}</strong>
        <span>${sets.length} set${sets.length === 1 ? "" : "s"} · ${formatNumber(exerciseVolume)} volume</span>
      </div>
      <div class="date-set-list">
        ${sets
          .sort((a, b) => a.setNumber - b.setNumber)
          .map((set) => `
            <div class="date-set-row">
              <span>Set ${set.setNumber || ""}</span>
              <strong>${formatNumber(set.weight)} ${escapeHtml(set.unit)} x ${formatNumber(set.reps)}</strong>
              <em>${escapeHtml(set.rpe || "No RPE")}</em>
            </div>
          `).join("")}
      </div>
    </section>
  `;
}

function formatSessionTime(session) {
  if (session.startedAt && session.finishedAt) return `${session.startedAt} to ${session.finishedAt}`;
  if (session.startedAt) return `Started ${session.startedAt}`;
  if (session.finishedAt) return `Finished ${session.finishedAt}`;
  return session.date;
}

function formatHistoryTime(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{1,2}:\d{2}\s?(AM|PM)$/i.test(raw)) return raw.replace(/\s?(AM|PM)$/i, " $1").toUpperCase();

  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  const match = raw.match(/(\d{1,2}:\d{2}:\d{2})/);
  if (match) {
    const [hours, minutes] = match[1].split(":").map(Number);
    const suffix = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${String(minutes).padStart(2, "0")} ${suffix}`;
  }

  return raw;
}

function renderDateWorkoutsEmpty(message) {
  els.dateWorkoutList.innerHTML = `<p class="empty-state">${escapeHtml(message)}</p>`;
}

function renderExerciseStats(rows, exercise) {
  const filtered = rows.filter((row) => row.exercise === exercise);
  if (!filtered.length) {
    renderStatsEmpty(`No logged sets found for ${exercise}.`);
    return;
  }

  const stats = calculateExerciseStats(filtered);
  const trendClass = stats.volumeChange >= 0 ? "positive" : "negative";
  const weightTrendClass = stats.weightChange >= 0 ? "positive" : "negative";

  els.statsGrid.innerHTML = `
    ${statSection("Overview", [
      statCard("Exercise", exercise, `${stats.sessions.length} session${stats.sessions.length === 1 ? "" : "s"} across ${stats.workoutTypes.length} workout type${stats.workoutTypes.length === 1 ? "" : "s"}`),
      statCard("Total Volume", formatNumber(stats.totalVolume), `${stats.totalSets} sets logged`),
      statCard("Avg Set", `${formatNumber(stats.avgWeight)} ${stats.unit} x ${formatNumber(stats.avgReps)}`, "Across all logged sets"),
    ])}
    ${statSection("Personal Bests", [
      statCard("Best Weight", `${formatNumber(stats.bestWeight.weight)} ${stats.unit}`, `${stats.bestWeight.reps} reps on ${stats.bestWeight.date}`),
      statCard("Best Reps", `${formatNumber(stats.bestReps.reps)} reps`, `${formatNumber(stats.bestReps.weight)} ${stats.unit} on ${stats.bestReps.date}`),
      statCard("Best Est. 1RM", `${formatNumber(stats.bestOneRepMax.value)} ${stats.unit}`, `${formatNumber(stats.bestOneRepMax.weight)} x ${stats.bestOneRepMax.reps}`),
    ])}
    ${statSection("Latest Change", [
      trendCard("Volume", formatNumber(stats.latest.volume), `${formatSigned(stats.volumeChange)} vs previous`, trendClass),
      trendCard("Top Weight", `${formatNumber(stats.latest.topWeight)} ${stats.unit}`, `${formatSigned(stats.weightChange)} ${stats.unit} vs previous`, weightTrendClass),
    ])}
    ${chartCard("Top Weight", `${stats.unit} by session`, stats.sessions.map((session) => ({
      label: session.date,
      value: session.topWeight,
    })))}
    ${chartCard("Volume", "Total weight x reps by session", stats.sessions.map((session) => ({
      label: session.date,
      value: session.volume,
    })))}
    <section class="stats-section">
      <h3>Recent Sessions</h3>
      <div class="session-list">
        ${stats.sessions.slice(-5).reverse().map(renderSessionRow).join("")}
      </div>
    </section>
  `;
}

function calculateExerciseStats(rows) {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.setNumber - b.setNumber);
  const unit = sorted.find((row) => row.unit)?.unit || settings.defaultUnit;
  const workoutTypes = [...new Set(sorted.map((row) => row.workoutType).filter(Boolean))].sort();
  const totalSets = sorted.length;
  const totalVolume = sorted.reduce((sum, row) => sum + row.weight * row.reps, 0);
  const avgWeight = totalSets ? sorted.reduce((sum, row) => sum + row.weight, 0) / totalSets : 0;
  const avgReps = totalSets ? sorted.reduce((sum, row) => sum + row.reps, 0) / totalSets : 0;
  const bestWeight = maxBy(sorted, (row) => row.weight);
  const bestReps = maxBy(sorted, (row) => row.reps);
  const bestOneRepMax = maxBy(sorted.map((row) => ({ ...row, value: estimatedOneRepMax(row) })), (row) => row.value);
  const sessions = groupSessions(sorted);
  const latest = sessions[sessions.length - 1] || emptySession();
  const previous = sessions[sessions.length - 2] || emptySession();

  return {
    unit,
    workoutTypes,
    totalSets,
    totalVolume,
    avgWeight,
    avgReps,
    bestWeight,
    bestReps,
    bestOneRepMax,
    sessions,
    latest,
    previous,
    volumeChange: latest.volume - previous.volume,
    weightChange: latest.topWeight - previous.topWeight,
  };
}

function groupSessions(rows) {
  const sessions = new Map();

  rows.forEach((row) => {
    const key = `${row.date}|${row.duration}`;
    if (!sessions.has(key)) {
      sessions.set(key, {
        date: row.date,
        duration: row.duration,
        sets: 0,
        reps: 0,
        volume: 0,
        topWeight: 0,
        topSet: "",
      });
    }

    const session = sessions.get(key);
    const volume = row.weight * row.reps;
    session.sets += 1;
    session.reps += row.reps;
    session.volume += volume;

    if (row.weight >= session.topWeight) {
      session.topWeight = row.weight;
      session.topSet = `${formatNumber(row.weight)} ${row.unit} x ${row.reps}`;
    }
  });

  return [...sessions.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function emptySession() {
  return { date: "", duration: "", sets: 0, reps: 0, volume: 0, topWeight: 0, topSet: "" };
}

function estimatedOneRepMax(row) {
  return row.weight * (1 + row.reps / 30);
}

function maxBy(items, selector) {
  return items.reduce((best, item) => (selector(item) > selector(best) ? item : best), items[0]);
}

function statSection(title, cards) {
  return `
    <section class="stats-section">
      <h3>${escapeHtml(title)}</h3>
      <div class="stats-section-grid">
        ${cards.join("")}
      </div>
    </section>
  `;
}

function statCard(label, value, detail) {
  return `
    <div class="stat-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(detail)}</small>
    </div>
  `;
}

function trendCard(label, value, detail, trendClass) {
  return `
    <div class="stat-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small class="trend ${trendClass}">${escapeHtml(detail)}</small>
    </div>
  `;
}

function chartCard(title, detail, points) {
  return `
    <section class="stats-section chart-card">
      <div>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(detail)}</p>
      </div>
      ${renderLineChart(points)}
    </section>
  `;
}

function renderLineChart(points) {
  const cleanPoints = points.filter((point) => Number.isFinite(point.value));
  if (cleanPoints.length < 2) {
    return `<p class="empty-state">Log this exercise on at least two sessions to see a trend chart.</p>`;
  }

  const width = 640;
  const height = 220;
  const padding = { top: 18, right: 22, bottom: 38, left: 52 };
  const values = cleanPoints.map((point) => point.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const max = rawMax === rawMin ? rawMax + 1 : rawMax;
  const min = rawMax === rawMin ? Math.max(0, rawMin - 1) : rawMin;
  const range = max - min || 1;
  const xStep = cleanPoints.length === 1 ? 0 : (width - padding.left - padding.right) / (cleanPoints.length - 1);
  const yScale = (value) => padding.top + (max - value) / range * (height - padding.top - padding.bottom);
  const xScale = (index) => padding.left + index * xStep;
  const path = cleanPoints.map((point, index) => `${index === 0 ? "M" : "L"} ${xScale(index).toFixed(1)} ${yScale(point.value).toFixed(1)}`).join(" ");
  const yTicks = [max, min + range / 2, min];
  const labelIndexes = chartLabelIndexes(cleanPoints.length);

  return `
    <div class="chart-wrap">
      <svg class="line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(cleanPoints.length)} session trend chart">
        <g class="chart-grid">
          ${yTicks.map((tick) => {
            const y = yScale(tick).toFixed(1);
            return `<path d="M ${padding.left} ${y} H ${width - padding.right}"></path>`;
          }).join("")}
        </g>
        <g class="chart-axis">
          <path d="M ${padding.left} ${padding.top} V ${height - padding.bottom} H ${width - padding.right}"></path>
        </g>
        <path class="chart-line" d="${path}"></path>
        <g class="chart-points">
          ${cleanPoints.map((point, index) => `<circle cx="${xScale(index).toFixed(1)}" cy="${yScale(point.value).toFixed(1)}" r="4"><title>${escapeHtml(point.label)}: ${escapeHtml(formatNumber(point.value))}</title></circle>`).join("")}
        </g>
        <g class="chart-labels">
          ${yTicks.map((tick) => `<text x="${padding.left - 10}" y="${(yScale(tick) + 4).toFixed(1)}" text-anchor="end">${escapeHtml(formatNumber(tick))}</text>`).join("")}
          ${labelIndexes.map((index) => `<text x="${xScale(index).toFixed(1)}" y="${height - 12}" text-anchor="${index === 0 ? "start" : index === cleanPoints.length - 1 ? "end" : "middle"}">${escapeHtml(shortDate(cleanPoints[index].label))}</text>`).join("")}
        </g>
      </svg>
    </div>
  `;
}

function chartLabelIndexes(length) {
  if (length <= 3) return Array.from({ length }, (_, index) => index);
  return [0, Math.floor((length - 1) / 2), length - 1];
}

function shortDate(value) {
  const parts = String(value).split("-");
  if (parts.length === 3) return `${Number(parts[1])}/${Number(parts[2])}`;
  return value;
}

function renderSessionRow(session) {
  return `
    <div class="session-row">
      <strong>${escapeHtml(session.date)}</strong>
      <span>${formatNumber(session.volume)} volume</span>
      <span>${session.sets} sets</span>
      <span>${escapeHtml(session.topSet || "No top set")}</span>
    </div>
  `;
}

function renderStatsEmpty(message) {
  els.statsGrid.innerHTML = `<p class="empty-state">${escapeHtml(message)}</p>`;
}

function formatNumber(value) {
  const number = Number(value || 0);
  return Number.isInteger(number) ? number.toLocaleString() : number.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function formatSigned(value) {
  const number = Number(value || 0);
  return `${number >= 0 ? "+" : ""}${formatNumber(number)}`;
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

function setAnalysisProcessing(isProcessing) {
  els.statsRefresh.disabled = isProcessing;
  els.statsRefresh.textContent = isProcessing ? "Loading..." : "Refresh";
}

function setHistoryProcessing(isProcessing) {
  els.historyRefresh.disabled = isProcessing;
  els.historyRefresh.textContent = isProcessing ? "Loading..." : "Refresh";
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
    els.startTime.value = draft.startTime || timeValueFromIso(draft.startedAtIso || draft.startedAt) || startTimeFromElapsed(draft.durationSeconds);
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

function showAnalysisMessage(message, type) {
  els.analysisMessage.textContent = message;
  els.analysisMessage.className = `form-message ${type}`;
}

function clearAnalysisMessage() {
  els.analysisMessage.textContent = "";
  els.analysisMessage.className = "form-message";
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
