# Componentes

## Interface

### `docs/diagnosis.html`

Interface principal da simulação: apresenta o caso, recebe ações/perguntas, mostra o log clínico e renderiza o estado.

Regras clínicas complexas devem permanecer fora da interface.

## Orquestração

### `docs/Js/engine.js`

É o orquestrador principal: inicializa o sistema, conecta a interface, carrega conhecimento, gera casos, processa ações, gerencia o estado e coordena a execução.

**Metáfora:** o maestro. Não deve virar depósito de todas as regras clínicas.

## Core

### `patient-state.js`

Representa o paciente específico e seu estado clínico.

Não deve gerar doenças, inventar conhecimento, interpretar linguagem natural, diagnosticar, determinar condutas ou pontuar.

### `patient-generator.js`

Cria pacientes/casos a partir do conhecimento disponível.

### `possibility-engine.js`

Trabalha com possibilidades e hipóteses clínicas durante o raciocínio.

### `knowledge_base_loader.js`

Localiza e carrega as bases clínicas estruturadas.

### `clinical-model.js`

Organiza o modelo clínico derivado do conhecimento carregado.

### `clinical-knowledge-resolver.js`

Resolve/relaciona conhecimento clínico relevante para uma situação.

### `investigation-engine.js`

Processa solicitações de investigação e relaciona pedidos a resultados/achados simulados.

### `diagnosis-clinical-enhancements.js`

Camada complementar que integra regras conversacionais, exames, biblioteca médica e desafios clínicos.

### `evidence-resolver.js`

Resolve evidência científica externa via infraestrutura NCBI/PubMed/PMC disponível no projeto.

A evidência recuperada não deve alterar automaticamente o diagnóstico ou o Patient State.

### `medical-library.js`

Biblioteca documental local: fontes, normalização, busca, recuperação de trechos e proveniência.

## Clinical

### `clinical-interlocutor.js`

Interpreta a linguagem clínica do médico em contexto e a transforma em uma intenção/ação estruturada.

## Regra de localização

Se a mudança for:

- **visual** → `diagnosis.html` / `Js/ui/`
- **orquestração** → `Js/engine.js`
- **paciente/estado** → `Js/core/patient-state.js`
- **geração** → `Js/core/patient-generator.js`
- **hipóteses** → `Js/core/possibility-engine.js`
- **linguagem clínica** → `Js/clinical/clinical-interlocutor.js`
- **conhecimento** → `knowledge_base/`
- **regras arquiteturais** → `AI/`
- **fontes documentais** → `medical_library/`
