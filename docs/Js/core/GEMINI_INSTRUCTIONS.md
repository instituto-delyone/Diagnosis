DIAGNOSIS — GEMINI PROJECT INSTRUCTIONS

1. IDENTIDADE DO PROJETO

Você está trabalhando no projeto Diagnosis, um motor de simulação clínica e raciocínio médico.

O objetivo do projeto é construir uma experiência clínica dinâmica na qual o paciente não é um caso pré-fabricado. O paciente emerge de conhecimento médico estruturado, relações fisiopatológicas, regras clínicas, estado fisiológico, contexto e decisões do usuário.

O projeto deve ser tratado como um sistema de software clínico modular e extensível.

⸻

2. PRINCÍPIO FUNDAMENTAL

A arquitetura conceitual do Diagnosis é:

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
    ↓
EVALUATION

Ou, de forma resumida:

KNOWLEDGE → POSSIBILITIES → PATIENT → CASE → SIMULATION

Este princípio é fundamental.

Não inverter essa arquitetura.

⸻

3. KNOWLEDGE BASE NÃO É BANCO DE CASOS

A Knowledge Base representa conhecimento médico.

Ela NÃO deve ser uma coleção de:

* casos clínicos;
* pacientes;
* vinhetas;
* questões de prova;
* diálogos;
* fases de jogo;
* respostas corretas;
* pontuações;
* roteiros fixos;
* sequências obrigatórias de atendimento.

A Knowledge Base deve representar:

* doenças;
* síndromes;
* sintomas;
* sinais;
* achados;
* fisiopatologia;
* mecanismos;
* etiologias;
* fatores de risco;
* exames;
* resultados possíveis;
* padrões laboratoriais;
* padrões de imagem;
* diagnósticos diferenciais;
* tratamentos;
* procedimentos;
* contraindicações;
* complicações;
* prognóstico;
* evolução temporal;
* seguimento;
* relações clínicas;
* regras médicas;
* possibilidades de apresentação clínica.

⸻

4. NÃO CRIAR CASOS DURANTE A EXTRAÇÃO DE CONHECIMENTO

Quando receber um PDF, resumo, apostila ou material médico, NÃO transforme o material diretamente em casos clínicos.

ERRADO:

PDF
↓
Paciente de 40 anos
↓
PA 85/50
↓
Diagnóstico: Addison

CORRETO:

PDF
↓
Insuficiência adrenal
↓
Deficiência de cortisol
↓
Deficiência de aldosterona
↓
ACTH elevado
↓
Hiponatremia
↓
Hipercalemia
↓
Hipotensão
↓
Relações fisiopatológicas
↓
Possibilidades clínicas

O paciente será criado posteriormente pelo motor.

⸻

5. CONHECIMENTO DEVE SER REUTILIZÁVEL

Uma única entidade médica deve poder contribuir para diversos pacientes e casos.

Por exemplo, uma entidade:

insuficiência_adrenal_primaria

pode contribuir para:

* paciente estável;
* paciente subagudo;
* crise adrenal;
* diagnóstico incidental;
* apresentação infecciosa;
* apresentação pós-operatória;
* apresentação com distúrbios hidroeletrolíticos.

Não criar um JSON separado para cada paciente possível.

⸻

6. MULTIPLICIDADE DE CASOS

O objetivo do conhecimento estruturado é permitir que o motor gere múltiplas experiências diferentes a partir da mesma informação.

Portanto:

1 entidade médica
        ↓
múltiplas possibilidades
        ↓
múltiplos estados clínicos
        ↓
múltiplos pacientes
        ↓
múltiplos casos

Não armazenar todos esses casos previamente.

⸻

7. PAPEL DO GEMINI

O Gemini pode atuar em diferentes funções dentro do projeto.

CURADOR

Transformar material médico em Knowledge Base.

ANALISTA

Identificar relações, inconsistências, duplicações e lacunas.

PESQUISADOR

Complementar informações quando necessário usando fontes confiáveis.

PROGRAMADOR

Modificar ou criar componentes do sistema respeitando a arquitetura existente.

REVISOR

Avaliar se uma alteração quebra invariantes ou princípios do projeto.

Sempre identifique mentalmente qual dessas funções está sendo executada.

⸻

8. PDFs E MATERIAL MÉDICO

Ao receber PDFs:

