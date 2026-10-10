+++
title = "Distributed Auction System"
author = "Dario Camargo"
date = "2026-10-10T00:00:00-03:00"
description = "High-concurrency auction engine in Go with batched bid ingestion, MongoDB persistence, and background expiration routines"

[params]
repo = "https://github.com/dpcamargo/distributed-auction-system-go"
stack = ["Go", "REST", "MongoDB", "Gin", "Zap", "Docker"]
+++

High-concurrency auction engine written in Go, architected to ingest large volumes of competitive bids, batch writes efficiently to MongoDB, and manage time-delimited auction lifecycles.

### Key Architectural Features

- **Batched Bid Ingestion**: In-memory channel buffering with batch flusher workers to reduce write contention and MongoDB round-trips under high load
- **Automated Lifecycle Expiration**: Background goroutine routines managing auction states and automatic closures upon timeout expiration
- **Domain Validation & Integrity**: Strict bid value validation, user verification, and concurrency-safe status transitions
- **Layered Architecture**: Decoupled handlers, use cases, and repository interfaces ensuring testability and separation of concerns
- **Automated Unit Testing**: Complete test coverage across auction and bid use cases using Go standard test suite and mocks
