# DIAGNOSYS — GUIA E GABARITO DA ARQUITETURA

**Documento:** `docs/DIAGNOSYS_ARCHITECTURE_GUIDE.md`  
**Projeto:** Diagnosys / Diagnosis Engine  
**Finalidade:** servir como mapa de navegação e manutenção do sistema.

> Este documento descreve a organização existente no repositório e a função de cada camada/arquivo. Quando uma integração ainda não existe no código, ela é marcada explicitamente como **PLANEJADA**.

---

## 1. VISÃO RÁPIDA

O Diagnosys é organizado em três grandes grupos dentro de `docs/`:

```text
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
      diagnosis.html
```

A lógica clínica pretendida segue, em alto nível:

```text
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

A camada de linguagem deve respeitar a regra fundamental do projeto:

> **A palavra não é a ação. A relação entre a palavra, a frase e o contexto determina a ação.**

---

# 2. MAPA DAS PASTAS

## `docs/`

É a área publicada/operacional do Diagnosys. Contém a interface web, o JavaScript, as regras de IA/arquitetura, a Knowledge Base, a biblioteca médica e os testes.

### Principais subpastas

| Pasta | Função |
|---|---|
| `docs/AI/` | especificações, schemas, protocolos e regras arquiteturais |
| `docs/Js/` | código executável do sistema |
| `docs/knowledge_base/` | conhecimento clínico estruturado e padrões de exames |
| `docs/medical_library/` | fontes bibliográficas/documentais usadas pela biblioteca médica |
| `docs/tests/` | área destinada a testes |

---

# 3. INTERFACE

## `docs/diagnosis.html`

**Função:** interface principal da simulação clínica.

Responsabilidades principais:
- apresentar o caso;
- receber a ação/pergunta do médico;
- mostrar o log clínico;
- apresentar estado e sinais vitais;
- disponibilizar comandos como ajuda, ciência e próximo caso;
- carregar os scripts que compõem o motor.

**Não deve:** concentrar regras clínicas complexas que pertencem às camadas de código/dados.

### Regra de manutenção

Se a mudança é **visual ou de interface**, procure primeiro `diagnosis.html` e `Js/ui/`.  
Se a mudança altera **comportamento clínico**, procure `Js/core/`, `Js/clinical/` ou `knowledge_base/` antes de alterar a interface.

---

## `docs/index.html`

**Função:** página de entrada do projeto/documentação web.

Não é o motor clínico principal.

---

## `docs/schema_diagnosis.md`

**Função:** documentação relacionada ao schema/modelo de diagnóstico.

Serve como referência documental para a representação estruturada do diagnóstico.

---

# 4. `docs/AI/` — ESPECIFICAÇÃO E REGRAS

Esta pasta não é, em princípio, o lugar para executar a lógica do paciente. Ela contém os documentos que definem **como o sistema deve ser construído e se comportar**.

## `CASE_SIMULATION_PROTOCOL.md`

**Função:** protocolo do fluxo de uma simulação clínica.

Define a sequência conceitual da experiência: apresentação → investigação → raciocínio → intervenção → evolução → avaliação.

**Mexer aqui quando:** for necessário alterar o protocolo geral da simulação.

---

## `CLINICAL_CONVERSATION_PT.json`

**Função:** regras de conversação clínica em português.

Define padrões para que a interação não seja apenas um parser de palavras, mas uma conversa contextual. Inclui desafios clínicos que podem surgir após resultados de exames, interpretação de achados, fechamento de prescrição, diagnóstico, resposta ao tratamento e alta.

**Mexer aqui quando:** o problema for **como o simulador conversa com o médico**, sem precisar alterar o motor que executa a ação.

---

## `CSI_SEMANTIC_LAYER.json`

**Função:** especificação da camada semântica/CSI.

Fluxo conceitual:

```text
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

Princípio central:
- CSI interpreta linguagem;
- CSI não deve diagnosticar;
- sintomas, sinais, achados, exames, tratamentos e diagnósticos devem permanecer semanticamente separados;
- linguagem ambígua pode gerar candidatos/ambiguidade;
- a informação original deve ser preservada.

