// src/lib/worldai.js
//
// Full front-end helper file to call your backend /api/recommend-opportunity
// Copy-paste this file as-is into your project (e.g., src/lib/worldai.js).
//
// This file intentionally DOES NOT add any UI. It only exports functions/hooks
// you can call from your existing "Ask WorldAI" button handler or any other place.
//
// Exports:
//   - askWorldAI({ roomCode, displayedOpportunities, fetchUrl, apiBase })
//       -> sends the up-to-5 displayed opportunities to the backend and returns the parsed JSON.
//   - useWorldAI({ roomCode, apiBase })
//       -> React hook that returns (ask, loading, error). `ask` accepts displayedOpportunities or fetchUrl.
//   - normalizeOpportunitiesForBackend(opps)
//       -> helper to normalize the objects you pass in (safe to call before askWorldAI).

/* eslint-disable no-console */
import { useState, useCallback } from "react";

/**
 * Normalize an array of opportunity-like objects into the minimal shape expected by backend:
 * { id?, name, link?, country? }
 * This mirrors the backend normalization rules so you can safely pass any of your tile objects.
 *
 * @param {Array} arr - array of opportunity objects (from OpportunitiesPanel paginated state)
 * @returns {Array} normalized array (string keys only)
 */
export function normalizeOpportunitiesForBackend(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .slice(0, 5)
    .map((it, idx) => {
      const item = it || {};
      const id = item.id ?? item._id ?? item.key ?? `opp-${idx}`;
      const name = item.name ?? item.title ?? item.Name ?? item.Title ?? "";
      const link = item.link ?? item.url ?? item.Link ?? item.URL ?? "";
      const country = item.country ?? item.Country ?? item.location ?? item.Location ?? "";
      return {
        id,
        name,
        link,
        country,
      };
    })
    .filter((o) => !!o.name && typeof o.name === "string");
}

/**
 * Send displayed opportunities (up to 5) to backend and return recommendation.
 *
 * Two modes:
 *  - Provide displayedOpportunities (array) -> the frontend data is sent in request body.
 *  - Or provide fetchUrl (string) -> backend will GET that URL to obtain the list.
 *
 * @param {Object} opts
 * @param {string} opts.roomCode - required: the chat room code used by your backend to fetch messages
 * @param {Array<Object>} [opts.displayedOpportunities] - optional: array of opportunity objects (max 5)
 * @param {string} [opts.fetchUrl] - optional: frontend endpoint URL that returns displayed opportunities JSON (if you prefer)
 * @param {string} [opts.apiBase] - optional: prefix for backend base (e.g. 'http://localhost:8000'), default is '' (same origin)
 * @param {number} [opts.timeoutMs] - optional: fetch timeout in ms (default 12000)
 * @returns {Promise<{recommendation: string, analyzed_count: number}>}
 */
export async function askWorldAI({
  roomCode,
  displayedOpportunities,
  fetchUrl,
  apiBase = "",
  timeoutMs = 12000,
}) {
  if (!roomCode || typeof roomCode !== "string") {
    throw new Error("roomCode (string) is required by askWorldAI()");
  }

  if ((!displayedOpportunities || displayedOpportunities.length === 0) && !fetchUrl) {
    throw new Error("Either displayedOpportunities (array) or fetchUrl (string) must be provided.");
  }

  const body = { room_code: roomCode };

  if (Array.isArray(displayedOpportunities) && displayedOpportunities.length > 0) {
    body.displayed_opportunities = normalizeOpportunitiesForBackend(displayedOpportunities);
    if (body.displayed_opportunities.length === 0) {
      throw new Error("displayedOpportunities contained no valid entries after normalization.");
    }
  } else if (fetchUrl) {
    if (typeof fetchUrl !== "string" || !fetchUrl) {
      throw new Error("fetchUrl must be a non-empty string when provided.");
    }
    body.fetch_url = fetchUrl;
  }

  const url = `${apiBase || ""}/api/recommend-opportunity`;

  // Use a simple abortable fetch with timeout
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  let resp;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      credentials: "same-origin",
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`askWorldAI: request timed out after ${timeoutMs} ms`);
    }
    throw new Error(`askWorldAI: network error: ${err.message || err}`);
  } finally {
    clearTimeout(id);
  }

  let parsed;
  const text = await resp.text().catch(() => "");
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch (err) {
    // Not JSON
    throw new Error(`askWorldAI: backend returned non-JSON response: ${text}`);
  }

  if (!resp.ok) {
    const detail = parsed?.detail || parsed?.message || JSON.stringify(parsed) || `HTTP ${resp.status}`;
    throw new Error(`askWorldAI: backend error: ${detail}`);
  }

  // Expect response { recommendation: string, analyzed_count: number }
  if (!parsed || typeof parsed.recommendation !== "string") {
    throw new Error(`askWorldAI: unexpected backend response shape: ${JSON.stringify(parsed)}`);
  }

  return parsed;
}

/**
 * React hook wrapper to call askWorldAI with simple loading/error state.
 *
 * Usage:
 *   const { ask, loading, error } = useWorldAI({ roomCode, apiBase });
 *   await ask({ displayedOpportunities: paginatedOpportunities });
 *
 * The hook does not add or render any UI.
 *
 * @param {{ roomCode: string, apiBase?: string, timeoutMs?: number }} options
 * @returns {{ ask: Function, loading: boolean, error: Error|null }}
 */
export function useWorldAI({ roomCode, apiBase = "", timeoutMs = 12000 }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const ask = useCallback(
    async ({ displayedOpportunities, fetchUrl } = {}) => {
      setError(null);
      setLoading(true);
      try {
        const result = await askWorldAI({
          roomCode,
          displayedOpportunities,
          fetchUrl,
          apiBase,
          timeoutMs,
        });
        setLoading(false);
        return result;
      } catch (err) {
        setLoading(false);
        setError(err);
        throw err;
      }
    },
    [roomCode, apiBase, timeoutMs]
  );

  return { ask, loading, error };
}

/* ---------------------------
  Convenience: helper that tries to call backend using the paginated opportunities
  you already get from OpportunitiesPanel via onPaginatedOpportunitiesChange.

  Example (no UI elements):
    // inside your parent component
    import { useWorldAI } from '../lib/worldai';
    const { ask, loading, error } = useWorldAI({ roomCode, apiBase: '' });

    // handler bound to your existing "Ask WorldAI" button:
    async function handleAsk() {
      try {
        const resp = await ask({ displayedOpportunities: paginatedOpportunities });
        // resp.recommendation -> show it however you already do in your UI
      } catch (e) {
        // handle errors using your existing UI
      }
    }

  This file does NOT dispatch any UI changes or mutate your app state.
--------------------------- */

export default {
  askWorldAI,
  normalizeOpportunitiesForBackend,
  useWorldAI,
};
