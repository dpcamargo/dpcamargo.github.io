+++
date = "2026-10-08"
title = "Jev: Modelo de Classificação"
tags = ["ai", "til", "llm", "classification"]
+++

Hoje eu aprendi sobre o **Jev**, um modelo da [TypeSafe AI](https://typesafe.ai/) feito para tomar decisões tipadas e estruturadas *dentro do software*, em vez de gerar texto.

### O que é o Jev?

O Jev é o primeiro **System One Model** da TypeSafe, e o nome vem do "Sistema 1" de pensamento do Kahneman: julgamentos rápidos, intuitivos, de resposta de barriga, em contraste com a lentidão deliberada e o lixo cheio de alucinação que a gente recebe às vezes de LLMs de propósito geral.

Além de rápido, é bem barato. E os tokens de saída são de graça.

A gente precisa passar ao Jev um **state** (algum contexto: um chamado de suporte, um documento, uma linha de log, qualquer coisa), e um conjunto de **perguntas tipadas** sobre esse contexto. Em troca recebemos respostas estruturadas e tipadas, com probabilidades calibradas e um nível de confiança. Nenhum texto é gerado, só uma resposta estruturada que a gente consegue decodificar e usar sem ficar na esperança de que a resposta bateu com o schema que a gente queria.

Existem três primitivas de pergunta:

- **Choice** - escolher uma opção de uma lista definida (ex.: qual time deve atender esse chamado).
- **Score** - avaliar o estado em uma régua ordenada (ex.: o quão frustrado está o cliente, de calmo a furioso).
- **Noul** - uma pergunta sim/não que retorna a probabilidade da resposta ser "sim" (ex.: isso é urgente?).

### Como usar

Uma requisição é basicamente "aqui está o estado, aqui estão minhas perguntas":

```bash
curl -X POST https://api.typesafe.ai/v1/systemone \
  -H "Authorization: Bearer $TYPESAFE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "state": "Hi, I'\''ve been trying to connect my Stripe account for 3 days and the integration keeps failing. I'\''m losing sales. Please help ASAP.",
    "model": "jev-latest",
    "questions": {
      "department": {
        "type": "choice",
        "instructions": "Which team should handle this",
        "criteria": {
          "billing": "Payment or subscription issues",
          "technical": "Bugs or integration problems",
          "sales": "Pricing or account questions"
        }
      },
      "is_urgent": {
        "type": "noul",
        "instructions": "The message conveys urgency or time-sensitivity"
      }
    }
  }'
```

A resposta vem totalmente tipada, com uma probabilidade por opção e um nível de confiança:

```json
{
  "answers": {
    "department": {
      "choice": "technical",
      "confidence": 0.78,
      "probabilities": { "technical": 0.85, "sales": 0.0, "billing": 0.15 }
    },
    "is_urgent": { "noul": 1.0 }
  }
}
```

### Aplicações

- **Roteamento**: para qual time/fila deve ir esse chamado de suporte, e-mail ou lead.
- **Moderação de conteúdo / guardrails**: sinalizar conteúdo tóxico, fora do tema ou que viola política antes de chegar a um humano ou a outro modelo.
- **Scoring**: sentimento, urgência, qualidade de lead, score de risco/fraude — qualquer coisa que entre numa decisão baseada em limiar.
- **Extração e marcação**: extrair campos estruturados de texto não estruturado em escala (map-reduce sobre grandes volumes de dados).
- **Verificação da saída de LLMs**: usar um classificador barato para julgar se a resposta de um modelo maior é segura/relevante/pertinente antes de mostrá-la ao usuário — um juiz na frente de outro juiz.
- **"Ifs inteligentes"**: em qualquer lugar onde seu código hoje tem uma regra escrita à mão e frágil que, na verdade, está tentando aproximar um julgamento nebuloso, um classificador pequeno pode substituí-la e ser recalibrado conforme os dados mudam, em vez de ser reescrito manualmente.

O fio condutor: quando a precisão só precisa ser "boa o suficiente e rápida", e a saída vai ser consumida por código em vez de lida por uma pessoa, você não precisa de um modelo de chat de ponta — precisa de um classificador que devolva uma resposta tipada e uma confiança sobre a qual você possa aplicar um limiar.

### Referências

- [TypeSafe AI](https://typesafe.ai/)
- [Introducing System One Models & Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev)
- [TypeSafe Docs — Introduction](https://docs.typesafe.ai/introduction)
- [TypeSafe Docs — Quick start](https://docs.typesafe.ai/introduction/quickstart)
