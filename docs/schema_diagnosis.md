# Diagnosis Engine: Schema v1.0 (Molde do Conhecimento)

Este documento define a estrutura matemática oficial de como o conhecimento médico humano deve ser traduzido para a linguagem do algoritmo Diagnosis (AIGAR Engine).

Qualquer nova síndrome clínica adicionada ao banco de dados (`knowledge_base/`) deve seguir RIGOROSAMENTE a estrutura JSON abaixo.

## A Estrutura Canônica (Copiar e Preencher)

```json
{
  "id_patologia": "nome_sem_espaco_ou_acento",
  "nome_oficial": "Nome Completo da Doença",
  "prevalencia_base": 10, 

  "01_campo_modulador": {
    "descricao": "Fatores que multiplicam a probabilidade pré-teste (epidemiologia, fisiologia, histórico).",
    "pesos": {
      "fator_de_risco_1": 1.5,
      "fator_de_risco_2": 2.0
    }
  },

  "02_campo_predicao_inicial": {
    "descricao": "Sintomas e achados relacionados. Cada um soma pontos de probabilidade.",
    "pesos": {
      "sintoma_1": 30,
      "sintoma_2": 20
    }
  },

  "03_campo_busca_ativa_filtragem": {
    "descricao": "Critérios para exclusão ativa ou confirmação obrigatória.",
    "sine_qua_non": [
      "sintoma_obrigatorio"
    ],
    "exclusao_ativa": [
      "criterio_de_exclusao"
    ]
  },

  "04_campo_avaliacao_risco_T": {
    "descricao": "Avaliação de risco de intervenção e letalidade para evitar atraso terapêutico.",
    "potencial_letalidade": "ALTO / MEDIO / BAIXO",
    "tempo_critico": true,
    "conduta_emergencial": "Ação imediata necessária (se houver)."
  },

  "05_campo_confirmacao_necessaria": {
    "descricao": "Ferramentas tecnológicas para o diagnóstico etiológico não definitivo/confirmação.",
    "exames": [
      "Exame 1",
      "Exame 2"
    ]
  }
}
