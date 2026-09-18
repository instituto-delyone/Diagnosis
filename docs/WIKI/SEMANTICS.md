# Camada Semântica e CSI

## Função

A camada semântica fornece ao Diagnosis uma forma estável de normalizar diferentes expressões de linguagem clínica em unidades semânticas.

Fluxo conceitual:

```
raw language
    ↓
normalization
    ↓
candidate semantic units
    ↓
canonical anchors
    ↓
patient state
    ↓
clinical model
    ↓
possibility engine
    ↓
clinical reasoning
```

## O que a camada semântica faz

- normaliza linguagem clínica;
- identifica unidades semânticas candidatas;
- mantém âncoras canônicas;
- preserva a expressão original;
- separa tipos semânticos como sintomas, sinais, achados, exames, tratamentos e diagnósticos;
- representa ambiguidade quando necessário.

## O que ela não faz

A camada semântica não deve:

- diagnosticar automaticamente;
- transformar palavra isolada em ação;
- alterar diretamente o Patient State;
- substituir a Knowledge Base;
- substituir o Clinical Model;
- substituir o Possibility Engine.

## Relação com o CSI

O **CSI é o dicionário semiológico que está sendo construído como projeto próprio**. No Diagnosis, a camada semântica atual é uma especificação/inspiração arquitetural e possui artefatos próprios.

A integração futura pode permitir que o Diagnosis utilize o CSI externo como fonte semântica, mas isso não deve ser confundido com transformar o CSI no motor de raciocínio clínico.

## UMLS

A integração UMLS do Diagnosis é uma camada de normalização terminológica prevista/documentada. UMLS pode apoiar:

- normalização de termos;
- relação com conceitos padronizados;
- interoperabilidade;
- identificadores e relações terminológicas.

UMLS não substitui a ontologia semântica do projeto e não deve decidir sozinho diagnóstico, estado do paciente ou ação clínica.

**Credenciais UMLS nunca devem ser colocadas em código público.**

## Princípio

```
LINGUAGEM
   ↓
SEMÂNTICA
   ↓
CONTEXTO
   ↓
ESTADO DO PACIENTE
   ↓
RACIOCÍNIO CLÍNICO
```

A semântica organiza o significado. O contexto clínico determina o que esse significado representa na simulação.