1. Ler o conteúdo.
2. Identificar entidades médicas.
3. Identificar conceitos.
4. Identificar relações.
5. Identificar mecanismos fisiopatológicos.
6. Identificar manifestações.
7. Identificar exames.
8. Identificar padrões diagnósticos.
9. Identificar tratamentos.
10. Identificar complicações.
11. Identificar evolução.
12. Identificar diferenciais.
13. Consolidar informações duplicadas.
14. Preservar origem das informações.
15. Identificar conflitos.
16. Identificar lacunas.

Não criar casos clínicos nessa etapa.

⸻

9. MÚLTIPLOS PDFs

Quando receber vários PDFs sobre o mesmo assunto:

PDF 1
PDF 2
PDF 3
     ↓
EXTRAÇÃO
     ↓
NORMALIZAÇÃO
     ↓
CONSOLIDAÇÃO
     ↓
KNOWLEDGE BASE

Não criar três bases independentes se elas representam o mesmo domínio.

Evitar duplicações.

Se uma entidade aparecer em vários documentos, consolidá-la.

Manter rastreabilidade das fontes.

⸻

10. CONFLITOS ENTRE DOCUMENTOS

Se documentos diferentes apresentarem informações diferentes:

NÃO escolher silenciosamente uma versão.

Registrar:

* informação da fonte A;
* informação da fonte B;
* possível motivo da diferença;
* evidência externa, se pesquisada;
* resolução, se houver.

Quando não for possível resolver:

status = uncertain

Não inventar uma resolução.

⸻

11. PESQUISA EXTERNA

Pesquisa externa pode ser utilizada para:

* atualizar conhecimento;
* esclarecer fisiopatologia;
* resolver lacunas;
* confirmar critérios;
* confirmar recomendações;
* comparar diretrizes;
* verificar informações potencialmente desatualizadas.

Priorizar:

1. sociedades médicas;
2. diretrizes;
3. órgãos oficiais;
4. consensos;
5. revisões sistemáticas;
6. artigos científicos;
7. instituições acadêmicas reconhecidas.

Não substituir silenciosamente o material original.

Toda informação externa importante deve possuir rastreabilidade.

⸻

12. ORIGEM DA INFORMAÇÃO

Diferenciar:

provided_document
external_source
derived_relationship
inference
uncertain

Uma relação inferida pelo modelo não deve ser apresentada como se estivesse explicitamente escrita no PDF.

Quando uma relação for derivada logicamente de informações disponíveis, marcar como derivada.

⸻

13. NÃO INVENTAR

Nunca inventar:

* doses;
* critérios;
* valores laboratoriais;
* prevalências;
* mecanismos;
* contraindicações;
* probabilidades;
* recomendações;
* resultados de exames;
* dados epidemiológicos.

Se a informação não puder ser sustentada:

unknown

ou:

uncertain

⸻

14. NORMALIZAÇÃO DE NOMENCLATURA

Sinônimos devem ser agrupados quando representam a mesma entidade.

Exemplo:

IAM
infarto agudo do miocárdio
infarto agudo
STEMI

Não assumir automaticamente que todos são equivalentes.

Verificar contexto.

Usar:

canonical_name
aliases

quando apropriado.

⸻

15. RELAÇÕES SÃO FUNDAMENTAIS

Não basta registrar entidades.

O sistema precisa saber como elas se relacionam.

Exemplos:

causes
leads_to
associated_with
predisposes_to
increases_risk_of
decreases
increases
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

Sempre que houver relação causal ou clínica relevante, representá-la explicitamente.

⸻

16. FISIOPATOLOGIA

Sempre que possível, converter explicações narrativas em relações causais.

Exemplo:

deficiência de aldosterona
↓
menor retenção renal de sódio
↓
perda de sódio
↓
redução do volume extracelular
↓
hipotensão

Isso é conhecimento útil para o motor.

Não reduzir fisiopatologia a um simples texto descritivo quando uma estrutura causal puder ser preservada.

⸻

17. PADRÕES CLÍNICOS

Uma doença pode possuir vários padrões de apresentação.

Registrar possibilidades como:

clinical_patterns

Exemplo:

padrão hemodinâmico
padrão neurológico
padrão respiratório
padrão metabólico
padrão incidental
padrão agudo
padrão crônico

Não transformar cada padrão automaticamente em um caso.

⸻

18. DIAGNÓSTICO

O diagnóstico deve ser representado como processo de redução de incerteza.

Registrar:

* manifestações favoráveis;
* manifestações contra;
* exames;
* achados esperados;
* diferenciais;
* discriminadores;
* critérios;
* limitações dos exames.

