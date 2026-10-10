+++
title = "HTTP Load Tester CLI"
author = "Dario Camargo"
date = "2026-10-10T00:00:00-03:00"
description = "Ferramenta CLI de alta performance para testes de carga e benchmarking HTTP em Go com worker pools e relatórios estruturados"

[params]
repo = "https://github.com/dpcamargo/http-load-tester-cli-go"
stack = ["Go", "Cobra", "Zap", "Docker"]
+++

Ferramenta de linha de comando de alta performance para benchmarking e testes de carga HTTP desenvolvida em Go, projetada para simular tráfego concorrente e validar capacidade de serviços.

### Destaques de Arquitetura

- **Concorrência com Worker Pool**: Pool de workers concorrentes configurável que orquestra o disparo de requisições HTTP sem sobrecarga de goroutines
- **Controle de Execução e Limites**: Aplicação de limites de concorrência, volume total de requisições e timeouts usando primitivas de contexto do Go
- **Interface CLI**: Parser de linha de comando com Cobra, validação estrita de flags e documentação de ajuda integrada
- **Métricas Consolidadas**: Relatório com tempo total de execução, vazão (requisições por segundo), distribuição de códigos HTTP (200, 4xx, 5xx) e detalhamento de erros
- **Execução Containerizada**: Imagem Docker multi-stage baseada em Alpine para portabilidade imediata e integração com pipelines de CI/CD
