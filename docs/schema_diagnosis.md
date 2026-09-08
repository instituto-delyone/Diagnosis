#  async function processarAcaoComIA(inputUsuario) {
    const inputNorm = normalizarTexto(inputUsuario);
    let msgRetorno = "";
    let isCriticalMsg = false;

    // 1. MECÂNICA DE PCR (Ressuscitação)
    if (hemodinamica.estagio === 'pcr') {
        const termosRCP = ["massagem", "rcp", "reanimacao", "adrenalina", "desfibrilar", "choque", "compressao", "intubar"];
        if (termosRCP.some(t => inputNorm.includes(t))) {
            hemodinamica.ciclos_pcr++;
            if (hemodinamica.ciclos_pcr >= 2) {
                hemodinamica.estagio = 'choque';
                hemodinamica.estabilidade = 35;
                msgRetorno = "⚡ RCE! Retorno da circulação espontânea. O pulso voltou, mas o paciente está em choque profundo. Retome o raciocínio da causa base.";
            } else {
                msgRetorno = "RCP em andamento. Paciente segue sem pulso. Qual o próximo passo do protocolo?";
                isCriticalMsg = true;
            }
        } else {
            hemodinamica.estagio = 'obito';
            processarDecisaoIA("Manobras ausentes ou incorretas. O paciente evoluiu para óbito.", true, true);
            return;
        }
        processarDecisaoIA(msgRetorno, false, isCriticalMsg);
        return;
    }

    // 2. EXTRAÇÃO DOS DADOS DA FASE ATUAL DO SCHEMA V3.0
    let faseDados;
    if (faseAtual === 1) faseDados = casoAtual.fase_1_investigacao;
    else if (faseAtual === 2) faseDados = casoAtual.fase_2_diagnostico;
    else faseDados = casoAtual.fase_3_conduta;

    const gabarito = faseDados.gabarito_esperado.map(t => normalizarTexto(t));
    const acertou = gabarito.some(termo => inputNorm.includes(termo));

    // Verificações específicas do Schema V3.0 (Distratores e Red Flags)
    const bateuDistrator = (faseAtual === 2 && faseDados.distrator_comum) ? 
        faseDados.distrator_comum.map(t => normalizarTexto(t)).some(t => inputNorm.includes(t)) : false;
        
    const bateuRedFlag = (faseAtual === 3 && faseDados.red_flag_mortal) ? 
        faseDados.red_flag_mortal.map(t => normalizarTexto(t)).some(t => inputNorm.includes(t)) : false;

    // 3. RESOLUÇÃO DA AÇÃO
    if (bateuRedFlag) {
        // Morte súbita por erro médico grave
        hemodinamica.estabilidade = 0;
        hemodinamica.estagio = 'pcr';
        msgRetorno = `🚨 ${faseDados.feedback_red_flag}`;
        isCriticalMsg = true;
    } 
    else if (bateuDistrator) {
        // Caiu na pegadinha da Fase 2
        hemodinamica.estabilidade -= 20;
        pontuacao -= 15;
        msgRetorno = `⚠️ ${faseDados.feedback_distrator}`;
        if (hemodinamica.estabilidade <= 40) hemodinamica.estagio = 'choque';
    }
    else if (acertou) {
        // Sucesso: Usa o texto rico do próprio JSON
        hemodinamica.estabilidade = Math.min(100, hemodinamica.estabilidade + 25);
        faseAtual++;
        
        if (faseAtual === 2) {
            msgRetorno = `${faseDados.achado_sucesso}<br><br><em>Com esses dados, qual o seu diagnóstico?</em>`;
        } else if (faseAtual === 3) {
            msgRetorno = `${faseDados.achado_sucesso}<br><br><em>Diagnóstico fechado. Qual a conduta imediata?</em>`;
        } else {
            hemodinamica.estagio = 'salvo';
            msgRetorno = faseDados.feedback_sucesso;
            return processarDecisaoIA(msgRetorno, true, false);
        }
    } 
    else {
        // Errou, mas não foi distrator nem red flag
        const dano = (modoAtual === 'sala_vermelha') ? 30 : 15;
        hemodinamica.estabilidade -= dano;
        pontuacao -= 10;
        
        if (faseAtual === 1 && faseDados.resposta_preceptor_erro) {
            msgRetorno = faseDados.resposta_preceptor_erro; // Usa dica socrática da fase 1
        } else {
            msgRetorno = "Não houve impacto clínico positivo. Tente outra abordagem.";
        }

        if (hemodinamica.estabilidade <= 10) {
            hemodinamica.estagio = 'pcr';
            msgRetorno += "<br><br>🚨 O paciente não resistiu e evoluiu para PCR! Inicie RCP!";
            isCriticalMsg = true;
        } else if (hemodinamica.estabilidade <= 40) {
            hemodinamica.estagio = 'choque';
            msgRetorno += "<br><br>⚠️ A pressão está despencando! Aja rápido!";
            isCriticalMsg = true;
        }
    }

    await new Promise(resolve => setTimeout(resolve, 800));
    processarDecisaoIA(msgRetorno, false, isCriticalMsg);
  }
  {
  "id_caso": "cardio_iam_01",
  "patologia_alvo": "IAM com Supra de ST",
  "ritmo_cardiaco": "Taquicardia Sinusal com Supra de ST", 
  "vinheta_admissao": "..."
}