**Mexer aqui quando:** a alteração diz respeito à **semântica da linguagem clínica**.

---

## `GEMINI_INSTRUCTIONS.md`

**Função:** conjunto de instruções/documentação para uso do modelo Gemini no ecossistema do projeto.

**Importante:** é documentação de integração/instrução, não substitui o motor clínico nem a Knowledge Base.

---

## `KNOWLEDGE_BASE_ROOT.md`

**Função:** documentação estrutural da Knowledge Base.

Explica a organização conceitual da base de conhecimento.

---

## `KNOWLEDGE_BASE_RULES.md`

**Função:** regras detalhadas para criação/manutenção da Knowledge Base.

**Mexer aqui quando:** a questão for sobre **como uma nova base clínica deve ser estruturada ou validada**.

---

## `KNOWLEDGE_BASE_SCHEMA.json`

**Função:** schema formal dos objetos da Knowledge Base.

É a referência estrutural para os campos esperados nos arquivos clínicos estruturados.

---

## `MEDICAL_LIBRARY_RULES.json`

**Função:** regras da biblioteca médica.

Define extração/indexação, normalização, chunking, busca, ranking, proveniência e limites de segurança da biblioteca documental.

Regra importante: texto recuperado da biblioteca **não deve ser convertido automaticamente em diagnóstico ou estado do paciente**.

---

## `PATIENT_STATE_SCHEMA.md`

**Função:** documentação do modelo de estado do paciente.

Serve de referência para o que representa o estado verdadeiro do paciente durante a simulação.

---

## `PROMPT_PDF_TO_KB.md`

**Função:** instruções para transformar material documental/PDF em conhecimento estruturado compatível com a Knowledge Base.

**Mexer aqui quando:** o processo de curadoria/conversão de fontes para KB precisar mudar.

---

## Arquivos `csi_extended_*.json`

São exemplos/artefatos estruturados da camada CSI para conceitos clínicos específicos, incluindo dispneia e dislipidemia.

Servem como referência prática para a implementação da camada semântica.

---

## Arquivos `diagnosis_csi_*.json`

Artefatos de demonstração/estrutura para cenários diagnósticos específicos, incluindo glicemia/consciência e pulso/circulação.

Não devem ser confundidos com o motor geral de diagnóstico.

---

# 5. `docs/Js/` — CÓDIGO EXECUTÁVEL

Aqui está a implementação do sistema.

```text
Js/
├── engine.js
├── core/
├── clinical/
├── episodes/
└── ui/
```

---

# 6. `docs/Js/engine.js` — ORQUESTRADOR PRINCIPAL

**Função:** núcleo/orquestrador da aplicação atual.

Responsabilidades principais incluem:
- inicialização do motor;
- ligação com a interface;
- carregamento da Knowledge Base;
- geração de casos;
- processamento das ações do usuário;
- gerenciamento do estado da simulação;
- registro/log da interação;
- renderização do estado;
- avaliação e pontuação dentro do fluxo existente.

**Pense nele como:** o maestro.

Ele não deve ser transformado em depósito de todas as regras clínicas. Quando uma funcionalidade puder ficar isolada em um componente especializado, ela deve permanecer nesse componente.

---

# 7. `docs/Js/core/` — MOTOR CLÍNICO

A pasta `core` contém os componentes fundamentais do raciocínio/execução do sistema.

## `patient-state.js`

**Função:** representar o paciente específico durante a simulação e manter seu estado clínico.

Responsabilidades documentadas no próprio componente:
- representar um paciente específico;
- manter o estado clínico atual;
- separar verdade interna de informação revelável;
- controlar informações já reveladas;
- registrar investigações;
- registrar intervenções;
- registrar evolução temporal;
- fornecer snapshots antes/depois de ações.

**NÃO é responsabilidade dele:**
- gerar doenças;
- inventar conhecimento médico;
- interpretar linguagem natural;
- diagnosticar;
- determinar condutas;
- pontuar.

Este é um dos arquivos mais importantes para preservar a separação entre **verdade interna** e **o que o médico descobriu**.

---

## `patient-generator.js`

