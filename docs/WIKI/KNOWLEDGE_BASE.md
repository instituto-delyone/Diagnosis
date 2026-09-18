# Knowledge Base

## Definição

A Knowledge Base do Diagnosis é uma representação estruturada de conhecimento médico reutilizável.

Ela **não representa casos clínicos específicos** e **não representa pacientes específicos**.

Seu fluxo conceitual é:

```
KNOWLEDGE
    ↓
RELATIONSHIPS
    ↓
POSSIBILITIES
    ↓
PATIENT
    ↓
CLINICAL STATE
    ↓
CASE
    ↓
SIMULATION
```

## Unidade fundamental

A unidade fundamental é a entidade médica, por exemplo:

- doença;
- síndrome;
- sintoma;
- sinal;
- achado;
- etiologia;
- fator de risco;
- mecanismo;
- processo fisiológico;
- exame;
- achado laboratorial;
- achado de imagem;
- medicamento;
- tratamento;
- procedimento;
- complicação;
- diagnóstico diferencial;
- estado fisiológico.

Cada entidade deve possuir identidade canônica estável e aliases quando aplicável.

## Relações

A base deve representar relações, não apenas listas.

Exemplos:

```
causes
leads_to
associated_with
predisposes_to
increases_risk_of
decreases_risk_of
results_in
characterized_by
supports_diagnosis_of
argues_against
treated_by
contraindicated_by
complicates
precedes
follows
subtype_of
part_of
differentiates_from
```

## Fisiopatologia

Sempre que possível:

```
CAUSA
 ↓
MECANISMO
 ↓
ALTERAÇÃO FISIOLÓGICA
 ↓
ACHADO
 ↓
MANIFESTAÇÃO CLÍNICA
```

## Exames

Um exame deve carregar contexto quando possível:

```
EXAME
 ↓
INDICAÇÃO
 ↓
PERGUNTA CLÍNICA
 ↓
RESULTADO POSSÍVEL
 ↓
INTERPRETAÇÃO
 ↓
IMPACTO DIAGNÓSTICO
```

## Diagnóstico e diferencial

Diagnóstico é tratado como redução de incerteza. A Knowledge Base deve permitir relacionar manifestações, hipóteses, investigações, resultados e diferenciais.

## Tratamento

Quando possível:

```
TRATAMENTO
 ↓
INDICAÇÃO
 ↓
OBJETIVO
 ↓
MECANISMO
 ↓
CONTEXTO
 ↓
RISCOS
 ↓
CONTRAINDICAÇÕES
 ↓
MONITORIZAÇÃO
```

## O que não pertence à Knowledge Base

Não incluir:

```
score
points
player_answer
correct_answer
wrong_answer
phase
game_over
hint_cost
reward
```

Esses elementos pertencem à Simulation/Evaluation/UI.

## Separação de casos

Uma base adequada deve poder gerar múltiplos casos:

```
UMA DOENÇA
    ↓
MÚLTIPLOS PADRÕES
    ↓
MÚLTIPLAS SEVERIDADES
    ↓
MÚLTIPLOS PACIENTES
    ↓
MÚLTIPLOS CASOS
    ↓
MÚLTIPLAS TRAJETÓRIAS
```

## Rastreabilidade e incerteza

Informações importantes devem manter fonte/proveniência. Conflitos entre fontes não devem ser silenciosamente apagados. Quando não for possível resolver um conflito, a incerteza deve ser preservada.

## Critério final

A Knowledge Base deve responder:

> **“O que a medicina permite que aconteça?”**

O Case Generator responde qual paciente será criado; o Simulation Engine responde o que acontece depois da ação; o Evaluation Engine avalia a decisão.
