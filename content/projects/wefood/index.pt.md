+++
title = "WeFood User Service"
author = "Dario Camargo"
date = "2026-09-25T00:00:00-03:00"
description = "Microsserviço Java hexagonal com isolamento estrito de frameworks, RBAC ciente de posse e testes com Testcontainers"
stack = ["Java 21", "Spring Boot 3", "Spring Security", "REST", "PostgreSQL", "Testcontainers", "Docker"]
repo = "https://github.com/dpcamargo/wefood-user-service-spring"
+++

Serviço de autenticação e gestão de usuários para uma plataforma multi-restaurante, estruturado sob os princípios estritos de Arquitetura Hexagonal (Ports & Adapters), mantendo o domínio e os casos de uso livres de dependências de framework.

- **Núcleo Independente de Framework**: Entidades de domínio e casos de uso dependem exclusivamente de interfaces puras em Java; Spring Security BCrypt e Spring Data JPA atuam como adaptadores intercambiáveis.
- **RBAC Ciente de Papéis e Posse de Recursos**: Controle granular distinguindo `ADMIN`, `RESTAURANT_OWNER` e `CUSTOMER`, assegurando restrições de propriedade do recurso e protegendo contra escalação indevida de privilégios.
- **Soft-Deletion Automatizado**: Implementado com filtros globais do Hibernate (`deletedFilter`) para omitir registros excluídos em consultas relacionais sem perda física dos dados.
- **Testes de Integração com Infraestrutura Real**: Validação de suíte com JUnit 5, Mockito e Testcontainers executando instâncias efêmeras de PostgreSQL.
