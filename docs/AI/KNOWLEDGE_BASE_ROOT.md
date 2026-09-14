DIAGNOSIS — KNOWLEDGE BASE ROOT

1. DEFINIÇÃO

A Knowledge Base do Diagnosis é uma representação estruturada de conhecimento médico reutilizável.

Ela não representa casos clínicos específicos.

Ela não representa pacientes específicos.

Ela representa o espaço de possibilidades clínicas que pode ser utilizado posteriormente pelo motor de simulação.

Princípio central:

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

Forma resumida:

KNOWLEDGE → POSSIBILITIES → PATIENT → CASE → SIMULATION

⸻

2. FUNÇÃO DA KNOWLEDGE BASE

A Knowledge Base deve responder:

* O que existe?
* Como as entidades se relacionam?
* O que causa o quê?
* O que aumenta ou reduz a probabilidade de determinada condição?
* Quais manifestações podem ocorrer?
* Quais alterações fisiológicas podem ocorrer?
* Quais alterações laboratoriais podem ocorrer?
* Quais exames podem ser utilizados?
* Quais resultados podem aparecer?
* Quais diagnósticos diferenciais existem?
* O que diferencia esses diagnósticos?
* Quais tratamentos existem?
* Quando cada tratamento é indicado?
* Quais são os riscos?
* Quais são as contraindicações?
* Quais complicações podem ocorrer?
* Como a condição evolui?
* Quais padrões de apresentação são possíveis?

Ela deve fornecer conhecimento suficiente para que outro componente do sistema possa posteriormente gerar pacientes e casos.

⸻

3. O QUE A KNOWLEDGE BASE NÃO É

A Knowledge Base não é:

casos clínicos
pacientes
questões
provas
flashcards
roteiros
fases de jogo
diálogos
pontuações
respostas esperadas
gabaritos

Nunca transformar conhecimento em caso apenas para preencher o JSON.

⸻

4. UNIDADE FUNDAMENTAL

A unidade fundamental da Knowledge Base é a entidade médica.

Exemplos:

doença
síndrome
sintoma
sinal
achado
etiologia
fator de risco
mecanismo
processo fisiológico
exame
achado laboratorial
achado de imagem
medicamento
tratamento
procedimento
complicação
diagnóstico diferencial
estado fisiológico

Uma entidade deve representar um conceito médico reutilizável.

⸻

5. IDENTIDADE CANÔNICA

Cada entidade deve possuir uma identidade canônica estável.

Exemplo:

insuficiencia_adrenal_primaria

Pode possuir aliases:

Doença de Addison
Insuficiência adrenal primária
Addison

Os aliases não devem criar entidades duplicadas quando representam o mesmo conceito.

⸻

6. RELAÇÕES

A Knowledge Base não deve ser apenas uma coleção de entidades isoladas.

As relações entre entidades são parte fundamental do conhecimento.

Exemplos:

causes
leads_to
associated_with
predisposes_to
increases_risk_of
decreases_risk_of
increases
decreases
results_in
characterized_by
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

Exemplo:

deficiência_de_aldosterona
        ↓
leva a
        ↓
perda renal de sódio
        ↓
leva a
        ↓
hiponatremia

⸻

7. FISIOPATOLOGIA

A fisiopatologia deve ser representada sempre que possível como relações causais.

Não armazenar somente explicações narrativas.

Preferir:

CAUSA
 ↓
MECANISMO
 ↓
ALTERAÇÃO FISIOLÓGICA
 ↓
ACHADO
 ↓
MANIFESTAÇÃO CLÍNICA

Exemplo:

deficiência de cortisol
 ↓
redução da responsividade vascular às catecolaminas
 ↓
vasoplegia
 ↓
hipotensão
 ↓
choque

⸻

8. PADRÕES CLÍNICOS

Uma entidade pode possuir múltiplos padrões clínicos.

Exemplo:

agudo
subagudo
crônico
agudo sobre crônico
leve
moderado
grave
fulminante
assintomático
incidental
atípico

Esses padrões representam possibilidades.

Não representam pacientes específicos.

⸻

9. DIMENSÃO TEMPORAL

Quando relevante, representar a evolução temporal:

onset
progression
acute_phase
subacute_phase
chronic_phase
relapse
remission
post_treatment
complication_phase
follow_up

