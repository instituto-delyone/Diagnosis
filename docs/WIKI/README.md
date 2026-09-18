# Diagnosis — Wiki

> Guia de navegação do **Diagnosis / Diagnosys**, o simulador de casos clínicos do Instituto Delyone.

## O que é o Diagnosis?

O Diagnosis é organizado como um sistema de simulação clínica em que conhecimento médico estruturado alimenta a geração de possibilidades, pacientes e casos, e o motor acompanha a evolução do paciente diante das ações do médico.

Fluxo arquitetural de alto nível:

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

Princípio central da linguagem clínica:

> **A palavra não é a ação. A relação entre a palavra, a frase e o contexto determina a ação.**

## Mapa rápido

| Quero entender... | Comece por |
|---|---|
| arquitetura geral | [Arquitetura](ARCHITECTURE.md) |
| motor e componentes | [Componentes](COMPONENTS.md) |
| Knowledge Base | [Knowledge Base](KNOWLEDGE_BASE.md) |
| semântica/CSI | [Camada Semântica](SEMANTICS.md) |
| simulação de casos | [Simulação](SIMULATION.md) |
| onde alterar o código | [Guia de Desenvolvimento](DEVELOPMENT.md) |

## Separação fundamental

O Diagnosis deve manter separadas estas entidades:

```
KNOWLEDGE
   ≠
PATIENT STATE
   ≠
CASE
   ≠
SIMULATION
   ≠
EVALUATION
```

A Knowledge Base descreve o espaço clínico reutilizável. O Patient State representa o paciente concreto. O Case representa a situação entregue ao jogador. A Simulation executa a interação e a evolução. A Evaluation avalia o desempenho.

## Relação com os outros projetos

O Diagnosis é **o simulador de caso clínico**.

- **CSI**: dicionário/camada semântica para normalização da linguagem clínica.
- **Medunity**: criador e unificador de prontuário.
- **IDMT**: site e camada institucional do Instituto.

Eles podem ser integrados, mas não são o mesmo sistema nem devem ter suas responsabilidades misturadas.

## Fonte desta Wiki

Esta documentação consolida a arquitetura já documentada no repositório, especialmente `docs/DIAGNOSYS_ARCHITECTURE_GUIDE.md`, `docs/AI/CSI_SEMANTIC_LAYER.json`, `docs/AI/KNOWLEDGE_BASE_ROOT.md` e `docs/AI/KNOWLEDGE_BASE_RULES.md`.

Quando uma funcionalidade ainda estiver planejada, ela deve ser marcada como **PLANEJADA**, e não descrita como já implementada.
