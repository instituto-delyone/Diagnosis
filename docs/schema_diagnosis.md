# Diagnosis Engine: Schema v4.0 (Hemodinâmico + ECG)

Este documento define a estrutura JSON oficial (Canônica) para inserção de síndromes e cenários clínicos no **Diagnosis Engine v11.0 (Offline Standalone)**.

Para que o Motor Hemodinâmico, o Painel de ECG e o Sistema Socrático de Fluência funcionem perfeitamente, **todo novo caso clínico deve seguir exatamente a estrutura abaixo**.

---

## 1. Estrutura Canônica V4.0 (Copiar e Preencher para Novos Casos)

```json
{
  "id_caso": "especialidade_nome_doenca_01",
  "patologia_alvo": "Nome da Doença",
  "dificuldade": "Básica / Intermediária / Avançada",
  
  "ritmo_cardiaco": "Ritmo que aparecerá no monitor (ex: Taquicardia Sinusal, Fibrilação Atrial)",
  "vinheta_admissao": "Texto detalhado do caso clínico de admissão (sintomas, dados vitais, exame físico inicial).",
  
  "fase_1_investigacao": {
    "gabarito_esperado": ["exame1", "exame2", "sinonimo"],
    "achado_sucesso": "Mensagem informando o resultado do exame correto.",
    "resposta_preceptor_erro": "Dica socrática se o usuário errar o exame inicial."
  },

  "fase_2_diagnostico": {
    "gabarito_esperado": ["diagnostico_principal", "sinonimo", "sigla"],
    "distrator_comum": ["diagnostico_errado_parecido"],
    "feedback_distrator": "Bronca construtiva explicando por que o distrator não se encaixa.",
    "achado_sucesso": "Validação positiva do diagnóstico correto."
  },

  "fase_3_conduta": {
    "gabarito_esperado": ["tratamento_prioritario", "medicamento"],
    "red_flag_mortal": ["medicamento_contraindicado", "conduta_proibida"],
    "feedback_sucesso": "Mensagem final de sucesso, paciente salvo.",
    "feedback_red_flag": "ERRO CRÍTICO! Explicação de como a conduta piorou ou matou o paciente."
  },

  "discussao_clinica_final": {
    "takeaway_message": "Pérola clínica de 1 ou 2 frases que o aluno deve levar para a vida.",
    "fisiopatologia": "Mecanismo fisiopatológico conciso para revisão."
  }
}
