# Simulação Clínica

## Fluxo

A simulação é a camada que transforma conhecimento e um caso em uma experiência clínica dinâmica.

Fluxo conceitual:

```
KNOWLEDGE
    ↓
CASE GENERATOR
    ↓
PATIENT STATE
    ↓
MÉDICO INTERAGE
    ↓
INTERPRETAÇÃO CONTEXTUAL
    ↓
CLINICAL ACTION
    ↓
CONSEQUENCE
    ↓
NEW PATIENT STATE
    ↓
EVALUATION
```

## Patient State

O Patient State representa a verdade interna do paciente durante a partida.

Ele deve registrar, conforme a implementação:

- estado clínico atual;
- informações reveladas;
- investigações;
- intervenções;
- evolução temporal;
- snapshots antes/depois de ações.

## Investigação

Solicitar um exame não deve, por si só, revelar o diagnóstico.

Resultados são simulados e dependem do contexto do caso. Resultados normais são possíveis e podem reduzir diferenciais.

Fluxo típico:

```
SOLICITAÇÃO
   ↓
RESULTADO
   ↓
ACHADOS
   ↓
INTERPRETAÇÃO
   ↓
ATUALIZAÇÃO DO RACIOCÍNIO
```

## Conversação

O interlocutor clínico deve interpretar frases completas e seu contexto.

Regra central:

> Uma palavra isolada não determina necessariamente a ação.

Exemplo arquitetural:

```
O QUE FOI DITO
      ↓
CONTEXTO
      ↓
INTENÇÃO
      ↓
AÇÃO CLÍNICA
      ↓
CONSEQUÊNCIA
```

## Evolução

A ação clínica pode produzir consequências no estado do paciente. O sistema deve preservar a distinção entre:

- conhecimento médico;
- possibilidade;
- estado verdadeiro;
- informação observada;
- ação executada;
- avaliação.

## Diagnóstico oculto

Nos casos de simulação, o diagnóstico pode permanecer como estado interno e não ser revelado no início. A interação deve permitir que investigação e raciocínio reduzam a incerteza progressivamente.

## Avaliação

A avaliação ocorre depois ou durante a progressão clínica conforme o protocolo do sistema. Ela é uma camada separada do conhecimento médico.

Não codificar pontuação dentro da Knowledge Base.
