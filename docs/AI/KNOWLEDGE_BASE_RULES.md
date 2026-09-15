Diagnosis — Knowledge Base Rules

1. Propósito

Este documento define as regras de curadoria, representação, normalização, validação e consolidação da Knowledge Base Médica do projeto Diagnosis.

A Knowledge Base deve representar conhecimento médico reutilizável.

Ela não deve representar casos clínicos específicos.

A função da Knowledge Base é fornecer ao sistema o espaço clínico necessário para que, posteriormente, outros componentes possam:

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

A regra fundamental é:

A Knowledge Base descreve o que a medicina permite que aconteça. O Case Generator escolhe o que acontecerá com um paciente específico.

⸻

2. Regra de separação entre conhecimento e caso

Nunca transformar diretamente um texto médico em uma coleção de casos.

Incorreto

PDF
↓
Caso 1
Caso 2
Caso 3

Correto

PDF
↓
Entidades médicas
↓
Relações
↓
Mecanismos
↓
Manifestações
↓
Padrões clínicos
↓
Diagnóstico
↓
Tratamento
↓
Complicações
↓
Possibilidades de evolução

Posteriormente:

Knowledge Base
+
regras
+
aleatoriedade/contexto
+
estado clínico
↓
Paciente
↓
Caso

A Knowledge Base nunca deve depender de um caso específico para existir.

⸻

3. O que pertence à Knowledge Base

Podem pertencer à Knowledge Base, quando houver suporte documental suficiente:

* doenças;
* síndromes;
* condições clínicas;
* estados fisiológicos;
* sintomas;
* sinais;
* achados clínicos;
* achados laboratoriais;
* achados de imagem;
* fatores de risco;
* fatores prognósticos;
* etiologias;
* mecanismos;
* fisiopatologia;
* processos fisiológicos;
* anatomia relevante;
* exames;
* métodos diagnósticos;
* critérios diagnósticos;
* pontos de corte;
* diagnósticos diferenciais;
* características discriminatórias;
* tratamentos;
* medicamentos;
* procedimentos;
* intervenções não farmacológicas;
* contraindicações;
* efeitos adversos;
* complicações;
* prognóstico;
* evolução temporal;
* seguimento;
* prevenção;
* regras clínicas;
* relações entre entidades;
* padrões clínicos;
* possibilidades de apresentação;
* fontes e rastreabilidade;
* conflitos entre fontes;
* incertezas.

⸻

4. O que NÃO pertence à Knowledge Base

Não inserir na Knowledge Base:

* pacientes específicos;
* nomes de pacientes;
* IDs de pacientes;
* histórias clínicas completas;
* casos clínicos fechados;
* vinhetas destinadas ao jogador;
* diálogos com o jogador;
* perguntas de prova;
* alternativas de múltipla escolha;
* gabaritos de jogo;
* pontuação;
* fases do jogo;
* tempo de jogo;
* score;
* penalidades de gameplay;
* mensagens de interface;
* botões;
* comandos do usuário;
* estados de UI;
* feedback específico de uma partida;
* decisões já tomadas por um jogador;
* trajetória fixa de um paciente;
* resposta correta associada a uma pergunta;
* sequência obrigatória de investigação;
* sequência obrigatória de tratamento criada apenas para o jogo.

Esses elementos pertencem a outras camadas do sistema.

⸻

5. Unidade fundamental: entidade médica

A menor unidade conceitual relevante da Knowledge Base deve ser uma entidade médica identificável.

Exemplos:

Crise adrenal
Insuficiência adrenal primária
Cortisol
ACTH
Aldosterona
Hiponatremia
Hipercalemia
Hidrocortisona
Choque distributivo
Hiperpigmentação

Uma entidade deve possuir uma identidade canônica.

Sempre que possível:

canonical_name
+
aliases
+
type
+
definition
+
relationships
+
source_traceability

⸻

6. Normalização de entidades

O mesmo conceito médico não deve ser duplicado simplesmente porque aparece com nomes diferentes em documentos diferentes.

Exemplo:

Doença de Addison
Insuficiência adrenal primária
Insuficiência suprarrenal primária

Devem ser analisados para determinar se representam:

