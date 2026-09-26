+++
title = "Tracing Distribuído com OTEL e Zipkin"
author = "Dario Camargo"
date = "2026-09-25T00:00:00-03:00"
description = "Arquitetura de microserviços em Go com propagação de contexto, rastreamento distribuído e métricas via OpenTelemetry, Zipkin e Prometheus"
stack = ["Go", "OpenTelemetry", "Zipkin", "Jaeger", "Prometheus", "Grafana", "Docker"]
repo = "https://github.com/dpcamargo/fullcycle-otel"
+++

Arquitetura de múltiplos serviços demonstrando observabilidade distribuída ponta a ponta em Go. O sistema recebe um CEP, valida a entrada, consulta localização e busca temperatura em tempo real, rastreando todo o fluxo de execução entre fronteiras de rede:

- **Serviço A (Ingestão e Validação)**: Valida dados de entrada (CEP com 8 dígitos) e propaga o contexto de rastreamento do OTEL via cabeçalhos HTTP
- **Serviço B (Orquestração e Integração)**: Integra com APIs externas (ViaCEP e WeatherAPI), converte temperaturas (Celsius, Fahrenheit, Kelvin) e cria spans customizados para cada chamada externa
- **Pipeline de Telemetria**: OpenTelemetry Collector exportando spans e métricas para Zipkin, Jaeger e Prometheus
- **Visualização**: Painéis no Grafana e rastreamento de traces no Zipkin/Jaeger, orquestrados via Docker Compose
