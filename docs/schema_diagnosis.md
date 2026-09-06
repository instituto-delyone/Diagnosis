# Diagnosis Engine: Schema v3.0 (Master Schema Socrático)

Este documento define a estrutura JSON oficial (Canônica) para inserção de síndromes e cenários clínicos no **Diagnosis Engine (AIGAR Engine V5.0 - Conversacional)**.

Para que o Motor de IA atue como um **Preceptor Virtual**, avaliando o usuário em fases, aplicando "Red Flags" (erros críticos) e reconhecendo distratores comuns, **todo novo caso clínico deve seguir exatamente a estrutura abaixo**.

---

## 1. Estrutura Canônica (Copiar e Preencher)

```json
{
  "id_caso": "especialidade_nome_doenca_01",
  "patologia_alvo": "Nome da Doença",
  "dificuldade": "Básica / Intermediária / Avançada",
  
  "vinheta_admissao": "Texto detalhado do caso clínico de admissão (sintomas, dados vitais, exame físico inicial). Termine de forma instigante.",
  
  "fase_1_investigacao": {
    "gabarito_esperado": ["exame_padrao_ouro", "sinonimo", "exame_2"],
    "achado_sucesso": "Mensagem do preceptor informando o resultado do exame correto.",
    "resposta_preceptor_erro": "Dica socrática ou consequência caso o usuário peça o exame errado ou não faça nada."
  },

  "fase_2_diagnostico": {
    "gabarito_esperado": ["diagnostico_principal", "sinonimo_1", "sigla"],
    "distrator_comum": ["diagnostico_errado_mas_parecido", "hipotese_comum"],
    "feedback_distrator": "Bronca construtiva explicando por que o distrator não se encaixa na clínica.",
    "achado_sucesso": "Validação positiva informando que o diagnóstico está correto."
  },

  "fase_3_conduta": {
    "gabarito_esperado": ["intervencao_prioritaria", "medicamento", "conduta"],
    "red_flag_mortal": ["conduta_proibida", "medicamento_contraindicado"],
    "feedback_sucesso": "Mensagem final de sucesso, paciente estabilizado.",
    "feedback_red_flag": "ERRO CRÍTICO! Explicação de como a conduta matou ou piorou gravemente o paciente."
  },

  "discussao_clinica_final": {
    "takeaway_message": "Pérola clínica de 1 ou 2 frases que o aluno deve levar para a vida.",
    "fisiopatologia": "Mecanismo fisiopatológico conciso do quadro para revisão estruturada."
  }
}
{
  "id_caso": "endocrino_cad_01",
  "patologia_alvo": "Cetoacidose Diabética (CAD)",
  "dificuldade": "Avançada",
  
  "vinheta_admissao": "Paciente masculino, 19 anos, trazido pela família rebaixado (Glasgow 12). Apresenta respiração profunda e rápida (Kussmaul) e hálito adocicado. Mãe relata que ele estava urinando muito nos últimos 2 dias. HGT capilar marcou 'HIGH'.",
  
  "fase_1_investigacao": {
    "gabarito_esperado": ["gasometria", "ph", "cetonemia", "cetonuria", "potassio", "eletrólitos"],
    "achado_sucesso": "Excelente pensamento. A gasometria revela pH 7.10, HCO3 10. O laboratório mostra K+ de 3.1 mEq/L e Cetonúria 3+.",
    "resposta_preceptor_erro": "Doutor, o paciente está francamente acidótico e rebaixando. O HGT já está estourado. Precisamos de marcadores de gravidade metabólica e eletrólitos urgentes. Peça a gasometria e o potássio."
  },

  "fase_2_diagnostico": {
    "gabarito_esperado": ["cetoacidose diabetica", "cad", "cetoacidose"],
    "distrator_comum": ["estado hiperosmolar", "coma hiperosmolar", "hipoglicemia"],
    "feedback_distrator": "Cuidado! Estado hiperosmolar geralmente ocorre em idosos DM2 e não cursa com essa acidose franca (respiração de Kussmaul). O quadro é outro.",
    "achado_sucesso": "Exato. Trata-se de uma Cetoacidose Diabética franca, provavelmente inaugural."
  },

  "fase_3_conduta": {
    "gabarito_esperado": ["soro fisiologico", "hidratacao", "reposicao de potassio", "kcl"],
    "red_flag_mortal": ["insulina", "insulina rapida", "bomba de insulina", "insulina regular"],
    "feedback_sucesso": "Conduta irretocável! Você iniciou a hidratação vigorosa e repôs o potássio ANTES da insulina. O paciente estabilizou e foi transferido para a UTI.",
    "feedback_red_flag": "ERRO CRÍTICO! Você fez insulina antes de checar/repor o potássio (que estava em 3.1). A insulina jogou o resto do potássio para dentro da célula, o paciente fez hipocalemia severa (2.0), evoluiu com arritmia ventricular e parou na sua frente."
  },

  "discussao_clinica_final": {
    "takeaway_message": "Na CAD, a hidratação é o pilar inicial. NUNCA inicie insulina se o Potássio estiver menor que 3.3 mEq/L. Primeiro repõe-se o K+, depois liga-se a bomba de insulina.",
    "fisiopatologia": "A deficiência absoluta de insulina gera lipólise intensa, formando corpos cetônicos (ácidos), consumindo o bicarbonato e gerando acidose metabólica com anion gap elevado."
  }
}
