-- Migration number: 0001 	 2026-10-23T16:57:55.552Z
CREATE TABLE app_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  state_json TEXT NOT NULL CHECK (json_valid(state_json)),
  updated_at INTEGER NOT NULL
);
