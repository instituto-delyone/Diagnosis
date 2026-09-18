# Guia de Desenvolvimento

## Primeiro princípio

Antes de alterar qualquer arquivo, identifique **qual responsabilidade está sendo modificada**.

### Mapa

| Problema | Área |
|---|---|
| interface | `docs/engine.html`, `docs/Js/ui/` |
| orquestração | `docs/Js/engine.js` |
| estado do paciente | `docs/Js/core/patient-state.js` |
| geração de paciente/caso | `docs/Js/core/patient-generator.js` |
| hipóteses | `docs/Js/core/possibility-engine.js` |
| carregamento de conhecimento | `docs/Js/core/knowledge_base_loader.js` |
| modelo clínico | `docs/Js/core/clinical-model.js` |
| resolução de conhecimento | `docs/Js/core/clinical-knowledge-resolver.js` |
| linguagem clínica | `docs/Js/clinical/clinical-interlocutor.js` |
| investigação | `docs/Js/core/investigation-engine.js` |
| evidência externa | `docs/Js/core/evidence-resolver.js` |
| conhecimento estruturado | `docs/knowledge_base/` |
| regras/schema | `docs/AI/` |

## Checklist antes do commit

- [ ] A mudança pertence à camada escolhida?
- [ ] O Patient State continua separado do conhecimento?
- [ ] A Knowledge Base continua independente de casos?
- [ ] A linguagem continua separada da ação executada?
- [ ] Uma palavra isolada não ganhou poder indevido sobre a conduta?
- [ ] Não houve vazamento do diagnóstico interno?
- [ ] Credenciais ou tokens não foram adicionados ao código público?
- [ ] A mudança está documentada se altera arquitetura?

## Regra para Knowledge Base

Não transformar:

```
PDF
 ↓
VINHETA
 ↓
CASO
 ↓
GABARITO
```

como estrutura principal.

Preferir:

```
DOCUMENTOS
 ↓
EXTRAÇÃO
 ↓
NORMALIZAÇÃO
 ↓
CONSOLIDAÇÃO
 ↓
KNOWLEDGE
 ↓
POSSIBILITIES
 ↓
PATIENT
 ↓
CASE
```

## Regra de atualização

Quando uma integração ainda não estiver implementada, documentá-la como **PLANEJADA**. Não confundir autorização de uma API, existência de um arquivo ou documentação de arquitetura com integração efetiva no runtime.

## Documentação

Esta Wiki complementa — não substitui — os documentos normativos em `docs/AI/` e o guia arquitetural existente.

Ao alterar uma responsabilidade central, atualizar a página correspondente da Wiki e o documento normativo aplicável.