A dimensão temporal é importante porque o mesmo paciente pode apresentar estados diferentes ao longo do tempo.

⸻

10. DIMENSÃO FISIOLÓGICA

Quando possível, representar alterações fisiológicas de forma estruturada.

Exemplos:

blood_pressure → decreased
heart_rate → increased
sodium → decreased
potassium → increased
cortisol → decreased
ACTH → increased

Não assumir valores numéricos quando o material não os fornece.

⸻

11. EXAMES

Um exame não deve ser armazenado somente pelo nome.

Quando possível, representar:

exame
↓
indicação
↓
pergunta clínica
↓
resultado possível
↓
interpretação
↓
impacto diagnóstico

Exemplo:

cortisol
    ↓
avaliação da função adrenal
    ↓
cortisol reduzido
    ↓
apoia insuficiência adrenal

⸻

12. DIAGNÓSTICO

Diagnóstico deve ser tratado como redução de incerteza.

A Knowledge Base deve fornecer:

manifestação
↓
hipótese
↓
investigação
↓
resultado
↓
atualização da probabilidade
↓
diagnóstico diferencial

Evitar modelos binários simplistas de:

certo / errado

quando a medicina real exigir interpretação contextual.

⸻

13. DIFERENCIAL DIAGNÓSTICO

Diagnósticos diferenciais devem ser relacionados por:

características compartilhadas
características discriminatórias
exames úteis
achados contra
achados favoráveis
contexto clínico

O objetivo é permitir raciocínio diferencial futuro.

⸻

14. TRATAMENTO

Tratamentos devem representar conhecimento clínico.

Sempre que possível:

tratamento
↓
indicação
↓
objetivo
↓
mecanismo
↓
contexto
↓
riscos
↓
contraindicações
↓
monitorização

Não incluir:

pontuação
gabarito
resposta esperada

Esses elementos pertencem ao motor de avaliação.

⸻

15. COMPLICAÇÕES

Complicações devem ser representadas como possibilidades relacionadas ao estado clínico.

Exemplo:

doença
 ↓
complicação
 ↓
mecanismo
 ↓
manifestações
 ↓
investigação
 ↓
manejo

Isso permitirá que o paciente evolua dinamicamente no futuro.

⸻

16. PATIENT GENERATION

A Knowledge Base pode fornecer parâmetros para geração de pacientes.

Exemplo:

possible_demographics
possible_risk_factors
possible_presentations
possible_severities
possible_temporal_patterns
possible_findings
possible_complications

Esses campos representam espaços de possibilidade.

Nunca devem representar um paciente específico.

⸻

17. REGRAS CLÍNICAS

A Knowledge Base pode conter regras médicas.

Exemplo:

SE
determinadas condições clínicas estão presentes
ENTÃO
determinada consequência clínica é possível ou provável

Essas regras devem representar medicina.

Não devem representar mecânicas do jogo.

⸻

18. SEPARAÇÃO ENTRE MEDICINA E JOGO

A Knowledge Base não deve conter:

score
points
player_answer
correct_answer
wrong_answer
phase
game_over
hint_cost
reward

Esses elementos pertencem aos módulos de:

Simulation
Evaluation
UI

⸻

19. SEPARAÇÃO ENTRE CONHECIMENTO E LINGUAGEM

A linguagem utilizada pelo jogador é uma camada diferente do conhecimento.

Arquitetura:

PLAYER LANGUAGE
      ↓
INTENT
      ↓
CLINICAL ACTION
      ↓
KNOWLEDGE
      ↓
CONSEQUENCE

A Knowledge Base não precisa conhecer todas as formas possíveis de o jogador escrever uma ação.

Essa responsabilidade pertence ao interpretador de intenção.

⸻

20. SEMÂNTICA CLÍNICA

Não assumir equivalência entre conceitos apenas por semelhança linguística.

Exemplos:

TC ≠ angio-TC ≠ RM
oxigênio ≠ VNI ≠ intubação
anticoagulação ≠ trombólise ≠ trombectomia
corticoide ≠ hidrocortisona

Equivalências devem ser estabelecidas somente quando clinicamente justificadas.

⸻

21. INCERTEZA

A Knowledge Base deve permitir incerteza.

Uma informação pode ser:

strong
moderate
weak
context_dependent
uncertain
unknown

A ausência de informação não deve ser preenchida por invenção.

⸻

22. FONTES

Toda informação importante deve possuir rastreabilidade.

As fontes podem ser:

provided_document
external_guideline
scientific_article
institutional_source
derived_relationship

Quando uma informação vier de material fornecido pelo usuário, preservar a origem.

Quando vier de pesquisa externa, registrar a fonte externa.

Quando for uma relação inferida, indicar que é derivada.

⸻

23. MÚLTIPLOS DOCUMENTOS

Quando vários documentos tratam do mesmo assunto:

DOCUMENTO A
DOCUMENTO B
DOCUMENTO C
       ↓
EXTRAÇÃO
       ↓
NORMALIZAÇÃO
       ↓
CONSOLIDAÇÃO
       ↓
ENTIDADE ÚNICA

Evitar duplicação.

Não sobrescrever silenciosamente conflitos.

⸻

24. CONFLITOS

Se duas fontes apresentarem informações diferentes:

SOURCE A
   ↓
CLAIM A
SOURCE B
   ↓
CLAIM B
      ↓
CONFLICT

Registrar o conflito.

Se houver evidência suficiente para resolver, registrar a resolução.

Caso contrário:

uncertain

⸻

25. ATUALIZAÇÃO

A Knowledge Base deve ser atualizável.

Novos documentos devem poder:

adicionar conhecimento
corrigir conhecimento
refinar conhecimento
adicionar relações
adicionar diferenciais
adicionar tratamentos
adicionar complicações

sem destruir conhecimento anterior válido.

⸻

26. GENERALIZAÇÃO

Uma estrutura só deve ser considerada adequada se puder funcionar em múltiplos domínios.

Testar conceitualmente:

Cardiologia
Endocrinologia
Neurologia
Pneumologia
Reumatologia

Se uma estrutura funciona somente para uma doença, ela provavelmente está excessivamente específica.

⸻

27. REGRA DE NÃO INVERSÃO

Nunca fazer:

CASO
 ↓
CONHECIMENTO

como arquitetura principal.

O fluxo principal deve ser:

CONHECIMENTO
 ↓
POSSIBILIDADES
 ↓
PACIENTE
 ↓
CASO

Casos antigos podem ser utilizados como material auxiliar ou legado, mas não definem a estrutura fundamental da Knowledge Base.

⸻

28. PRINCÍPIO DE REUTILIZAÇÃO

O mesmo conhecimento deve poder gerar múltiplos casos.

Exemplo:

UMA DOENÇA
    ↓
MÚLTIPLOS PADRÕES
    ↓
MÚLTIPLAS SEVERIDADES
    ↓
MÚLTIPLOS PACIENTES
    ↓
MÚLTIPLOS CASOS
    ↓
MÚLTIPLAS TRAJETÓRIAS

Esse é um dos objetivos centrais do Diagnosis.

⸻

29. RELAÇÃO COM O SIMULADOR

A Knowledge Base não executa a simulação.

Ela fornece o conhecimento que o simulador utiliza.

Arquitetura:

KNOWLEDGE BASE
      ↓
CLINICAL MODEL
      ↓
CASE GENERATOR
      ↓
PATIENT STATE
      ↓
ACTION
      ↓
CONSEQUENCE
      ↓
NEW STATE

⸻

30. PRINCÍPIO DE INTEGRIDADE

Se uma alteração proposta fizer a Knowledge Base começar a representar diretamente:

* pacientes específicos;
* casos fixos;
* gabaritos;
* pontuação;
* fases;
* mecânicas de jogo;

a alteração deve ser considerada uma possível violação arquitetural.

Reavaliar antes de implementar.

⸻

31. REGRA FINAL

A Knowledge Base deve responder:

“O que a medicina permite que aconteça?”

O Case Generator responde:

“Qual paciente específico vamos criar?”

O Simulation Engine responde:

“O que acontece depois que o médico age?”

O Evaluation Engine responde:

“Quão adequada foi a decisão?”

Essas responsabilidades não devem ser confundidas.

⸻

32. AXIOMA DO DIAGNOSIS

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

A Knowledge Base contém o espaço clínico.

O motor transforma esse espaço em experiência.