* o mesmo conceito;
* conceitos relacionados;
* um conceito mais amplo e outro mais específico;
* ou entidades realmente diferentes.

Não assumir equivalência automaticamente.

Quando houver equivalência:

canonical entity
    ├── alias
    ├── synonym
    └── alternative terminology

Quando não houver equivalência, preservar entidades distintas e registrar a relação apropriada.

⸻

7. Hierarquia semântica

A Knowledge Base deve preservar diferenças clínicas relevantes.

Não colapsar conceitos diferentes em uma categoria genérica apenas para simplificar o JSON.

Exemplos:

Oxigênio
NIV
Ventilação mecânica invasiva

são intervenções diferentes.

Da mesma forma:

Anticoagulação
Trombólise
Trombectomia

não são equivalentes.

E:

Corticosteroide
Hidrocortisona
Prednisona
Dexametasona

não devem ser tratados como uma única entidade quando a distinção farmacológica for clinicamente relevante.

Também preservar diferenças entre:

TC
Angio-TC
RM
Angio-RM
Ultrassonografia
Ecocardiografia

quando a finalidade clínica ou interpretação for diferente.

⸻

8. Relações são conhecimento de primeira classe

Não basta armazenar entidades isoladas.

O sistema deve representar como os conceitos se relacionam.

Exemplos:

Doença de Addison
    ↓ causes
deficiência de cortisol
Doença de Addison
    ↓ causes
deficiência de aldosterona
deficiência de aldosterona
    ↓ increases
hipercalemia
deficiência de cortisol
    ↓ contributes_to
hipotensão
hipercalemia
    ↓ can_result_in
arritmia

Relações podem incluir:

* causes;
* caused_by;
* associated_with;
* predisposes_to;
* increases_risk_of;
* decreases;
* increases;
* results_in;
* leads_to;
* characterized_by;
* manifests_as;
* suggests;
* supports_diagnosis_of;
* argues_against;
* requires;
* treated_by;
* contraindicated_by;
* complicates;
* precedes;
* follows;
* differentiates_from;
* part_of;
* subtype_of.

Nunca criar uma relação apenas porque duas entidades aparecem próximas no texto.

A relação deve ter suporte documental ou inferência médica explicitamente justificada.

⸻

9. Fisiopatologia

Quando possível, representar fisiopatologia como cadeia causal.

Exemplo:

destruição do córtex adrenal
        ↓
redução de cortisol
        ↓
redução da resposta vascular às catecolaminas
        ↓
vasoplegia/hipotensão
        ↓
choque

Outro exemplo:

destruição da zona glomerulosa
        ↓
redução de aldosterona
        ↓
redução da retenção renal de sódio
        +
redução da excreção de potássio
        ↓
hiponatremia
+
hipercalemia

A Knowledge Base deve privilegiar relações causais explicativas em vez de apenas listas de fatos.

⸻

10. Fatos versus interpretações

Distinguir:

Fato

ACTH elevado

Interpretação

ACTH elevado associado a cortisol baixo favorece insuficiência adrenal primária.

Relação causal

deficiência de cortisol
→ aumento compensatório de ACTH

Essas informações podem coexistir, mas não devem ser misturadas indiscriminadamente.

⸻

11. Padrões clínicos

A Knowledge Base pode representar padrões clínicos reutilizáveis.

Exemplo:

hipotensão
+
hiponatremia
+
hipercalemia
+
hiperpigmentação

pode representar um padrão fortemente sugestivo de insuficiência adrenal primária.

Isso não significa que esse padrão deva ser transformado em um caso.

O padrão deve ser representado como uma possibilidade clínica.

O Case Generator poderá posteriormente escolher:

* quais manifestações estarão presentes;
* quais estarão ausentes;
* quais serão discretas;
* quais serão graves;
* em que momento aparecerão;
* quais serão descobertas apenas após investigação.

⸻

12. Presença, ausência e intensidade

Quando suportado pela literatura, manifestações podem possuir dimensões como:

presence
frequency
severity
timing
context

Não assumir que uma manifestação seja obrigatória apenas porque aparece em um resumo.

Diferenciar:

