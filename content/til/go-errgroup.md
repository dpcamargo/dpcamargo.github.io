+++
date = "2025-06-03"
title = "Go Errgroup"
+++

"golang.org/x/sync/errgroup" lets you combine WaitGroup with error handling.

- g.Go() to start a go routine
- g.Wait() to wait for all go routines
- no need to wg.Add()

{{< highlight go >}}
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
            return nil // No error
        })
    }

    if err := g.Wait(); err != nil {
        fmt.Println("Error:", err)
    } else {
        fmt.Println("All goroutines finished")
    }

}
{{< /highlight >}}
