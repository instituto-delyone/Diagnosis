"use strict";

/*
 * Aurora Conversation Logger
 * Development-only structured interaction logger.
 *
 * Design:
 *   conversation -> logger -> JSON -> download -> manual GitHub commit
 *
 * It does not transmit logs anywhere and never stores provider secrets.
 */
(function (global) {
    const SCHEMA_VERSION = "1.0.0";
    const APPLICATION = "Diagnosys";
    const SECRET_KEY_PATTERN = /(api[_-]?key|authorization|bearer|token|secret|password|passwd|credential|cookie|set-cookie)/i;

    function cloneSafe(value, depth = 0) {
        if (depth > 6) return "[truncated]";
        if (value == null) return value;
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
        if (typeof value === "function") return "[function]";
        if (Array.isArray(value)) return value.slice(0, 100).map(item => cloneSafe(item, depth + 1));
        if (typeof value === "object") {
            const output = {};
            Object.entries(value).slice(0, 100).forEach(([key, item]) => {
                if (SECRET_KEY_PATTERN.test(key)) {
                    output[key] = "[redacted]";
                } else {
                    output[key] = cloneSafe(item, depth + 1);
                }
            });
            return output;
        }
        return String(value);
    }

    function isoNow() {
        return new Date().toISOString();
    }

    function makeId() {
        if (global.crypto?.randomUUID) return global.crypto.randomUUID();
        return "session_" + Date.now() + "_" + Math.random().toString(36).slice(2);
    }

    class ConversationLogger {
        constructor(options = {}) {
            this.application = options.application || APPLICATION;
            this.engineVersion = options.engineVersion || null;
            this.captureClinicalState = options.captureClinicalState === true;
            this.session = null;
            this.events = [];
            this.sequence = 0;
        }

        startSession(metadata = {}) {
            this.session = {
                session_id: makeId(),
                started_at: isoNow(),
                ended_at: null,
                application: this.application,
                engine_version: this.engineVersion,
                mode: metadata.mode || "clinical_simulation",
                case: {
                    case_id: metadata.case_id ?? null,
                    title: metadata.title ?? null,
                    difficulty: metadata.difficulty ?? null
                }
            };
            this.events = [];
            this.sequence = 0;
            this.logEvent("session_started", {
                mode: this.session.mode,
                case_id: this.session.case.case_id
            });
            return this.session.session_id;
        }

        setCase(metadata = {}) {
            if (!this.session) this.startSession(metadata);
            this.session.case = {
                case_id: metadata.case_id ?? null,
                title: metadata.title ?? null,
                difficulty: metadata.difficulty ?? null
            };
            this.logEvent("case_selected", this.session.case);
        }

        logMessage(role, text, data = {}) {
            return this.addEvent({
                type: "message",
                role,
                text: String(text ?? ""),
                data
            });
        }

        logEvent(type, data = {}, options = {}) {
            return this.addEvent({
                type,
                role: options.role || "system",
                data,
                duration_ms: options.duration_ms ?? null
            });
        }

        logError(error, data = {}) {
            const message = error instanceof Error ? error.message : String(error);
            return this.logEvent("error", {
                message,
                ...data
            });
        }

        logFallback(reason, data = {}) {
            return this.logEvent("fallback_activated", {
                reason: String(reason || "unknown"),
                ...data
            });
        }

        addEvent(event) {
            if (!this.session) this.startSession();
            const entry = {
                event_id: ++this.sequence,
                timestamp: isoNow(),
                type: String(event.type || "event"),
                role: event.role || null,
                text: event.text ?? null,
                data: cloneSafe(event.data || {})
            };
            if (event.duration_ms != null) entry.duration_ms = Number(event.duration_ms);
            this.events.push(entry);
            return entry;
        }

        endSession(metadata = {}) {
            if (!this.session) return this.exportObject();
            this.logEvent("session_ended", metadata);
            this.session.ended_at = isoNow();
            return this.exportObject();
        }

        exportObject() {
            if (!this.session) this.startSession();
            return {
                schema_version: SCHEMA_VERSION,
                session: cloneSafe(this.session),
                events: cloneSafe(this.events)
            };
        }

        exportJSON(pretty = true) {
            return JSON.stringify(this.exportObject(), null, pretty ? 2 : 0);
        }

        download(filename) {
            const safeName = filename || ("conversation_" + new Date().toISOString().replace(/[:.]/g, "-") + ".json");
            this.logEvent("log_downloaded", { filename: safeName });
            const blob = new Blob([this.exportJSON(true)], { type: "application/json;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = safeName.endsWith(".json") ? safeName : safeName + ".json";
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            return anchor.download;
        }

        clearSession() {
            this.session = null;
            this.events = [];
            this.sequence = 0;
        }

        getEventCount() {
            return this.events.length;
        }
    }

    global.AuroraConversationLogger = ConversationLogger;
})(window);
