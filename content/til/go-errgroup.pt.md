+++
date = "2025-06-03"
title = "Go: errgroup - WaitGroup com tratamento de erros"
tags = ["go", "til", "concurrency", "errgroup"]
+++

### Por que usar?

- Inicie goroutines com `g.Go()`, passando uma função que retorna um erro.
- Espere todas terminarem (e receba o primeiro erro, se houver) com `g.Wait()`.
- Não precisa chamar `Add()` nem gerenciar canais de erro por conta própria.

### Exemplo:

```go
package main

import (
    "fmt"
    "golang.org/x/sync/errgroup"
)

func main() {
    var g errgroup.Group

    for i := 1; i <= 3; i++ {
        id := i
        g.Go(func() error {
            fmt.Printf("Goroutine %d is running\n", id)
            return nil // return error if something fails
        })
    }

    if err := g.Wait(); err != nil {
        fmt.Println("Error:", err)
    } else {
        fmt.Println("All goroutines finished")
    }
}
```

### Resumo

- Sem boilerplate para adicionar/esperar.
- Tratamento de erros simples em tarefas concorrentes.

### Referência:

- [documentação do errgroup](https://pkg.go.dev/golang.org/x/sync/errgroup)
