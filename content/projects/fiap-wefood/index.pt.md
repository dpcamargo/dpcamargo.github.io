+++
title = "WeFood"
author = "Dario Camargo"
date = "2026-09-25T00:00:00-03:00"
description = "API de gestão de restaurantes — backend Java hexagonal para uma plataforma de pedidos multi-restaurante"
stack = ["Java 21", "Spring Boot", "Spring Security", "Spring Data JPA", "MapStruct", "Docker"]
repo = "https://github.com/dpcamargo/fiap-wefood"
+++

Backend para uma plataforma de pedidos multi-restaurante, feito como trabalho de conclusão da pós-graduação em Arquitetura e Desenvolvimento Java na FIAP. Arquitetura Hexagonal (Clean Architecture) com camadas de domínio, casos de uso e adaptadores independentes, de forma que as regras de negócio não dependem do Spring nem do banco de dados.

- **Autenticação e autorização**: login via JWT, controle de acesso por papel (admin / dono de restaurante / cliente)
- **Persistência**: Spring Data JPA, roda contra PostgreSQL ou H2 via profiles do Docker Compose
- **Documentação da API**: Swagger/OpenAPI, além de uma collection do Postman para testes manuais
- **Testes**: JUnit 5 e Mockito
