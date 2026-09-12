/**
 * =====================================================================
 * IDMT DIAGNOSIS ENGINE (AIGAR) - PRÓ ESTENDIDO (CORE SEMÂNTICO & BAYESIANO)
 * Instituto Delyone de Medicina e Tecnologia (IDMT)
 * =====================================================================
 * Desenvolvido para simulações de alta performance em Sala Vermelha 
 * e atendimento ambulatorial, integrando flexibilidade semântica, 
 * sinônimos estendidos de plantão e rastreabilidade de condutas.
 */

class IDMTEnginePró {
    constructor() {
        // Dicionário avançado de equivalências clínicas, sinônimos e termos de plantão
        this.sinonimos = {
            "angiotc": ["angio tc", "angiotomografia", "angio-tc", "tomografia computadorizada com contraste", "angio tc de torax", "tomografia vascular"],
            "gasometria": ["gasometria arterial", "gaso", "gasometria venosa", "perfil gasoso", "gaso arterial", "gasometria com acidose"],
            "eletro": ["eletrocardiograma", "ecg", "eletrocardiografia", "traz um eletro", "fazer eletro", "ecg de 12 derivacoes"],
            "anticoagulacao": ["heparina", "rivaroxaban", "enoxaparina", "anticoagulante", "inibidor de xfa", "NOAC", "iniciar anticoagulante", "heparinizacao"],
            "monabiche": ["morfina", "nitrato", "aas", "aspirina", "beta bloqueador", "estatina", "monabi", "dupla antiagregacao"],
            "troponina": ["enzimas miocardicas", "marcador de necrose miocardica", "ckmb", "troponina t", "troponina i", "dosagem de troponina"],
            "oxigenio": ["o2", "cateter nasal", "mascara de oxigenio", "suporte de oxigenio", "oxigenioterapia", "ventilar"],
            "acesso": ["acesso venoso", "puncao", "veia periferica", "cateter venoso", "acesso venoso periferico"]
        };
    }

    /**
     * Normalização profunda: remove acentos, pontuações, converte para minúsculas 
     * e limpa espaços excedentes para garantir tolerância a digitação de plantão.
     */
    normalizar(texto) {
        if (!texto) return "";
        return texto
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // Remove acentos
            .toLowerCase()
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'<>@\[\]{}]/g, " ") // Remove pontuação
            .replace(/\s+/g, " ") // Normaliza espaços múltiplos
            .trim();
    }

    /**
     * Valida a resposta do usuário contra o gabarito estruturado,
     * avaliando correspondência exata, sinônimos de plantão e proximidade de tokens.
     */
    validarResposta(inputUsuario, gabaritoEsperadoArray) {
        const textoLimpo = this.normalizar(inputUsuario);
        
        if (!textoLimpo || !gabaritoEsperadoArray || !Array.isArray(gabaritoEsperadoArray)) {
            return { valido: false, matchEncontrado: null };
        }

        for (let gabarito of gabaritoEsperadoArray) {
            const gabaritoNormalizado = this.normalizar(gabarito);

            // 1. Verificação direta de substring ou igualdade
            if (textoLimpo.includes(gabaritoNormalizado) || gabaritoNormalizado.includes(textoLimpo)) {
                return { valido: true, matchEncontrado: gabarito };
            }

            // 2. Verificação via Dicionário de Sinônimos Estendidos
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

            // 3. Verificação por proximidade de palavras-chave individuais (Token Match / 70% de similaridade)
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
     * Identifica gatilhos de Red Flags (condutas iatrogênicas ou letais)
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

    /**
     * Calcula o impacto dinâmico na estabilidade e pontuação do estudante
     */
    calcularDesempenho(turnoAtual, pesoDificuldade, tipoAcao) {
        // tipoAcao pode ser: 'acerto', 'distrator', 'red_flag', 'ajuda'
        let penalidadeTurno = Math.max(0.5, 1 - (turnoAtual * 0.05));
        
        switch(tipoAcao) {
            case 'acerto':
                return { pontos: Math.floor(25 * pesoDificuldade * penalidadeTurno), estabilidadeDelta: +10 };
            case 'distrator':
                return { pontos: -5, estabilidadeDelta: -10 };
            case 'red_flag':
                return { pontos: -30, estabilidadeDelta: -35 };
            case 'ajuda':
                return { pontos: -10, estabilidadeDelta: 0 };
            default:
                return { pontos: -2, estabilidadeDelta: -5 }; // Ação genérica fora do protocolo
        }
    }
}

// Instância global do Pró Estendido pronta para integração no IDMT
const idmtEngine = new IDMTEnginePró();
