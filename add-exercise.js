const API_URL = "https://script.google.com/macros/s/AKfycbwXYPvj0kiUNiyNLbN7WoK4Vf_FptWZ-W8WDKOC963eMdUDG5V0F_vsRw8rJKG18DubXQ/exec";

const STORAGE_KEYS = {
  settings: "workoutTrackerSettings",
  references: "workoutTrackerReferences",
};

const els = {
  form: document.querySelector("#referenceExerciseForm"),
  workoutType: document.querySelector("#referenceWorkoutType"),
  exerciseName: document.querySelector("#referenceExerciseName"),
  message: document.querySelector("#referenceMessage"),
  submit: document.querySelector("#referenceSubmitButton"),
};

const settings = loadSettings();

init();

function init() {
  registerServiceWorker();
  applyTheme(settings.theme);
  els.form.addEventListener("submit", submitReferenceExercise);
}

function loadSettings() {
  const fallback = {
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

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme || "system";
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      // The page still works without offline caching.
    });
  });
}

async function submitReferenceExercise(event) {
  event.preventDefault();
  clearMessage();

  const workoutType = els.workoutType.value;
  const exerciseName = els.exerciseName.value.trim();

  if (!workoutType || !exerciseName) {
    showMessage("Choose a workout type and enter an exercise name.", "error");
    return;
  }

  setProcessing(true);

  try {
    const response = await fetch(settings.apiUrl || API_URL, {
      method: "POST",
      mode: "cors",
      ...buildRequest({ action: "addExercise", workoutType, exerciseName }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(text || `Backend returned ${response.status}`);
    }

    const body = await response.clone().json().catch(() => null);
    if (body && body.ok === false) {
      throw new Error(body.error || "Backend rejected the exercise.");
    }

    localStorage.removeItem(STORAGE_KEYS.references);
    els.exerciseName.value = "";
    showMessage("Exercise added. Refresh the workout log to pull the latest Sheet references.", "success");
    els.exerciseName.focus();
  } catch (error) {
    showMessage(readableSubmitError(error), "error");
  } finally {
    setProcessing(false);
  }
}

function buildRequest(payload) {
  const body = { ...payload };
  const isAppsScript = (settings.apiUrl || API_URL).includes("script.google.com/macros/");

  if (isAppsScript) {
    if (settings.apiToken) body.apiToken = settings.apiToken;
    return { body: JSON.stringify(body) };
  }

  const headers = { "Content-Type": "application/json" };
  if (settings.apiToken) headers.Authorization = `Bearer ${settings.apiToken}`;
  return { headers, body: JSON.stringify(body) };
}

function readableSubmitError(error) {
  const message = error?.message || "";
  if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
    return "Could not reach the backend. Check the API URL and make sure the backend allows CORS requests from this page.";
  }
  return `Exercise add failed: ${message}`;
}

function setProcessing(isProcessing) {
  els.submit.disabled = isProcessing;
  els.submit.textContent = isProcessing ? "Adding..." : "Add to Sheet";
}

function showMessage(message, type) {
  els.message.textContent = message;
  els.message.className = `form-message ${type}`;
}

function clearMessage() {
  els.message.textContent = "";
  els.message.className = "form-message";
}