**Função:** gerar/criar pacientes e casos a partir do conhecimento disponível.

É a ponte entre o conteúdo da Knowledge Base e a criação de um paciente simulável.

**Mexer aqui quando:** o problema estiver na **criação, composição ou variação dos casos/pacientes**.

---

## `possibility-engine.js`

**Função:** trabalhar com possibilidades/hipóteses clínicas durante o raciocínio.

Não deve ser confundido com o `PatientState`: possibilidades são raciocínio sobre o caso; estado é o estado verdadeiro do paciente.

**Mexer aqui quando:** o problema for de diferencial, hipóteses ou relação entre achados e possibilidades.

---

## `knowledge_base_loader.js`

**Função:** carregar os arquivos da Knowledge Base para o ambiente do motor.

É a porta de entrada dos dados clínicos estruturados para o runtime.

**Mexer aqui quando:** a mudança for sobre **como as bases são localizadas, carregadas, registradas ou disponibilizadas ao sistema**.

---

## `clinical-model.js`

**Função:** representar/organizar o modelo clínico derivado do conhecimento carregado.

Fica entre o conhecimento bruto estruturado e componentes que precisam raciocinar sobre ele.

---

## `clinical-knowledge-resolver.js`

**Função:** resolver/relacionar conhecimento clínico relevante para uma determinada situação.

Serve como camada de resolução de conhecimento, evitando colocar toda essa lógica diretamente no `engine.js`.

---

## `investigation-engine.js`

**Função:** motor de investigação clínica.

Relaciona solicitações de investigação com o comportamento esperado do simulador e com resultados/achados.

**Mexer aqui quando:** a mudança for estrutural no mecanismo de investigação, e não apenas no conjunto de exames disponíveis.

---

## `diagnosis-clinical-enhancements.js`

**Função:** camada complementar de comportamento clínico/conversacional.

Na versão atual, inclui a lógica para:
- carregar regras de conversação clínica;
- carregar `examinations.json`;
- integrar a biblioteca médica;
- interceptar solicitações de exames;
- produzir resultados de exames simulados;
- registrar achados no Patient State;
- criar um desafio clínico após o resultado;
- avaliar a resposta do médico ao desafio.

Exemplo do fluxo:

```text
Solicitar hemograma
      ↓
Resultado do hemograma
      ↓
Achados
      ↓
"O senhor notou alguma alteração relevante nesse exame?"
      ↓
Resposta do médico
      ↓
Avaliação da interpretação
```

**Atenção:** esta camada é uma extensão sobre o motor existente. Não deve ser confundida com a substituição completa do `engine.js`.

---

## `clinical-runtime-adapter.js`

**Função:** adaptador de runtime para conectar conceitos/fluxos clínicos ao ambiente de execução.

É uma camada mais ampla de integração do runtime clínico e contém infraestrutura relacionada a desafios/fluxos clínicos.

**Status atual:** existe no repositório, mas não deve ser presumido como parte do carregamento principal sem verificar sua inclusão na página/runtime.

---

## `evidence-resolver.js`

**Função:** resolver evidência científica externa.

A implementação existente contempla integração com:
- PubMed/NCBI E-utilities;
- recuperação de registros;
- PMCID;
- PMC/BioC;
- extração de passagens;
- resolução de artigos.

Fluxo conceitual:

```text
conceito clínico
      ↓
PubMed / NCBI
      ↓
PMID
      ↓
EFetch
      ↓
PMCID
      ↓
PMC BioC
      ↓
passagens / evidência
```

**Não deve:** transformar automaticamente evidência recuperada em diagnóstico ou alterar o Patient State.

---

## `medical-library.js`

**Função:** biblioteca documental/médica local.

Responsabilidades:
- carregar fontes documentais;
- preparar conteúdo para busca;
- normalizar texto;
- recuperar trechos relevantes;
- manter proveniência;
- disponibilizar evidência documental para consulta.

A biblioteca é uma **fonte de conhecimento**, não o estado do paciente.

---

# 8. `docs/Js/clinical/`

## `clinical-interlocutor.js`

**Função:** interpretar a linguagem clínica usada pelo médico.

