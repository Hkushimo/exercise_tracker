const API_URL = "https://script.google.com/macros/s/AKfycbwXYPvj0kiUNiyNLbN7WoK4Vf_FptWZ-W8WDKOC963eMdUDG5V0F_vsRw8rJKG18DubXQ/exec";

const STORAGE_KEYS = {
  draft: "workoutTrackerDraft",
  settings: "workoutTrackerSettings",
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

const ALL_EXERCISES = [...new Set(Object.values(WORKOUT_TYPES).flat())].sort();

// Centralized element references keep event wiring and state collection simple.
const els = {
  form: document.querySelector("#workoutForm"),
  date: document.querySelector("#workoutDate"),
  type: document.querySelector("#workoutType"),
  notes: document.querySelector("#workoutNotes"),
  exerciseList: document.querySelector("#exerciseList"),
  addExercise: document.querySelector("#addExerciseButton"),
  formMessage: document.querySelector("#formMessage"),
  submit: document.querySelector("#submitButton"),
  installButton: document.querySelector("#installButton"),
  settingsToggle: document.querySelector("#settingsToggle"),
  settingsPanel: document.querySelector("#settingsPanel"),
  defaultUnit: document.querySelector("#defaultUnit"),
  themeMode: document.querySelector("#themeMode"),
  apiUrl: document.querySelector("#apiUrl"),
  apiToken: document.querySelector("#apiToken"),
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

function init() {
  registerServiceWorker();
  setupInstallPrompt();
  applyTheme(settings.theme);
  els.date.value = todayIso();
  els.defaultUnit.value = settings.defaultUnit;
  els.themeMode.value = settings.theme;
  els.apiUrl.value = settings.apiUrl;
  els.apiToken.value = settings.apiToken;

  const restored = restoreDraft();
  if (!restored) {
    addExercise();
  }

  els.addExercise.addEventListener("click", () => {
    addExercise();
    saveDraftSoon();
  });

  els.type.addEventListener("change", () => {
    refreshExerciseOptions();
    saveDraftSoon();
  });

  els.form.addEventListener("input", saveDraftSoon);
  els.form.addEventListener("change", saveDraftSoon);
  els.form.addEventListener("submit", handleReview);

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

function toggleSettings() {
  const isOpen = !els.settingsPanel.hidden;
  els.settingsPanel.hidden = isOpen;
  els.settingsToggle.setAttribute("aria-expanded", String(!isOpen));
}

function exerciseSuggestions() {
  const preferred = WORKOUT_TYPES[els.type.value] || [];
  return els.type.value === "Custom" ? ALL_EXERCISES : preferred;
}

// Exercise cards own their set rows, which keeps add/remove behavior localized.
function addExercise(data = {}) {
  const node = els.exerciseTemplate.content.firstElementChild.cloneNode(true);
  const exerciseSelect = node.querySelector(".exercise-select");
  const customWrap = node.querySelector(".custom-exercise-wrap");
  const customInput = node.querySelector(".custom-exercise");
  const setsList = node.querySelector(".sets-list");

  populateExerciseSelect(exerciseSelect, data.name);
  customInput.value = data.isCustom ? data.name || "" : "";
  customWrap.hidden = exerciseSelect.value !== "Custom exercise";

  exerciseSelect.addEventListener("change", () => {
    customWrap.hidden = exerciseSelect.value !== "Custom exercise";
    if (!customWrap.hidden) customInput.focus();
    saveDraftSoon();
  });

  node.querySelector(".add-set").addEventListener("click", () => {
    addSet(setsList);
    renumberSets(setsList);
    saveDraftSoon();
  });

  node.querySelector(".remove-exercise").addEventListener("click", () => {
    node.remove();
    if (!els.exerciseList.children.length) addExercise();
    saveDraftSoon();
  });

  els.exerciseList.append(node);

  if (data.sets?.length) {
    data.sets.forEach((set) => addSet(setsList, set));
  } else {
    addSet(setsList);
  }

  renumberSets(setsList);
}

function populateExerciseSelect(select, selectedName = "") {
  const suggestions = exerciseSuggestions();
  select.replaceChildren();

  suggestions.forEach((exercise) => {
    select.add(new Option(exercise, exercise));
  });

  select.add(new Option("Custom exercise", "Custom exercise"));

  if (selectedName && suggestions.includes(selectedName)) {
    select.value = selectedName;
  } else if (selectedName) {
    select.value = "Custom exercise";
  }
}

function refreshExerciseOptions() {
  document.querySelectorAll(".exercise-card").forEach((card) => {
    const select = card.querySelector(".exercise-select");
    const custom = card.querySelector(".custom-exercise");
    const currentName = select.value === "Custom exercise" ? custom.value.trim() : select.value;
    populateExerciseSelect(select, currentName);
    card.querySelector(".custom-exercise-wrap").hidden = select.value !== "Custom exercise";
  });
}

// Each new set inherits weight and reps from the previous set for faster entry.
function addSet(setsList, data = {}) {
  const row = els.setTemplate.content.firstElementChild.cloneNode(true);
  const previous = setsList.lastElementChild;

  const previousWeight = previous?.querySelector(".set-weight").value || "";
  const previousReps = previous?.querySelector(".set-reps").value || "";

  row.querySelector(".set-weight").value = data.weight ?? previousWeight;
  row.querySelector(".set-reps").value = data.reps ?? previousReps;
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

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "";
  if (numeric <= 7.5) return "7";
  if (numeric <= 8.5) return "8";
  return "9";
}

function renumberSets(setsList) {
  setsList.querySelectorAll(".set-row").forEach((row, index) => {
    const setNumber = index + 1;
    row.querySelector(".set-number").textContent = `Set ${setNumber}`;
  });
}

// The draft includes incomplete rows; submissions only include completed sets.
function collectWorkout({ includeIncomplete = true } = {}) {
  const exercises = [...els.exerciseList.querySelectorAll(".exercise-card")]
    .map((card) => {
      const select = card.querySelector(".exercise-select");
      const customName = card.querySelector(".custom-exercise").value.trim();
      const name = select.value === "Custom exercise" ? customName : select.value;
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
            rpe: rpe === "" ? "" : Number(rpe),
            notes: "",
          };
        })
        .filter((set) => includeIncomplete || isCompletedSet(set));

      return {
        name,
        isCustom: select.value === "Custom exercise",
        sets,
      };
    })
    .filter((exercise) => includeIncomplete || (exercise.name && exercise.sets.length));

  return {
    date: els.date.value,
    workoutType: els.type.value,
    notes: els.notes.value.trim(),
    exercises,
  };
}

