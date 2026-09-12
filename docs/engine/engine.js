/**
 * =====================================================================
 * IDMT DIAGNOSIS ENGINE (AIGAR) - SEMANTIC VALIDATION CORE
 * Instituto Delyone de Medicina e Tecnologia (IDMT)
 * Finalidade: Processamento semântico, normalização de texto e 
 * flexibilização de condutas para simulações clínicas de Sala Vermelha.
 * =====================================================================
 */

class IDMTEngine {
    constructor() {
        // Dicionário de equivalências clínicas e sinônimos estendidos
        this.sinonimos = {
            "angiotc": ["angio tc", "angiotomografia", "angio-tc", "tomografia computadorizada com contraste", "angio tc de torax", "tomografia vascular"],
            "gasometria": ["gasometria arterial", "gaso", "gasometria venosa", "perfil gasoso"],
            "eletro": ["eletrocardiograma", "ecg", "eletrocardiografia", "traz um eletro"],
            "anticoagulacao": ["heparina", "rivaroxaban", "enoxaparina", "anticoagulante", "inibidor de xfa", "NOAC", "iniciar anticoagulante"],
            "monabiche": ["morfina", "nitrato", "aas", "aspirina", "beta bloqueador", "estatina", "monabi"],
            "troponina": ["enzimas miocardicas", "marcador de necrose miocardica", "ckmb", "troponina t", "troponina i", "dosagem de troponina"]
        };
    }

    /**
     * Normaliza a string do usuário (remove acentos, pontuação, joga para minúsculas e limpa espaços)
     */
    normalizar(texto) {
        if (!texto) return "";
        return texto
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // Remove acentos
            .toLowerCase()
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'<>@\[\]{}]/g, " ") // Remove pontuações
            .replace(/\s+/g, " ") // Normaliza espaços múltiplos
            .trim();
    }

    /**
     * Valida se a resposta do usuário corresponde ao gabarito esperado, 
     * considerando sinônimos, substrings e normalização semântica.
     */
    validarResposta(inputUsuario, gabaritoEsperadoArray) {
        const textoLimpo = this.normalizar(inputUsuario);
        
        if (!textoLimpo || !gabaritoEsperadoArray || !Array.isArray(gabaritoEsperadoArray)) {
            return { valido: false, matchEncontrado: null };
        }

        // Verifica cada termo esperado no gabarito
        for (let gabarito of gabaritoEsperadoArray) {
            const gabaritoNormalizado = this.normalizar(gabarito);

            // 1. Verificação direta de inclusão de substring ou igualdade
            if (textoLimpo.includes(gabaritoNormalizado) || gabaritoNormalizado.includes(textoLimpo)) {
                return { valido: true, matchEncontrado: gabarito };
            }

            // 2. Verificação de sinônimos conhecidos
            for (let [termoBase, listaSinonimos] of Object.entries(this.sinonimos)) {
                const atingeBase = gabaritoNormalizado.includes(termoBase) || 
                                   listaSinonimos.some(s => gabaritoNormalizado.includes(this.normalizar(s)));
                
                if (atingeBase) {
                    const usuarioDigitou = textoLimpo.includes(termoBase) || 
                                           listaSinonimos.some(s => textoLimpo.includes(this.normalizar(s)));
                    if (usuarioDigitou) {
                        return { valido: true, matchEncontrado: gabarito };
                    }
                }
            }

            // 3. Verificação por proximidade de palavras-chave individuais (Token Match)
            const palavrasGabarito = gabaritoNormalizado.split(" ").filter(p => p.length > 2);
            const palavrasUsuario = textoLimpo.split(" ");
            
            if (palavrasGabarito.length > 0) {
                const acertosTokens = palavrasGabarito.filter(token => 
                    palavrasUsuario.some(uToken => uToken.includes(token) || token.includes(uToken))
                );
                if (acertosTokens.length >= Math.ceil(palavrasGabarito.length * 0.7)) {
                    return { valido: true, matchEncontrado: gabarito };
                }
            }
        }

        return { valido: false, matchEncontrado: null };
    }

    /**
     * Verifica se o input acionou alguma Red Flag mortal
     */
    verificarRedFlag(inputUsuario, redFlagsArray) {
        const textoLimpo = this.normalizar(inputUsuario);
        if (!redFlagsArray || !Array.isArray(redFlagsArray)) return false;

        for (let rf of redFlagsArray) {
            const rfLimpa = this.normalizar(rf);
            if (textoLimpo.includes(rfLimpa)) {
                return true;
            }
        }
        return false;
    }
}

// Instância global pronta para uso no motor AIGAR / IDMT
const idmtEngine = new IDMTEngine();
