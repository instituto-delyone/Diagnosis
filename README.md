# 🧠 Diagnosis Engine (AIGAR Engine)

**Instituto Delyone** | *Framework Computacional de Raciocínio Clínico Bayesiano Funcional*

O **Diagnosis** é um Sistema Especialista (Expert System) determinístico construído para traduzir o pensamento e a cognição médica humana em uma arquitetura de linguagem computacional universal. 

Através da meta-engenharia da linguagem, o sistema converte quadros clínicos, fatores de risco e regras *sine qua non* em matrizes matemáticas de probabilidade cruzada, permitindo simulação, auditoria e treinamento clínico sem o risco de "alucinações" comuns em IAs generativas convencionais.

---

## ⚙️ Arquitetura do Sistema

O projeto é estritamente dividido em duas camadas principais, garantindo máxima escalabilidade e segurança:

1. **O Motor Matemático (Simulador / Frontend):** Uma interface interativa em Vanilla JS que sorteia casos clínicos, processa a entrada do usuário (Natural Language Parsing simplificado) e calcula o *score* com base nos pesos bayesianos.
2. **A Base de Conhecimento (Knowledge Base):** O "córtex" do sistema. Um banco de dados descentralizado em arquivos JSON modulares, divididos por grandes áreas e síndromes clínicas.

### Estrutura de Diretórios

\`\`\`text
Diagnosis/
├── LICENSE                      # GNU General Public License v3.0
├── README.md                    # Documentação principal
│
└── docs/                        # Raiz de publicação (GitHub Pages)
    ├── diagnoses/
    │   └── index.html           # A "Arena de Testes" (Simulador Interativo)
    │
    └── knowledge_base/          # Banco de dados clínico descentralizado (Córtex)
        ├── sindromes_clinicas/  # Cápsulas JSON de Clínica Médica
        ├── cirurgia/            # Cápsulas JSON de Cirurgia Geral
        ├── go/                  # Cápsulas JSON de Ginecologia e Obstetrícia
        └── pediatria/           # Cápsulas JSON de Pediatria
\`\`\`

---

## 🧬 O Molde do Conhecimento (Schema JSON)

Cada patologia no motor é estruturada sob o modelo do **Bayesianismo Clínico Funcional**. A conversão do conhecimento médico para o motor AIGAR segue cinco campos estritos:

*   **01. Campo Modulador:** Fatores epidemiológicos e histórico que multiplicam a probabilidade basal pré-teste (ex: Idade, Comorbidades).
*   **02. Campo de Predição Inicial:** Sinais e sintomas de apresentação que somam pontos lógicos na árvore diagnóstica.
*   **03. Campo de Filtragem Probabilística:** Critérios de exclusão ativa ou fatores *sine qua non* (obrigatórios para a confirmação).
*   **04. Campo de Avaliação de Risco (T):** Nível de letalidade e necessidade de intervenção imediata para evitar atrasos terapêuticos.
*   **05. Campo de Confirmação Necessária:** Ferramentas tecnológicas ou exames complementares definitivos.

---

## 🚀 Como Executar Localmente

Como a aplicação faz o *fetch* (download assíncrono) dos arquivos JSON, ela não rodará corretamente se o arquivo `index.html` for aberto diretamente do seu disco local (devido às políticas de CORS dos navegadores).

Para rodar e testar:
1. Faça o clone do repositório: `git clone https://github.com/seu-usuario/Diagnosis.git`
2. Utilize uma extensão como o **Live Server** (no VS Code) ou suba um servidor Python simples:
   `python -m http.server 8000`
3. Acesse `http://localhost:8000/docs/diagnoses/` no seu navegador.

**Ambiente de Produção:** O projeto é compilado e hospedado automaticamente via **GitHub Pages**, com a raiz apontando estritamente para a pasta `/docs`.

---

## 📄 Licenciamento

Distribuído sob a licença **GNU General Public License v3.0**. 

Este projeto é protegido. O uso acadêmico e de pesquisa é incentivado para a consolidação de um padrão universal de comunicação de raciocínio clínico. A integração deste algoritmo em softwares proprietários comerciais de terceiros exige licenciamento específico (Enterprise/Premium) junto ao Instituto Delyone. Veja o arquivo `LICENSE` para mais detalhes.

---
*Desenvolvido por Instituto Delyone.*
