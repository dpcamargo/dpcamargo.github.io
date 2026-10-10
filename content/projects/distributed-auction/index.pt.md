+++
title = "Sistema de Leilão Distribuído"
author = "Dario Camargo"
date = "2026-10-10T00:00:00-03:00"
description = "Motor de leilões de alta concorrência em Go com ingestão de lances em lote, persistência em MongoDB e rotinas de expiração"

[params]
repo = "https://github.com/dpcamargo/distributed-auction-system-go"
stack = ["Go", "REST", "MongoDB", "Gin", "Zap", "Docker"]
+++

Motor de leilões de alta concorrência em Go, projetado para suportar alto volume de lances simultâneos com escrita em lote no MongoDB e gerenciamento de ciclo de vida com expiração automática.

### Destaques de Arquitetura

- **Ingestão de Lances em Lote**: Buffer de canais em memória com workers periódicos para diminuir contenção de I/O e round-trips ao MongoDB
- **Ciclo de Vida com Expiração Automática**: Rotinas assíncronas em background gerenciando o fechamento automático de leilões expirados
- **Validação de Domínio e Integridade**: Regras estritas de validação de valores de lance, conferência de usuário e transições seguras de estado
- **Arquitetura em Camadas**: Separação clara entre handlers, use cases e interfaces de repositório, facilitando testes e manutenção
- **Cobertura de Testes**: Suíte abrangente de testes unitários para os casos de uso de leilão e lances utilizando mocks e a suíte padrão de testes do Go
