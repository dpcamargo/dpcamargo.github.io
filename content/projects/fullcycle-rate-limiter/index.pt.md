+++
title = "Rate Limiter em Go com Redis"
author = "Dario Camargo"
date = "2026-09-25T00:00:00-03:00"
description = "Middleware HTTP configurável em Go para controle de taxa por IP e Token com persistência no Redis"
stack = ["Go", "Redis", "Docker", "Middleware", "Strategy Pattern"]
repo = "https://github.com/dpcamargo/fullcycle-rate-limiter"
+++

Middleware HTTP projetado para proteção de serviços web contra sobrecarga e abuso de requisições. Implementa limitação de taxa por endereço IP ou token de acesso com limites e tempos de bloqueio independentes:

- **Estratégia Dupla de Limitação**: Restringe requisições por segundo por IP, com regras prioritárias para tokens customizados (via header `API_KEY`)
- **Padrão Strategy**: Desacopla regras de contagem e verificação da camada de transporte HTTP, permitindo substituir o Redis por outro mecanismo de persistência
- **Configuração Flexível**: Limites de requisições e períodos de expiração/bloqueio controlados via variáveis de ambiente
- **Conformidade HTTP**: Responde com status HTTP 429 (`Too Many Requests`) informando o esgotamento da cota de requisições
- **Ambiente Isolado**: Acompanha testes automatizados e orquestração do serviço com Redis via Docker Compose