frequente
comum
possível
raro
característico
obrigatório

Essas categorias não são intercambiáveis.

⸻

13. Dimensão temporal

Doenças e condições podem possuir evolução temporal.

Quando aplicável, representar:

início
progressão
fase aguda
fase subaguda
fase crônica
descompensação
recuperação
recorrência
complicação
seguimento

A evolução não deve ser transformada em uma sequência fixa de fases de jogo.

Ela representa uma possibilidade médica.

⸻

14. Fisiologia e valores laboratoriais

Valores fisiológicos e laboratoriais devem ser representados com contexto.

Quando disponível, registrar:

* exame;
* unidade;
* faixa de referência;
* direção da alteração;
* magnitude;
* contexto;
* população;
* fonte.

Exemplo conceitual:

sodium
direction: decreased
clinical_pattern: hyponatremia

Evitar transformar todo valor em um número rígido quando o significado clínico depende do contexto.

Quando um ponto de corte realmente for necessário, registrar:

* valor;
* unidade;
* população;
* finalidade;
* fonte;
* contexto clínico.

Nunca inventar valores.

⸻

15. Exames

Um exame não deve ser representado apenas como seu nome.

Quando possível, registrar:

investigation
    ↓
clinical_question
    ↓
possible_result
    ↓
interpretation
    ↓
diagnostic_impact

Exemplo:

Cortisol basal
    ↓
avalia produção de cortisol
    ↓
baixo
    ↓
sugere insuficiência adrenal
    ↓
aumenta probabilidade diagnóstica

Também representar quando apropriado:

* indicação;
* limitações;
* falso positivo;
* falso negativo;
* necessidade de confirmação;
* relação com outros exames.

⸻

16. Diagnóstico como redução de incerteza

O diagnóstico não deve ser modelado apenas como:

doença → resposta correta

Deve ser possível representar:

apresentação
↓
hipóteses
↓
evidências
↓
testes
↓
discriminadores
↓
redução de incerteza
↓
diagnóstico mais provável

Para cada diagnóstico relevante, quando disponível, representar:

* achados que apoiam;
* achados que enfraquecem;
* exames úteis;
* resultados esperados;
* diagnósticos diferenciais;
* características discriminatórias.

⸻

17. Diagnóstico diferencial

Diagnósticos diferenciais devem ser entidades relacionadas, não simplesmente uma lista textual.

Exemplo:

Insuficiência adrenal primária
    ↔ differentiates_from ↔
Insuficiência adrenal secundária

A relação pode possuir discriminadores:

hiperpigmentação
hipercalemia
ACTH
aldosterona

Quando houver suporte, registrar quais achados:

* favorecem;
* desfavorecem;
* discriminam;
* exigem investigação adicional.

⸻

18. Tratamento

Tratamento deve representar conhecimento clínico, não instruções de gameplay.

Sempre que possível, incluir:

* indicação;
* objetivo;
* mecanismo;
* contexto;
* prioridade;
* riscos;
* contraindicações;
* monitorização;
* alternativas;
* escalonamento;
* descalonamento;
* seguimento.

Separar:

acute
maintenance
non_pharmacological
procedures
monitoring

quando essa distinção fizer sentido.

⸻

19. Tratamento agudo

Em emergências, registrar a lógica clínica.

Exemplo conceitual:

crise adrenal
    ↓
suspeita clínica
    ↓
tratamento imediato
    ↓
reposição de glicocorticoide
+
ressuscitação volêmica
    ↓
monitorização

Não transformar essa lógica em uma sequência rígida de comandos do jogador.

O Simulation Engine decidirá como uma ação concreta do jogador interage com esse conhecimento.

⸻

20. Medicamentos

Medicamentos devem ser entidades próprias quando clinicamente relevante.

Registrar, quando disponível:

* nome;
* classe;
* mecanismo;
* indicações;
* contraindicações;
* efeitos adversos;
* interações;
* monitorização;
* contexto de uso;
* vias;
* doses, quando a fonte fornecer explicitamente;
* população específica, quando aplicável.

Nunca inventar dose.

Não substituir uma entidade farmacológica específica por uma classe genérica quando a distinção for clinicamente relevante.

⸻

