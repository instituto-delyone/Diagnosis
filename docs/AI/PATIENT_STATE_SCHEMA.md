PATIENT STATE — Clinical Data Contract

**Version:** 1.0

## 1. Fundamental principle

O paciente não é o diagnóstico e não é um caso pré-fabricado.

A Knowledge Base define o espaço clínico. O Patient Generator seleciona uma apresentação possível e cria o Patient State.

```text
KNOWLEDGE
   ↓
POSSIBILITIES
   ↓
PATIENT GENERATOR
   ↓
PATIENT STATE
   ↓
CLINICAL INTERACTION
```

**O diagnóstico pode estar oculto. A queixa nunca deve estar ausente.**

A situação inicial deve apresentar um problema clínico real. Não deve ser apenas:

> “A doença não é revelada. Investigue, formule hipóteses e conduza o paciente.”

Essa frase pode existir como instrução da simulação **depois** da apresentação, mas não substitui a queixa.

Exemplo correto:

> ENFERMAGEM  
> Paciente masculino, 64 anos, encaminhado por dor no peito iniciada há aproximadamente 1 hora, associada a falta de ar e sudorese.  
> Deseja aceitar o atendimento?

Depois da aceitação:

> A doença subjacente não é revelada. Investigue o paciente e conduza a avaliação clínica.

---

## 2. Estrutura mínima do Patient State

```json
{
  "id": "generated_patient_id",

  "demographics": {
    "age": 64,
    "sex": "male"
  },

  "presentation": {
    "chief_complaint": {
      "symptoms": [
        "dor_toracica",
        "dispneia",
        "sudorese"
      ],
      "narrative": "Dor no peito iniciada há aproximadamente 1 hora, associada a falta de ar e sudorese."
    },

    "onset": {
      "type": "acute",
      "description": "há aproximadamente 1 hora"
    },

    "context": {
      "arrival_mode": "encaminhado_pela_enfermagem"
    }
  },

  "history": {
    "past_medical_history": [],
    "medications": [],
    "allergies": [],
    "family_history": [],
    "social_history": []
  },

  "vitals": {
    "heart_rate": null,
    "respiratory_rate": null,
    "blood_pressure": null,
    "oxygen_saturation": null,
    "temperature": null,
    "glucose": null
  },

  "physical_exam": {
    "general": {},
    "cardiovascular": {},
    "respiratory": {},
    "neurologic": {},
    "other": {}
  },

  "investigations": {
    "laboratory": {},
    "ecg": null,
    "imaging": {},
    "other": {}
  },

  "hidden_state": {
    "diagnosis": null,
    "severity": null,
    "pathophysiology": {},
    "complications": [],
    "evolution": {}
  }
}
```

## 3. Initial presentation

Todo paciente de simulação clínica deve chegar com um problema.

Normalmente, o gerador selecionará **1–3 sintomas iniciais** clinicamente coerentes.

Exemplos:

- dor torácica + sudorese
- dispneia + tosse
- fraqueza em membro + alteração da fala
- cefaleia + vômitos
- dor abdominal + náuseas

A combinação deve ser compatível com as possibilidades clínicas existentes na Knowledge Base.

A apresentação não deve revelar explicitamente o diagnóstico.

---

## 4. Demographics

Contém características básicas:

```json
{
  "age": 64,
  "sex": "male"
}
```

Podem ser acrescentados posteriormente outros fatores demográficos relevantes.

---

## 5. Chief complaint

A queixa principal representa o motivo que levou o paciente ao atendimento.

```json
"chief_complaint": {
  "symptoms": ["dor_toracica", "dispneia"],
  "narrative": "Dor no peito acompanhada de falta de ar."
}
```

A narrativa deve parecer uma apresentação clínica real, e não uma mensagem do sistema.

---

## 6. Onset

Descreve quando e como os sintomas começaram.

```json
"onset": {
  "type": "acute",
  "description": "há aproximadamente 1 hora"
}
```

Tipos possíveis incluem:

- acute
- subacute
- chronic
- recurrent
- progressive

Os valores permitidos devem respeitar o conhecimento clínico da entidade.

---

## 7. Context

Descreve como o paciente chegou ao médico:

- chegada espontânea
- ambulância
- encaminhamento
- enfermagem
- transferência
- consulta ambulatorial
- avaliação pós-operatória

O contexto não deve revelar automaticamente o diagnóstico.

---

## 8. History

Informações interrogáveis:

```json
"history": {
  "past_medical_history": [],
  "medications": [],
  "allergies": [],
  "family_history": [],
  "social_history": []
}
```

O Interlocutor deve recuperar esses dados do Patient State quando o médico perguntar.

Exemplos:

- “Tem alguma doença?”
- “Usa algum medicamento?”
- “É alérgico?”
- “Fuma?”
- “Já teve isso antes?”

Não deve inventar respostas fora do estado do paciente.

