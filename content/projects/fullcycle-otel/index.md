+++
title = "Distributed Tracing with OTEL & Zipkin"
author = "Dario Camargo"
date = "2026-09-25T00:00:00-03:00"
description = "Microservices architecture in Go with context propagation, distributed tracing, and metrics via OpenTelemetry, Zipkin, and Prometheus"
stack = ["Go", "OpenTelemetry", "Zipkin", "Jaeger", "Prometheus", "Grafana", "Docker"]
repo = "https://github.com/dpcamargo/fullcycle-otel"
+++

Multi-service architecture illustrating end-to-end distributed observability in Go. The system receives a Brazilian postal code (CEP), validates it, resolves geographic location, and queries real-time weather metrics, tracking the entire execution flow across network boundaries:

- **Service A (Ingestion & Validation)**: Validates incoming request payloads (8-digit postal codes) and propagates OTEL trace context over HTTP
- **Service B (Orchestration & Transformation)**: Consumes external APIs (ViaCEP and WeatherAPI), converts temperatures (Celsius, Fahrenheit, Kelvin), and instruments granular spans for external HTTP calls
- **Telemetry Pipeline**: OpenTelemetry Collector exporting spans and metrics to Zipkin, Jaeger, and Prometheus
- **Visualization**: Grafana dashboards for metrics and trace timeline inspection, fully orchestrated via Docker Compose
