# Diagnosis — Fase 1: Clinical Action Resolver

## Objetivo

Criar uma porta semântica canônica entre a linguagem natural do médico e o restante do motor:

```
LINGUAGEM
   ↓
ClinicalActionParser
   ↓
ClinicalActionResolver
   ↓
INTENÇÃO / AÇÃO CANÔNICA
   ↓
ClinicalActionDispatcher
   ↓
módulos clínicos existentes
```

A Fase 1 identifica o que o jogador está tentando expressar. Ela não decide se a ação é clinicamente correta.

## Componentes

### clinical-action-registry.js

Vocabulário canônico, aliases, domínios, operações e alvos explicitamente mapeados.

### clinical-action-parser.js

Normalização, cláusulas, ato de fala, verbos, negação, temporalidade e perguntas.

### clinical-action-resolver.js

Pontuação, resolução de intenção, resolução de alvo, ambiguidade e evidências.

### clinical-action-dispatcher.js

Encaminha a ação resolvida para os módulos já existentes. Não duplica regras médicas.

### clinical-action-runtime.js

Integra a camada ao DiagnosisEngine depois dos módulos legados. Mantém o processAction anterior como fallback e destino de delegação.

### tests/clinical-action-resolver.test.js

Testes automatizados da camada semântica.

## Contrato

```js
{
    recognized: true,
    status: "resolved",
    intent: "request_investigation",
    action: {
        id: "request_investigation",
        domain: "investigation",
        operation: "request",
        targetType: "investigation",
        target: {
            id: "ecg",
            canonical: "ecg",
            matchedAlias: "ecg"
        },
        negated: false,
        temporality: "current",
        speechAct: "request"
    },
    confidence: 0.9,
    evidence: {},
    originalText: "solicito um ECG",
    normalizedText: "solicito um ecg"
}
```

## Estados

- `resolved`: uma interpretação canônica suficientemente sustentada.
- `ambiguous`: existem interpretações concorrentes próximas.
- `partial`: entrada com múltiplas cláusulas em que somente parte foi resolvida.
- `unknown`: evidência insuficiente.

## Regras importantes

### Negação

`"não solicito ECG"` é reconhecido como ação de ECG com `negated: true`. O Dispatcher não executa a ação.

### Temporalidade

`"já solicitei ECG"` é reconhecido como ação passada e registrado como histórico, sem executar uma segunda solicitação.

### Múltiplas ações

`"solicito ECG e depois reavalio os sinais vitais"` pode produzir duas ações independentes, cada uma preservando sua cláusula e evidência.

### Não regressão

Frases que o Resolver não reconhece continuam seguindo o `processAction` legado.

## Separação arquitetural

A Fase 1 não deve:

- decidir diagnóstico;
- determinar tratamento correto;
- gerar consequências fisiológicas;
- alterar resultados;
- pontuar o jogador;
- transformar PDFs em casos;
- substituir a Knowledge Base.

O contrato é:

```
LINGUAGEM
   ↓
INTENÇÃO
   ↓
AÇÃO CANÔNICA
```

A Knowledge Base produz conhecimento médico reutilizável. A camada de linguagem apenas referencia conceitos e ações; não deve incorporar silenciosamente conteúdo médico extraído de PDFs.

## Próxima etapa

Depois de estabilizar a Fase 1:

```
Fase 1
LINGUAGEM → INTENÇÃO

        ↓

Fase 2
INTENÇÃO + PATIENT STATE + KNOWLEDGE
→ CONSEQUÊNCIA CLÍNICA

        ↓

Fase 3
CONSEQUÊNCIA → EVOLUÇÃO / AVALIAÇÃO
```

A Fase 2 deve começar somente quando o contrato semântico da Fase 1 estiver estável.