É a camada que recebe a linguagem e tenta transformá-la em uma intenção/ação clínica estruturada.

Deve preservar a diferença entre:

```text
O QUE O MÉDICO DISSE
        ≠
O QUE O SISTEMA ENTENDEU
        ≠
O QUE EFETIVAMENTE ACONTECEU AO PACIENTE
```

### Exemplo fundamental

```text
"Trato inicialmente com benzodiazepínico."
              ↓
contexto de tratamento
              ↓
"diazepam"
              ↓
continuação/complementação da ação anterior
```

A palavra isolada não deve obrigatoriamente determinar a ação.

---

# 9. `docs/Js/episodes/`

Área reservada para componentes relacionados a episódios clínicos.

Atualmente contém `.gitkeep`, funcionando como estrutura preparada para futura implementação.

---

# 10. `docs/Js/ui/`

Área reservada para componentes de interface desacoplados do motor clínico.

Atualmente contém `.gitkeep`.

Quando a interface crescer, componentes visuais devem preferencialmente migrar para esta área em vez de aumentar indefinidamente o `engine.js`.

---

# 11. `docs/knowledge_base/` — CONHECIMENTO CLÍNICO ESTRUTURADO

Esta pasta contém o conhecimento clínico estruturado utilizado pelo Diagnosis.

A organização atual da fase 1 segue o princípio:

> **Um conhecimento → um arquivo canônico.**

Os módulos clínicos canônicos são:

1. `DIAGNOSIS_CM01_SINDROME_ICTERICA_v0.3.json`
2. `DIAGNOSIS_CM02_SINDROME_DIARREICA_v0.3.json`
3. `DIAGNOSIS_CM03_SINDROME_METABOLICA_HAS_DISLIPIDEMIA_v0.3.json`
4. `DIAGNOSIS_CM04_DIABETES_v0.3.json`
5. `DIAGNOSIS_CM05_I_TIREOIDE_v0.3.json`
6. `DIAGNOSIS_CM05_II_SUPRARRENAL_v0.3.json`
7. `DIAGNOSIS_CM06_TERAPIA_INTENSIVA_v0.3.json`
8. `DIAGNOSIS_CM07_PNEUMONIA_COMUNITARIA_NOSOCOMIAL_v0.3.json`
9. `DIAGNOSIS_CM08_HIV_v0.3.json`
10. `DIAGNOSIS_CM09_SINDROMES_BACTERIANAS_v0.3.json`
11. `DIAGNOSIS_CM10_SINDROMES_FEBRIS_v0.3.json`
12. `DIAGNOSIS_CM11_TOSSE_CRONICA_v0.3.json`
13. `DIAGNOSIS_CM12_DISPNEIA_v0.3.json`
14. `DIAGNOSIS_CM13_GERIATRIA_v0.3.json`
15. `DIAGNOSIS_CM14_EPILEPSIA_v0.3.json`
16. `DIAGNOSIS_CM15_FRAQUEZA_MUSCULAR_v0.3.json`
17. `DIAGNOSIS_CM16_CEFALEIAS_v0.3.json`
18. `DIAGNOSIS_CM17_COMPARTIMENTOS_RENAIS_v0.3.json`
19. `DIAGNOSIS_CM18_SINDROME_UREMICA_v0.3.json`
20. `DIAGNOSIS_CM19_DISTURBIOS_HIDROELETROLITICOS_ACIDOBASES_v0.3.json`
21. `DIAGNOSIS_CM20_SINDROMES_ANEMICAS_v0.3.json`
22. `DIAGNOSIS_CM21_PANCITOPENIAS_v0.3.json`
23. `DIAGNOSIS_CM22_LINFONODO_ESPLENOMEGALIA_v0.3.json`
24. `DIAGNOSIS_CM23_HEMOSTASIA_v0.3.json`
25. `DIAGNOSIS_CM24_ARTRITES_v0.3.json`
26. `DIAGNOSIS_CM25_COLAGENOSES_VASCULITES_v0.3.json`
27. `DIAGNOSIS_CM26_SINDROME_EDEMIGENICA_v0.3.json`
28. `DIAGNOSIS_CM27_DOR_TORACICA_v0.3.json`
29. `DIAGNOSIS_CM28_ARRITMIAS_v0.2.json`
30. `DIAGNOSIS_CM29_INTOXICACOES_v0.2.json`
31. `DIAGNOSIS_CM30_SEMIOLOGIA_CARDIOVASCULAR_v0.2.json`
32. `DIAGNOSIS_CM31_SINDROMES_NEUROLOGICAS_v0.3.json`
33. `DIAGNOSIS_CM32_SEMIOLOGIA_OSTEOARTICULAR_v0.3.json`
34. `DIAGNOSIS_CM33_SEMIOLOGIA_RESPIRATORIA_SOURCE_PENDING_v0.3.json`
35. `DIAGNOSIS_CM34_MORDEDURAS_SOURCE_PENDING_v0.1.json`
36. `DIAGNOSIS_CM35_OTORRINOLARINGOLOGIA_SOURCE_PENDING_v0.1.json`

