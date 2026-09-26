+++
title = "High-Throughput Go Rate Limiter"
author = "Dario Camargo"
date = "2026-09-25T00:00:00-03:00"
description = "Configurable HTTP middleware rate limiter in Go supporting IP and Token strategies with Redis persistence"
stack = ["Go", "Redis", "Docker", "Middleware", "Strategy Pattern"]
repo = "https://github.com/dpcamargo/fullcycle-rate-limiter"
+++

HTTP middleware designed to protect web services against traffic spikes and abuse. Implements rate limiting based on client IP addresses or custom access tokens with independent limits and block windows:

- **Dual Limiting Strategy**: Controls requests per second per IP, with prioritized token-based overrides (via `API_KEY` header)
- **Strategy Pattern Architecture**: Decouples rate-limiting evaluation and storage from the HTTP middleware layer, allowing seamless swapping of Redis for other backends
- **Configurable Thresholds**: Independent request limits and cooldown/block durations driven by environment variables
- **Standard Protocol Compliance**: Returns HTTP 429 (`Too Many Requests`) with clear messaging upon exceeding configured limits
- **Reproducible Setup**: Includes automated unit/integration tests and Docker Compose for the application and Redis server
