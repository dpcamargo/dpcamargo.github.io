+++
title = "Clean Architecture Multitransport"
author = "Dario Camargo"
date = "2026-09-25T00:00:00-03:00"
description = "Order management system sharing a single business core exposed via REST, gRPC, GraphQL, and RabbitMQ"
stack = ["Go", "gRPC", "GraphQL", "REST", "RabbitMQ", "MySQL", "Docker"]
repo = "https://github.com/dpcamargo/fullcycle-clean-architecture"
+++

Order processing service built with Clean Architecture, decoupling core domain logic and use cases from delivery mechanisms. The exact same business actions (creating and listing orders) run simultaneously across four distinct transport protocols without duplication:

- **REST API**: HTTP endpoints for order creation and querying
- **gRPC**: Protobuf service (`pb.OrderService`) for high-throughput RPC communication
- **GraphQL**: Graph query interface with schema-driven queries and mutations
- **Message Broker**: RabbitMQ consumer processing order events asynchronously
- **Persistence**: MySQL with schema migrations, isolated via repository interfaces and run via Docker Compose
