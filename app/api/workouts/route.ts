import { env } from "cloudflare:workers";
import {
  ExerciseSet,
  Workout,
  hashPin,
  loadMember,
  publicMember,
  saveMember,
} from "../storage";

export const runtime = "edge";

type ParsedWorkout = {
  summary: string;
  exercises: Array<{
    exercise: string;
    sets: number;
    reps: number | null;
    weight: number | null;
    unit: string | null;
    distance: number | null;
    distanceUnit: string | null;
    durationMinutes: number | null;
    notes: string;
  }>;
};

const workoutSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "exercises"],
  properties: {
    summary: { type: "string" },
    exercises: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "exercise",
          "sets",
          "reps",
          "weight",
          "unit",
          "distance",
          "distanceUnit",
          "durationMinutes",
          "notes",
        ],
        properties: {
          exercise: { type: "string" },
          sets: { type: "number" },
          reps: { type: ["number", "null"] },
          weight: { type: ["number", "null"] },
          unit: { type: ["string", "null"] },
          distance: { type: ["number", "null"] },
          distanceUnit: { type: ["string", "null"] },
          durationMinutes: { type: ["number", "null"] },
          notes: { type: "string" },
        },
      },
    },
  },
};

function getResponseText(result: unknown) {
  const response = result as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };
  if (response.output_text) return response.output_text;
  return (
    response.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text ?? "")
      .join("") ?? ""
  );
}

function normalizeExercise(set: ParsedWorkout["exercises"][number]): ExerciseSet {
  return {
    id: crypto.randomUUID(),
    exercise: set.exercise.trim() || "Exercise",
    sets: Math.max(Number(set.sets) || 1, 1),
    reps: set.reps === null ? null : Number(set.reps) || null,
    weight: set.weight === null ? null : Number(set.weight) || null,
    unit: set.unit?.trim() || null,
    distance: set.distance === null ? null : Number(set.distance) || null,
    distanceUnit: set.distanceUnit?.trim() || null,
    durationMinutes:
      set.durationMinutes === null ? null : Number(set.durationMinutes) || null,
    notes: set.notes?.trim() ?? "",
  };
}

async function parseWorkout(rawText: string, date: string): Promise<ParsedWorkout> {
  const runtimeEnv = env as unknown as {
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
  };

  if (!runtimeEnv.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured for the site.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${runtimeEnv.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: runtimeEnv.OPENAI_MODEL || "gpt-5.6-luna",
      input: [
        {
          role: "system",
          content:
            "Parse workout notes into normalized exercise entries. Use null when a field is not present. Keep exercise names concise. Convert time to minutes when obvious. Do not invent weights, reps, distances, or durations.",
        },
        {
          role: "user",
          content: `Workout date: ${date}\nWorkout notes: ${rawText}`,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "workout_parse",
          strict: true,
          schema: workoutSchema,
        },
      },
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    const message =
      (result as { error?: { message?: string } }).error?.message ??
      "OpenAI could not parse this workout.";
    throw new Error(message);
  }

  const text = getResponseText(result);
  if (!text) throw new Error("OpenAI returned an empty parse result.");
  return JSON.parse(text) as ParsedWorkout;
}

async function requireMember(pin: string) {
  if (pin.trim().length < 4) {
    throw new Error("PIN must be at least 4 characters.");
  }
  const member = await loadMember(await hashPin(pin.trim()));
  if (!member) throw new Error("No member profile exists for that PIN.");
  return member;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      action?: "list" | "add";
      pin?: string;
      rawText?: string;
      date?: string;
    };

    const member = await requireMember(payload.pin ?? "");

    if (payload.action === "list") {
      return Response.json({ member: publicMember(member) });
    }

    if (payload.action !== "add") {
      return Response.json({ error: "Unsupported workout action." }, { status: 400 });
    }

    const rawText = payload.rawText?.trim() ?? "";
    const date = payload.date?.trim() ?? "";
    if (!rawText) {
      return Response.json({ error: "Workout description is required." }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return Response.json({ error: "Workout date must be YYYY-MM-DD." }, { status: 400 });
    }

    const parsed = await parseWorkout(rawText, date);
    const workout: Workout = {
      id: crypto.randomUUID(),
      date,
      rawText,
      summary: parsed.summary.trim() || "Workout logged",
      exercises: parsed.exercises.map(normalizeExercise),
      createdAt: new Date().toISOString(),
    };

    member.workouts = [workout, ...member.workouts].slice(0, 500);
    await saveMember(member);

    return Response.json({ workout, member: publicMember(member) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to process workout.";
    return Response.json({ error: message }, { status: 500 });
  }
}
