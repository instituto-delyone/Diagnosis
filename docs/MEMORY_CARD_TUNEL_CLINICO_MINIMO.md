# MEMORY CARD — DIAGNOSYS · TÚNEL CLÍNICO MÍNIMO

## Status

**Estado:** FUNCIONAL / PONTO DE REFERÊNCIA  
**Objetivo:** preservar a rota mínima que recuperou o funcionamento do Diagnosis depois da arquitetura ampla ter se tornado difícil de depurar.

> **Regra central:** não consertar o castelo inteiro. Usar o túnel como rota controlada e religar componentes somente quando uma necessidade concreta aparecer.

---

## 1. O problema que motivou o túnel

A arquitetura anterior havia acumulado muitos módulos, fallbacks e caminhos de compatibilidade para produzir um único caso clínico.

Isso tornou difícil responder à pergunta fundamental:

> **Qual é o caminho mínimo necessário para gerar um caso clínico e conversar com ele?**

A estratégia adotada foi deixar os arquivos antigos no repositório, mas criar uma rota nova que não depende deles.

Metáfora operacional:

**Castelo → chave perdida → túnel → acesso funcional → religação gradual das salas.**

---

## 2. O que foi preservado

A interface visual principal foi mantida conceitualmente, especialmente a região superior do jogo:

- Diagnóstico / Diagnosis Engine
- ambiente clínico
- frequência cardíaca
- frequência respiratória
- SpO₂
- pressão arterial
- temperatura
- glicemia
- monitor cardiorrespiratório / ECG simulado
- estabilidade
- pontuação
- dificuldade
- estado do caso
- caso clínico
- evolução clínica
- investigações
- diagnóstico
- log da conversa

A aparência foi simplificada, mas a experiência essencial do jogo permanece reconhecível.

---

## 3. O que foi desligado da rota do túnel

Os arquivos antigos **não foram apagados**.

Eles permanecem disponíveis para futura religação, mas a página do túnel não os carrega.

A rota mínima não depende de:

- engine.js antigo
- diagnosis-bootstrap.js
- case-preparation-engine.js
- knowledge-base-adapter.js
- knowledge-to-patient-engine.js
- clinical-action-runtime.js
- clinical-action-resolver.js
- clinical-intent-remote-router.js
- CaseLibrary
- CaseBuilder
- UMLS
- Gemini
- pesquisa remota automática
- research engine
- fallbacks de compatibilidade
- carregamento das demais CMs
- cadeia extensa de módulos legados

**Princípio:** arquivo existente não significa arquivo ativo.

---

## 4. Os únicos componentes ativos do túnel

### Interface

`docs/diagnosis.html`

A página contém a interface limpa e carrega somente:

`Js/tunnel-engine.js`

### Motor

`docs/Js/tunnel-engine.js`

É o controlador do experimento mínimo.

### Conhecimento clínico

Inicialmente apenas:

`docs/knowledge_base/DIAGNOSIS_CM01_SINDROME_ICTERICA_v0.3.json`

Portanto:

**HTML → Tunnel Engine → CM01 JSON**

Esse é o caminho-base.

---

## 5. O que o túnel faz

Fluxo atual:

```
CM01 JSON
   ↓
possibilidades clínicas
   ↓
patologia selecionada
   ↓
paciente sintético
   ↓
caso clínico mínimo
   ↓
perguntas
   ↓
respostas
   ↓
exames sob demanda
   ↓
hipótese diagnóstica
   ↓
avaliação
```

O paciente é uma realização sintética do espaço clínico.

**Inventar não significa arbitrariedade.**

A invenção serve para criar uma instância verossímil a partir do conhecimento disponível.

---

## 6. Caso clínico mínimo

O túnel gera:

- iniciais sintéticas de 3 letras;
- idade;
- sexo;
- queixa principal;
- fator/contexto de risco;
- achados físicos mínimos;
- sinais vitais;
- conjunto de investigações ocultas;
- diagnóstico verdadeiro oculto.

Exemplo observado no teste:

**CAI, 46 anos, feminino.**  
**“Estou ficando amarelo e me sentindo mal.”**

A patologia verdadeira permaneceu oculta.

---

## 7. Conversação

O jogador pode perguntar diretamente.

Exemplos testados:

- “Qual a idade?”
- “Você sente dor?”
- “Você tem outra doença?”
- “Como está o exame físico abdominal?”
- “Há quanto tempo se sente assim?”
- “Há um sinal de doença das vias biliares?”

Perguntas cobertas recebem resposta.

Perguntas ainda não cobertas **não recebem um fallback artificial**.

O sistema responde:

> “Pergunta ainda não coberta. Isso é proposital: agora sabemos exatamente onde conectar o próximo componente.”

Essa frase é importante para a arquitetura.

O desconhecido virou **instrumento de depuração**.

---

## 8. Investigações

Os exames ficam disponíveis na interface, mas o resultado não é revelado antes da solicitação.

Exemplo:

- Bilirrubina total e frações
- AST/ALT
- Fosfatase alcalina e GGT
- Albumina e TP/INR
- Ultrassonografia abdominal
- Exame etiológico dirigido

Ao solicitar o exame, o resultado aparece.

