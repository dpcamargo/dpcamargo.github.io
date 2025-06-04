+++
date = '2025-06-04T11:38:23-03:00'
title = "Go: Sort structs with slices.SortFunc and cmp.Compare"
tags = ["go", "til", "cmp", "slices", "sorting"]
+++

You can easily sort slices of structs in Go 1.21+ using the generic packages `slices` and `cmp`.

### How `cmp.Compare` works

<p>

`cmp.Compare(a, b)` returns:

``` t
- `-1` if `a < b`
- `0` if `a == b`
- `1` if `a > b`
```

It's perfect for concise custom comparators in sorting functions.

### Example: Sorting structs

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

No need to implement sort.Interface or manage index logic manually—just use generics!

### References:

- [cmp docs](https://pkg.go.dev/cmp)
- [slices docs](https://pkg.go.dev/slices)
