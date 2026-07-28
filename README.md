# Lift Log

A lightweight workout tracker that lets members sign in with a shared PIN, log workouts in natural language, and store each member's workout history as a small JSON database file in hosted object storage.

## Configuration

Set these runtime variables before using the parser:

```text
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-5.6-luna
```

`OPENAI_MODEL` is optional. The app defaults to `gpt-5.6-luna`.

## Storage

The app uses the Sites `FILES` R2 binding. Each PIN maps to one file:

```text
members/<sha256-pin>.json
```

The PIN itself is not stored in the file.

## Local Commands

```bash
npm install
npm run dev
npm run build
```