function isCompletedSet(set) {
  return typeof set.weight === "number" && Number.isFinite(set.weight) && typeof set.reps === "number" && Number.isFinite(set.reps);
}

function validateWorkout(payload) {
  if (!payload.date) return "Choose a workout date.";
  if (!payload.exercises.length) return "Add at least one exercise.";
  if (payload.exercises.some((exercise) => !exercise.name)) return "Enter a name for each custom exercise.";

  const completedSets = payload.exercises.flatMap((exercise) => exercise.sets);
  if (!completedSets.length) return "Add at least one completed set with weight and reps.";
  if (completedSets.some((set) => set.weight < 0 || set.reps < 0)) return "Weight and reps cannot be negative.";
  if (completedSets.some((set) => set.rpe !== "" && (set.rpe < 1 || set.rpe > 10))) return "RPE must be between 1 and 10.";

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
      <p>${payload.exercises.length} exercise${payload.exercises.length === 1 ? "" : "s"} - ${totalSets} set${totalSets === 1 ? "" : "s"}</p>
    </div>
    ${items}
    ${payload.notes ? `<div class="summary-item"><h3>Notes</h3><p>${escapeHtml(payload.notes)}</p></div>` : ""}
  `;
}

// Review first, then POST only after the user confirms the modal.
async function submitWorkout() {
  if (!pendingPayload) return;

  setProcessing(true);
  clearMessage();

  try {
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
  const body = stripDraftFields(payload);
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
  return {
    ...payload,
    exercises: payload.exercises.map(({ name, sets }) => ({ name, sets })),
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

function resetForm(unit) {
  els.date.value = todayIso();
  els.type.value = "Push";
  els.notes.value = "";
  settings.defaultUnit = unit;
  els.defaultUnit.value = unit;
  els.exerciseList.replaceChildren();
  addExercise();
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
    els.notes.value = draft.notes || "";
    els.exerciseList.replaceChildren();
    (draft.exercises?.length ? draft.exercises : [{}]).forEach((exercise) => addExercise(exercise));
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