21. Contraindicações

Contraindicações devem ser relacionadas à intervenção específica.

Evitar estruturas vagas como:

tratamento X → contraindicado

Preferir:

intervenção
+
condição/contexto
+
tipo de contraindicação
+
fonte

Diferenciar:

* contraindicação absoluta;
* contraindicação relativa;
* precaução;
* necessidade de ajuste.

Não inferir automaticamente uma contraindicação apenas porque determinada condição aumenta risco.

⸻

22. Complicações

Complicações devem ser entidades ou relações clínicas.

Exemplo:

doença
    ↓ can_complicate_to
complicação

Quando possível, registrar:

* mecanismo;
* fatores de risco;
* sinais de alerta;
* impacto;
* prevenção;
* tratamento.

Não confundir complicação com simples sintoma.

⸻

23. Prognóstico e seguimento

Quando houver informação suficiente, representar:

* fatores prognósticos;
* evolução esperada;
* recorrência;
* monitorização;
* acompanhamento;
* prevenção de novas descompensações;
* educação do paciente;
* necessidade de tratamento crônico.

Isso é especialmente importante porque o Diagnosis deve poder continuar uma experiência após a estabilização aguda.

A existência de conhecimento de seguimento não significa que todo caso precise obrigatoriamente entrar em seguimento.

⸻

24. Patient Generation

A seção patient_generation representa o espaço de possibilidades para criação de pacientes.

Ela pode conter:

* faixas etárias;
* sexo, quando clinicamente relevante;
* fatores de risco;
* exposições;
* comorbidades;
* apresentações possíveis;
* gravidade;
* manifestações possíveis;
* achados possíveis;
* contextos;
* combinações plausíveis;
* probabilidades ou frequências, quando houver fonte confiável.

Ela NÃO deve conter:

* nome;
* idade de um paciente específico;
* sinais vitais fixos de um caso;
* uma história clínica pronta;
* um caso completo;
* trajetória fixa;
* diagnóstico já revelado ao jogador.

Exemplo correto:

age_range:
  20-70
possible_presentations:
  - hypotension
  - fatigue
  - abdominal_pain
  - vomiting
possible_risk_factors:
  - autoimmune_disease

Exemplo incorreto:

patient:
  name: João
  age: 40
  BP: 85/50
  diagnosis: Addison

⸻

25. Probabilidades

Probabilidades somente devem ser usadas quando houver fundamento.

Diferenciar:

frequência documentada

de:

estimativa do sistema

Nunca inventar probabilidades clínicas apenas para tornar a geração de casos “realista”.

Quando uma probabilidade for desconhecida, deixar explicitamente ausente.

⸻

26. Regras clínicas

Uma clinical_rule representa uma regra médica.

Exemplo:

IF
  hypotension
  AND hyperkalemia
  AND hyponatremia
  AND compatible_context
THEN
  increase_suspicion_for:
  primary_adrenal_insufficiency

Regras clínicas devem ser:

* justificáveis;
* rastreáveis;
* semanticamente explícitas;
* independentes da pontuação do jogo.

Nunca escrever:

IF player says Addison THEN +20 points

Isso é regra de gameplay, não regra clínica.

⸻

27. Linguagem não é conhecimento

A forma como o jogador fala não deve ser confundida com o conceito médico.

Exemplos:

"quero dar corticoide"
"vou fazer glicocorticoide"
"vou administrar hidrocortisona"

podem representar intenções semanticamente relacionadas.

A arquitetura correta é:

PLAYER LANGUAGE
      ↓
INTENT
      ↓
CLINICAL ACTION
      ↓
KNOWLEDGE
      ↓
CONSEQUENCE

A Knowledge Base deve representar o conceito médico.

O processamento de linguagem pertence à camada de interpretação.

⸻

28. Não confundir termos próximos

O sistema deve preservar diferenças semânticas.

Exemplos:

cortisol ≠ hidrocortisona
ACTH ≠ cortisol
hiponatremia ≠ hipercalemia
TC ≠ angio-TC
oxigênio ≠ NIV
NIV ≠ ventilação invasiva
anticoagulação ≠ trombólise
trombólise ≠ trombectomia
diagnóstico ≠ hipótese
tratamento ≠ suporte