Exemplo observado:

**Bilirrubina total e frações → Bilirrubina direta predominante**

Outro exemplo:

**Exame etiológico dirigido → AST elevada e maior que ALT**

---

## 9. Diagnóstico

O jogador pode registrar a hipótese.

Exemplo testado:

**hepatite alcoólica**

O túnel compara a hipótese registrada com a verdade clínica interna e retorna uma avaliação.

No teste:

**“Hipótese coerente com a verdade clínica.”**

---

## 10. Gemini

### Estado atual

**FORA DA ROTA DO TÚNEL.**

Gemini não é requisito para:

- gerar o paciente;
- gerar a apresentação;
- responder perguntas básicas;
- revelar exames;
- registrar diagnóstico;
- avaliar a hipótese.

Isso é deliberado.

Se Gemini voltar futuramente, deverá entrar como **componente adicional**, nunca como dependência invisível do caminho mínimo.

---

## 11. Fallbacks

O túnel adota uma política diferente da arquitetura anterior.

### Não fazer

```
componente ausente
   ↓
fallback
   ↓
outro fallback
   ↓
outro módulo
   ↓
modelo remoto
   ↓
resultado aparentemente funcional
```

### Fazer

```
componente ausente
   ↓
declarar a lacuna
   ↓
registrar exatamente o que faltou
   ↓
conectar apenas o componente necessário
```

Assim, cada falha vira informação arquitetural.

---

## 12. Regra de expansão

Não religar arquivos por antecipação.

A próxima camada só entra quando houver uma necessidade observada no túnel.

Exemplo:

> “O sistema não sabe responder duração da icterícia.”

Então não se liga 15 módulos.

Primeiro se pergunta:

**Qual fonte mínima contém essa informação?**

Conecta-se essa fonte.

Depois testa-se novamente.

---

## 13. Critério de sucesso de cada nova camada

Cada componente novo precisa provar uma capacidade concreta.

Exemplo:

### Camada 1
Gerar paciente.

### Camada 2
Responder anamnese.

### Camada 3
Responder exame físico.

### Camada 4
Gerar/revelar exames.

### Camada 5
Reconhecer padrões clínicos.

### Camada 6
Evoluir o paciente.

### Camada 7
Produzir consequências das ações.

### Camada 8
Avaliar raciocínio clínico.

Somente depois disso se decide quais componentes antigos merecem ser religados.

---

## 14. Invariantes do túnel

Qualquer expansão deve preservar:

1. O jogo abre.
2. Um caso é criado.
3. O diagnóstico verdadeiro fica oculto.
4. O jogador consegue conversar com o paciente.
5. Exames são revelados sob demanda.
6. A hipótese pode ser registrada.
7. O caso pode ser encerrado.
8. Um novo caso pode ser iniciado.
9. A rota mínima não depende de Gemini.
10. Uma falha não deve acionar uma cascata de fallbacks invisíveis.

---

## 15. Arquitetura conceitual

A arquitetura mínima recuperada é:

```
CONHECIMENTO
    ↓
POSSIBILIDADES
    ↓
PATOLOGIA
    ↓
PACIENTE SINTÉTICO
    ↓
CASO MÍNIMO
    ↓
INTERAÇÃO
    ↓
ESTADO CLÍNICO
```

Não existe obrigação de materializar milhares de casos previamente.

O caso é uma realização do conhecimento.

---

## 16. Ponto de referência atual

### Commit da interface do túnel

`078d93ae90e6df2f6a31db428ca91c28a0c031dd`

### Commit do motor do túnel

`90c7cd5c1c2a208e344f80f354c7e4fb0e7c5c84`

Esses commits representam o primeiro estado funcional observado do túnel.

---

## 17. Estado observado no teste

O teste manual demonstrou:

- CM01 carregado;
- caso sintético criado;
- paciente identificado por iniciais;
- idade apresentada;
- queixa apresentada;
- pergunta sobre idade respondida;
- pergunta sobre dor respondida;
- fator de risco recuperado;
- exames solicitados;
- resultados revelados;
- hipótese diagnóstica registrada;
- hipótese avaliada;
- pergunta não coberta identificada sem fallback;
- interface e monitor funcionando.

---

## 18. Regra de ouro

> **Primeiro fazemos funcionar com o mínimo. Depois fazemos o mínimo saber mais.**

Ou, na linguagem do túnel:

> **Não religar o castelo. Descobrir primeiro qual sala realmente precisamos.**

---

## 19. Nota de continuidade

O usuário relatou que a interação/conversa ficou mais confortável e menos estressante depois da redução radical da complexidade.

Isso reforça uma observação operacional importante:

**a redução de complexidade não melhorou apenas a depuração do código; ela também melhorou a experiência de trabalhar no projeto.**

Esse efeito deve ser preservado.

---

## 20. Próximo passo recomendado

Não ampliar a arquitetura ainda.

Primeiro consolidar o túnel com mais testes pequenos.

A sequência natural é:

**perguntas → exame físico → tempo de evolução → sintomas associados → exames → padrão clínico → diagnóstico → evolução.**

Cada novo passo deve ser pequeno, observável e reversível.