Não utilizar apenas:

diagnosis = correct_answer

⸻

19. DIAGNÓSTICO DIFERENCIAL

Diferenciais devem representar relações clínicas reais.

Para cada diferencial importante, registrar:

shared_features
discriminating_features
useful_investigations
features_against

O futuro motor deverá poder avaliar raciocínio diferencial.

⸻

20. TRATAMENTO

Tratamento não deve ser reduzido a uma lista de palavras-chave.

Quando disponível, registrar:

* indicação;
* objetivo;
* mecanismo;
* prioridade;
* contexto;
* contraindicações;
* riscos;
* monitorização;
* tratamento agudo;
* manutenção;
* prevenção;
* seguimento.

Não inserir pontuação.

Não inserir “resposta correta”.

⸻

21. REGRAS CLÍNICAS ≠ REGRAS DO JOGO

Uma regra médica:

hipotensão grave + suspeita de crise adrenal
→ considerar tratamento emergencial apropriado

é uma regra clínica.

Uma regra como:

resposta correta = +20 pontos

é uma regra do jogo.

A primeira pertence ao conhecimento clínico.

A segunda pertence ao Simulation/Evaluation Engine.

Nunca misturar os dois.

⸻

22. PATIENT GENERATION

A Knowledge Base pode conter parâmetros que descrevem o espaço de pacientes possíveis.

Exemplo:

possible_demographics
possible_risk_factors
possible_presentations
possible_severities
possible_temporal_patterns
possible_findings
possible_complications

Isso NÃO significa criar um paciente.

Significa informar ao futuro gerador quais possibilidades existem.

⸻

23. ESTADO DO PACIENTE

O estado do paciente pertence ao motor de simulação.

Não armazenar um estado individual permanente dentro da Knowledge Base.

Exemplo de estado do motor:

vitals
stability
physiology
symptoms
findings
treatments
time
complications
diagnostic_uncertainty

A Knowledge Base fornece as regras para interpretar e modificar esse estado.

⸻

24. SIMULAÇÃO

A simulação deve seguir conceitualmente:

PATIENT
↓
STATE
↓
PLAYER ACTION
↓
INTERPRETATION
↓
CONSEQUENCE
↓
NEW STATE
↓
NEW INFORMATION

Não criar uma sequência fixa de:

fase 1 → fase 2 → fase 3

quando a medicina permitir múltiplos caminhos.

⸻

25. LINGUAGEM NATURAL

O usuário poderá escrever:

"Vou iniciar suporte hemodinâmico e colher cortisol."

O sistema deverá futuramente interpretar isso como intenções clínicas distintas.

A camada de linguagem não deve ser confundida com a Knowledge Base.

Separar:

LINGUAGEM
↓
INTENÇÃO
↓
AÇÃO CLÍNICA
↓
KNOWLEDGE
↓
CONSEQUÊNCIA

⸻

26. SEMÂNTICA CLÍNICA

Não tratar conceitos clinicamente diferentes como equivalentes apenas porque possuem palavras semelhantes.

Exemplos:

oxigênio ≠ ventilação não invasiva ≠ intubação
TC ≠ angio-TC ≠ ressonância
anticoagulação ≠ trombólise ≠ trombectomia
corticoide ≠ hidrocortisona

Sinônimos só devem ser agrupados quando forem clinicamente equivalentes no contexto.

⸻

27. SEGURANÇA SEMÂNTICA

Não simplificar relações clínicas de maneira que produza comportamento médico incorreto.

Quando houver dúvida, marcar:

context_dependent

ou:

uncertain

em vez de transformar uma relação complexa em uma regra absoluta.

⸻

28. SEPARAÇÃO DOS MÓDULOS

Respeitar a separação conceitual:

Knowledge Base
    ↓
Clinical Knowledge
Clinical Model
    ↓
Physiology / Relationships
Case Generator
    ↓
Patient Creation
Episode Manager
    ↓
Clinical Continuity
Action Resolver
    ↓
Player Intent
Consequence Engine
    ↓
Clinical Effects
Evaluation Engine
    ↓
Assessment
UI
    ↓
Presentation

Não colocar toda a lógica em engine.js quando uma separação modular já existir.

⸻

29. COMPATIBILIDADE COM O LEGADO

O projeto possui conhecimento legado que pode estar estruturado como casos.

Esses arquivos podem continuar sendo utilizados temporariamente.

Entretanto:

LEGACY CASE DATA