Aliases podem representar linguagem equivalente.

Aliases não devem apagar diferenças clínicas.

⸻

29. Fontes

Toda informação clinicamente relevante deve ser rastreável sempre que possível.

Registrar:

* documento de origem;
* página ou seção;
* trecho ou referência interna;
* tipo de fonte;
* data;
* fonte externa, se houver.

Diferenciar:

PDF_SOURCE
EXTERNAL_RESEARCH
CURATOR_INTERPRETATION

Não apresentar interpretação do curador como se fosse texto original da fonte.

⸻

30. Pesquisa externa

Pesquisa externa pode ser utilizada para:

* preencher lacunas;
* atualizar recomendações;
* esclarecer conceitos;
* comparar fontes;
* resolver ambiguidades;
* verificar informações potencialmente desatualizadas.

Priorizar:

1. sociedades médicas;
2. guidelines;
3. órgãos oficiais;
4. consensos;
5. revisões sistemáticas;
6. artigos científicos;
7. instituições acadêmicas;
8. fontes secundárias confiáveis.

A pesquisa externa nunca deve ser usada para inventar informação ausente.

⸻

31. Conflitos entre fontes

Quando duas fontes discordarem, não apagar silenciosamente uma delas.

Registrar:

source A
source B
claim A
claim B
reason for conflict
resolution

Possíveis resoluções:

* fonte mais recente;
* guideline específico;
* população diferente;
* contexto clínico diferente;
* mudança temporal de recomendação;
* evidência insuficiente.

Se não houver base suficiente para resolver:

uncertainty

deve ser preservada.

⸻

32. Documentos múltiplos

Quando vários PDFs pertencem ao mesmo domínio:

Reumato 1
Reumato 2
Reumato 3

eles devem ser tratados como partes de uma mesma Knowledge Base.

Não criar:

reumato_1.json
reumato_2.json
reumato_3.json

apenas porque existem três PDFs.

O objetivo é:

Reumato 1
      +
Reumato 2
      +
Reumato 3
      ↓
Knowledge Base consolidada

⸻

33. Deduplicação

Antes de criar uma nova entidade, verificar se ela já existe.

Comparar:

* nome;
* aliases;
* definição;
* tipo;
* contexto;
* relações;
* fontes.

Se for a mesma entidade:

merge

Se houver dúvida:

preserve separately
+
record uncertainty

Nunca duplicar uma entidade simplesmente porque aparece em outro PDF.

⸻

34. Atualização incremental

Uma Knowledge Base deve poder receber novos documentos sem ser reconstruída do zero.

Ao processar um novo documento:

documento novo
↓
extração
↓
matching de entidades
↓
matching de relações
↓
novos conhecimentos
↓
conflitos
↓
merge
↓
validação

O processamento deve preservar o conhecimento previamente consolidado.

⸻

35. Não destruir informação anterior

Ao atualizar a Knowledge Base:

* não apagar uma informação apenas porque ela não aparece no novo documento;
* não substituir silenciosamente uma recomendação antiga;
* não remover uma relação sem justificativa;
* não sobrescrever fontes.

Atualizações devem ser rastreáveis.

⸻

36. Incerteza

A ausência de informação é diferente de informação negativa.

Não confundir:

"não encontrei informação"

com:

"não existe"

Quando o conhecimento for insuficiente, usar explicitamente:

unknown
uncertain
not_documented
conflicting

conforme o caso.

Nunca preencher lacunas com suposições.

⸻

37. Generalização

A Knowledge Base deve funcionar como base para múltiplos casos.

Uma entidade bem representada deve poder participar de diferentes cenários.

Exemplo:

hipercalemia

pode aparecer em:

* insuficiência adrenal;
* insuficiência renal;
* medicamentos;
* acidose;
* condições específicas.

Não vincular artificialmente a entidade a apenas um caso.

⸻

38. Não transformar conhecimento em gabarito

Evitar estruturas como:

correct_answer
wrong_answer
expected_player_response

O conhecimento deve permitir que o Simulation Engine determine consequências.

Exemplo:

