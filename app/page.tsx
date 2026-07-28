"use client";

import { FormEvent, useMemo, useState } from "react";

type ExerciseSet = {
  id: string;
  exercise: string;
  sets: number;
  reps: number | null;
  weight: number | null;
  unit: string | null;
  distance: number | null;
  distanceUnit: string | null;
  durationMinutes: number | null;
  notes: string;
};

type Workout = {
  id: string;
  date: string;
  rawText: string;
  summary: string;
  exercises: ExerciseSet[];
  createdAt: string;
};

type MemberData = {
  memberName: string;
  workouts: Workout[];
};

type AuthState = {
  pin: string;
  memberName: string;
};

const samplePrompts = [
  "Bench 3x8 at 155, squats 5x5 at 225, 20 min incline walk",
  "Ran 3.1 miles in 27 minutes, then pullups 4 sets of 6",
  "Deadlift 315 for 3x3, RDL 135 3x10, plank 3 minutes",
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function bestSetLabel(set: ExerciseSet) {
  const parts = [`${set.sets} set${set.sets === 1 ? "" : "s"}`];
  if (set.reps) parts.push(`${set.reps} reps`);
  if (set.weight) parts.push(`${set.weight} ${set.unit ?? "lb"}`);
  if (set.distance) parts.push(`${set.distance} ${set.distanceUnit ?? "mi"}`);
  if (set.durationMinutes) parts.push(`${set.durationMinutes} min`);
  return parts.join(" · ");
}

export default function Home() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [pin, setPin] = useState("");
  const [memberName, setMemberName] = useState("");
  const [workoutText, setWorkoutText] = useState("");
  const [workoutDate, setWorkoutDate] = useState(today());
  const [data, setData] = useState<MemberData | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function request(path: string, options: RequestInit = {}) {
    const response = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Something went wrong");
    }
    return payload;
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setError("");
    setStatus("");
    const cleanPin = pin.trim();
    if (cleanPin.length < 4) {
      setError("Use a PIN with at least 4 digits.");
      return;
    }

    setIsBusy(true);
    try {
      const payload = await request("/api/member", {
        method: "POST",
        body: JSON.stringify({
          pin: cleanPin,
          memberName: memberName.trim(),
        }),
      });
      const nextAuth = { pin: cleanPin, memberName: payload.member.memberName };
      setAuth(nextAuth);
      setData(payload.member);
      setMemberName(payload.member.memberName);
      window.localStorage.setItem("workout-member-name", payload.member.memberName);
      setStatus(payload.created ? "Profile created." : "Signed in.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleWorkout(event: FormEvent) {
    event.preventDefault();
    if (!auth || !workoutText.trim()) return;
    setError("");
    setStatus("Parsing workout...");
    setIsBusy(true);
    try {
      const payload = await request("/api/workouts", {
        method: "POST",
        body: JSON.stringify({
          action: "add",
          pin: auth.pin,
          date: workoutDate,
          rawText: workoutText.trim(),
        }),
      });
      setData(payload.member);
      setWorkoutText("");
      setStatus(`Saved ${payload.workout.exercises.length} exercise entry.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save workout.");
      setStatus("");
    } finally {
      setIsBusy(false);
    }
  }

  const stats = useMemo(() => {
    const workouts = data?.workouts ?? [];
    const sets = workouts.flatMap((workout) => workout.exercises);
    const bestByExercise = new Map<string, ExerciseSet>();
    for (const set of sets) {
      const key = set.exercise.toLowerCase();
      const current = bestByExercise.get(key);
      const score =
        (set.weight ?? 0) * Math.max(set.reps ?? 1, 1) * Math.max(set.sets, 1) +
        (set.distance ?? 0) * 100 +
        (set.durationMinutes ?? 0);
      const currentScore = current
        ? (current.weight ?? 0) * Math.max(current.reps ?? 1, 1) * Math.max(current.sets, 1) +
          (current.distance ?? 0) * 100 +
          (current.durationMinutes ?? 0)
        : -1;
      if (!current || score > currentScore) bestByExercise.set(key, set);
    }
    return {
      workouts: workouts.length,
      exercises: sets.length,
      bests: Array.from(bestByExercise.values()).slice(0, 6),
      recent: workouts.slice(0, 8),
    };
  }, [data]);

  return (
    <main className="min-h-screen bg-[#f7f3ec] text-[#191814]">
      <section className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 gap-6 px-4 py-5 md:grid-cols-[340px_1fr] md:px-6">
        <aside className="rounded-lg border border-[#ded4c5] bg-[#fffdf8] p-5 shadow-sm">
          <div className="mb-6">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#6f6a5f]">
              Lift Log
            </p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight">
              Lightweight workout tracking.
            </h1>
          </div>

          {!auth ? (
            <form className="space-y-4" onSubmit={handleLogin}>
              <label className="block">
                <span className="text-sm font-medium">PIN code</span>
                <input
                  className="mt-2 w-full rounded-md border border-[#cfc4b2] bg-white px-3 py-3 text-lg outline-none focus:border-[#377d71]"
                  inputMode="numeric"
                  minLength={4}
                  placeholder="Create or enter PIN"
                  type="password"
                  value={pin}
                  onChange={(event) => setPin(event.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Name</span>
                <input
                  className="mt-2 w-full rounded-md border border-[#cfc4b2] bg-white px-3 py-3 outline-none focus:border-[#377d71]"
                  placeholder="Optional on returning login"
                  value={memberName}
                  onChange={(event) => setMemberName(event.target.value)}
                />
              </label>
              <button
                className="w-full rounded-md bg-[#1f5f55] px-4 py-3 font-semibold text-white disabled:opacity-60"
                disabled={isBusy}
              >
                {isBusy ? "Opening..." : "Open tracker"}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border border-[#ded4c5] bg-[#f8f1e6] p-4">
                <p className="text-sm text-[#6f6a5f]">Signed in as</p>
                <p className="text-xl font-semibold">{data?.memberName ?? auth.memberName}</p>
              </div>
              <button
                className="w-full rounded-md border border-[#b7aa97] px-4 py-3 font-semibold"
                onClick={() => {
                  setAuth(null);
                  setPin("");
                  setData(null);
                  setStatus("");
                }}
              >
                Lock tracker
              </button>
            </div>
          )}

          {(status || error) && (
            <div
              className={`mt-4 rounded-md px-3 py-3 text-sm ${
                error ? "bg-[#ffe8e2] text-[#8d2e1f]" : "bg-[#e5f4ef] text-[#1f5f55]"
              }`}
            >
              {error || status}
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-md bg-[#191814] p-4 text-white">
              <p className="text-sm text-[#d7d0c2]">Workouts</p>
              <p className="text-3xl font-semibold">{stats.workouts}</p>
            </div>
            <div className="rounded-md bg-[#d97a35] p-4 text-white">
              <p className="text-sm text-[#fff3e8]">Entries</p>
              <p className="text-3xl font-semibold">{stats.exercises}</p>
            </div>
          </div>
        </aside>

        <section className="space-y-5">
          <form
            className="rounded-lg border border-[#ded4c5] bg-[#fffdf8] p-5 shadow-sm"
            onSubmit={handleWorkout}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Log a workout</h2>
                <p className="text-sm text-[#6f6a5f]">
                  Type naturally. The server parses and saves the structured result.
                </p>
              </div>
              <input
                className="rounded-md border border-[#cfc4b2] bg-white px-3 py-2 outline-none focus:border-[#377d71]"
                type="date"
                value={workoutDate}
                onChange={(event) => setWorkoutDate(event.target.value)}
              />
            </div>
            <textarea
              className="mt-4 min-h-36 w-full resize-y rounded-md border border-[#cfc4b2] bg-white px-3 py-3 outline-none focus:border-[#377d71]"
              disabled={!auth}
              placeholder="Bench 3x8 at 155, squats 5x5 at 225, ran 2 miles..."
              value={workoutText}
              onChange={(event) => setWorkoutText(event.target.value)}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {samplePrompts.map((prompt) => (
                <button
                  className="rounded-md border border-[#cfc4b2] px-3 py-2 text-sm text-[#4d493f]"
                  key={prompt}
                  type="button"
                  onClick={() => setWorkoutText(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
            <button
              className="mt-4 rounded-md bg-[#1f5f55] px-5 py-3 font-semibold text-white disabled:opacity-60"
              disabled={!auth || isBusy || !workoutText.trim()}
            >
              {isBusy ? "Saving..." : "Parse and save"}
            </button>
          </form>

          <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
            <section className="rounded-lg border border-[#ded4c5] bg-[#fffdf8] p-5 shadow-sm">
              <h2 className="text-xl font-semibold">Recent workouts</h2>
              <div className="mt-4 space-y-3">
                {stats.recent.length === 0 ? (
                  <p className="rounded-md bg-[#f8f1e6] p-4 text-[#6f6a5f]">
                    Sign in and save your first workout.
                  </p>
                ) : (
                  stats.recent.map((workout) => (
                    <article className="rounded-md border border-[#e3dacd] p-4" key={workout.id}>
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <h3 className="font-semibold">{formatDate(workout.date)}</h3>
                        <p className="text-sm text-[#6f6a5f]">{workout.summary}</p>
                      </div>
                      <div className="mt-3 grid gap-2">
                        {workout.exercises.map((set) => (
                          <div
                            className="flex flex-col rounded-md bg-[#f8f1e6] px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                            key={set.id}
                          >
                            <span className="font-medium">{set.exercise}</span>
                            <span className="text-sm text-[#5e584e]">{bestSetLabel(set)}</span>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-lg border border-[#ded4c5] bg-[#fffdf8] p-5 shadow-sm">
              <h2 className="text-xl font-semibold">Progress bests</h2>
              <div className="mt-4 space-y-3">
                {stats.bests.length === 0 ? (
                  <p className="text-sm text-[#6f6a5f]">Bests appear after your first parsed log.</p>
                ) : (
                  stats.bests.map((set) => (
                    <div className="rounded-md bg-[#eef4f1] p-3" key={set.id}>
                      <p className="font-semibold">{set.exercise}</p>
                      <p className="text-sm text-[#4d675f]">{bestSetLabel(set)}</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </section>
      </section>
    </main>
  );
}