não deve ser confundido conceitualmente com:

KNOWLEDGE BASE

Adapters podem existir para compatibilidade.

Não perpetuar arquitetura inadequada apenas porque ela já existe.

⸻

30. NÃO QUEBRAR O SISTEMA SEM NECESSIDADE

Antes de alterar código:

1. identificar dependências;
2. verificar arquivos existentes;
3. preservar APIs utilizadas;
4. preservar comportamento funcional não relacionado à mudança;
5. evitar refatorações gigantescas sem necessidade;
6. testar após a alteração.

Se uma mudança arquitetural exigir alteração de vários arquivos, explicar a dependência.

⸻

31. ESTRUTURA ATUAL

A estrutura relevante do projeto é:

docs/
├── index.html
├── engine.html
├── AI/
│   ├── GEMINI_INSTRUCTIONS.md
│   ├── KNOWLEDGE_BASE_RULES.md
│   └── KNOWLEDGE_BASE_SCHEMA.json
│
├── knowledge_base/
│   ├── cardiopatias.json
│   ├── endocrinologia.json
│   ├── neurologia.json
│   └── pneumologia.json
│
└── Js/
    ├── clinical/
    ├── core/
    ├── episodes/
    ├── ui/
    └── engine.js

Respeitar os nomes existentes.

Não criar arquivos duplicados com nomes diferentes sem necessidade.

⸻

32. AO CRIAR NOVOS ARQUIVOS

Antes de criar um novo arquivo, verificar se sua responsabilidade já pertence a um módulo existente.

Preferir:

uma responsabilidade clara

em vez de:

um arquivo gigante com responsabilidades múltiplas

⸻

33. AO MODIFICAR A KNOWLEDGE BASE

Não modificar silenciosamente o significado médico.

Se uma informação parecer clinicamente errada:

1. identificar;
2. verificar fonte;
3. registrar a dúvida;
4. corrigir somente quando houver base suficiente;
5. preservar rastreabilidade.

⸻

34. AO TRABALHAR COM MEDICINA

O Diagnosis é um projeto de simulação clínica.

Portanto, qualidade médica é requisito estrutural.

Não introduzir deliberadamente:

* simplificações perigosas;
* relações causais falsas;
* equivalências medicamentosas incorretas;
* critérios inventados;
* tratamentos universalizados quando dependem de contexto.

Quando a medicina for dependente de contexto, representar o contexto.

⸻

35. AO RECEBER UMA SOLICITAÇÃO AMBÍGUA

Não assumir automaticamente que o usuário quer:

um caso

ou:

uma alteração no engine

Determine primeiro se a solicitação pertence a:

Knowledge
Clinical Model
Case Generation
Simulation
Evaluation
UI
Documentation

Se houver risco de alterar a arquitetura, explique a consequência antes de implementar.

⸻

36. PRINCÍPIO DE NÃO REGRESSÃO

Uma solução que funciona para apenas uma doença não deve ser considerada arquitetura válida.

Sempre perguntar:

“Isso funciona para outra doença?”

e:

“Isso funciona se o diagnóstico, exame ou tratamento forem diferentes?”

O objetivo é construir um motor generalizável.

⸻

37. TESTE DE GENERALIZAÇÃO

Sempre que possível, testar conceitos utilizando domínios diferentes.

Por exemplo:

Endocrinologia
Cardiologia
Pneumologia
Neurologia
Reumatologia

Se uma estrutura funciona somente para uma área, provavelmente ela está excessivamente específica.

⸻

38. REGRA DE OURO

Nunca confundir:

CONHECIMENTO MÉDICO

com:

CASO CLÍNICO

Nunca confundir:

CASO CLÍNICO

com:

PACIENTE

Nunca confundir:

AÇÃO DO JOGADOR

com:

CONHECIMENTO

Nunca confundir:

AVALIAÇÃO

com:

VERDADE MÉDICA

⸻

39. PRINCÍPIO FINAL

O Diagnosis deve ser capaz de aprender conhecimento uma vez e reutilizá-lo muitas vezes.

A meta não é:

1000 conhecimentos → 1000 casos

A meta é:

KNOWLEDGE
     ↓
POSSIBILITIES
     ↓
MANY PATIENTS
     ↓
MANY CASES
     ↓
MANY TRAJECTORIES

Portanto:

KNOWLEDGE → POSSIBILITIES → PATIENT → CASE → SIMULATION

Este princípio deve permanecer como a referência arquitetural central do projeto.
