# DIAGNOSYS — CASE GENERATION PROTOCOL

## Objetivo

Definir o primeiro nível funcional do Diagnosys: gerar um caso clínico completo antes de iniciar a interação com o médico.

O caso é uma entidade interna completa. A interface revela progressivamente as informações conforme perguntas, exames e ações do usuário.

## Princípio central

A plataforma deve saber o caso inteiro; o usuário da plataforma não.

A geração deve separar três camadas:

1. **Conhecimento médico** — biblioteca local e fontes externas.
2. **Verdade do caso** — Clinical Case Model completo, incluindo informações ocultas.
3. **Estado de revelação** — o que já foi apresentado ao médico.

## Fluxo de geração

```text
GERAR CASO
    ↓
Selecionar domínio/caso da Knowledge Base
    ↓
Extrair conceito, anchors e requisitos
    ↓
Pesquisar fontes externas configuradas
    ↓
Normalizar evidências
    ↓
Construir Clinical Case Model
    ↓
Validar coerência
    ↓
Criar estado de revelação
    ↓
Apresentar somente a abertura do caso
```

## Seleção local antes da pesquisa

A pesquisa externa não escolhe aleatoriamente uma doença. Primeiro a biblioteca local fornece o caso/modelo que será enriquecido.

Exemplo:

```json
{
  "case_id": "ANEMIA_CASE_01",
  "primary_concept": "iron_deficiency_anemia",
  "anchors": [
    "fadiga",
    "microcitose",
    "pica",
    "perda gastrointestinal"
  ]
}
```

## Pesquisa externa

A pesquisa ocorre durante a geração e antes da apresentação do caso.

Cada fonte recebe consultas derivadas do conceito e dos anchors.

Dimensões mínimas:

- apresentação clínica;
- história e fatores de risco;
- exame físico;
- investigação diagnóstica;
- manejo;
- complicações/evolução.

## Fontes

As fontes são definidas em `docs/AI/CASE_RESEARCH_RULES.json` e não devem ficar codificadas dentro do Case Builder.

Configuração inicial pretendida:

- Manual MSD — Profissionais: `https://www.msdmanuals.com/pt/profissional/`
- Ministério da Saúde — PCDT: `https://www.gov.br/saude/pt-br/assuntos/pcdt`

A implementação deve respeitar os mecanismos de acesso disponíveis e não depender de scraping frágil. Quando uma fonte não puder ser consultada, o sistema deve registrar a falha em vez de inventar evidência.

## Construção do caso

O Case Builder combina:

```text
caso/modelo local
+
evidência externa
+
regras de coerência
=
Clinical Case Model
```

A pesquisa externa pode enriquecer ou validar a construção, mas não deve substituir a verdade específica do paciente.

## Caso completo

O objeto interno deve conter, quando aplicável:

- identificação;
- queixa principal;
- narrativa inicial;
- história completa;
- sintomas presentes e ausentes;
- antecedentes;
- fatores de risco;
- exame físico;
- sinais vitais;
- catálogo completo de exames disponíveis;
- resultado pré-construído para cada exame disponível;
- interpretação clínica associada quando definida;
- estado de realização/revelação de cada investigação;
- diagnóstico interno;
- fisiopatologia;
- diferenciais;
- condutas possíveis;
- consequências;
- evolução temporal;
- evidências usadas na construção.

## Apresentação inicial

A apresentação deve ser narrativa e clínica, não uma tabela JSON.

Exemplo de forma:

> Mulher, 58 anos, chega ao pronto-socorro acompanhada da filha, relatando dor e aumento de volume na perna esquerda iniciados no dia anterior.

### Sinais vitais

- PA: 138/84 mmHg
- FC: 96 bpm
- FR: 18 irpm
- SpO₂: 97% em ar ambiente
- Temperatura: 37,2 °C

### Queixa principal

> "Minha perna esquerda começou a doer e está muito inchada desde ontem."

O restante da história fica disponível internamente e será revelado conforme a interação clínica.

## Informações ocultas

Nunca apresentar automaticamente na abertura:

- diagnóstico interno;
- fisiopatologia interna;
- diferencial interno completo;
- resultados de exames ainda não solicitados/realizados;
- achados de exame físico ainda não obtidos;
- informações de anamnese ainda não perguntadas;
- consequências futuras ainda não ocorridas.

## Validação pré-apresentação

O caso somente pode ser apresentado se possuir:

- paciente identificável por idade/sexo ou equivalente;
- queixa principal;
- narrativa inicial;
- sinais vitais ou justificativa para ausência;
- estado inicial;
- verdade clínica interna;
- informações suficientes para permitir investigação;
- coerência entre história, exame, exames e diagnóstico interno;
- ausência de diagnóstico na apresentação inicial.

Caso a validação falhe, o caso deve ser rejeitado e reconstruído.

## Regra de não invenção

O sistema não deve transformar ausência de informação em informação clínica falsa.

Se uma fonte externa não responder a uma questão de conhecimento, o sistema deve declarar que a evidência não foi encontrada ou utilizar outra fonte configurada.

Se um exame não fizer parte do caso, o sistema não deve fabricar um resultado para responder ao médico.

Todo exame marcado como disponível no caso deve possuir um resultado definido durante a construção do Clinical Case Model. O resultado pode vir diretamente do caso, de um resultado esperado explicitamente definido ou de uma escolha determinística entre resultados possíveis declarados pelo próprio modelo do caso.

Depois que o caso é construído, o resultado fica congelado: a conversa apenas controla quando ele é revelado.

Assim:

GERAÇÃO DO CASO
    ↓
exame disponível
    ↓
resultado definido
    ↓
resultado congelado
    ↓
médico solicita exame
    ↓
resultado revelado

O Gemini e a camada conversacional podem apresentar o resultado naturalmente, mas não podem alterá-lo silenciosamente.

## Arquitetura

```text
Knowledge Base
      ↓
Case Selection
      ↓
External Research
      ↓
Evidence Layer
      ↓
Case Builder
      ↓
Clinical Case Model
      ↓
Patient State
      ↓
Clinical Conversation
```
