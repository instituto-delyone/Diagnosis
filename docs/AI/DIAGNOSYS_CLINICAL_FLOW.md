# Diagnosys — Fluxo Clínico Conversacional

## Princípio

O caso é pesquisado e construído antes da conversa. A verdade clínica permanece no Engine; o Gemini verbaliza e ajuda na comunicação, mas não cria a realidade clínica.

## Sequência

1. Preparação: pesquisa nas fontes configuradas (MSD/PCDT) e construção do caso.
2. Validação: sintomas, história, exame físico, investigações e manejo precisam existir na verdade interna.
3. Abertura: o sistema pergunta **“Doutor, qual é a sua primeira hipótese diagnóstica?”**
4. Diagnóstico sindrômico: até 3 tentativas, com feedback imediato.
5. Diagnóstico etiológico: até 3 tentativas, liberado após a etapa sindrômica quando configurada.
6. Anamnese: perguntas ao paciente, preferencialmente curtas e naturais; respostas binárias quando a informação é binária.
7. Investigações: o Engine revela apenas resultados previamente construídos quando solicitados.
8. Monitorização: ao solicitar monitorização, os marcadores vitais ficam ativos e o Engine avalia alertas configurados.
9. Tratamento: só é liberado após o diagnóstico etiológico. Em casos de emergência, a primeira conduta terapêutica pode ser avaliada como estabilização.
10. Após uma conduta terapêutica, a pesquisa clínica pode ser chamada novamente e o caso pode ser encerrado conforme as regras do cenário.

## Monitorização e choque

O alerta de PAM <65 mmHg é implementado como **alerta de hipotensão grave/hipoperfusão**, não como diagnóstico automático de choque. Isso evita transformar um único número em diagnóstico clínico; o choque depende do contexto e de evidências de hipoperfusão. O Manual MSD descreve PAM <65 mmHg como hipotensão comum em choque e ressalta que choque é um estado de hipoperfusão. 

## Pesquisa

O Ministério da Saúde descreve os PCDT como documentos que estabelecem critérios de diagnóstico, tratamento, monitoramento e acompanhamento. O Manual MSD é usado como fonte profissional complementar. A pesquisa é feita antes da apresentação do caso; a etapa terapêutica pode disparar nova pesquisa.

## Gemini

O Engine fornece ao Gemini:
- identidade demográfica do paciente;
- apresentação;
- história;
- caracterização dos sintomas;
- exame físico;
- resultados já revelados;
- estado de monitorização;
- histórico recente da conversa.

O Gemini deve responder como paciente quando o canal for conversacional e nunca alterar a verdade clínica.

## Nota de implementação

A etapa de pesquisa atualmente depende dos providers configurados no repositório. O catálogo PCDT/MSD e as regras de pesquisa já existem, mas uma pesquisa externa de texto integral deve continuar sendo tratada como uma camada separada da verdade clínica.