Além dos módulos clínicos, permanecem como camadas auxiliares separadas os catálogos e recursos transversais já definidos pelo projeto, incluindo `examinations.json`, `reference_ranges.json`, `pcdt_catalog.json`, `diagnosys_catalogo_mestre_doencas.json`, os recursos AHA de ressuscitação e os módulos transversais de glicemia/consciência e pulso/circulação.

A pasta `interaction/` também permanece separada como camada de interação/recuperação de conhecimento e não deve ser confundida com os módulos CM.

> **Importante:** os nomes acima são os nomes canônicos atualmente definidos para a fase 1. Não recriar referências às antigas bases por especialidade.

---

# 12. `examinations.json` — EXAMES

**Função:** catálogo/regras prototípicas de resultados de exames utilizados pela camada clínica atual.

A versão existente inclui padrões para exames como:
- hemograma;
- glicemia;
- creatinina.

Regras importantes da implementação atual:
- resultados são simulados;
- exames normais são possíveis;
- resultados normais podem reduzir diferenciais;
- resultados alterados precisam de contexto;
- solicitar exame não deve gerar penalidade simplesmente por solicitar;
- o resultado não deve revelar automaticamente o diagnóstico.

**Mexer aqui quando:** a mudança for no **conteúdo/padrão dos exames**, não no motor que interpreta uma solicitação.

---

# 13. `docs/medical_library/` — FONTES DOCUMENTAIS

Esta pasta contém documentos utilizados pela biblioteca médica.

Atualmente há, entre outros:

- `Exame_Clinico_8a_edicao-pt1.pdf`
- `Exame_Clinico_8a_edicao-pt2.pdf`
- `Tratado De Fisiologia Médica- Guyton 13ª Ed-pt3.pdf`
- `Tratado-de-Clinica-Medica-3a-Ed.-ACL.pdf`
- `Tratado-de-Clinica-Medica-3a-Ed.-ACL- doenças cardiacas (1).docx`

Esses documentos são **fontes documentais**, não dados de um paciente específico.

### Regra importante

Não confundir:

```text
medical_library
      ↓
CONHECIMENTO DOCUMENTAL

knowledge_base
      ↓
CONHECIMENTO CLÍNICO ESTRUTURADO

patient-state
      ↓
ESTADO DO PACIENTE ATUAL
```

---

# 14. `docs/tests/`

Área destinada aos testes do sistema.

Quando novos módulos forem adicionados, os testes devem preferencialmente acompanhar o componente correspondente.

---

# 15. FONTES EXTERNAS E EVIDÊNCIA

## PubMed / PMC

O projeto já possui `evidence-resolver.js` preparado para resolução de evidência via NCBI/PubMed/PMC.

Fluxo:

```text
Diagnosys
   ↓
EvidenceResolver
   ↓
PubMed / PMC
   ↓
metadados + evidência
```

A persistência de evidência local pode ser organizada futuramente em:

```text
knowledge_base/evidence/
```

sem transformar o navegador em um cliente com permissão de escrita direta no GitHub.

---

# 16. UMLS — NOVA INTEGRAÇÃO AUTORIZADA

## Status