# DIAGNOSYS — PROTOCOLO DE CRIAÇÃO DE CASO CLÍNICO v1.0

## Princípio

O caso clínico não é uma cópia do JSON e não é uma resposta pronta.

O JSON define o espaço clínico. O gerador cria uma realização sintética, verossímil e mínima desse espaço.

Fluxo:

`KNOWLEDGE BASE → POSSIBILIDADES → PATOLOGIA → PACIENTE MÍNIMO → CASO → SIMULAÇÃO`

A invenção é necessária: nome, idade, combinação de apresentação e detalhes do paciente são sintéticos. O que não pode ser inventado livremente é a lógica médica que sustenta essas escolhas.

## Regra de criação

Para cada caso:

1. Ler o módulo clínico correspondente.
2. Ler `knowledge_entities`, `patient_generation`, `clinical_rules`, `diagnostic_network` e `source_registry`.
3. Identificar um conjunto de patologias/condições possíveis dentro daquele módulo.
4. Sortear uma patologia de maneira pseudoaleatória.
5. Construir somente a identidade clínica mínima:
   - iniciais sintéticas de 3–4 letras;
   - idade plausível;
   - sexo quando clinicamente pertinente;
   - queixa principal;
   - no máximo um fator de risco relevante;
   - um hábito somente se necessário para tornar a patologia plausível;
   - uma disfunção/limitação funcional somente se útil para a apresentação.
6. Manter o diagnóstico verdadeiro oculto do jogador.
7. Não despejar investigação, diagnóstico ou tratamento na abertura.
8. Preparar o contexto clínico oculto que permitirá responder às perguntas posteriormente.
9. Associar as referências locais e externas relevantes ao caso.
10. Se houver uma camada de pesquisa externa disponível, ela pode complementar o contexto. A pesquisa nunca substitui a Knowledge Base nem deve bloquear a abertura do caso.
11. Validar coerência antes de entregar o caso.

## Exemplo CM1 — Síndrome Ictérica

O CM1 define, entre outras possibilidades hepatocelulares, hepatites virais, hepatite alcoólica, cirrose, EBV, CMV, HSV, doença de Wilson e doença hepática autoimune.

Uma realização mínima poderia ser:

- Patologia sorteada: hepatite alcoólica.
- Paciente: `R.A.`
- Idade: adulto, escolhida de acordo com o contexto epidemiológico disponível.
- Queixa: "Estou ficando amarelo."
- Fator de risco: consumo crônico de álcool, quando necessário para sustentar a hipótese.
- Disfunção opcional: redução da tolerância ao álcool/limitação funcional relacionada ao quadro, somente se clinicamente coerente.

A abertura não precisa trazer AST, ALT, bilirrubinas, INR, ultrassom etc.

Esses elementos pertencem ao estado clínico oculto e podem ser revelados progressivamente quando o jogador perguntar ou solicitar investigação.

## Verossimilhança

"Inventado" não significa arbitrário.

O gerador deve:

- preferir faixas etárias e apresentações documentadas;
- respeitar relações causais presentes no conhecimento;
- não inventar uma manifestação incompatível com a patologia;
- não transformar uma associação em regra absoluta;
- evitar hábitos ou detalhes sociais decorativos;
- manter o número de informações iniciais pequeno;
- permitir que diferentes perguntas revelem diferentes partes do mesmo paciente.

## Pesquisa externa

Fontes externas são complementares.

Prioridade:

1. Knowledge Base canônica;
2. referências embutidas no módulo;
3. catálogos/referências locais do Diagnosis;
4. fontes externas configuradas;
5. modelo generativo, somente quando explicitamente autorizado.

O caso deve continuar funcionando se a pesquisa externa falhar.

## Saída mínima

O gerador deve produzir pelo menos:

`case_id`, `patient.initials`, `patient.age`, `patient.sex`,
`presentation.chief_complaint`, `presentation.initial_narrative`,
`history.risk_factors`, `hidden.diagnosis`,
`clinical_truth` e `reference_context`.

O jogador vê somente a camada de apresentação apropriada. A verdade clínica e as referências ficam no estado interno.

## Regra de ouro

**Criar pouco no começo. Conhecer muito por baixo. Revelar progressivamente.**

Essa separação é o que permite que o mesmo conhecimento produza muitos pacientes diferentes sem transformar a Knowledge Base em um banco de casos.