knowledge:
  adrenal_crisis
    treated_by:
      hydrocortisone

é conhecimento.

Já:

player_answer:
  hydrocortisone
score:
  +25

é gameplay.

⸻

39. Regra de não inversão

A arquitetura não deve depender de:

CASE → KNOWLEDGE

como processo principal.

O processo principal deve ser:

KNOWLEDGE → POSSIBILITIES → PATIENT → CASE

Casos antigos podem ser usados temporariamente como dados legados, testes ou material de migração.

Eles não devem definir o modelo futuro.

⸻

40. Compatibilidade com dados legados

Dados antigos podem possuir estruturas como:

id_caso
patologia_alvo
vinheta_admissao
fase_1_investigacao
fase_2_diagnostico
fase_3_conduta
discussao_clinica_final

Esses dados podem continuar funcionando temporariamente através de um adaptador.

Porém:

Compatibilidade com o legado não significa validação arquitetural do legado.

O objetivo é migrar progressivamente:

legacy case
↓
knowledge extraction
↓
normalized knowledge
↓
procedural case generation

⸻

41. Validação estrutural

Antes de aceitar uma Knowledge Base, verificar:

Estrutura

* JSON válido;
* schema válido;
* IDs únicos;
* tipos válidos;
* referências resolvíveis.

Semântica

* entidades não duplicadas;
* relações coerentes;
* aliases coerentes;
* ausência de casos específicos;
* ausência de gameplay;
* ausência de respostas inventadas.

Clínica

* afirmações importantes possuem fonte;
* doses possuem fonte;
* critérios possuem fonte;
* pontos de corte possuem fonte;
* contraindicações possuem fonte;
* recomendações controversas possuem contexto.

⸻

42. Validação de coerência clínica

Quando possível, verificar relações cruzadas.

Exemplo:

Se:

Disease A
→ causes
Finding B

e:

Disease A
→ does_not_associate_with
Finding B

existe conflito que precisa ser investigado.

Também verificar:

* contraindicação versus indicação;
* mecanismo versus efeito;
* diagnóstico versus achados;
* tratamento versus doença;
* complicação versus evolução;
* exames versus pergunta clínica.

⸻

43. Validação contra o documento original

Nenhuma informação importante deve ser adicionada apenas porque “parece médica”.

Para cada afirmação importante, deve existir uma destas situações:

supported_by_source

ou

supported_by_external_source

ou

explicitly_marked_as_inference

ou

explicitly_marked_as_uncertain

Nunca:

invented

⸻

44. Regras de escrita

Preferir:

* linguagem objetiva;
* termos médicos padronizados;
* frases curtas;
* conceitos atomicamente representados;
* relações explícitas;
* campos estruturados.

Evitar:

* textos excessivamente narrativos;
* floreios;
* explicações repetidas;
* linguagem direcionada ao jogador;
* frases que escondam múltiplos conceitos em um único campo.

⸻

45. Regras de atomicidade

Quando uma frase contiver vários conceitos, avaliar se eles devem ser separados.

Exemplo:

"A insuficiência adrenal causa hipotensão, hiponatremia,
hipercalemia e hiperpigmentação."

Pode ser decomposta em:

insuficiência_adrenal
→ associated_with → hipotensão
insuficiência_adrenal
→ associated_with → hiponatremia
insuficiência_adrenal
→ associated_with → hipercalemia
insuficiência_adrenal_primária
→ associated_with → hiperpigmentação

A decomposição deve preservar a precisão clínica.

⸻

46. Não exagerar na atomização

Atomicidade não significa transformar cada palavra em uma entidade.

A unidade deve ser clinicamente significativa.

Não criar entidades artificiais para:

"grave"
"muito"
"imediatamente"

quando essas palavras forem apenas qualificadores.

Representar intensidade, temporalidade e contexto nos campos apropriados.

⸻

47. Contexto clínico

Uma afirmação pode ser verdadeira apenas em determinado contexto.

Registrar quando relevante:

population
age
pregnancy
severity
acute_vs_chronic
inpatient_vs_outpatient
emergency_context
comorbidity

Evitar transformar recomendações contextuais em regras universais.

⸻

48. Regras de segurança epistemológica

