+++
date = "2026-10-08"
title = "Jev: Classification Model"
tags = ["ai", "til", "llm", "classification"]
+++

Today I learned about **Jev**, a model from [TypeSafe AI](https://typesafe.ai/) built to make typed, structured decisions *inside software*, instead of generating text.

### What is Jev?

Jev is TypeSafe's first **System One Model**, and the name comes from Kahneman's "System 1" thinking: fast, intuitive, gut-check judgments, as opposed to the slow, deliberate hallucination-filled garbage we get sometimes from general-purpose LLMs.

Not only is it fast, but also very cheap. And the output tokens are free.

We must pass Jev a **state** (some context: a support ticket, a document, a log line, anything), and a set of **typed questions** about that state. In return we get typed structured answers with calibrated probabilities and a confidence score. No text is generated, just a structured response that we can decode and use without hoping the response matches our desired schema.

There are three question primitives:

- **Choice** - pick one option from a defined list (e.g. which team should handle this ticket).
- **Score** - rate the state against an ordered rubric (e.g. how frustrated is this customer, from calm to furious).
- **Noul** - a yes/no question that returns the probability the answer is "yes" (e.g. is this urgent?).

### How to use it

A request is basically "here's some state, here are my questions":

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

The response comes back fully typed, with a probability per option and a confidence score:

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

### Applications

- **Routing**: which team/queue should this support ticket, email, or lead go to.
- **Content moderation / guardrails**: flag toxic, off-topic, or policy-violating content before it reaches a human or another model.
- **Scoring**: sentiment, urgency, lead quality, risk/fraud score — anything that slots into a threshold-based decision.
- **Extraction and tagging**: pull structured fields out of unstructured text at scale (map-reduce over large datasets).
- **Verifying LLM output**: use a cheap classifier to judge whether a bigger model's answer is safe/relevant/on-topic before you show it to a user — a judge in front of a judge.
- **"Smart if-statements"**: anywhere your code currently has a brittle hand-written rule that's really trying to approximate a fuzzy judgment, a small classifier can replace it and get recalibrated as data changes, instead of rewritten by hand.

The common thread: when correctness just needs to be "good enough and fast," and the output has to be consumed by code rather than read by a human, you don't need a frontier chat model — you need a classifier that returns a typed answer and a confidence you can threshold on.

### References

- [TypeSafe AI](https://typesafe.ai/)
- [Introducing System One Models & Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev)
- [TypeSafe Docs — Introduction](https://docs.typesafe.ai/introduction)
- [TypeSafe Docs — Quick start](https://docs.typesafe.ai/introduction/quickstart)
