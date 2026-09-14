/**
 * IDMT ENGINE PRÓ - COM SUPORTE AO CSI (Classificação Semiológica Institucional)
 * Arquitetura de Processamento de Linguagem Natural Baseada em Âncoras Semânticas
 */

class IDMTEnginePró {
    constructor() {
        // Matriz de Sinônimos e Termos Populares baseada no CSI
        this.dicionarioCSI = {
            // Investigação / Exames
            "ecg": ["ecg", "eletro", "eletrocardiograma", "traçado", "ver o coração", "olhar o ritmo"],
            "gasometria": ["gasometria", "gaso", "oxigênio no sangue", "sangue arterial"],
            "tomografia": ["tc", "tomografia", "angiotc", "angio-tc", "ressonância", "rm", "imagem da cabeça"],
            "laboratorio": ["labs", "exames", "sangue", "hemograma", "ionograma", "função renal"],
            
            // Condutas e Terapêutica
            "suporte_oxigenio": ["o2", "oxigênio", "máscara", "cateter nasal", "ventilação"],
            "hidratacao": ["soro", "hidratação", "volemia", "expansão", "sf 0.9%"],
            "corticoide": ["corticoide", "corticoterapia", "hidrocortisona", "prednisolona", "dexametasona"],
            "anticoagulante": ["heparina", "anticoagulação", "enoxaparina", "clexane"],
            
            // Red Flags / Erros Fatais mapeados
            "alta_precoce": ["alta", "mandar para casa", "liberar o paciente"],
            "sedacao_indevida": ["sedativo", "morfina em excesso", "diazepam na crise"]
        };
    }

    /**
     * Traduz a fala natural do usuário usando o conceito de Âncoras do CSI
     */
    normalizarEntrada(textoDoAluno) {
        if (!textoDoAluno) return "";
        const textoLimpo = textoDoAluno.toLowerCase().trim();
        
        // Varre o dicionário CSI em busca de correspondências semânticas
        for (let [ancora, sinônimos] of Object.entries(this.dicionarioCSI)) {
            for (let sinonimo of sinônimos) {
                if (textoLimpo.includes(sinonimo)) {
                    return ancora; // Retorna a âncora padronizada para o motor processar
                }
            }
        }
        return textoLimpo; // Se não achar gíria mapeada, retorna o texto limpo original
    }

    /**
     * Valida se a intenção do aluno corresponde ao gabarito esperado do caso
     */
    validarResposta(inputAluno, gabaritoEsperado) {
        const inputNormalizado = this.normalizarEntrada(inputAluno);
        
        for (let itemGabarito of gabaritoEsperado) {
            const gabaritoNormalizado = itemGabarito.toLowerCase().trim();
            
            // Checa se o texto bate com a âncora ou contém o termo esperado
            if (inputNormalizado.includes(gabaritoNormalizado) || gabaritoNormalizado.includes(inputNormalizado)) {
                return { valido: true, termoEncontrado: itemGabarito };
            }
        }
        return { valido: false };
    }

    /**
     * Verifica se o aluno cometeu uma Red Flag (Erro Crítico)
     */
    verificarRedFlag(inputAluno, listaRedFlags) {
        const inputNormalizado = this.normalizarEntrada(inputAluno);
        
        for (let flag of listaRedFlags) {
            const flagNormalizada = flag.toLowerCase().trim();
            if (inputNormalizado.includes(flagNormalizada)) {
                return true;
            }
        }
        return false;
    }
}

// Instancia global do motor inteligente para uso no HTML
const idmtEngine = new IDMTEnginePró();
