# DIAGNOSYS — CASE PRESENTATION PROTOCOL

## Finalidade

Definir o que o médico vê quando um caso é gerado e o que permanece exclusivamente no estado interno da plataforma.

## Regra fundamental

> A plataforma conhece o caso completo; o usuário descobre o caso progressivamente.

A apresentação inicial não é uma descoberta compartilhada. O Clinical Case Model já contém a verdade do paciente. O runtime apenas controla a revelação.

## Apresentação inicial

A abertura deve conter, quando disponíveis:

- ambiente de atendimento;
- idade;
- sexo;
- contexto de chegada;
- queixa principal;
- narrativa inicial;
- sinais vitais iniciais;
- condição clínica observável no primeiro contato.

## Não revelar automaticamente

A abertura não deve apresentar:

- diagnóstico interno;
- diagnóstico diferencial interno;
- fisiopatologia interna;
- resultados de exames ainda não solicitados;
- achados de exame físico que exigiriam exame ainda não realizado;
- respostas de anamnese ainda não obtidas;
- complicações futuras;
- evolução futura;
- "macetes" da biblioteca que entreguem o diagnóstico.

## Revelação progressiva

Informações devem ser liberadas conforme a ação do médico:

```text
pergunta de anamnese
    ↓
resposta correspondente

solicitação de exame físico
    ↓
achado correspondente

solicitação de exame
    ↓
resultado do exame definido para aquele paciente

intervenção
    ↓
consequência clínica

passagem de tempo
    ↓
evolução do caso
```

## Exame disponível versus exame realizado

O caso pode saber internamente quais exames estão disponíveis no ambiente.

Isso não significa que seus resultados já estejam revelados.

```text
available = true
performed = false
result = definido internamente ou gerável por regra válida
```

Ao solicitar o exame, o runtime registra a realização e revela o resultado correspondente.

## Exame não disponível

Se o médico solicitar um exame que não pertence ao conjunto de recursos daquele cenário, o sistema deve informar que o exame não está disponível naquele ambiente. Não deve fabricar um resultado.

## Perguntas clínicas

Perguntas naturais devem ser interpretadas pelo significado da frase e pelo contexto, não por palavra isolada.

Exemplos equivalentes:

- "Tem icterícia?"
- "Há icterícia?"
- "O paciente está ictérico?"
- "Apresenta sinais de icterícia?"

devem consultar o mesmo estado clínico quando semanticamente equivalentes.

## Apresentação narrativa

A interface deve preferir uma narrativa clínica legível a uma impressão direta do JSON.

Exemplo:

> Mulher, 58 anos, chega ao pronto-socorro acompanhada da filha, relatando dor e aumento de volume na perna esquerda iniciados no dia anterior.

### Sinais vitais

- PA: 138/84 mmHg
- FC: 96 bpm
- FR: 18 irpm
- SpO₂: 97% em ar ambiente
- Temperatura: 37,2 °C

## Fontes de conhecimento

Quando pesquisa externa tiver participado da construção, a interface pode exibir uma área de fontes/conhecimento carregado sem revelar o diagnóstico oculto.

A fonte usada para construir o caso não deve aparecer como uma pista diagnóstica involuntária.

## Princípio de consistência

Toda informação revelada deve ser compatível com o mesmo Clinical Case Model.

O sistema não pode responder uma pergunta de um campo e outra pergunta de um campo incompatível com ele.

## Princípio de assimetria de informação

```text
PLATAFORMA
100% do caso

MÉDICO
somente informações reveladas até o momento
```

A assimetria de informação é uma característica essencial da simulação.
