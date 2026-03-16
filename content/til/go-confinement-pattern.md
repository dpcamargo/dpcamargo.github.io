+++
date = "2026-03-16"
title = "Go: The Confinement Pattern - Stop Using Mutex for Everything"
tags = ["go", "til", "concurrency", "patterns"]
+++

Today I learned about the **confinement pattern** in Go: instead of protecting shared state with a `sync.Mutex`, you give ownership of the state to a single goroutine and communicate through channels.

### The problem with mutexes everywhere

Using mutexes for shared state works, but comes with downsides:

- Lock contention reduces parallelism.
- Forgetting `Unlock()` leads to deadlocks.
- Subtle race bugs appear under concurrency.
- Reasoning about state ownership becomes harder as locks spread.

### What is confinement?

Confinement means a piece of state is **only ever accessible from one goroutine**. No other goroutine can touch it directly, so no synchronization is needed. This follows Go's philosophy: *"Do not communicate by sharing memory; share memory by communicating."*

### Example: Mutex vs Confinement

**Before** - shared state protected by a mutex:

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

**After** - state confined to an owner goroutine:

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

### Why it works

- `counter` lives inside the goroutine — no other code can access it.
- All interaction happens through channels.
- No mutex, no race conditions, no shared mutable state.

### Summary

- Most concurrency bugs come from shared state, not from Go itself.
- The confinement pattern eliminates locks by giving each piece of state a single owner.
- The safest shared state is the state that isn't shared at all.

### Reference:

- [Go Tip #8: The Confinement Pattern](https://medium.com/@lenonrodrigues/go-tip-8-stop-using-mutex-for-everything-the-confinement-pattern-be75ff80be17)
- [Concurrency in Go - Katherine Cox-Buday (O'Reilly)](https://learning.oreilly.com/library/view/concurrency-in-go/9781491941294/)