---

## 9. Vital signs

```json
"vitals": {
  "heart_rate": null,
  "respiratory_rate": null,
  "blood_pressure": null,
  "oxygen_saturation": null,
  "temperature": null,
  "glucose": null
}
```

Um valor pode existir internamente sem ser automaticamente mostrado.

Modelo:

```text
KNOWN INTERNALLY
      ↓
AVAILABLE TO REVEAL
      ↓
REVEALED TO PHYSICIAN
```

---

## 10. Physical examination

```json
"physical_exam": {
  "general": {},
  "cardiovascular": {},
  "respiratory": {},
  "neurologic": {},
  "other": {}
}
```

Pode conter:

- estado geral
- estado mental
- perfusão
- ausculta cardíaca
- ausculta pulmonar
- esforço respiratório
- exame neurológico
- edema
- achados abdominais
- outros achados pertinentes

---

## 11. Investigations

```json
"investigations": {
  "laboratory": {},
  "ecg": null,
  "imaging": {},
  "other": {}
}
```

Exemplos:

```text
“Solicito hemograma.”
→ resultado do hemograma

“Solicito troponina.”
→ resultado da troponina

“Faça um ECG.”
→ resultado do ECG

“Solicito radiografia de tórax.”
→ resultado da imagem
```

Nem todos os exames devem ser automaticamente revelados.

---

## 12. Hidden state

Contém informações verdadeiras sobre o paciente que não são inicialmente disponíveis ao médico:

```json
"hidden_state": {
  "diagnosis": null,
  "severity": null,
  "pathophysiology": {},
  "complications": [],
  "evolution": {}
}
```

Inclui potencialmente:

- diagnóstico verdadeiro
- fisiopatologia
- gravidade
- complicações
- trajetória clínica
- resposta esperada às intervenções

O hidden state nunca deve ser impresso diretamente na apresentação inicial.

---

## 13. Information layers

### Inicialmente revelado

```text
idade
sexo
queixa principal
1–3 sintomas iniciais
contexto básico
```

### Revelável

```text
detalhes da história
características dos sintomas
antecedentes
medicações
alergias
sinais vitais
exame físico
laboratório
ECG
imagem
outros exames
```

### Oculto

```text
diagnóstico
fisiopatologia
gravidade verdadeira
complicações ocultas
trajetória futura
```

---

## 14. Presentation generation

A doença não vira diretamente um caso.

```text
DISEASE
   ↓
PRESENTATION POSSIBILITIES
   ↓
PATIENT GENERATOR
   ↓
1–3 INITIAL SYMPTOMS
   ↓
CLINICAL NARRATIVE
```

Exemplo:

```text
IAM
 ↓
dor torácica
dispneia
sudorese
náusea
síncope
dor epigástrica
...
 ↓
Patient Generator seleciona combinação coerente
 ↓
“Paciente com dor no peito associada a sudorese.”
```

Assim, uma mesma doença pode gerar diferentes encontros clínicos.

---

## 15. Clinical coherence

O gerador deve respeitar as relações da Knowledge Base.

```text
SELECT DISEASE
      ↓
READ MANIFESTATIONS
      ↓
READ PRESENTATION PATTERNS
      ↓
SELECT COHERENT SYMPTOMS
      ↓
SELECT COMPATIBLE ONSET
      ↓
SELECT COMPATIBLE CONTEXT
      ↓
GENERATE PATIENT
```

Não deve combinar sintomas aleatoriamente.

---

## 16. Separation of responsibilities

**Knowledge Base**

Define o que pode acontecer clinicamente.

**Possibility Engine**

Define quais apresentações são possíveis.

**Patient Generator**

Escolhe qual apresentação este paciente terá.

**Patient State**

Armazena o que é verdadeiro sobre este paciente.

**Clinical Interlocutor**

Controla o que é revelado ao médico em resposta às interações.

**Evaluation**

Avalia:

1. propedêutica
2. diagnóstico
3. tratamento

O Patient State não deve conter pontuação ou mecânica de jogo.

---

## 17. Implementation order

A implementação deve ser incremental:

```text
1. Patient presentation
        ↓
2. Patient State
        ↓
3. Clinical Interlocutor
        ↓
4. Investigations
        ↓
5. Propaedeutics evaluation
        ↓
6. Diagnosis evaluation
        ↓
7. Treatment evaluation
```

Primeiro, garantir que o paciente **chegue com uma queixa**.

Depois, permitir que o médico interrogue essa apresentação.

Depois, permitir exame físico e investigação.

Não é necessário redesenhar todo o Engine agora.

---

## 18. Core axiom

> **A doença determina o espaço clínico; o gerador determina a apresentação; o Patient State determina o que é verdadeiro; o Interlocutor determina o que pode ser revelado.**

> **O diagnóstico pode estar oculto. A queixa nunca deve estar ausente.**