Quando houver dúvida:

Preservar a dúvida é melhor do que inventar precisão.

Quando houver conflito:

Preservar o conflito é melhor do que apagá-lo silenciosamente.

Quando houver ausência:

Marcar ausência de conhecimento é melhor do que preencher com uma suposição.

Quando houver diferença semântica:

Preservar a diferença é melhor do que simplificar incorretamente.

⸻

49. Teste de reutilização

Uma Knowledge Base só deve ser considerada adequada se conseguir alimentar múltiplos casos diferentes.

Pergunta obrigatória:

“Consigo gerar mais de um paciente plausível usando esse conhecimento sem copiar uma vinheta existente?”

Se a resposta for não, provavelmente foi criado um caso em vez de conhecimento.

⸻

50. Teste de independência

Perguntar:

“Se eu remover todos os pacientes e todas as vinhetas, o conhecimento médico continua fazendo sentido?”

Se não, a estrutura está excessivamente dependente de casos.

⸻

51. Teste de generalização

Perguntar:

“A mesma entidade pode participar de casos diferentes?”

Exemplo:

hipotensão

deve poder aparecer em múltiplas condições.

Se uma entidade só existe porque pertence ao caso_01, a modelagem está inadequada.

⸻

52. Teste de separação de camadas

Antes de aceitar qualquer informação, perguntar:

Isso é conhecimento médico?

Se sim:

Knowledge Base

Isso é uma possibilidade para geração?

Se sim:

Patient Generator

Isso é um paciente concreto?

Se sim:

Patient State

Isso é uma situação específica entregue ao jogador?

Se sim:

Case

Isso depende de uma ação do jogador?

Se sim:

Simulation

Isso mede desempenho?

Se sim:

Evaluation

⸻

53. Proibição de leakage

A Knowledge Base não deve vazar a resposta de um caso específico.

Exemplo incorreto:

patient_generation:
  diagnosis: Addison

Exemplo aceitável:

candidate_conditions:
  - primary_adrenal_insufficiency
  - secondary_adrenal_insufficiency

O Generator pode utilizar essas possibilidades internamente.

O jogador não deve receber automaticamente essa informação.

⸻

54. Conhecimento oculto versus conhecimento apresentado

A Knowledge Base pode conter informações que não serão inicialmente apresentadas ao jogador.

Isso é esperado.

Exemplo:

Knowledge Base:
    diagnóstico
    fisiopatologia
    exames
    tratamento
    complicações

O caso inicial pode mostrar apenas:

queixa
contexto
alguns sinais
alguns achados

A Simulation Engine determina quais informações são observáveis em cada momento.

⸻

55. Observabilidade

Quando aplicável, conhecimento pode possuir dimensões como:

observable_initially
requires_physical_exam
requires_laboratory
requires_imaging
requires_history
requires_specific_question

Essas propriedades devem representar como a informação médica pode ser obtida, e não regras arbitrárias de pontuação.

⸻

56. Relação entre conhecimento e ação

O Knowledge Base não deve executar ações.

Ela descreve:

ação possível
+
indicação
+
efeito
+
riscos
+
consequências clínicas

O Simulation Engine posteriormente transforma uma ação do jogador em uma mudança no estado clínico.

⸻

57. Consequências clínicas

Quando suportado, representar consequências de intervenções.

Exemplo:

hydrocortisone
→ treats
cortisol_deficiency

e:

volume_replacement
→ improves
intravascular_volume

Isso permite ao Simulation Engine combinar intervenções.

Não codificar diretamente:

hydrocortisone → +25 points

⸻

58. Compatibilidade com diferentes modos

A mesma Knowledge Base deve poder alimentar:

Sala Vermelha
Clínica/Ambulatório
Follow-up

A diferença entre os modos não deve exigir duplicação do conhecimento.

O modo determina:

* contexto;
* observabilidade;
* urgência;
* disponibilidade de recursos;
* tempo;
* objetivos operacionais.

O conhecimento médico permanece compartilhado.

⸻

59. Follow-up

Quando a literatura fornecer informações de acompanhamento, elas devem ser armazenadas na Knowledge Base.

Exemplos:

