+++
date = "2026-03-16"
title = "Go: O padrão de confinamento - Pare de usar Mutex para tudo"
tags = ["go", "til", "concurrency", "patterns"]
+++

Hoje eu aprendi sobre o **padrão de confinamento** em Go: em vez de proteger o estado compartilhado com um `sync.Mutex`, você atribui a posse do estado a uma única goroutine e se comunica por meio de canais.

### O problema de usar mutexes em todo lugar

Usar mutexes para estado compartilhado funciona, mas traz desvantagens:

- A contenção de locks reduz o paralelismo.
- Esquecer o `Unlock()` leva a deadlocks.
- Bugs sutis de condição de corrida aparecem sob concorrência.
- Raciocinar sobre a posse do estado fica mais difícil conforme os locks se espalham.

### O que é confinamento?

Confinamento significa que um pedaço de estado **só é acessível a partir de uma única goroutine**. Nenhuma outra goroutine pode tocá-lo diretamente, então não é preciso sincronização. Isso segue a filosofia do Go: *"Não se comunique compartilhando memória; compartilhe memória se comunicando."*

### Exemplo: Mutex vs Confinamento

**Antes** - estado compartilhado protegido por um mutex:

```go
counter := 0
var mu sync.Mutex

for i := 0; i < 3; i++ {
    go func() {
        mu.Lock()
        counter++
        mu.Unlock()
    }()
}
```

**Depois** - estado confinado a uma goroutine dona:

```go
increments := make(chan int)
read := make(chan chan int)

go func() {
    counter := 0 // confined state
    for {
        select {
        case v := <-increments:
            counter += v
        case response := <-read:
            response <- counter
        }
    }
}()

increments <- 1
increments <- 1
increments <- 1

response := make(chan int)
read <- response
fmt.Println("Final counter:", <-response)
```

### Por que funciona

- `counter` vive dentro da goroutine — nenhum outro código consegue acessá-lo.
- Toda a interação acontece por meio de canais.
- Sem mutex, sem condições de corrida, sem estado mutável compartilhado.

### Resumo

- A maioria dos bugs de concorrência vem do estado compartilhado, não do Go em si.
- O padrão de confinamento elimina os locks ao dar a cada pedaço de estado um único dono.
- O estado compartilhado mais seguro é aquele que não é compartilhado de jeito nenhum.

### Referência:

- [Go Tip #8: The Confinement Pattern](https://medium.com/@lenonrodrigues/go-tip-8-stop-using-mutex-for-everything-the-confinement-pattern-be75ff80be17)
- [Concurrency in Go - Katherine Cox-Buday (O'Reilly)](https://learning.oreilly.com/library/view/concurrency-in-go/9781491941294/)
