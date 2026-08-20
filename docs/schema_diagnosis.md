# Diagnosis Engine: Schema v2.0 (Molde Operacional Canônico)

Este documento define a estrutura JSON oficial para inserção de síndromes e cenários clínicos no Diagnosis Engine (AIGAR Engine V4.2+).

Qualquer novo caso clínico ou patologia adicionada à base de dados (`knowledge_base/`) deve seguir a estrutura abaixo para compatibilidade total com o Game Loop, NLP/Fuzzy Matching, badges e revisão estruturada.

---

## 1. Estrutura Canônica de Cenário Clínico (Copiar e Preencher)

```json
{
  "id": "nome_unico_da_doenca",
  "badgeName": "Nome da Patologia para a Badge",
  "categoria": "Clínica Médica / Cirurgia Geral / Ginecologia e Obstetrícia / Pediatria",
  "prevalencia_base": 25,
  "vigneta": "Texto detalhado do caso clínico de admissão (sintomas, dados vitais, exame físico inicial).",
  "respostas_esperadas": {
    "diagnostico": [
      "hipotese_principal",
      "sinonimo_1",
      "sigla"
    ],
    "exames": [
      "exame_padrao_ouro",
      "sinonimo_exame",
      "exame_laboratorial"
    ],
    "conduta": [
      "intervencao_prioritaria",
      "medicamento_escolha",
      "conduta_cirurgica"
    ]
  },
  "feedback_tecnico": "Discussão do preceptor explicando o racional diagnóstico, metas terapêuticas e armadilhas clínicas.",
  "revisao_estruturada": {
    "etiologia": "Origem etiológica, patógenos comuns ou mecanismo causal.",
    "fisiopatologia": "Mecanismo fisiopatológico conciso do quadro.",
    "diagnostico": "Critérios clínicos, laboratoriais e de imagem indispensáveis.",
    "tratamento": "Manejo imediato, suporte e medidas curativas/manutenção.",
    "particularidades": "Pérola clínica ou 'red flag' crucial para a prática médica."
  }
}
