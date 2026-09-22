+++
date = '2025-06-04T11:38:23-03:00'
title = "Go: Ordene structs com slices.SortFunc e cmp.Compare"
tags = ["go", "til", "cmp", "slices", "sorting"]
+++

Você pode ordenar slices de structs com facilidade no Go 1.21+ usando os pacotes genéricos `slices` e `cmp`.

### Como o `cmp.Compare` funciona

<p>

`cmp.Compare(a, b)` retorna:

``` t
- `-1` if `a < b`
- `0` if `a == b`
- `1` if `a > b`
```

É perfeito para escrever comparadores personalizados concisos em funções de ordenação.

### Exemplo: Ordenando structs

```go
import (
    "cmp"
    "slices"
)

type Book struct {
    Title string
    Year  int
}

books := []Book{
    {"The Go Programming Language", 2015},
    {"Learning Go", 2021},
    {"Introducing Go", 2016},
}

// Sort books by Year (ascending)
slices.SortFunc(books, func(a, b Book) int {
    return cmp.Compare(a.Year, b.Year)
})

// Sort books by Title (ascending)
slices.SortFunc(books, func(a, b Book) int {
    return cmp.Compare(a.Title, b.Title)
})
```

Não precisa implementar sort.Interface nem gerenciar a lógica de índices manualmente — é só usar generics!

### Referências:

- [documentação do cmp](https://pkg.go.dev/cmp)
- [documentação do slices](https://pkg.go.dev/slices)
