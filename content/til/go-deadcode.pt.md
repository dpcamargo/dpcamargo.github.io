+++
date = '2025-06-23T16:56:40-03:00'
title = 'Go: Encontre código inalcançável com o Deadcode'
tags = ["go", "til", "tool"]
+++

Hoje eu aprendi a encontrar código inalcançável em um projeto Go usando a ferramenta [deadcode](https://pkg.go.dev/golang.org/x/tools/cmd/deadcode).

Instale o deadcode:

```sh
go install golang.org/x/tools/cmd/deadcode@latest
```

Execute o deadcode na sua base de código:

```sh
go tool deadcode ./...
```

Exemplo de saída:

```
example/foo.go:42:6: func unusedFunc
```

## Referências

[documentação do deadcode](https://pkg.go.dev/golang.org/x/tools/cmd/deadcode)
[Ferramentas oficiais do Go]
