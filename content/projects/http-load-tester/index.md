+++
title = "HTTP Load Tester CLI"
author = "Dario Camargo"
date = "2026-10-10T00:00:00-03:00"
description = "High-performance CLI benchmarking and load testing tool in Go using worker pools and structured reporting"

[params]
repo = "https://github.com/dpcamargo/http-load-tester-cli-go"
stack = ["go", "docker"]
+++

High-performance command-line HTTP benchmarking tool written in Go, designed to simulate concurrent HTTP traffic and evaluate service capacity under load.

### Key Architectural Features

- **Worker Pool Concurrency**: Configurable concurrent worker pools orchestrating HTTP request distribution without excessive goroutine churn
- **Execution Limits & Pacing**: Enforces concurrency caps, total request bounds, and timeout controls using Go's context primitives
- **CLI Interface**: Robust command-line parsing powered by Cobra with parameter validation and friendly help documentation
- **Real-Time & Aggregated Metrics**: Reports total execution time, throughput (requests/sec), status code distribution (200, 4xx, 5xx), and error breakdowns
- **Containerized Execution**: Multi-stage Alpine container build enabling zero-dependency portability and CI/CD testing integration
