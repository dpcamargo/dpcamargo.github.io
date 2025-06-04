+++
date = "2025-06-03"
title = "Go: errgroup - WaitGroup with error handling"
tags = ["go", "til", "concurrency", "errgroup"]
+++

### Why use it?

- Start goroutines with `g.Go()`, passing a function that returns an error.
- Wait for all to finish (and get the first error, if any) with `g.Wait()`.
- No need to call `Add()` or manage error channels yourself.

### Example:

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

### Summary

- No boilerplate for adding/waiting.
- Easy error handling from concurrent tasks.

### Reference:

- [errgroup docs](https://pkg.go.dev/golang.org/x/sync/errgroup)
