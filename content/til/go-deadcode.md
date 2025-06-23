+++
date = '2025-06-23T16:56:40-03:00'
title = 'Go: Check for unreachable code with Deadcode'
tags = ["go", "til", "tool"]
+++

Today I learned how to find unreachable code in a Go project using the [deadcode](https://pkg.go.dev/golang.org/x/tools/cmd/deadcode) tool.

Install deadcode:

```sh
go install golang.org/x/tools/cmd/deadcode@latest
```

Run deadcode on your Codebase:

```sh
go tool deadcode ./...
```

Example output:

```
example/foo.go:42:6: func unusedFunc
```

## References

[deadcode documentation](https://pkg.go.dev/golang.org/x/tools/cmd/deadcode)
[Official Go tools]
