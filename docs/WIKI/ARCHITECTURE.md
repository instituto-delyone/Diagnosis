# Arquitetura

## Visão geral

O Diagnosis separa documentação/regras, conhecimento clínico e execução:

```
DOCUMENTAÇÃO / REGRAS
        ↓
      docs/AI
        ↓
DADOS CLÍNICOS / CONHECIMENTO
        ↓
  docs/knowledge_base
        ↓
CÓDIGO DE EXECUÇÃO
        ↓
      docs/Js
        ↓
   engine.html
```

## Pipeline clínico

```
KNOWLEDGE BASE
      ↓
POSSIBILITIES
      ↓
PATIENT GENERATOR
      ↓
PATIENT STATE
      ↓
CLINICAL INTERLOCUTOR
      ↓
CLINICAL ACTION
      ↓
CONSEQUENCE / EVOLUTION
      ↓
EVALUATION
```

### 1. Knowledge Base

Representa conhecimento médico reutilizável: entidades, relações, fisiopatologia, manifestações, exames, tratamentos, diferenciais, complicações e evolução.

Não representa um paciente específico nem um gabarito de jogo.

### 2. Possibilities

Representa o espaço de hipóteses e possibilidades clínicas que pode alimentar a geração e o raciocínio.

### 3. Patient Generator

Cria pacientes/casos concretos a partir das possibilidades fornecidas pelo conhecimento.

### 4. Patient State

Mantém o estado verdadeiro do paciente durante a simulação, incluindo evolução temporal, investigações, intervenções e informações reveladas.

Uma separação importante:

```
VERDADE INTERNA DO PACIENTE
        ≠
INFORMAÇÃO JÁ DESCOBERTA PELO MÉDICO
```

### 5. Clinical Interlocutor

Recebe a linguagem do médico e interpreta intenção/ação em contexto.

A implementação deve preservar:

```
O QUE FOI DITO
      ≠
O QUE FOI INTERPRETADO
      ≠
O QUE ACONTECEU AO PACIENTE
```

### 6. Clinical Action

Representa a ação clínica que o sistema efetivamente executará após interpretação contextual.

### 7. Consequence / Evolution

Atualiza o estado clínico conforme a ação, o contexto e o conhecimento disponível.

### 8. Evaluation

Avalia a trajetória/decisões do médico dentro do fluxo da simulação.

## Axioma

```
KNOWLEDGE
    ↓
POSSIBILITIES
    ↓
PATIENT
    ↓
CASE
    ↓
SIMULATION
    ↓
EVOLUTION
    ↓
FEEDBACK
```

Cada camada tem uma pergunta diferente. Misturá-las aumenta o acoplamento e pode produzir comportamento clínico incorreto.