* monitorização;
* tratamento crônico;
* investigação etiológica;
* prevenção;
* educação;
* recorrência;
* exames de acompanhamento.

O episódio de follow-up será controlado pelo sistema de episódios, não pela Knowledge Base.

⸻

60. Regras para transformação de PDFs

Ao processar um PDF:

1. identificar entidades
2. identificar relações
3. identificar mecanismos
4. identificar manifestações
5. identificar exames
6. identificar diagnóstico
7. identificar diferenciais
8. identificar tratamento
9. identificar complicações
10. identificar evolução
11. identificar seguimento
12. registrar fontes
13. detectar conflitos
14. deduplicar
15. validar
16. gerar JSON

Nunca:

PDF
↓
vinhetas
↓
casos
↓
gabaritos

⸻

61. Múltiplos PDFs do mesmo domínio

Quando processar vários documentos:

Documento A
Documento B
Documento C

o sistema deve:

1. extrair;
2. normalizar;
3. identificar entidades comuns;
4. consolidar;
5. identificar complementações;
6. identificar contradições;
7. registrar fontes;
8. gerar uma Knowledge Base única.

Não simplesmente concatenar JSONs.

⸻

62. Hierarquia de confiança

Quando fontes entrarem em conflito, considerar:

1. guideline ou consenso atual e específico;
2. órgão oficial;
3. sociedade médica;
4. revisão sistemática/meta-análise;
5. estudo primário;
6. material didático;
7. resumo secundário.

A hierarquia não substitui análise contextual.

Uma fonte de maior autoridade pode não responder à mesma pergunta clínica.

⸻

63. Conhecimento temporalmente sensível

Algumas informações mudam com o tempo.

Quando aplicável, registrar:

source_date
publication_date
last_verified
validity_context

Não assumir que uma recomendação antiga continua vigente.

⸻

64. Proibição de invenção estrutural

Não criar dados fictícios apenas para preencher campos do Schema.

Se não houver informação:

[]

ou:

null

ou estrutura equivalente definida pelo Schema.

Não preencher com:

"unknown"

quando o Schema tiver representação própria para ausência.

⸻

65. Proibição de preenchimento ornamental

Não adicionar conteúdo apenas para fazer o JSON parecer completo.

Qualidade é mais importante que quantidade.

Uma Knowledge Base pequena e rastreável é preferível a uma Knowledge Base enorme e parcialmente inventada.

⸻

66. Critério de qualidade

Uma Knowledge Base de alta qualidade deve ser:

* clinicamente coerente;
* reutilizável;
* modular;
* rastreável;
* atualizável;
* semanticamente precisa;
* capaz de representar relações;
* capaz de representar incerteza;
* independente de casos;
* independente de gameplay;
* adequada para geração procedural;
* adequada para simulação dinâmica.

⸻

67. Critério final de aceitação

Antes de considerar uma Knowledge Base pronta, verificar:

[ ] Não contém pacientes específicos
[ ] Não contém casos específicos
[ ] Não contém score
[ ] Não contém gameplay
[ ] Não contém fases de jogo
[ ] Não contém gabaritos de jogador
[ ] Entidades estão normalizadas
[ ] Relações estão representadas
[ ] Fisiopatologia está estruturada
[ ] Diagnóstico diferencial está estruturado
[ ] Exames possuem contexto
[ ] Tratamentos possuem contexto
[ ] Contraindicações possuem contexto
[ ] Complicações estão representadas
[ ] Seguimento está representado quando disponível
[ ] Patient generation contém possibilidades
[ ] Fontes estão rastreadas
[ ] Conflitos estão preservados
[ ] Incertezas estão preservadas
[ ] Não há informação inventada
[ ] JSON pode ser reutilizado para múltiplos casos

⸻

68. Axioma final

A Knowledge Base não deve responder:

“Qual é o caso?”

Ela deve responder:

“Quais entidades clínicas existem, como elas se relacionam, o que pode acontecer, como podemos observar isso, como podemos distinguir as possibilidades, como podemos intervir e como o quadro pode evoluir?”

A partir desse conhecimento:

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
EVALUATION

Esse é o princípio estrutural do Diagnosis.
