/*
 * Medical Library compressed-text adapter.
 * Keeps the canonical MedicalLibrary implementation and adds support for
 * .txt.gz.b64 sources produced by the ingestion pipeline.
 */
(function (global) {
    "use strict";

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[data-medical-library-adapter="${src}"]`);
            if (existing) {
                if (existing.dataset.loaded === "true") return resolve();
                existing.addEventListener("load", resolve, { once: true });
                existing.addEventListener("error", reject, { once: true });
                return;
            }
            const script = document.createElement("script");
            script.src = src;
            script.async = true;
            script.dataset.medicalLibraryAdapter = src;
            script.onload = () => { script.dataset.loaded = "true"; resolve(); };
            script.onerror = () => reject(new Error(`Não foi possível carregar ${src}`));
            document.head.appendChild(script);
        });
    }

    async function inflateGzipBase64(base64) {
        if (typeof DecompressionStream !== "function") {
            throw new Error("O navegador não suporta DecompressionStream(gzip).");
        }
        const binary = atob(String(base64 || "").replace(/\s+/g, ""));
        const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
        return new TextDecoder("utf-8").decode(await new Response(stream).arrayBuffer());
    }

    async function install() {
        if (typeof global.MedicalLibrary !== "function") {
            await loadScript("Js/core/medical-library.js");
        }
        if (typeof global.MedicalLibrary !== "function") {
            throw new Error("MedicalLibrary base não ficou disponível.");
        }
        if (global.MedicalLibrary.__compressedTextAdapter) return;

        const Base = global.MedicalLibrary;
        class MedicalLibraryWithCompressedText extends Base {
            async discoverSources() {
                const response = await fetch(this.config.githubApiUrl, {
                    headers: { Accept: "application/vnd.github+json" },
                    cache: "no-store"
                });
                if (!response.ok) throw new Error(`Não foi possível descobrir a Medical Library (${response.status}).`);
                const entries = await response.json();
                this.sources = entries.filter(entry => {
                    if (entry.type !== "file") return false;
                    const lower = entry.name.toLowerCase();
                    return lower.endsWith(".pdf") || lower.endsWith(".docx") || lower.endsWith(".txt.gz.b64");
                });
                this.sources.forEach(source => this.states.set(source.path, {
                    path: source.path, name: source.name, status: "loading", chunks: 0, characters: 0, error: null
                }));
                this.renderStatus();
                return this.sources;
            }

            async loadSource(source) {
                if (!source.name.toLowerCase().endsWith(".txt.gz.b64")) {
                    return super.loadSource(source);
                }
                const state = this.states.get(source.path);
                if (!state) return;
                state.status = "loading";
                state.error = null;
                this.renderStatus();
                try {
                    const response = await fetch(source.download_url || source.html_url, { cache: "no-store" });
                    if (!response.ok) throw new Error(`Falha ao baixar fonte comprimida (${response.status}).`);
                    const text = await inflateGzipBase64(await response.text());
                    const chunks = this.chunkText(text);
                    chunks.forEach((chunk, index) => this.chunks.push({
                        id: `${source.path}#${index + 1}`,
                        source: source.name,
                        path: source.path,
                        index,
                        text: chunk,
                        normalized: normalize(chunk)
                    }));
                    state.status = "loaded";
                    state.chunks = chunks.length;
                    state.characters = text.length;
                } catch (error) {
                    console.warn("Medical Library compressed source failed:", source.name, error);
                    state.status = "error";
                    state.error = error.message || String(error);
                }
                this.renderStatus();
            }
        }
        MedicalLibraryWithCompressedText.__compressedTextAdapter = true;
        global.MedicalLibrary = MedicalLibraryWithCompressedText;
    }

    install().catch(error => console.warn("Medical Library adapter indisponível:", error));
})(window);
