+++
title = "Clean Architecture Multitransporte"
author = "Dario Camargo"
date = "2026-09-25T00:00:00-03:00"
description = "Sistema de gestão de pedidos com core de negócio único exposto via REST, gRPC, GraphQL e RabbitMQ"
stack = ["Go", "gRPC", "GraphQL", "REST", "RabbitMQ", "MySQL", "Docker"]
repo = "https://github.com/dpcamargo/fullcycle-clean-architecture"
+++

Serviço de processamento de pedidos construído com princípios de Clean Architecture, desacoplando regras de negócio e casos de uso dos mecanismos de entrega. As mesmas ações de criação e consulta de pedidos são expostas simultaneamente em quatro interfaces distintas sem replicação de lógica:

- **API REST**: Endpoints HTTP tradicionais para registro e consulta de pedidos
- **gRPC**: Serviço Protobuf (`pb.OrderService`) para comunicação RPC de alta performance
- **GraphQL**: Interface orientada a grafo com queries e mutations tipadas
- **Mensageria**: Consumer RabbitMQ para processamento assíncrono de eventos de pedido
- **Persistência**: MySQL com migrações automatizadas, isolado por interfaces de repositório e orquestrado via Docker Compose
